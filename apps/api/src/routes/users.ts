import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

/**
 * GET /users/leaderboard
 * Public endpoint — no auth required.
 * Returns top 50 users ranked by average score across reviewed submissions.
 */
router.get("/leaderboard", async (req: Request, res: Response): Promise<void> => {
  const stackFilter = (req.query.stack as string | undefined)?.toUpperCase();
  try {
    // Pull reviewed submissions WITH the stack of the ticket they solved, so a
    // developer is ranked within the stack they actually worked in — not a
    // single global pool that mixes C++ with Angular.
    const submissions = await prisma.submission.findMany({
      where: {
        status: "REVIEWED",
        ...(stackFilter ? { ticket: { stack: stackFilter as never } } : {}),
      },
      select: {
        scoreTotal: true,
        user: { select: { githubUsername: true } },
        ticket: { select: { stack: true } },
      },
    });

    // Group by (githubUsername + stack)
    const groups = new Map<string, { username: string; stack: string; scores: number[] }>();
    for (const s of submissions) {
      const username = s.user.githubUsername ?? "unknown";
      const stack = s.ticket.stack;
      const key = `${username}::${stack}`;
      if (!groups.has(key)) groups.set(key, { username, stack, scores: [] });
      groups.get(key)!.scores.push(s.scoreTotal ?? 0);
    }

    const ranked = [...groups.values()]
      .map((g) => ({
        githubUsername: g.username,
        stack: g.stack,
        ticketsCompleted: g.scores.length,
        averageScore: Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length),
        bestScore: Math.max(...g.scores),
      }))
      .sort((a, b) => b.averageScore - a.averageScore || b.ticketsCompleted - a.ticketsCompleted)
      .slice(0, 100);

    // Which stacks have any entries (for the page's stack tabs)
    const stacks = [...new Set([...groups.values()].map((g) => g.stack))].sort();

    res.json({ data: ranked, stacks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch leaderboard";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /users/:username/profile
 * Public endpoint — no auth required.
 * Returns aggregated developer profile for the public profile page.
 */
router.get(
  "/:username/profile",
  async (req: Request, res: Response): Promise<void> => {
    const { username } = req.params;

    try {
      const user = await prisma.user.findUnique({
        where: { githubUsername: username },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const reviewed = await prisma.submission.findMany({
        where: { userId: user.id, status: "REVIEWED" },
        orderBy: { submittedAt: "desc" },
        include: { ticket: true },
      });

      const total = reviewed.length;

      const avgScore =
        total > 0
          ? Math.round(reviewed.reduce((s, r) => s + (r.scoreTotal ?? 0), 0) / total)
          : 0;

      const avgDiagnosis =
        total > 0
          ? Math.round(reviewed.reduce((s, r) => s + (r.scoreDiagnosis ?? 0), 0) / total)
          : 0;

      const avgDesign =
        total > 0
          ? Math.round(reviewed.reduce((s, r) => s + (r.scoreDesign ?? 0), 0) / total)
          : 0;

      const avgCommunication =
        total > 0
          ? Math.round(reviewed.reduce((s, r) => s + (r.scoreCommunication ?? 0), 0) / total)
          : 0;

      const avgExecution =
        total > 0
          ? Math.round(reviewed.reduce((s, r) => s + (r.scoreExecution ?? 0), 0) / total)
          : 0;

      const totalSubmissions = await prisma.submission.count({
        where: { userId: user.id },
      });

      const recentSubmissions = reviewed.slice(0, 3).map((s) => ({
        ticketTitle: s.ticket.title,
        scoreTotal: s.scoreTotal,
        submittedAt: s.submittedAt,
        status: s.status,
      }));

      res.json({
        data: {
          githubUsername: user.githubUsername,
          primaryStack: user.primaryStack ?? "Unknown",
          skillScore: user.skillScore,
          subscriptionTier: user.subscriptionTier,
          totalSubmissions,
          ticketsCompleted: total,
          averageScore: avgScore,
          scoreDiagnosis: avgDiagnosis,
          scoreDesign: avgDesign,
          scoreCommunication: avgCommunication,
          scoreExecution: avgExecution,
          recentSubmissions,
          joinedAt: user.createdAt,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch profile";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
