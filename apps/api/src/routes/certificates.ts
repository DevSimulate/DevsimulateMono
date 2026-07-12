import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";
import { categoryForStack } from "../lib/devfest-categories";
import { campaignSubmissionScope } from "../lib/campaign-scope";

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
        select: { orgId: true, codebaseId: true, ticketIds: true },
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
              ...campaignSubmissionScope(campaign),
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

      // Resolve stacks and submissions in batch (mirrors the leaderboard so
      // certificates and the public board never disagree).
      const codebaseIds = [...new Set(campaigns.map((c) => c.codebaseId as string))];
      const stackTickets = await prisma.ticket.findMany({
        where: { codebaseId: { in: codebaseIds } },
        select: { codebaseId: true, stack: true },
      });
      const stackByCodebase = new Map<string, string>();
      for (const t of stackTickets) {
        if (!stackByCodebase.has(t.codebaseId)) stackByCodebase.set(t.codebaseId, t.stack.toString());
      }

      const allUserIds = [
        ...new Set(campaigns.flatMap((c) => c.candidates.map((cd: { userId: string }) => cd.userId))),
      ];
      const allSubs = allUserIds.length
        ? await prisma.submission.findMany({
            where: { userId: { in: allUserIds }, status: "REVIEWED", finalized: true },
            select: {
              userId: true, ticketId: true, submittedAt: true, scoreTotal: true,
              ticket: { select: { codebaseId: true } },
            },
          })
        : [];
      const subsByUser = new Map<string, typeof allSubs>();
      for (const s of allSubs) {
        const list = subsByUser.get(s.userId) ?? [];
        list.push(s);
        subsByUser.set(s.userId, list);
      }

      // One best entry per user across the event — deadline-respecting and
      // de-duplicated so nobody gets two certificates.
      type Entry = { userId: string; campaignId: string; score: number; category: string };
      const bestByUser = new Map<string, Entry>();

      for (const campaign of campaigns) {
        const category = categoryForStack(stackByCodebase.get(campaign.codebaseId)).name;
        const ticketIds: string[] = campaign.ticketIds ?? [];
        const campDeadline = campaign.deadline as Date | null;

        for (const c of campaign.candidates) {
          const subs = subsByUser.get(c.userId) ?? [];
          const eligible = subs.filter((s) => {
            if (s.scoreTotal == null) return false;
            const inScope = ticketIds.length
              ? ticketIds.includes(s.ticketId)
              : s.ticket?.codebaseId === campaign.codebaseId;
            if (!inScope) return false;
            if (campDeadline && s.submittedAt > campDeadline) return false; // late submissions don't rank
            return true;
          });
          if (eligible.length === 0) continue;

          const best = eligible.reduce((a, b) => ((b.scoreTotal ?? 0) > (a.scoreTotal ?? 0) ? b : a));
          if ((best.scoreTotal ?? 0) < minScore) continue;

          const entry: Entry = {
            userId: c.userId, campaignId: campaign.id,
            score: best.scoreTotal ?? 0, category,
          };
          const existing = bestByUser.get(c.userId);
          if (!existing || entry.score > existing.score) bestByUser.set(c.userId, entry);
        }
      }

      // Regroup the de-duplicated entries by category.
      const byCategory: Record<string, Entry[]> = {};
      for (const entry of bestByUser.values()) {
        (byCategory[entry.category] ??= []).push(entry);
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
