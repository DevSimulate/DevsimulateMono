import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

/**
 * GET /users/leaderboard
 * Public endpoint — no auth required.
 * Returns top 50 users ranked by average score across reviewed submissions.
 */
router.get("/leaderboard", async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: {
        submissions: {
          some: { status: "REVIEWED" },
        },
      },
      select: {
        githubUsername: true,
        primaryStack: true,
        createdAt: true,
        submissions: {
          where: { status: "REVIEWED" },
          select: {
            scoreTotal: true,
            scoreDiagnosis: true,
            scoreDesign: true,
            scoreCommunication: true,
            scoreExecution: true,
            submittedAt: true,
          },
        },
      },
    });

    const ranked = users
      .map((u) => {
        const scores = u.submissions.map((s) => s.scoreTotal ?? 0);
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const best = Math.max(...scores);
        return {
          githubUsername: u.githubUsername,
          primaryStack: u.primaryStack ?? "Unknown",
          ticketsCompleted: scores.length,
          averageScore: avg,
          bestScore: best,
          joinedAt: u.createdAt,
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore || b.ticketsCompleted - a.ticketsCompleted)
      .slice(0, 50);

    res.json({ data: ranked });
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
