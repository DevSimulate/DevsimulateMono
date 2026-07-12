import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";
import { OrgRole, CampaignStatus, CandidateStatus } from "@prisma/client";
import { campaignSubmissionScope } from "../lib/campaign-scope";

const router = Router();
router.use(requireAuth as (req: Request, res: Response, next: () => void) => void);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrgId(userId: string): Promise<string | null> {
  const m = await prisma.orgMember.findFirst({ where: { userId }, orderBy: { joinedAt: "asc" } });
  return m?.orgId ?? null;
}

async function getRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const m = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
  return m?.role ?? null;
}

const toAuth = (risk: number) => Math.max(0, Math.min(100, 100 - risk));
const band = (a: number) => (a >= 70 ? "HIGH" : a >= 40 ? "MEDIUM" : "LOW");
// Advisory only. AI use is allowed, and paste counts are trivially bypassable and
// over-flag honest candidates — so they no longer gate. A flag means "verification
// concern worth a human look," not "auto-reject."
function flagged(auth: number, mismatch: boolean): boolean {
  return mismatch || auth < 40;
}
// Judgment (the score, which now includes the Verification dimension) drives the verdict.
// A flag never auto-rejects — it routes the candidate to human review by capping at MAYBE.
function verdict(total: number, auth: number, flag: boolean): string {
  if (total < 50) return "NO";
  if (!flag && total > 80 && auth > 80) return "STRONG_YES";
  if (!flag && total > 70 && auth > 65) return "YES";
  if (total > 60) return "MAYBE";
  return "NO";
}

// ─── Dashboard summary ───────────────────────────────────────────────────────

/**
 * GET /employer/dashboard-summary
 * Real campaign-driven stats + recent campaigns + recent scored candidates.
 */
