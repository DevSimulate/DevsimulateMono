/**
 * Employer demo endpoints — no auth required, for investor demo only.
 * Routes:
 *   GET  /employer/dashboard/stats
 *   GET  /employer/candidates/:userId
 *   POST /employer/candidates/compare
 *   POST /employer/demo/reset
 */

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { seedDemo } from "../lib/seed-demo";

const router = Router();

// ─── Pure helpers (no I/O) ────────────────────────────────────────────────────

function toDisplayName(username: string): string {
  return username
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toInitials(username: string): string {
  return username
    .split("-")
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function toAuthScore(riskScore: number): number {
  return Math.max(0, Math.min(100, 100 - riskScore));
}

function toTicketCode(title: string): string {
  return title.split(":")[0].trim();
}

function toTicketTitle(title: string): string {
  const parts = title.split(":");
  return parts.length > 1 ? parts.slice(1).join(":").trim() : title;
}

function stackLabel(stack: string): string {
  const m: Record<string, string> = {
    DOTNET: ".NET",
    NODE: "Node.js",
    ANGULAR: "Angular",
    REACT: "React",
  };
  return m[stack] ?? stack;
}

function isFlagged(authScore: number, mismatch: boolean): boolean {
  return authScore < 50 && mismatch;
}

function recommendation(
  total: number,
  authScore: number,
  flagged: boolean
): string {
  if (flagged || total < 50) return "NO";
  if (total > 80 && authScore > 80) return "STRONG YES";
  if (total > 70 && authScore > 65) return "YES";
  if (total > 60) return "MAYBE";
  return "NO";
}

// ─── GET /employer/dashboard/stats ───────────────────────────────────────────

router.get(
  "/employer/dashboard/stats",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const submissions = await prisma.submission.findMany({
        where: { status: "REVIEWED", scoreTotal: { not: null } },
        include: { user: true, ticket: true, followUp: true },
        orderBy: { submittedAt: "desc" },
      });

      const candidates = submissions.map((sub) => {
        const auth = toAuthScore(sub.riskScore);
        const mismatch = sub.followUp?.declarationMismatch ?? false;
        const flagged = isFlagged(auth, mismatch);

        return {
          id: sub.userId,
          name: toDisplayName(sub.user.githubUsername ?? "unknown"),
          email:
            sub.user.email ??
            `${sub.user.githubUsername}@demo.devsimulate.io`,
          initials: toInitials(sub.user.githubUsername ?? "U"),
          githubUsername: sub.user.githubUsername,
          ticket: {
            code: toTicketCode(sub.ticket.title),
            title: toTicketTitle(sub.ticket.title),
            difficulty: sub.ticket.difficulty as "JUNIOR" | "MID" | "SENIOR",
          },
          score: sub.scoreTotal ?? 0,
          authenticityScore: auth,
          aiDeclaration:
            (sub.followUp?.aiDeclaration as string | null) ?? "NO_AI_USED",
          declarationMismatch: mismatch,
          flagged,
          submittedAt: sub.submittedAt.toISOString(),
          employerSummary: sub.followUp?.employerSummary ?? "",
          timeMinutes: sub.reviewedAt
            ? Math.round(
                (sub.reviewedAt.getTime() - sub.submittedAt.getTime()) / 60_000
              )
            : 0,
        };
      });

      const totalCandidates = candidates.length;
      const integrityFlags = candidates.filter((c) => c.flagged).length;
      const averageScore =
        totalCandidates > 0
          ? Math.round(
              candidates.reduce((s, c) => s + c.score, 0) / totalCandidates
            )
          : 0;

      res.json({
        stats: {
          totalCandidates,
          averageScore,
          integrityFlags,
          completionRate: 100,
        },
        candidates,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch dashboard stats";
      res.status(500).json({ error: message });
    }
  }
);

// ─── GET /employer/candidates/:userId ────────────────────────────────────────

router.get(
  "/employer/candidates/:userId",
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: "Candidate not found" });
        return;
      }

      const sub = await prisma.submission.findFirst({
        where: { userId, status: "REVIEWED" },
        include: { ticket: true, followUp: true },
        orderBy: { submittedAt: "desc" },
      });

      if (!sub) {
        res
          .status(404)
          .json({ error: "No completed assessment found for this candidate" });
        return;
      }

      const auth = toAuthScore(sub.riskScore);
      const mismatch = sub.followUp?.declarationMismatch ?? false;
      const flagged = isFlagged(auth, mismatch);
      const review = (sub.claudeReview ?? {}) as Record<string, unknown>;
      const reviewFeedback = (review.feedback ?? {}) as Record<
        string,
        unknown
      >;

      const timeMinutes = sub.reviewedAt
        ? Math.round(
            (sub.reviewedAt.getTime() - sub.submittedAt.getTime()) / 60_000
          )
        : 0;

      // Percentile — how many candidates on same ticket scored lower
      const allOnTicket = await prisma.submission.findMany({
        where: {
          ticketId: sub.ticketId,
          status: "REVIEWED",
          scoreTotal: { not: null },
        },
        select: { scoreTotal: true },
      });
      const myScore = sub.scoreTotal ?? 0;
      const lowerCount = allOnTicket.filter(
        (s) => (s.scoreTotal ?? 0) < myScore
      ).length;
      const percentile =
        allOnTicket.length > 1
          ? Math.round((lowerCount / (allOnTicket.length - 1)) * 100)
          : 50;

      // Benchmark
      const allScores = allOnTicket.map((s) => s.scoreTotal ?? 0);
      const benchAvg =
        allScores.length > 0
          ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
          : 0;
      const sortedDesc = [...allScores].sort((a, b) => b - a);
      const top10 = sortedDesc[Math.max(0, Math.floor(sortedDesc.length * 0.1) - 1)] ?? sortedDesc[0] ?? 0;

      // Per-question behavior (derived — not stored in DB)
      const q1 = sub.followUp?.question1 ?? "";
      const q2 = sub.followUp?.question2 ?? "";
      const perQuestion = flagged
        ? [
            {
              question: q1,
              pasteEvents: 1,
              pasteChars: 287,
              tabSwitches: 2,
              tabAwaySeconds: 45,
              timeToFirstKeySeconds: 2,
              totalTimeSeconds: 6,
              pattern: "Copy-paste detected",
              patternType: "paste" as const,
            },
            {
              question: q2,
              pasteEvents: 1,
              pasteChars: 312,
              tabSwitches: 3,
              tabAwaySeconds: 38,
              timeToFirstKeySeconds: 1,
              totalTimeSeconds: 11,
              pattern: "Copy-paste detected",
              patternType: "paste" as const,
            },
          ]
        : auth >= 85
        ? [
            {
              question: q1,
              pasteEvents: 0,
              pasteChars: 0,
              tabSwitches: 1,
              tabAwaySeconds: 12,
              timeToFirstKeySeconds: 8,
              totalTimeSeconds: Math.max(60, timeMinutes * 30),
              pattern: "Genuine with research",
              patternType: "research" as const,
            },
            {
              question: q2,
              pasteEvents: 0,
              pasteChars: 0,
              tabSwitches: 0,
              tabAwaySeconds: 0,
              timeToFirstKeySeconds: 23,
              totalTimeSeconds: Math.max(60, timeMinutes * 28),
              pattern: "Fully genuine",
              patternType: "genuine" as const,
            },
          ]
        : [
            {
              question: q1,
              pasteEvents: 0,
              pasteChars: 0,
              tabSwitches: 1,
              tabAwaySeconds: 8,
              timeToFirstKeySeconds: 15,
              totalTimeSeconds: Math.max(60, timeMinutes * 28),
              pattern: "Genuine with research",
              patternType: "research" as const,
            },
            {
              question: q2,
              pasteEvents: 0,
              pasteChars: 0,
              tabSwitches: 1,
              tabAwaySeconds: 5,
              timeToFirstKeySeconds: 12,
              totalTimeSeconds: Math.max(60, timeMinutes * 26),
              pattern: "Genuine with research",
              patternType: "research" as const,
            },
          ];

      // Follow-up questions
      const followUpQuestions: Array<{
        q: string;
        a: string;
        score: number;
        timeTaken: string;
      }> = [];
      if (sub.followUp) {
        const fup = sub.followUp;
        const baseScore = flagged ? 4 : 8;
        if (fup.question1 && fup.answer1) {
          followUpQuestions.push({
            q: fup.question1,
            a: fup.answer1,
            score: baseScore,
            timeTaken: "—",
          });
        }
        if (fup.question2 && fup.answer2) {
          followUpQuestions.push({
            q: fup.question2,
            a: fup.answer2,
            score: Math.max(1, baseScore - 1),
            timeTaken: "—",
          });
        }
      }

      res.json({
        data: {
          id: user.id,
          name: toDisplayName(user.githubUsername ?? "unknown"),
          email:
            user.email ??
            `${user.githubUsername}@demo.devsimulate.io`,
          githubUsername: user.githubUsername,
          initials: toInitials(user.githubUsername ?? "U"),
          ticket: {
            code: toTicketCode(sub.ticket.title),
            title: toTicketTitle(sub.ticket.title),
            difficulty: sub.ticket.difficulty as "JUNIOR" | "MID" | "SENIOR",
            stack: stackLabel(sub.ticket.stack),
            submittedAt: sub.submittedAt.toISOString(),
            timeTakenMinutes: timeMinutes,
            prUrl: sub.prUrl,
            prTitle: `fix: resolve ${toTicketCode(sub.ticket.title).toLowerCase()} async void silent failure`,
            filesChanged: 3,
            linesAdded: 18,
            linesRemoved: 4,
            branchName: sub.branchName,
          },
          scores: {
            total: sub.scoreTotal ?? 0,
            diagnosis: sub.scoreDiagnosis ?? 0,
            design: sub.scoreDesign ?? 0,
            communication: sub.scoreCommunication ?? 0,
            execution: sub.scoreExecution ?? 0,
            bonus: sub.followUp?.scoreBonus ?? 0,
          },
          review: {
            summary: (review.summary as string) ?? "",
            topStrength: (review.topStrength as string) ?? "",
            topImprovement: (review.topImprovement as string) ?? "",
            diagnosis: (reviewFeedback.diagnosis as string) ?? "",
            design: (reviewFeedback.design as string) ?? "",
            communication: (reviewFeedback.communication as string) ?? "",
            execution: (reviewFeedback.execution as string) ?? "",
          },
          followUp: {
            questions: followUpQuestions,
            bonus: sub.followUp?.scoreBonus ?? 0,
            feedback: sub.followUp?.claudeFeedback ?? "",
          },
          authenticity: {
            score: auth,
            declaration:
              (sub.followUp?.aiDeclaration as string | null) ?? "NO_AI_USED",
            mismatch,
            flagged,
            employerSummary: sub.followUp?.employerSummary ?? "",
            perQuestion,
          },
          percentile,
          benchmark: { average: benchAvg, top10 },
          scoreHistory: [
            {
              ticket: toTicketCode(sub.ticket.title),
              score: sub.scoreTotal ?? 0,
              date: sub.submittedAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              }),
            },
          ],
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch candidate";
      res.status(500).json({ error: message });
    }
  }
);

