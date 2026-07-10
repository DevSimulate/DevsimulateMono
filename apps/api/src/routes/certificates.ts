import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";
import { categoryForStack } from "../lib/devfest-categories";

const router = Router();

/**
 * GET /certificates/mine  (AUTH)
 * Must be declared BEFORE /:id so Express doesn't treat "mine" as an id.
 */
router.get(
  "/mine",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    try {
      const certs = await prisma.certificate.findMany({
        where: { userId },
        include: {
          campaign: {
            select: {
              roleName: true,
              companyName: true,
              org: { select: { logoUrl: true, primaryColor: true, brandName: true } },
            },
          },
        },
        orderBy: { issuedAt: "desc" },
      });

      res.json({
        data: certs.map((c) => ({
          id:           c.id,
          campaignName: c.campaign.roleName,
          companyName:  c.campaign.companyName,
          brandName:    c.campaign.org.brandName || c.campaign.companyName,
          logoUrl:      c.campaign.org.logoUrl ?? null,
          primaryColor: c.campaign.org.primaryColor ?? "#5B5BD6",
          score:        c.score,
          rank:         c.rank,
          category:     c.category,
          issuedAt:     c.issuedAt,
        })),
      });
    } catch {
      res.status(500).json({ error: "Failed to load certificates" });
    }
  }
);

/**
 * POST /certificates/employer/campaigns/:campaignId/certificates  (AUTH — employer)
 * Issues certificates to all reviewed candidates in the campaign.
 * Safe to call multiple times — upserts, will not duplicate.
 */
router.post(
  "/employer/campaigns/:campaignId/certificates",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    const { campaignId } = req.params;
    const { minScore = 0 } = req.body as { minScore?: number };

    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { orgId: true, codebaseId: true },
      });
      if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

      const member = await prisma.orgMember.findFirst({ where: { orgId: campaign.orgId, userId } });
      if (!member) { res.status(403).json({ error: "Not authorised" }); return; }

      const candidates = await prisma.campaignCandidate.findMany({
        where: { campaignId },
        select: { userId: true },
      });

      // CampaignCandidate.submissionId is not always set (submissions are linked by
      // userId + codebase, not by a FK). Mirror the same lookup the results page uses.
      const withScores = await Promise.all(
        candidates.map(async (c) => {
          const sub = await prisma.submission.findFirst({
            where: {
              userId: c.userId,
              status: "REVIEWED", finalized: true,
              ticket: { codebaseId: campaign.codebaseId },
            },
            orderBy: { scoreTotal: "desc" },
            select: { scoreTotal: true },
          });
          return { userId: c.userId, scoreTotal: sub?.scoreTotal ?? null };
        })
      );

      const eligible = withScores
        .filter((c) => c.scoreTotal != null && (c.scoreTotal ?? 0) >= minScore)
        .sort((a, b) => (b.scoreTotal ?? 0) - (a.scoreTotal ?? 0));

      let issued = 0;
      for (let i = 0; i < eligible.length; i++) {
        const c = eligible[i];
        await prisma.certificate.upsert({
          where: { userId_campaignId: { userId: c.userId, campaignId } },
          create: { userId: c.userId, campaignId, score: c.scoreTotal ?? 0, rank: i + 1 },
          update: { score: c.scoreTotal ?? 0, rank: i + 1 },
        });
        issued++;
      }

      res.json({ data: { issued } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to issue certificates";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /certificates/devfest/:tag/certificates  (AUTH — employer)
 * Issues certificates for a whole DevFest, ranked by LEADERBOARD CATEGORY
 * (Frontend / Backend / DevOps · Infra / System Design) rather than per stack or
 * per campaign. Candidates across every campaign sharing the tag are pooled into
 * their category and ranked together — matching the DevFest leaderboard.
 * Idempotent (upserts).
 */
router.post(
  "/devfest/:tag/certificates",
  requireAuth as (req: Request, res: Response, next: () => void) => void,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    const { tag } = req.params;
    const { minScore = 0 } = req.body as { minScore?: number };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const campaigns: any[] = await (prisma.campaign.findMany as any)({
        where: { devFestTag: tag },
        include: { candidates: { select: { userId: true } } },
      });
      if (campaigns.length === 0) { res.status(404).json({ error: "DevFest not found" }); return; }

      // The caller must belong to the org running this DevFest.
      const member = await prisma.orgMember.findFirst({ where: { orgId: campaigns[0].orgId, userId } });
      if (!member) { res.status(403).json({ error: "Not authorised" }); return; }

      // Pool every candidate into their leaderboard category with their score.
      type Entry = { userId: string; campaignId: string; score: number };
      const byCategory: Record<string, Entry[]> = {};

      for (const campaign of campaigns) {
        const firstTicket = await prisma.ticket.findFirst({
          where: { codebaseId: campaign.codebaseId },
          select: { stack: true },
        });
        const category = categoryForStack(firstTicket?.stack).name;

        for (const c of campaign.candidates) {
          const sub = await prisma.submission.findFirst({
            where: {
              userId: c.userId,
              status: "REVIEWED", finalized: true,
              ticket: { codebaseId: campaign.codebaseId },
            },
            orderBy: { scoreTotal: "desc" },
            select: { scoreTotal: true },
          });
          if (sub?.scoreTotal != null && sub.scoreTotal >= minScore) {
            (byCategory[category] ??= []).push({
              userId: c.userId,
              campaignId: campaign.id,
              score: sub.scoreTotal,
            });
          }
        }
      }

      // Rank within each category and issue.
      let issued = 0;
      const perCategory: Record<string, number> = {};
      for (const [category, entries] of Object.entries(byCategory)) {
        entries.sort((a, b) => b.score - a.score);
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          await prisma.certificate.upsert({
            where: { userId_campaignId: { userId: e.userId, campaignId: e.campaignId } },
            create: { userId: e.userId, campaignId: e.campaignId, score: e.score, rank: i + 1, category },
            update: { score: e.score, rank: i + 1, category },
          });
          issued++;
        }
        perCategory[category] = entries.length;
      }

      res.json({ data: { issued, byCategory: perCategory } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to issue DevFest certificates";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /certificates/:id  (PUBLIC)
 * Declared LAST — catches any id that didn't match a specific route above.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const cert = await prisma.certificate.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { githubUsername: true, fullName: true } },
        campaign: {
          include: {
            org: { select: { logoUrl: true, primaryColor: true, accentColor: true, brandName: true } },
          },
        },
      },
    });

    if (!cert) { res.status(404).json({ error: "Certificate not found" }); return; }

    res.json({
      data: {
        id:             cert.id,
        recipientName:  cert.user.fullName || cert.user.githubUsername || "Participant",
        githubUsername: cert.user.githubUsername ?? "Participant",
        campaignName:   cert.campaign.roleName,
        companyName:    cert.campaign.companyName,
        score:          cert.score,
        rank:           cert.rank,
        category:       cert.category,
        issuedAt:       cert.issuedAt,
        branding: {
          logoUrl:      cert.campaign.org.logoUrl      || null,
          primaryColor: cert.campaign.org.primaryColor || "#5B5BD6",
          accentColor:  cert.campaign.org.accentColor  || "#E8762B",
          brandName:    cert.campaign.org.brandName    || cert.campaign.companyName,
        },
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load certificate" });
  }
});

export default router;
