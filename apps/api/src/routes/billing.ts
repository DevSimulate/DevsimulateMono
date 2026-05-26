import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";

const router = Router();

type StripeClient = InstanceType<typeof Stripe>;
type StripeEvent = ReturnType<StripeClient["webhooks"]["constructEvent"]>;

type CheckoutSessionObject = {
  metadata?: { userId?: string } | null;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
};

type SubscriptionObject = {
  customer: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
};

function getStripe(): StripeClient {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

/**
 * POST /billing/create-checkout-session
 * Creates a Stripe checkout session for the Pro plan.
 */
router.post(
  "/create-checkout-session",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;

    try {
      const stripe = getStripe();
      const priceId = process.env.STRIPE_PRO_PRICE_ID;
      if (!priceId) {
        res.status(500).json({ error: "STRIPE_PRO_PRICE_ID is not configured" });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: user.email ?? undefined,
        metadata: { userId },
        success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
        cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      });

      res.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create checkout session";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /billing/portal
 * Creates a Stripe customer portal session.
 */
router.post(
  "/portal",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;

    try {
      const stripe = getStripe();
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        res.status(404).json({ error: "No active subscription found" });
        return;
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL}/dashboard`,
      });

      res.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create portal session";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /billing/webhook
 * Receives Stripe webhook events. No auth — Stripe signs the request.
 */
router.post(
  "/webhook",
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET is not configured" });
      return;
    }

    let event: StripeEvent;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.rawBody ?? Buffer.alloc(0), sig, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Webhook signature failed";
      console.error("[billing/webhook] Signature error:", message);
      res.status(400).json({ error: message });
      return;
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as CheckoutSessionObject;
        const userId = session.metadata?.userId;
        if (!userId || !session.customer) return;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer.id;

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null);

        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { subscriptionTier: "PRO" },
          }),
          prisma.subscription.upsert({
            where: { userId },
            create: { userId, stripeCustomerId: customerId, stripeSubscriptionId: subId, tier: "PRO" },
            update: { stripeCustomerId: customerId, stripeSubscriptionId: subId, tier: "PRO" },
          }),
        ]);

        console.log(`[billing] User ${userId} upgraded to PRO`);
      }

      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object as unknown as SubscriptionObject;
        const record = await prisma.subscription.findUnique({
          where: { stripeCustomerId: sub.customer },
        });
        if (record) {
          await prisma.$transaction([
            prisma.user.update({
              where: { id: record.userId },
              data: { subscriptionTier: "FREE" },
            }),
            prisma.subscription.update({
              where: { id: record.id },
              data: { tier: "FREE", stripeSubscriptionId: null },
            }),
          ]);
          console.log(`[billing] User ${record.userId} downgraded to FREE`);
        }
      }

      if (event.type === "customer.subscription.updated") {
        const sub = event.data.object as unknown as SubscriptionObject;
        const record = await prisma.subscription.findUnique({
          where: { stripeCustomerId: sub.customer },
        });
        if (record) {
          await prisma.subscription.update({
            where: { id: record.id },
            data: {
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
          });
        }
      }
    } catch (err) {
      console.error("[billing/webhook] Processing error:", err);
    }

    res.status(200).json({ received: true });
  }
);

/**
 * GET /billing/status
 * Returns current subscription status for the authenticated user.
 */
router.get(
  "/status",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        data: {
          tier: user.subscriptionTier,
          currentPeriodEnd: user.subscription?.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd ?? false,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch billing status";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
