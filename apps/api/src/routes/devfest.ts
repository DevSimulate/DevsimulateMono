import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { CATEGORY_MAP, CategoryMeta, OTHER_CATEGORY } from "../lib/devfest-categories";
import { cacheGet, cacheSet } from "../lib/ttl-cache";

const router = Router();

// Public leaderboard is read-heavy during an event; serve a short-lived snapshot
// so a burst of viewers doesn't recompute (and re-query) on every request.
const LEADERBOARD_TTL_MS = 45_000;

interface ParticipantEntry {
  userId: string;
  githubUsername: string;
  score: number;
  diag: number | null;
  design: number | null;
  comms: number | null;
  exec: number | null;
  verbalPenalty: number;
  stack: string;
  campaignName: string;
}


// GET /devfest/:tag — public leaderboard aggregated across all campaigns for a DevFest event
router.get("/:tag", async (req: Request, res: Response): Promise<void> => {
  try {
    const { tag } = req.params;

    // Serve a short-lived snapshot so an event-day traffic burst doesn't recompute
    // the whole leaderboard (and re-query the DB) on every page load.
    const cacheKey = `devfest:${tag}`;
    const cached = cacheGet<object>(cacheKey);
    if (cached) {
      res.json({ data: cached });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const campaigns: any[] = await (prisma.campaign.findMany as any)({
      where: { devFestTag: tag },
      include: {
        codebase:   { select: { name: true } },
        org:        { select: { logoUrl: true, primaryColor: true, accentColor: true, brandName: true } },
        candidates: { include: { user: { select: { githubUsername: true } } } },
      },
    });

    if (campaigns.length === 0) {
      res.status(404).json({ error: "DevFest not found" });
      return;
    }

    const { org, companyName } = campaigns[0];

    // A DevFest shares one deadline across its campaigns; take the latest as the
    // official close time (the leaderboard shows a countdown to it).
    const deadline: Date | null = campaigns
      .map((c) => c.deadline as Date | null)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    // --- Batch every lookup instead of querying per candidate (was N+1) ---

    // 1. Resolve each codebase's stack in one query.
    const codebaseIds = [...new Set(campaigns.map((c) => c.codebaseId as string))];
    const stackTickets = await prisma.ticket.findMany({
      where: { codebaseId: { in: codebaseIds } },
      select: { codebaseId: true, stack: true },
    });
    const stackByCodebase = new Map<string, string>();
    for (const t of stackTickets) {
      if (!stackByCodebase.has(t.codebaseId)) stackByCodebase.set(t.codebaseId, t.stack.toString());
    }

    // 2. Fetch every participant's reviewed submissions in one query, then match
    //    them to campaigns in memory.
    const allUserIds = [
      ...new Set(campaigns.flatMap((c) => c.candidates.map((cd: { userId: string }) => cd.userId))),
    ];
    const allSubs = allUserIds.length
      ? await prisma.submission.findMany({
          where: { userId: { in: allUserIds }, status: "REVIEWED", finalized: true },
          select: {
            userId: true, ticketId: true, submittedAt: true,
            scoreTotal: true, scoreDiagnosis: true, scoreDesign: true,
            scoreCommunication: true, scoreExecution: true, verbalPenalty: true,
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

    // 3. Resolve each candidate's best eligible submission, de-duplicated by user.
    //    A submission counts only if it is on THIS campaign's ticket(s) (or codebase
    //    for legacy campaigns without ticketIds) AND was submitted on/before the
    //    campaign deadline. Each user keeps a single best entry across the event.
    const bestByUser = new Map<string, ParticipantEntry>();

    for (const campaign of campaigns) {
      const stack = stackByCodebase.get(campaign.codebaseId) ?? "NODE";
      const ticketIds: string[] = campaign.ticketIds ?? [];
      const campDeadline = campaign.deadline as Date | null;

      for (const candidate of campaign.candidates) {
        const subs = subsByUser.get(candidate.userId) ?? [];
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
        const entry: ParticipantEntry = {
          userId:        candidate.userId,
          githubUsername: candidate.user.githubUsername ?? "unknown",
          score:         best.scoreTotal ?? 0,
          diag:          best.scoreDiagnosis,
          design:        best.scoreDesign,
          comms:         best.scoreCommunication,
          exec:          best.scoreExecution,
          verbalPenalty: best.verbalPenalty ?? 0,
          stack,
          campaignName:  campaign.roleName,
        };

        const existing = bestByUser.get(candidate.userId);
        if (!existing || entry.score > existing.score) bestByUser.set(candidate.userId, entry);
      }
    }

    const allParticipants: ParticipantEntry[] = [...bestByUser.values()];

    // Group by category
    const groups: Record<string, CategoryMeta & { participants: ParticipantEntry[] }> = {};

    for (const p of allParticipants) {
      const cat = CATEGORY_MAP[p.stack] ?? OTHER_CATEGORY;
      if (!groups[cat.name]) groups[cat.name] = { ...cat, participants: [] };
      groups[cat.name].participants.push(p);
    }

    const categories = Object.values(groups)
      .sort((a, b) => a.order - b.order)
      .map((cat) => ({
        name:  cat.name,
        icon:  cat.icon,
        participants: cat.participants
          .sort((a, b) => b.score - a.score)
          .map((p, i) => ({ ...p, rank: i + 1 })),
      }));

    const champion = allParticipants.length
      ? allParticipants.reduce((best, p) => (p.score > best.score ? p : best))
      : null;

    const data = {
      tag,
      deadline: deadline ? deadline.toISOString() : null,
      companyName: org.brandName || companyName,
      branding: {
        logoUrl:      org.logoUrl      ?? null,
        primaryColor: org.primaryColor || "#5B5BD6",
        accentColor:  org.accentColor  || "#E8762B",
        brandName:    org.brandName    || companyName,
      },
      categories,
      overallChampion: champion
        ? { ...champion, rank: 1, category: CATEGORY_MAP[champion.stack]?.name ?? "Unknown" }
        : null,
    };

    cacheSet(cacheKey, data, LEADERBOARD_TTL_MS);
    res.json({ data });
  } catch (err) {
    console.error("[devfest] error:", err);
    res.status(500).json({ error: "Failed to load DevFest leaderboard" });
  }
});

export default router;