router.get("/dashboard-summary", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) {
      res.json({ data: { stats: { activeCampaigns: 0, totalAssessed: 0, totalShortlisted: 0, avgScore: 0 }, campaigns: [], recent: [] } });
      return;
    }

    const [activeCampaigns, campaigns] = await Promise.all([
      prisma.campaign.count({ where: { orgId, status: CampaignStatus.ACTIVE } }),
      prisma.campaign.findMany({
        where: { orgId },
        include: { codebase: { select: { name: true } }, _count: { select: { candidates: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // All candidates across the org's campaigns
    const candidates = await prisma.campaignCandidate.findMany({
      where: { campaign: { orgId } },
      include: {
        user: { select: { githubUsername: true } },
        campaign: { select: { roleName: true, codebaseId: true, ticketIds: true } },
      },
      orderBy: { joinedAt: "desc" },
    });

    let assessed = 0;
    let scoreSum = 0;
    const shortlisted = candidates.filter((c) => c.status === CandidateStatus.SHORTLISTED).length;
    const recent: Array<{ id: string; githubUsername: string; roleName: string; score: number; verdict: string; band: string; submittedAt: string }> = [];

    for (const c of candidates) {
      const sub = await prisma.submission.findFirst({
        where: { userId: c.userId, status: "REVIEWED", finalized: true, ...campaignSubmissionScope(c.campaign) },
        orderBy: { scoreTotal: "desc" },
        include: { followUp: { select: { declarationMismatch: true } } },
      });
      if (!sub) continue;
      assessed++;
      scoreSum += sub.scoreTotal ?? 0;
      if (recent.length < 8) {
        const auth = toAuth(sub.riskScore);
        const f = flagged(auth, sub.followUp?.declarationMismatch ?? false);
        recent.push({
          id: c.id,
          githubUsername: c.user.githubUsername ?? "unknown",
          roleName: c.campaign.roleName,
          score: sub.scoreTotal ?? 0,
          verdict: verdict(sub.scoreTotal ?? 0, auth, f),
          band: band(auth),
          submittedAt: sub.submittedAt.toISOString(),
        });
      }
    }

    res.json({
      data: {
        stats: {
          activeCampaigns,
          totalAssessed: assessed,
          totalShortlisted: shortlisted,
          avgScore: assessed ? Math.round(scoreSum / assessed) : 0,
        },
        campaigns: campaigns.map((c) => ({
          id: c.id, roleName: c.roleName, companyName: c.companyName,
          codebase: c.codebase.name, status: c.status,
          count: c._count.candidates, limit: c.candidateLimit,
        })),
        recent,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ─── Candidates (cross-campaign) ─────────────────────────────────────────────

/**
 * GET /employer/candidates
 * Every candidate across all of the org's campaigns, scored + ranked.
 */
router.get("/candidates", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.json({ data: [] }); return; }

    const rows = await prisma.campaignCandidate.findMany({
      where: { campaign: { orgId } },
      include: {
        user: { select: { githubUsername: true, email: true } },
        campaign: { select: { id: true, roleName: true, codebaseId: true, ticketIds: true } },
      },
    });

    const out = [];
    for (const c of rows) {
      const sub = await prisma.submission.findFirst({
        where: { userId: c.userId, status: "REVIEWED", finalized: true, ...campaignSubmissionScope(c.campaign) },
        orderBy: { scoreTotal: "desc" },
        include: { followUp: { select: { declarationMismatch: true, aiDeclaration: true } } },
      });
      if (!sub) continue;
      const auth = toAuth(sub.riskScore);
      const f = flagged(auth, sub.followUp?.declarationMismatch ?? false);
      out.push({
        id: c.id,
        campaignId: c.campaign.id,
        roleName: c.campaign.roleName,
        githubUsername: c.user.githubUsername,
        email: c.user.email,
        status: c.status,
        score: sub.scoreTotal ?? 0,
        authBand: band(auth),
        flagged: f,
        verdict: verdict(sub.scoreTotal ?? 0, auth, f),
        aiDeclaration: sub.followUp?.aiDeclaration ?? null,
        submittedAt: sub.submittedAt.toISOString(),
      });
    }
    out.sort((a, b) => b.score - a.score);
    res.json({ data: out });
  } catch (err) {
    res.status(500).json({ error: "Failed to load candidates" });
  }
});

// ─── Team ────────────────────────────────────────────────────────────────────

router.get("/team", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.json({ data: { members: [], myRole: null } }); return; }
    const myRole = await getRole(userId, orgId);
    const members = await prisma.orgMember.findMany({
      where: { orgId },
      include: { user: { select: { id: true, githubUsername: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    });
    res.json({
      data: {
        myRole,
        members: members.map((m) => ({
          id: m.id, role: m.role, joinedAt: m.joinedAt,
          githubUsername: m.user.githubUsername, email: m.user.email, userId: m.user.id,
          isMe: m.user.id === userId,
        })),
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load team" });
  }
});

router.post("/team/invite", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { githubUsername, role } = req.body as { githubUsername?: string; role?: OrgRole };
  if (!githubUsername) { res.status(400).json({ error: "githubUsername is required" }); return; }
  try {
    const orgId = await getOrgId(userId);
    if (!orgId || (await getRole(userId, orgId)) !== OrgRole.ADMIN) {
      res.status(403).json({ error: "Only admins can add team members" });
      return;
    }
    const invitee = await prisma.user.findUnique({ where: { githubUsername } });
    if (!invitee) {
      res.status(404).json({ error: `No DevSimulate user with GitHub username “${githubUsername}”. They must sign in once first.` });
      return;
    }
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId, userId: invitee.id } },
      update: { role: role ?? OrgRole.MEMBER },
      create: { orgId, userId: invitee.id, role: role ?? OrgRole.MEMBER },
    });
    res.json({ data: { ok: true } });
  } catch {
    res.status(500).json({ error: "Failed to add member" });
  }
});

router.patch("/team/:memberId", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { role } = req.body as { role: OrgRole };
  try {
    const orgId = await getOrgId(userId);
    if (!orgId || (await getRole(userId, orgId)) !== OrgRole.ADMIN) {
      res.status(403).json({ error: "Only admins can change roles" });
      return;
    }
    await prisma.orgMember.update({ where: { id: req.params.memberId }, data: { role } });
    res.json({ data: { ok: true } });
  } catch {
    res.status(500).json({ error: "Failed to update role" });
  }
});

router.delete("/team/:memberId", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId || (await getRole(userId, orgId)) !== OrgRole.ADMIN) {
      res.status(403).json({ error: "Only admins can remove members" });
      return;
    }
    await prisma.orgMember.delete({ where: { id: req.params.memberId } });
    res.json({ data: { ok: true } });
  } catch {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get("/settings", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.json({ data: null }); return; }
    const [org, memberCount, campaignCount, user] = await Promise.all([
      prisma.organisation.findUnique({ where: { id: orgId } }),
      prisma.orgMember.count({ where: { orgId } }),
      prisma.campaign.count({ where: { orgId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { subscriptionTier: true } }),
    ]);
    res.json({
      data: {
        orgName:      org?.name         ?? "",
        domain:       org?.domain       ?? "",
        logoUrl:      org?.logoUrl      ?? "",
        primaryColor: org?.primaryColor ?? "",
        accentColor:  org?.accentColor  ?? "",
        brandName:    org?.brandName    ?? "",
        plan:         org?.plan         ?? "HIRING",
        tier:         user?.subscriptionTier ?? "FREE",
        memberCount,
        campaignCount,
        myRole: await getRole(userId, orgId),
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.patch("/settings", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { orgName, domain, logoUrl, primaryColor, accentColor, brandName } = req.body as {
    orgName?: string; domain?: string;
    logoUrl?: string; primaryColor?: string; accentColor?: string; brandName?: string;
  };
  try {
    const orgId = await getOrgId(userId);
    if (!orgId || (await getRole(userId, orgId)) !== OrgRole.ADMIN) {
      res.status(403).json({ error: "Only admins can change settings" });
      return;
    }
    await prisma.organisation.update({
      where: { id: orgId },
      data: {
        ...(orgName        ? { name: orgName }              : {}),
        ...(domain         !== undefined ? { domain }       : {}),
        ...(logoUrl        !== undefined ? { logoUrl }      : {}),
        ...(primaryColor   !== undefined ? { primaryColor } : {}),
        ...(accentColor    !== undefined ? { accentColor }  : {}),
        ...(brandName      !== undefined ? { brandName }    : {}),
      },
    });
    res.json({ data: { ok: true } });
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
