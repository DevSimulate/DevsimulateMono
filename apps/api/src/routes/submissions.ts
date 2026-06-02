import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest, ReviewJobData } from "../types/index";
import prisma from "../lib/prisma";
import { reviewQueue } from "../lib/queue";
import { scoreFollowUpAnswers, generateQ2FromA1, generateQ2FromA1ForDesign, fetchPrDiff } from "../services/review.service";
import { updateUserSkillScore } from "../services/score.service";
import { reviewEvents } from "../lib/review-events";

const router = Router();

router.use(requireAuth as (req: Request, res: Response, next: () => void) => void);

/**
 * POST /submissions
 * Body (code):   { ticketId, prUrl, prDescription, branchName }
 * Body (design): { ticketId, designDoc }
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { ticketId, prUrl, prDescription, branchName, designDoc } = req.body as {
    ticketId?: string;
    prUrl?: string;
    prDescription?: string;
    branchName?: string;
    designDoc?: string;
  };

  if (!ticketId) {
    res.status(400).json({ error: "Missing required field: ticketId" });
    return;
  }

  const isDesign = Boolean(designDoc);
  const isCode   = Boolean(prUrl);

  if (!isDesign && !isCode) {
    res.status(400).json({ error: "Provide either prUrl (code review) or designDoc (system design)" });
    return;
  }

  if (isCode && (!prDescription || !branchName)) {
    res.status(400).json({ error: "Code review requires: prUrl, prDescription, branchName" });
    return;
  }

  try {
    // Free tier limit: 2 submissions per month
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.subscriptionTier === "FREE") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const count = await prisma.submission.count({
        where: { userId, submittedAt: { gte: startOfMonth }, status: { not: "VOID" } },
      });
      if (count >= 2) {
        res.status(402).json({
          error: "You have used your 2 free submissions this month. Upgrade to Pro for unlimited tickets.",
          upgradeRequired: true,
        });
        return;
      }
    }

    let jobData: ReviewJobData;

    if (isDesign) {
      const submission = await prisma.submission.create({
        data: { userId, ticketId, designDoc, status: "PENDING" },
        include: { ticket: true },
      });

      jobData = {
        submissionId: submission.id,
        submissionType: "SYSTEM_DESIGN",
        ticketId,
        designDoc: designDoc!,
      };

      await reviewQueue.add("review-pr", jobData, { jobId: `review-${submission.id}` });
      console.log(`[submissions] Queued SD review for submission ${submission.id}`);
      res.status(201).json({ data: submission });
    } else {
      const prUrlMatch = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(prUrl!);
      if (!prUrlMatch) {
        res.status(400).json({ error: "Invalid PR URL — must be a GitHub PR link" });
        return;
      }
      const [, repoOwner, repoName, prNumberStr] = prUrlMatch;
      const prNumber = parseInt(prNumberStr, 10);

      const submission = await prisma.submission.create({
        data: { userId, ticketId, prUrl, prDescription, branchName, status: "PENDING" },
        include: { ticket: true },
      });

      jobData = {
        submissionId: submission.id,
        submissionType: "CODE",
        ticketId,
        prUrl: prUrl!,
        prDescription: prDescription!,
        branchName: branchName!,
        repoOwner,
        repoName,
        prNumber,
      };

      await reviewQueue.add("review-pr", jobData, { jobId: `review-${submission.id}` });
      console.log(`[submissions] Queued code review for submission ${submission.id} (PR #${prNumber})`);
      res.status(201).json({ data: submission });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create submission";
    console.error("[submissions] create error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /submissions/history?limit=20
 * Returns recent submissions for charting score progress over time.
 */
