import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import prisma from "../lib/prisma";
import { Difficulty, CampaignStatus, CandidateStatus, CampaignType } from "@prisma/client";
import crypto from "crypto";
import { preForkForUser } from "../lib/github-fork";
import { sendEmail, interviewInviteEmail } from "../lib/email";
import { campaignSubmissionScope } from "../lib/campaign-scope";
import { computeHiringSignals } from "../lib/hiring-signals";

const router = Router();

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

// ─── Integrity helpers (ported from the proven demo dashboard logic) ─────────────
// Authenticity is surfaced as an advisory signal — it NEVER changes a candidate's
// rank (rank is pure PR score) and NEVER auto-rejects anyone. The flag only fires
// when authenticity is low AND Claude set the hard declarationMismatch — i.e. the
// candidate's answers contradict their OWN declaration.

/** riskScore (0-100) → authenticity (0-100). Higher = more authentic. */
function toAuthScore(riskScore: number): number {
  return Math.max(0, Math.min(100, 100 - riskScore));
}

/** High ≥ 70 · Medium 40–69 · Low < 40 */
function authBand(authScore: number): "HIGH" | "MEDIUM" | "LOW" {
  if (authScore >= 70) return "HIGH";
  if (authScore >= 40) return "MEDIUM";
  return "LOW";
}

/**
 * Flags a candidate for human review. Fires on ANY of:
 *  - low authenticity AND a hard declaration mismatch (text + self-report), OR
 *  - paste attempts into the Q&A boxes (behavioral fact), OR
 *  - a suspiciously fast completion for the difficulty (behavioral fact).
 * Behavioral signals are deterministic, so they can flag on their own.
 */
function isFlagged(
  authScore: number,
  mismatch: boolean,
  pasteAttempts = 0,
  suspiciouslyFast = false
): boolean {
  if (pasteAttempts > 0) return true;
  if (suspiciouslyFast) return true;
  return authScore < 50 && mismatch;
}

/**
 * Verdict from the FINAL score, which already bakes in the real signals: a hidden-test
 * fail caps the score (≤45) and a weak verbal defence deducts from it. The crude
 * authenticity heuristic (PR description length / completion speed) is ADVISORY ONLY and
 * no longer caps the verdict — a strong, verified candidate is a STRONG_YES even if their
 * PR description was terse or they finished fast.
 */
function verdict(total: number): "STRONG_YES" | "YES" | "MAYBE" | "NO" {
  if (total < 50) return "NO";
  if (total >= 80) return "STRONG_YES";
  if (total >= 65) return "YES";
  return "MAYBE"; // 50–64
}

/**
 * Picks a ticket for a candidate joining a campaign.
 *  - If the employer curated a specific ticket set, pick a RANDOM one from it.
 *  - Otherwise pick a RANDOM ticket from the codebase's difficulty pool.
 * Random across candidates (anti-collusion) but each candidate locks to their
 * ticket on assignment, so it's stable for them.
 */