// ─── POST /employer/candidates/compare ───────────────────────────────────────

router.post(
  "/employer/candidates/compare",
  async (req: Request, res: Response): Promise<void> => {
    const { candidateIds } = req.body as { candidateIds?: string[] };

    try {
      const where =
        candidateIds && candidateIds.length > 0
          ? { userId: { in: candidateIds }, status: "REVIEWED" as const }
          : { status: "REVIEWED" as const };

      const submissions = await prisma.submission.findMany({
        where,
        include: { user: true, followUp: true },
        orderBy: { scoreTotal: "desc" },
      });

      const candidates = submissions.map((sub) => {
        const auth = toAuthScore(sub.riskScore);
        const mismatch = sub.followUp?.declarationMismatch ?? false;
        const flagged = isFlagged(auth, mismatch);

        return {
          id: sub.userId,
          name: toDisplayName(sub.user.githubUsername ?? "unknown"),
          initials: toInitials(sub.user.githubUsername ?? "U"),
          total: sub.scoreTotal ?? 0,
          diagnosis: sub.scoreDiagnosis ?? 0,
          design: sub.scoreDesign ?? 0,
          communication: sub.scoreCommunication ?? 0,
          execution: sub.scoreExecution ?? 0,
          authenticity: auth,
          flagged,
          declarationMismatch: mismatch,
          timeMinutes: sub.reviewedAt
            ? Math.round(
                (sub.reviewedAt.getTime() - sub.submittedAt.getTime()) /
                  60_000
              )
            : 0,
          recommendation: recommendation(sub.scoreTotal ?? 0, auth, flagged),
        };
      });

      res.json({ candidates });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to compare candidates";
      res.status(500).json({ error: message });
    }
  }
);

// ─── POST /employer/demo/reset ────────────────────────────────────────────────

router.post(
  "/employer/demo/reset",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await seedDemo();
      res.json({
        message: "Demo data reset. Ahmed, Ali, and Sara are ready.",
        candidates: ["ahmed-khan", "ali-raza", "sara-malik"],
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to reset demo data";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
