import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

interface ParticipantEntry {
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

type CategoryMeta = { name: string; icon: string; order: number };

const CATEGORY_MAP: Record<string, CategoryMeta> = {
  REACT:         { name: "Frontend",       icon: "🖥️",  order: 1 },
  ANGULAR:       { name: "Frontend",       icon: "🖥️",  order: 1 },
  JAVA:          { name: "Backend",        icon: "⚙️",  order: 2 },
  CPP:           { name: "Backend",        icon: "⚙️",  order: 2 },
  DOTNET:        { name: "Backend",        icon: "⚙️",  order: 2 },
  PYTHON:        { name: "Backend",        icon: "⚙️",  order: 2 },
  NODE:          { name: "Backend",        icon: "⚙️",  order: 2 },
  DEVOPS:        { name: "DevOps / Infra", icon: "🚀",  order: 3 },
  SYSTEM_DESIGN: { name: "System Design",  icon: "🏗️", order: 4 },
};

// GET /devfest/:tag — public leaderboard aggregated across all campaigns for a DevFest event
router.get("/:tag", async (req: Request, res: Response): Promise<void> => {
  try {
    const { tag } = req.params;

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

    const allParticipants: ParticipantEntry[] = [];

    for (const campaign of campaigns) {
      const firstTicket = await prisma.ticket.findFirst({
        where: { codebaseId: campaign.codebaseId },
        select: { stack: true },
      });
      const stack = (firstTicket?.stack ?? "NODE").toString();

      for (const candidate of campaign.candidates) {
        const sub = await prisma.submission.findFirst({
          where: {
            userId: candidate.userId,
            status: "REVIEWED",
            finalized: true,
            ticket: { codebaseId: campaign.codebaseId },
          },
          orderBy: { scoreTotal: "desc" },
          select: {
            scoreTotal: true, scoreDiagnosis: true, scoreDesign: true,
            scoreCommunication: true, scoreExecution: true, verbalPenalty: true,
          },
        });

        if (sub && sub.scoreTotal != null) {
          allParticipants.push({
            githubUsername: candidate.user.githubUsername ?? "unknown",
            score:        sub.scoreTotal,
            diag:         sub.scoreDiagnosis,
            design:       sub.scoreDesign,
            comms:        sub.scoreCommunication,
            exec:         sub.scoreExecution,
            verbalPenalty: sub.verbalPenalty ?? 0,
            stack,
            campaignName: campaign.roleName,
          });
        }
      }
    }

    // Group by category
    const groups: Record<string, CategoryMeta & { participants: ParticipantEntry[] }> = {};

    for (const p of allParticipants) {
      const cat = CATEGORY_MAP[p.stack] ?? { name: "Other", icon: "💻", order: 5 };
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

    res.json({
      data: {
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
      },
    });
  } catch (err) {
    console.error("[devfest] error:", err);
    res.status(500).json({ error: "Failed to load DevFest leaderboard" });
  }
});

export default router;
