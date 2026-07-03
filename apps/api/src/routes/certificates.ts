import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";

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
          brandName:    c.campaign.org.brandName ?? c.campaign.companyName,
          logoUrl:      c.campaign.org.logoUrl ?? null,
          primaryColor: c.campaign.org.primaryColor ?? "#5B5BD6",
          score:        c.score,
          rank:         c.rank,
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
        select: { orgId: true },
      });
      if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

      const member = await prisma.orgMember.findFirst({ where: { orgId: campaign.orgId, userId } });
      if (!member) { res.status(403).json({ error: "Not authorised" }); return; }

      const candidates = await prisma.campaignCandidate.findMany({
        where: { campaignId },
        include: { submission: { select: { scoreTotal: true, status: true } } },
      });

      const eligible = candidates
        .filter((c) => c.submission?.status === "REVIEWED" && (c.submission.scoreTotal ?? 0) >= minScore)
        .sort((a, b) => (b.submission?.scoreTotal ?? 0) - (a.submission?.scoreTotal ?? 0));

      let issued = 0;
      for (let i = 0; i < eligible.length; i++) {
        const c = eligible[i];
        await prisma.certificate.upsert({
          where: { userId_campaignId: { userId: c.userId, campaignId } },
          create: { userId: c.userId, campaignId, score: c.submission?.scoreTotal ?? 0, rank: i + 1 },
          update: { score: c.submission?.scoreTotal ?? 0, rank: i + 1 },
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
 * GET /certificates/:id  (PUBLIC)
 * Declared LAST — catches any id that didn't match a specific route above.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const cert = await prisma.certificate.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { githubUsername: true } },
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
        githubUsername: cert.user.githubUsername ?? "Participant",
        campaignName:   cert.campaign.roleName,
        companyName:    cert.campaign.companyName,
        score:          cert.score,
        rank:           cert.rank,
        issuedAt:       cert.issuedAt,
        branding: {
          logoUrl:      cert.campaign.org.logoUrl      ?? null,
          primaryColor: cert.campaign.org.primaryColor ?? "#5B5BD6",
          accentColor:  cert.campaign.org.accentColor  ?? "#E8762B",
          brandName:    cert.campaign.org.brandName    ?? cert.campaign.companyName,
        },
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load certificate" });
  }
});

export default router;