async function pickTicketForCampaign(campaign: {
  codebaseId: string;
  difficulty: Difficulty;
  ticketIds: string[];
}): Promise<{ id: string; title: string; difficulty: Difficulty; expectedMinutes: number } | null> {
  const pool = campaign.ticketIds.length
    ? await prisma.ticket.findMany({
        where: { id: { in: campaign.ticketIds } },
        select: { id: true, title: true, difficulty: true, expectedMinutes: true },
      })
    : await prisma.ticket.findMany({
        where: { codebaseId: campaign.codebaseId, difficulty: campaign.difficulty },
        select: { id: true, title: true, difficulty: true, expectedMinutes: true },
      });
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── PUBLIC routes (no auth) — must be defined before the auth gate ──────────────

/**
 * GET /campaigns/apply/:slug  (PUBLIC)
 * Returns campaign details for a candidate opening the apply link before login.
 */
router.get("/apply/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { shareableSlug: req.params.slug },
      include: {
        codebase: { select: { name: true, description: true } },
        org: { select: { logoUrl: true, primaryColor: true, accentColor: true, brandName: true } },
      },
    });
    if (!campaign || campaign.status !== CampaignStatus.ACTIVE) {
      res.status(404).json({ error: "Campaign not found or closed" });
      return;
    }
    res.json({
      data: {
        id: campaign.id,
        roleName: campaign.roleName,
        companyName: campaign.companyName,
        difficulty: campaign.difficulty,
        type: campaign.type,
        codebase: campaign.codebase,
        branding: {
          logoUrl:      campaign.org.logoUrl      ?? null,
          primaryColor: campaign.org.primaryColor ?? "#5B5BD6",
          accentColor:  campaign.org.accentColor  ?? "#5B5BD6",
          brandName:    campaign.org.brandName    ?? campaign.companyName,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load campaign" });
  }
});

/**
 * GET /campaigns/leaderboard/:slug  (PUBLIC)
 * Live ranked board of THIS campaign's participants — no login required, so it
 * can be shared with devs / put on a screen during a contest.
 */
router.get("/leaderboard/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { shareableSlug: req.params.slug },
      include: {
        codebase: { select: { name: true } },
        org: { select: { logoUrl: true, primaryColor: true, accentColor: true, brandName: true } },
      },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    const rows = await prisma.campaignCandidate.findMany({
      where: { campaignId: campaign.id },
      include: { user: { select: { githubUsername: true } } },
    });

    const scored: Array<{
      githubUsername: string; score: number;
      diag: number | null; design: number | null; comms: number | null; exec: number | null;
      verbalPenalty: number;
    }> = [];
    for (const c of rows) {
      const sub = await prisma.submission.findFirst({
        where: { userId: c.userId, status: "REVIEWED", finalized: true, ...campaignSubmissionScope(campaign) },
        orderBy: { scoreTotal: "desc" },
        select: {
          scoreTotal: true, scoreDiagnosis: true, scoreDesign: true,
          scoreCommunication: true, scoreExecution: true, verbalPenalty: true,
        },
      });
      if (sub) scored.push({
        githubUsername: c.user.githubUsername ?? "unknown",
        score:         sub.scoreTotal      ?? 0,
        diag:          sub.scoreDiagnosis  ?? null,
        design:        sub.scoreDesign     ?? null,
        comms:         sub.scoreCommunication ?? null,
        exec:          sub.scoreExecution  ?? null,
        verbalPenalty: sub.verbalPenalty   ?? 0,
      });
    }
    scored.sort((a, b) => b.score - a.score);

    res.json({
      data: {
        campaignName: campaign.roleName,
        companyName: campaign.companyName,
        codebase: campaign.codebase.name,
        type: campaign.type,
        status: campaign.status,
        participants: scored.map((s, i) => ({ rank: i + 1, ...s })),
        totalJoined: rows.length,
        branding: {
          logoUrl:      campaign.org.logoUrl      ?? null,
          primaryColor: campaign.org.primaryColor ?? "#5B5BD6",
          accentColor:  campaign.org.accentColor  ?? "#5B5BD6",
          brandName:    campaign.org.brandName    ?? campaign.companyName,
        },
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// ─── Everything below requires authentication ───────────────────────────────────
router.use(requireAuth as (req: Request, res: Response, next: () => void) => void);

async function getOrgForUser(userId: string): Promise<string | null> {
  const member = await prisma.orgMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  return member?.orgId ?? null;
}

/**
 * POST /campaigns
 * Creates a new hiring campaign.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { roleName, codebaseId, difficulty, candidateLimit, deadline, companyName, bookingLink, ticketIds, type } =
    req.body as {
      roleName?: string;
      codebaseId?: string;
      difficulty?: Difficulty;
      candidateLimit?: number;
      deadline?: string;
      companyName?: string;
      bookingLink?: string;
      ticketIds?: string[];
      type?: CampaignType;
    };

  if (!roleName || !codebaseId || !difficulty || !companyName) {
    res.status(400).json({ error: "roleName, codebaseId, difficulty and companyName are required" });
    return;
  }

  try {
    const orgId = await getOrgForUser(userId);
    if (!orgId) {
      res.status(403).json({ error: "You must belong to an organisation to create campaigns" });
      return;
    }

    const roleSlug = slugify(roleName);
    const companySlug = slugify(companyName);
    const randomId = crypto.randomBytes(4).toString("hex");
    const shareableSlug = `${companySlug}-${roleSlug}-${randomId}`;

    const campaign = await prisma.campaign.create({
      data: {
        orgId,
        roleName,
        codebaseId,
        difficulty,
        candidateLimit: candidateLimit ?? 100,
        deadline: deadline ? new Date(deadline) : null,
        companyName,
        bookingLink: bookingLink ?? null,
        shareableSlug,
        ticketIds: Array.isArray(ticketIds) ? ticketIds : [],
        type: type === "CONTEST" ? CampaignType.CONTEST : CampaignType.HIRING,
        status: CampaignStatus.ACTIVE,
      },
      include: { codebase: true },
    });

    res.status(201).json({ data: campaign });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create campaign";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /campaigns/apply/:slug
 * Registers the authenticated candidate to the campaign and assigns a ticket
 * from the campaign's codebase at the chosen difficulty.
 */
router.post("/apply/:slug", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { fullName } = req.body as { fullName?: string };
  try {
    if (fullName?.trim()) {
      await prisma.user.update({ where: { id: userId }, data: { fullName: fullName.trim() } });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { shareableSlug: req.params.slug },
    });
    if (!campaign || campaign.status !== CampaignStatus.ACTIVE) {
      res.status(404).json({ error: "Campaign not found or closed" });
      return;
    }

    // Already joined? return existing assignment
    const existing = await prisma.campaignCandidate.findUnique({
      where: { campaignId_userId: { campaignId: campaign.id, userId } },
    });

    // Reuse the candidate's existing ticket if they already have one for this
    // campaign's codebase; otherwise pick a random one from the pool.
    let ticket = await prisma.ticket.findFirst({
      where: {
        codebaseId: campaign.codebaseId,
        assignments: { some: { userId } },
        ...(campaign.ticketIds.length ? { id: { in: campaign.ticketIds } } : { difficulty: campaign.difficulty }),
      },
      select: { id: true, title: true, difficulty: true, expectedMinutes: true },
    });
    if (!ticket) {
      ticket = await pickTicketForCampaign(campaign);
    }
    if (!ticket) {
      res.status(404).json({ error: "No ticket available for this campaign" });
      return;
    }

    // Assign the ticket if not already assigned
    const slug = ticket.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const branchName = `ds/${ticket.id.slice(0, 8)}-${slug}`;
    await prisma.ticketAssignment.upsert({
      where: { userId_ticketId: { userId, ticketId: ticket.id } },
      create: { userId, ticketId: ticket.id, branchName },
      update: {},
    });

    if (!existing) {
      await prisma.campaignCandidate.create({
        data: { campaignId: campaign.id, userId },
      });
    }

    // Pre-fork so the codebase is ready when they open VS Code
    const applyCb = await prisma.codebase.findUnique({ where: { id: campaign.codebaseId }, select: { repoUrl: true } });
    if (applyCb) void preForkForUser(userId, applyCb.repoUrl);

    res.json({
      data: {
        campaignId: campaign.id,
        ticket: {
          id: ticket.id,
          title: ticket.title,
          difficulty: ticket.difficulty,
          expectedMinutes: ticket.expectedMinutes,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to join campaign";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /campaigns/join
 * Body: { slug }. Alias of apply/:slug POST — registers the authenticated
 * candidate to the campaign and assigns a ticket. Returns campaignId + ticketId.
 */
router.post("/join", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { slug } = req.body as { slug?: string };
  if (!slug) { res.status(400).json({ error: "slug is required" }); return; }

  try {
    const campaign = await prisma.campaign.findUnique({ where: { shareableSlug: slug } });
    if (!campaign || campaign.status !== CampaignStatus.ACTIVE) {
      res.status(404).json({ error: "Campaign not found or closed" });
      return;
    }

    // Enforce candidate limit
    const count = await prisma.campaignCandidate.count({ where: { campaignId: campaign.id } });
    const already = await prisma.campaignCandidate.findUnique({
      where: { campaignId_userId: { campaignId: campaign.id, userId } },
    });
    if (!already && count >= campaign.candidateLimit) {
      res.status(403).json({ error: "This campaign has reached its candidate limit" });
      return;
    }

    let ticket = await prisma.ticket.findFirst({
      where: {
        codebaseId: campaign.codebaseId,
        assignments: { some: { userId } },
        ...(campaign.ticketIds.length ? { id: { in: campaign.ticketIds } } : { difficulty: campaign.difficulty }),
      },
      select: { id: true, title: true, difficulty: true, expectedMinutes: true },
    });
    if (!ticket) {
      ticket = await pickTicketForCampaign(campaign);
    }
    if (!ticket) { res.status(404).json({ error: "No ticket available for this campaign" }); return; }

    const tslug = ticket.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const branchName = `ds/${ticket.id.slice(0, 8)}-${tslug}`;
    await prisma.ticketAssignment.upsert({
      where: { userId_ticketId: { userId, ticketId: ticket.id } },
      create: { userId, ticketId: ticket.id, branchName },
      update: {},
    });

    if (!already) {
      await prisma.campaignCandidate.create({ data: { campaignId: campaign.id, userId } });
    }

    // Pre-fork so the codebase is ready when they open VS Code
    const joinCb = await prisma.codebase.findUnique({ where: { id: campaign.codebaseId }, select: { repoUrl: true } });
    if (joinCb) void preForkForUser(userId, joinCb.repoUrl);

    res.json({
      data: { campaignId: campaign.id, ticketId: ticket.id },
      message: `You have joined the ${campaign.companyName} campaign. Your ticket has been assigned.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to join campaign";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /campaigns/me
 * Returns the employer's org + identity for the sidebar.
 */
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const member = await prisma.orgMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: "asc" },
      include: { org: { select: { name: true } }, user: { select: { githubUsername: true, email: true } } },
    });
    if (!member) {
      res.json({ data: null });
      return;
    }
    res.json({
      data: {
        orgName: member.org.name,
        githubUsername: member.user.githubUsername,
        email: member.user.email,
        role: member.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/**
 * GET /campaigns/codebases
 * Lists available codebases for the campaign creation dropdown.
 */
router.get("/codebases", async (_req: Request, res: Response): Promise<void> => {
  try {
    const codebases = await prisma.codebase.findMany({
      select: { id: true, name: true, stack: true },
      orderBy: { name: "asc" },
    });
    res.json({ data: codebases });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch codebases" });
  }
});

/**
 * GET /campaigns/ticket-library?codebaseId=&difficulty=
 * Lists tickets the employer can optionally hand-pick for a campaign.
 */
router.get("/ticket-library", async (req: Request, res: Response): Promise<void> => {
  const { codebaseId, difficulty } = req.query as Record<string, string>;
  if (!codebaseId || !difficulty) {
    res.status(400).json({ error: "codebaseId and difficulty are required" });
    return;
  }
  try {
    const tickets = await prisma.ticket.findMany({
      where: { codebaseId, difficulty: difficulty as Difficulty },
      select: { id: true, title: true, description: true, expectedMinutes: true, filesInvolved: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ data: tickets });
  } catch {
    res.status(500).json({ error: "Failed to fetch ticket library" });
  }
});

/**
 * GET /campaigns
 * Lists all campaigns for the current user's organisation.
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const orgId = await getOrgForUser(userId);
    if (!orgId) { res.json({ data: [] }); return; }

    const campaigns = await prisma.campaign.findMany({
      where: { orgId },
      include: {
        codebase: { select: { name: true, stack: true } },
        _count: { select: { candidates: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: campaigns });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

/**
 * GET /campaigns/stats
 * Returns dashboard summary stats for the employer.
 */
router.get("/stats", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const orgId = await getOrgForUser(userId);
    if (!orgId) { res.json({ data: { activeCampaigns: 0, totalAssessed: 0, totalShortlisted: 0 } }); return; }

    const [activeCampaigns, totalAssessed, totalShortlisted] = await Promise.all([
      prisma.campaign.count({ where: { orgId, status: CampaignStatus.ACTIVE } }),
      prisma.campaignCandidate.count({
        where: { campaign: { orgId }, submissionId: { not: null } },
      }),
      prisma.campaignCandidate.count({
        where: { campaign: { orgId }, status: CandidateStatus.SHORTLISTED },
      }),
    ]);

    res.json({ data: { activeCampaigns, totalAssessed, totalShortlisted } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * GET /campaigns/:id
 * Single campaign details.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
      include: { codebase: true, _count: { select: { candidates: true } } },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
    res.json({ data: campaign });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
});

/**
 * PATCH /campaigns/:id
 * Update campaign status or details.
 */
router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { status, bookingLink, deadline } = req.body as {
    status?: CampaignStatus;
    bookingLink?: string;
    deadline?: string;
  };
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...(status ? { status } : {}),
        ...(bookingLink !== undefined ? { bookingLink } : {}),
        ...(deadline ? { deadline: new Date(deadline) } : {}),
      },
    });
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

/**
 * DELETE /campaigns/:id
 * Permanently deletes a campaign and its candidate records.
 */
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    // Remove children first to satisfy foreign keys: decisions → candidates → campaign.
    const candidates = await prisma.campaignCandidate.findMany({
      where: { campaignId: req.params.id },
      select: { id: true },
    });
    const candidateIds = candidates.map((c) => c.id);
    if (candidateIds.length) {
      await prisma.candidateDecision.deleteMany({ where: { candidateId: { in: candidateIds } } });
      await prisma.campaignCandidate.deleteMany({ where: { campaignId: req.params.id } });
    }
    await prisma.campaign.delete({ where: { id: req.params.id } });

    res.json({ data: { deleted: true } });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

/**
 * GET /campaigns/:id/results
 * Returns all candidates with scores, supports filtering and sorting.
 */
router.get("/:id/results", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const {
    minScore, minDiagnosis, minDesign,
    aiDeclaration, sortBy, page, status: statusFilter,
  } = req.query as Record<string, string>;

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    const rawCandidates = await prisma.campaignCandidate.findMany({
      where: {
        campaignId: req.params.id,
        ...(statusFilter ? { status: statusFilter as CandidateStatus } : {}),
      },
      include: {
        user: { select: { id: true, githubUsername: true, email: true, skillScore: true } },
      },
    });

    // Resolve each candidate's best REVIEWED submission for THIS campaign's
    // ticket(s). Match the campaign's specific tickets when set — otherwise a
    // candidate with a higher-scoring submission on another ticket of the same
    // codebase would mask the ticket this campaign actually assessed. Falls back
    // to codebase-wide matching only for legacy campaigns with no ticketIds.
    const candidates = await Promise.all(
      rawCandidates.map(async (c) => {
        const submission = await prisma.submission.findFirst({
          where: {
            userId: c.userId,
            status: "REVIEWED", finalized: true,
            ...campaignSubmissionScope(campaign),
          },
          orderBy: { scoreTotal: "desc" },
          include: {
            ticket: { select: { title: true, difficulty: true, expectedMinutes: true } },
            followUp: {
              select: {
                aiDeclaration: true, scoreBonus: true, declarationMismatch: true,
                question1: true, question2: true, answer1: true, answer2: true,
                claudeFeedback: true, employerSummary: true,
                verbalScore: true, verbalNote: true,
              },
            },
          },
        });

        // Time-on-task — flag a finish under 20% of the ticket estimate
        let suspiciouslyFast = false;
        let minutesTaken: number | null = null;
        if (submission) {
          const assignment = await prisma.ticketAssignment.findFirst({
            where: { userId: c.userId, ticketId: submission.ticketId },
          });
          if (assignment) {
            minutesTaken = Math.round((submission.submittedAt.getTime() - assignment.assignedAt.getTime()) / 60000);
            suspiciouslyFast = minutesTaken < submission.ticket.expectedMinutes * 0.2;
          }
        }
        return { ...c, submission, suspiciouslyFast, minutesTaken };
      })
    );

    let results = candidates.filter((c) => c.submission?.status === "REVIEWED");

    // Apply filters
    if (minScore) results = results.filter((c) => (c.submission?.scoreTotal ?? 0) >= parseInt(minScore));
    if (minDiagnosis) results = results.filter((c) => (c.submission?.scoreDiagnosis ?? 0) >= parseInt(minDiagnosis));
    if (minDesign) results = results.filter((c) => (c.submission?.scoreDesign ?? 0) >= parseInt(minDesign));
    if (aiDeclaration) {
      const declarations = aiDeclaration.split(",");
      results = results.filter((c) =>
        declarations.includes(c.submission?.followUp?.aiDeclaration ?? "")
      );
    }

    // Sort
    if (sortBy === "diagnosis") results.sort((a, b) => (b.submission?.scoreDiagnosis ?? 0) - (a.submission?.scoreDiagnosis ?? 0));
    else if (sortBy === "design") results.sort((a, b) => (b.submission?.scoreDesign ?? 0) - (a.submission?.scoreDesign ?? 0));
    else if (sortBy === "date") results.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    else results.sort((a, b) => (b.submission?.scoreTotal ?? 0) - (a.submission?.scoreTotal ?? 0));

    // Paginate
    const pageNum = parseInt(page ?? "1");
    const pageSize = 50;
    const total = results.length;
    const paginated = results.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    // Mark top 20% as recommended
    const top20Threshold = results.length > 0
      ? results[Math.floor(results.length * 0.2)]?.submission?.scoreTotal ?? 0
      : 80;

    const withRank = paginated.map((c, i) => {
      const total = c.submission?.scoreTotal ?? 0;
      const authScore = toAuthScore(c.submission?.riskScore ?? 0);
      const mismatch = c.submission?.followUp?.declarationMismatch ?? false;
      const pastes = c.submission?.pasteAttempts ?? 0;
      const flagged = isFlagged(authScore, mismatch, pastes, c.suspiciouslyFast);
      return {
        ...c,
        rank: (pageNum - 1) * pageSize + i + 1,
        // Integrity signals — advisory only, never change rank, never auto-reject
        authScore,
        authBand: authBand(authScore),
        flagged,
        verdict: verdict(total),
        // Recommended is gated on NOT flagged — a flagged candidate is never
        // auto-recommended, but is never auto-hidden either.
        recommended: !flagged && total >= Math.max(top20Threshold, 70),
        // Score story — shows how the final score was derived
        scorePrBase: c.submission?.scorePrBase ?? null,
        scoreGap: c.submission?.scorePrBase != null ? c.submission.scorePrBase - total : null,
        verbalPenalty: c.submission?.verbalPenalty ?? 0,
        hiddenTestPenalty: c.submission?.hiddenTestPenalty ?? 0,
        // Literacy signals surfaced inline so employer doesn't need to click in
        verbalScore: c.submission?.followUp?.verbalScore ?? null,
        verbalNote: c.submission?.followUp?.verbalNote ?? null,
        diagnosisPct: c.submission?.scoreDiagnosis != null
          ? Math.round((c.submission.scoreDiagnosis / 40) * 100)
          : null,
        employerSummary: c.submission?.followUp?.employerSummary ?? null,
        // Role-aware hiring signals — skill profile, defense, consistency,
        // confidence, strength/concern. Role weighting is applied client-side.
        signals: c.submission
          ? computeHiringSignals(c.submission, c.submission.followUp ?? null)
          : null,
        effort: {
          minutes: c.minutesTaken,
          expected: c.submission?.ticket?.expectedMinutes ?? null,
          difficulty: c.submission?.ticket?.difficulty ?? null,
        },
      };
    });

    res.json({ data: withRank, total, page: pageNum, pageSize });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

/**
 * GET /campaigns/:id/candidates/:candidateId
 * Full detail for a single candidate including Claude feedback and Q&A.
 */
router.get("/:id/candidates/:candidateId", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const campaignCb = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
      select: { id: true, roleName: true, companyName: true, bookingLink: true, codebaseId: true, ticketIds: true },
    });
    if (!campaignCb) { res.status(404).json({ error: "Campaign not found" }); return; }
    const campaign = {
      id: campaignCb.id, roleName: campaignCb.roleName,
      companyName: campaignCb.companyName, bookingLink: campaignCb.bookingLink,
    };

    const rawCandidate = await prisma.campaignCandidate.findUnique({
      where: { id: req.params.candidateId },
      include: {
        user: { select: { id: true, githubUsername: true, email: true, skillScore: true } },
      },
    });
    if (!rawCandidate) { res.status(404).json({ error: "Candidate not found" }); return; }

    const submission = await prisma.submission.findFirst({
      where: {
        userId: rawCandidate.userId,
        status: "REVIEWED", finalized: true,
        ...campaignSubmissionScope(campaignCb),
      },
      orderBy: { scoreTotal: "desc" },
      include: {
        ticket: { select: { title: true, difficulty: true, expectedMinutes: true } },
        followUp: true,
      },
    });

    // Time-on-task signal: how long from assignment to submission, vs the
    // ticket's own estimate. A suspiciously fast finish is an integrity signal.
    let timing: { minutesTaken: number; expectedMinutes: number; suspiciouslyFast: boolean } | null = null;
    if (submission) {
      const assignment = await prisma.ticketAssignment.findFirst({
        where: { userId: rawCandidate.userId, ticketId: submission.ticketId },
      });
      if (assignment) {
        const minutesTaken = Math.max(
          0,
          Math.round((submission.submittedAt.getTime() - assignment.assignedAt.getTime()) / 60000)
        );
        const expectedMinutes = submission.ticket.expectedMinutes;
        timing = {
          minutesTaken,
          expectedMinutes,
          suspiciouslyFast: minutesTaken < expectedMinutes * 0.2,
        };
      }
    }

    res.json({ data: { candidate: { ...rawCandidate, submission }, campaign, timing } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

/**
 * PATCH /campaigns/:id/candidates/:candidateId
 * Update a single candidate's status.
 */
router.patch("/:id/candidates/:candidateId", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { status } = req.body as { status: CandidateStatus };
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    const current = await prisma.campaignCandidate.findUnique({
      where: { id: req.params.candidateId },
    });
    if (!current) { res.status(404).json({ error: "Candidate not found" }); return; }

    // Was this candidate integrity-flagged at decision time? (for the audit record)
    const sub = await prisma.submission.findFirst({
      where: { userId: current.userId, status: "REVIEWED", finalized: true, ...campaignSubmissionScope(campaign) },
      orderBy: { scoreTotal: "desc" },
      include: { followUp: { select: { declarationMismatch: true } } },
    });
    const wasFlagged = sub
      ? isFlagged(toAuthScore(sub.riskScore), sub.followUp?.declarationMismatch ?? false)
      : false;

    const updated = await prisma.campaignCandidate.update({
      where: { id: req.params.candidateId },
      data: { status },
    });

    // Append-only audit record — proves a human made this call
    await prisma.candidateDecision.create({
      data: {
        candidateId: req.params.candidateId,
        changedBy: userId,
        fromStatus: current.status,
        toStatus: status,
        wasFlagged,
      },
    });

    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update candidate" });
  }
});

/**
 * POST /campaigns/:id/invite
 * Send interview invites to selected candidates.
 */
router.post("/:id/invite", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { candidateIds } = req.body as { candidateIds: string[] };

  if (!candidateIds?.length) {
    res.status(400).json({ error: "No candidates selected" });
    return;
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    await prisma.campaignCandidate.updateMany({
      where: { id: { in: candidateIds }, campaignId: req.params.id },
      data: { status: CandidateStatus.SHORTLISTED, invitedAt: new Date() },
    });

    // Send the interview invite email to each candidate (best-effort)
    const candidates = await prisma.campaignCandidate.findMany({
      where: { id: { in: candidateIds }, campaignId: req.params.id },
      include: { user: { select: { email: true, githubUsername: true } } },
    });

    let emailed = 0;
    let missingEmail = 0;
    for (const c of candidates) {
      if (!c.user.email) { missingEmail++; continue; }
      const sub = await prisma.submission.findFirst({
        where: { userId: c.userId, status: "REVIEWED", finalized: true, ...campaignSubmissionScope(campaign) },
        orderBy: { scoreTotal: "desc" },
        select: { scoreTotal: true },
      });
      const { subject, html } = interviewInviteEmail({
        candidateName: c.user.githubUsername ?? "Candidate",
        companyName: campaign.companyName,
        roleName: campaign.roleName,
        score: sub?.scoreTotal ?? 0,
        bookingLink: campaign.bookingLink,
      });
      const ok = await sendEmail({ to: c.user.email, subject, html });
      if (ok) emailed++;
    }

    res.json({ data: { shortlisted: candidateIds.length, emailed, missingEmail } });
  } catch (err) {
    res.status(500).json({ error: "Failed to send invites" });
  }
});

/**
 * GET /campaigns/:id/export
 * Export campaign results as CSV.
 */
router.get("/:id/export", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    const candidates = await prisma.campaignCandidate.findMany({
      where: { campaignId: req.params.id },
      include: {
        user: { select: { githubUsername: true, email: true } },
        submission: {
          include: {
            followUp: {
              select: {
                aiDeclaration: true, scoreBonus: true,
                declarationMismatch: true, employerSummary: true,
                verbalScore: true, verbalNote: true,
              },
            },
          },
        },
      },
      orderBy: { submission: { scoreTotal: "desc" } },
    });

    // Fetch assignment timestamps for time-on-task column
    const timingMap = new Map<string, number>();
    for (const c of candidates) {
      if (!c.submission) continue;
      const assignment = await prisma.ticketAssignment.findFirst({
        where: { userId: c.userId, ticketId: c.submission.ticketId },
        select: { assignedAt: true },
      });
      if (assignment) {
        timingMap.set(
          c.submission.id,
          Math.max(0, Math.round((c.submission.submittedAt.getTime() - assignment.assignedAt.getTime()) / 60000))
        );
      }
    }

    const rows = [
      [
        "Rank", "GitHub", "Email",
        "Final Score", "PR Base Score", "Score Gap",
        "Verbal Penalty", "Hidden Test Penalty",
        "Diagnosis", "Diagnosis %", "Design", "Communication", "Execution",
        "Verbal Score", "Declaration Mismatch", "AI Declaration",
        "Paste Attempts", "Minutes Taken", "Verdict", "Flagged",
        "Employer Summary", "Status", "Submitted At",
      ],
      ...candidates.map((c, i) => {
        const total = c.submission?.scoreTotal ?? 0;
        const base = c.submission?.scorePrBase ?? null;
        const gap = base != null ? base - total : "";
        const auth = toAuthScore(c.submission?.riskScore ?? 0);
        const mismatch = c.submission?.followUp?.declarationMismatch ?? false;
        const pastes = c.submission?.pasteAttempts ?? 0;
        const fast = false; // timing-based flag omitted in export for simplicity
        const flaggedVal = isFlagged(auth, mismatch, pastes, fast);
        const diag = c.submission?.scoreDiagnosis ?? null;
        return [
          i + 1,
          c.user.githubUsername ?? "",
          c.user.email ?? "",
          total,
          base ?? "",
          gap,
          c.submission?.verbalPenalty ?? 0,
          c.submission?.hiddenTestPenalty ?? 0,
          diag ?? "",
          diag != null ? `${Math.round((diag / 40) * 100)}%` : "",
          c.submission?.scoreDesign ?? "",
          c.submission?.scoreCommunication ?? "",
          c.submission?.scoreExecution ?? "",
          c.submission?.followUp?.verbalScore ?? "",
          mismatch ? "YES" : "NO",
          c.submission?.followUp?.aiDeclaration ?? "",
          pastes,
          c.submission ? (timingMap.get(c.submission.id) ?? "") : "",
          verdict(total),
          flaggedVal ? "YES" : "NO",
          `"${(c.submission?.followUp?.employerSummary ?? "").replace(/"/g, '""')}"`,
          c.status,
          c.submission?.submittedAt ? new Date(c.submission.submittedAt).toISOString() : "",
        ];
      }),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="campaign-${req.params.id}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: "Failed to export" });
  }
});

/**
 * PATCH /campaigns/:id/devfest-tag
 * Set or clear the DevFest tag on a campaign.
 * Body: { devFestTag: string | null }
 */
router.patch("/:id/devfest-tag", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { devFestTag } = req.body as { devFestTag: string | null };

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, org: { members: { some: { userId } } } },
    });
    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma.campaign.update as any)({
      where: { id: req.params.id },
      data:  { devFestTag: devFestTag ?? null },
      select: { id: true, devFestTag: true },
    });

    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update DevFest tag" });
  }
});

export default router;