router.get("/history", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const limit = Math.min(Number(req.query.limit ?? 20), 50);

  try {
    const submissions = await prisma.submission.findMany({
      where: { userId, status: "REVIEWED" },
      orderBy: { submittedAt: "asc" },
      take: limit,
      select: {
        submittedAt: true,
        scoreTotal: true,
        scoreDiagnosis: true,
        scoreDesign: true,
        scoreCommunication: true,
        scoreExecution: true,
        ticket: { select: { title: true } },
      },
    });

    const data = submissions.map((s) => ({
      submittedAt: s.submittedAt,
      scoreTotal: s.scoreTotal,
      scoreDiagnosis: s.scoreDiagnosis,
      scoreDesign: s.scoreDesign,
      scoreCommunication: s.scoreCommunication,
      scoreExecution: s.scoreExecution,
      ticketTitle: s.ticket.title,
    }));

    res.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch history";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /submissions/latest
 * Returns the most recent submission for the authenticated user, including
 * the Claude review if available.
 */
router.get("/latest", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;

  try {
    const submission = await prisma.submission.findFirst({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      include: { ticket: { include: { codebase: true } } },
    });

    if (!submission) {
      res.status(404).json({ error: "No submissions found" });
      return;
    }

    res.json({ data: submission });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch submission";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /submissions
 * Returns all submissions for the authenticated user, newest first.
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;

  try {
    const submissions = await prisma.submission.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      include: { ticket: true, followUp: true },
    });

    res.json({ data: submissions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list submissions";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /submissions/:id
 * Returns a single submission by id (must belong to the authenticated user).
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;

  try {
    const submission = await prisma.submission.findFirst({
      where: { id: req.params.id, userId },
      include: { ticket: { include: { codebase: true } } },
    });

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json({ data: submission });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch submission";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /submissions/:id/followup
 * Returns follow-up questions for a submission (if generated).
 */
router.get("/:id/followup", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;

  try {
    const submission = await prisma.submission.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const followUp = await prisma.followUpQuestion.findUnique({
      where: { submissionId: req.params.id },
    });

    if (!followUp) {
      res.status(404).json({ error: "Follow-up questions not yet generated" });
      return;
    }

    res.json({ data: followUp });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch follow-up";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /submissions/:id/followup
 * Body: { answer1, answer2, aiDeclaration }
 * Submits answers, scores them with Claude, adds bonus to scoreTotal.
 */
router.post("/:id/followup", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { answer1, answer2, aiDeclaration, pasteAttempts } = req.body as {
    answer1?: string;
    answer2?: string;
    aiDeclaration?: string;
    pasteAttempts?: number;
  };

  const validDeclarations = ["NO_AI_USED", "AI_USED_FOR_PHRASING", "AI_USED_FOR_UNDERSTANDING", "AI_USED_FOR_ANSWER"];
  if (!answer1 || !answer2) {
    res.status(400).json({ error: "Both answers are required" });
    return;
  }
  if (!aiDeclaration || !validDeclarations.includes(aiDeclaration)) {
    res.status(400).json({ error: "aiDeclaration is required" });
    return;
  }

  try {
    const submission = await prisma.submission.findFirst({
      where: { id: req.params.id, userId },
      include: { ticket: { include: { codebase: true } } },
    });

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const followUp = await prisma.followUpQuestion.findUnique({
      where: { submissionId: req.params.id },
    });

    if (!followUp) {
      res.status(404).json({ error: "Follow-up questions not found" });
      return;
    }

    // Behavioral integrity signal: paste attempts into the Q&A boxes raise risk.
    // The questions are generated from the candidate's own code — pasting a long
    // answer has no legitimate use. +20 risk per attempt, capped at 60.
    if (pasteAttempts && pasteAttempts > 0) {
      const pasteRisk = Math.min(pasteAttempts * 20, 60);
      const newRisk = Math.min((submission.riskScore ?? 0) + pasteRisk, 100);
      await prisma.submission.update({
        where: { id: submission.id },
        data: { riskScore: newRisk },
      });
    }

    if (followUp.answeredAt) {
      res.status(409).json({ error: "Already answered" });
      return;
    }

    const scored = await scoreFollowUpAnswers(
      submission.ticket as any,
      followUp.question1,
      followUp.question2 ?? "",
      answer1,
      answer2,
      aiDeclaration!
    );

    // Tiered bonus based on declared AI usage level.
    // Mismatch penalty differs by declaration: PHRASING gets -10 (smaller gap),
    // NO_AI_USED gets -20 (claimed full independence).
    const MISMATCH_PENALTY: Record<string, number> = {
      NO_AI_USED:           20,
      AI_USED_FOR_PHRASING: 10,
    };
    const BONUS_MULTIPLIER: Record<string, number> = {
      NO_AI_USED:                1.0,
      AI_USED_FOR_PHRASING:      1.0,
      AI_USED_FOR_UNDERSTANDING: 0.5,
      AI_USED_FOR_ANSWER:        0.0,
    };
    const HONESTY_REWARD = aiDeclaration === "AI_USED_FOR_ANSWER" ? 3 : 0;
    const multiplier     = BONUS_MULTIPLIER[aiDeclaration!] ?? 1.0;
    const mismatchPenalty = scored.declarationMismatch
      ? (MISMATCH_PENALTY[aiDeclaration!] ?? 20)
      : 0;
    const effectiveBonus  = scored.declarationMismatch
      ? 0
      : Math.round(scored.scoreBonus * multiplier) + HONESTY_REWARD;

    const updated = await prisma.followUpQuestion.update({
      where: { id: followUp.id },
      data: {
        answer1,
        answer2,
        scoreBonus: effectiveBonus,
        claudeFeedback: scored.feedback,
        aiDeclaration: aiDeclaration as any,
        declarationMismatch: scored.declarationMismatch,
        employerSummary: scored.employerSummary,
        answeredAt: new Date(),
      },
    });

    /**
     * INTENTIONAL DESIGN DECISION:
     *
     * Base score dominates final score by design.
     *
     * A developer who copy-pasted everything but whose code actually works
     * correctly will score approximately 60–65 after mismatch penalty.
     *
     * This is philosophically correct:
     * - Their code fix was genuinely good (base score reflects this)
     * - Their understanding was not proven (penalty reflects this)
     * - 63/100 accurately represents partial value
     *
     * We do NOT want to collapse scores to zero for technically correct fixes.
     * The employer sees both the raw PR score and the final adjusted score.
     * The gap between them tells the story.
     *
     * Example:
     * PR Score:    83/100  (code was excellent)
     * Final Score: 63/100  (understanding unproven)
     * Gap:         20 pts
     * Employer interpretation: Great code, unclear if they understood what they fixed.
     */
    const finalScore = Math.max(0, Math.min((submission.scoreTotal ?? 0) + effectiveBonus - mismatchPenalty, 100));
    await prisma.submission.update({
      where: { id: req.params.id },
      data: { scoreTotal: finalScore },
    });
    await updateUserSkillScore(submission.userId, finalScore);

    const bonusNote =
      scored.declarationMismatch
        ? `Declaration mismatch detected — bonus forfeited and ${mismatchPenalty} pts deducted.`
        : aiDeclaration === "AI_USED_FOR_ANSWER"
        ? `You honestly declared AI wrote your answers. No follow-up bonus, but +${HONESTY_REWARD} pts for transparency.`
        : aiDeclaration === "AI_USED_FOR_UNDERSTANDING"
        ? `You used AI to understand the concepts. Bonus reduced to 50% (${effectiveBonus} pts) to reflect partial independent work.`
        : null;

    res.json({
      data: {
        scoreBonus: effectiveBonus,
        feedback: scored.feedback,
        followUp: updated,
        declarationMismatch: scored.declarationMismatch,
        mismatchPenalty,
        bonusNote,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit follow-up";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /submissions/:id/stream
 *
 * Server-Sent Events endpoint. Sends a single "reviewed" event the moment
 * the BullMQ worker finishes scoring. Client holds one persistent connection
 * instead of polling every 3 seconds.
 */
router.get("/:id/stream", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const subId = req.params.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering on Railway
  res.flushHeaders();

  // If already reviewed, send event immediately and close
  try {
    const existing = await prisma.submission.findFirst({ where: { id: subId, userId } });
    if (existing?.status === "REVIEWED") {
      res.write("data: reviewed\n\n");
      res.end();
      return;
    }
  } catch { /* proceed to listen */ }

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 20_000);

  const onReviewed = (id: string) => {
    if (id === subId) {
      res.write("data: reviewed\n\n");
      res.end();
      cleanup();
    }
  };

  const cleanup = () => {
    reviewEvents.off("reviewed", onReviewed);
    clearInterval(heartbeat);
  };

  reviewEvents.on("reviewed", onReviewed);
  req.on("close", cleanup);
});

/**
 * POST /submissions/:id/followup/answer1
 * Body: { answer1 }
 *
 * Receives the developer's answer to Q1, then generates Q2 based on that
 * answer so it cannot be pre-generated by AI (Q2 didn't exist until A1 arrived).
 */
router.post("/:id/followup/answer1", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { answer1 } = req.body as { answer1?: string };

  if (!answer1 || answer1.trim().length < 10) {
    res.status(400).json({ error: "answer1 is required" });
    return;
  }

  try {
    const submission = await prisma.submission.findFirst({
      where: { id: req.params.id, userId },
      include: { ticket: { include: { codebase: true } } },
    });

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const followUp = await prisma.followUpQuestion.findUnique({
      where: { submissionId: req.params.id },
    });

    if (!followUp) {
      res.status(404).json({ error: "Follow-up questions not found" });
      return;
    }

    if (followUp.answer1) {
      res.status(409).json({ error: "Q1 already answered" });
      return;
    }

    // Generate Q2 from A1 — route by submission type
    let question2: string;
    if (submission.designDoc) {
      const result = await generateQ2FromA1ForDesign(
        submission.ticket as any,
        submission.designDoc,
        followUp.question1,
        answer1
      );
      question2 = result.question2;
    } else {
      const prUrlMatch = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(submission.prUrl ?? "");
      if (!prUrlMatch) {
        res.status(400).json({ error: "Cannot parse PR URL to fetch diff" });
        return;
      }
      const [, repoOwner, repoName, prNumberStr] = prUrlMatch;
      const prDiff = await fetchPrDiff(repoOwner, repoName, parseInt(prNumberStr, 10));
      const result = await generateQ2FromA1(submission.ticket as any, prDiff, followUp.question1, answer1);
      question2 = result.question2;
    }

    await prisma.followUpQuestion.update({
      where: { id: followUp.id },
      data: { answer1, question2: question2 },
    });

    res.json({ data: { question2: question2 } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate Q2";
    console.error("[submissions] answer1 error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
