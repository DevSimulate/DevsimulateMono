import { Router, Request, Response, raw } from "express";
import { transcribeAudio } from "../lib/whisper";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest, ReviewJobData } from "../types/index";
import prisma from "../lib/prisma";
import { reviewQueue } from "../lib/queue";
import { scoreFollowUpAnswers, generateQ2FromA1, generateQ2FromA1ForDesign, fetchPrDiff, generateVerbalQuestion, scoreVerbalAnswer, generateVerbalQuestionForDesign, scoreVerbalAnswerForDesign } from "../services/review.service";
import { recomputeUserSkillScore } from "../services/score.service";
import { reviewEvents } from "../lib/review-events";
import { triggerHiddenTest } from "../lib/grader";

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

    // Enforce the campaign deadline — once a contest/campaign has closed, it
    // accepts no further submissions. Scope this to the campaigns that actually
    // contain THIS ticket: an unrelated expired campaign on the same codebase
    // (e.g. an old event the candidate also joined) must NOT block a submission
    // to a different, still-open campaign.
    const ticketMeta = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { codebaseId: true, difficulty: true },
    });
    if (ticketMeta) {
      const memberships = await prisma.campaignCandidate.findMany({
        where: { userId, campaign: { codebaseId: ticketMeta.codebaseId } },
        select: { campaign: { select: { roleName: true, deadline: true, ticketIds: true, difficulty: true } } },
      });
      const containsTicket = (c: { ticketIds: string[]; difficulty: typeof ticketMeta.difficulty }) =>
        c.ticketIds.length ? c.ticketIds.includes(ticketId) : c.difficulty === ticketMeta.difficulty;
      const relevant = memberships.map((m) => m.campaign).filter(containsTicket);

      const now = new Date();
      const hasOpen = relevant.some((c) => !c.deadline || c.deadline >= now);
      const closed = relevant.find((c) => c.deadline && c.deadline < now);

      // Block only if this ticket's campaign has closed AND there is no still-open
      // campaign for it.
      if (closed && !hasOpen) {
        res.status(403).json({
          error: `This competition has closed — the deadline for “${closed.roleName}” has passed, so no more submissions are accepted.`,
        });
        return;
      }
    }

    // The BRANCH is the ground truth for which ticket this work belongs to — the
    // client's ticketId is not trusted. A returning candidate with several open
    // assignments can otherwise submit ticket A's PR under ticket B's id, which
    // silently scores them against the wrong rubric and generates follow-up
    // questions about a bug they never touched. Fail loudly instead.
    if (isCode) {
      const branchAssignment = await prisma.ticketAssignment.findFirst({
        where: { userId, branchName },
        include: { ticket: { select: { title: true } } },
      });

      if (branchAssignment && branchAssignment.ticketId !== ticketId) {
        const claimed = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { title: true },
        });
        res.status(400).json({
          error:
            `This branch is for “${branchAssignment.ticket.title}”, but the submission was sent for ` +
            `“${claimed?.title ?? ticketId}”. Open the ticket you actually worked on and submit again.`,
        });
        return;
      }

      if (!branchAssignment) {
        // The branch isn't one we handed out, so it can't confirm the ticket.
        // Require at least that the claimed ticket is assigned to this user.
        const claimedAssignment = await prisma.ticketAssignment.findFirst({
          where: { userId, ticketId },
        });
        if (!claimedAssignment) {
          res.status(400).json({
            error:
              "You don't have an active assignment for this ticket. Open the ticket from your dashboard and submit from the branch it created.",
          });
          return;
        }
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

      // Fire the hidden-test grader (best-effort, non-blocking) — objective
      // correctness check that runs the candidate's fix on a private CI runner.
      void triggerHiddenTest({
        repoOwner, repoName, branch: branchName!, ticketId, submissionId: submission.id,
      });

      res.status(201).json({ data: submission });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create submission";
    console.error("[submissions] create error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /submissions/:id/disqualify
 * Body: { reason? }
 * Called by the assessment UI when a candidate hits the paste limit (3rd attempt).
 * Voids the submission and flags the user as disqualified so they can't re-apply.
 * Admin-reversible — clearing user.disqualifiedAt/Reason restores the account.
 */
router.post("/:id/disqualify", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { reason } = req.body as { reason?: string };
  try {
    const submission = await prisma.submission.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });
    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const disqReason = reason?.trim() || "Repeated paste attempts during the assessment";
    await prisma.$transaction([
      prisma.submission.update({
        where: { id: submission.id },
        data: { status: "VOID", riskScore: 100 },
      }),
      // Only set the flag once — don't overwrite an earlier disqualification time.
      prisma.user.updateMany({
        where: { id: userId, disqualifiedAt: null },
        data: { disqualifiedAt: new Date(), disqualifiedReason: disqReason },
      }),
    ]);

    console.log(`[submissions] user ${userId} disqualified (submission ${submission.id}): ${disqReason}`);
    res.json({ data: { disqualified: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to disqualify";
    console.error("[submissions] disqualify error:", message);
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
  const { answer1, answer2, aiDeclaration, pasteAttempts, tabSwitches } = req.body as {
    answer1?: string;
    answer2?: string;
    aiDeclaration?: string;
    pasteAttempts?: number;
    tabSwitches?: number;
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

    // Behavioral integrity signals raise the risk score:
    //  - paste attempts into the Q&A boxes (+20 each, cap 60)
    //  - tab switches / focus loss during the timed assessment (+10 each, cap 30)
    // Both are deterministic facts, not text guesses.
    const pastes = pasteAttempts && pasteAttempts > 0 ? pasteAttempts : 0;
    const switches = tabSwitches && tabSwitches > 0 ? tabSwitches : 0;
    if (pastes > 0 || switches > 0) {
      const behaviorRisk = Math.min(pastes * 20, 60) + Math.min(switches * 10, 30);
      const newRisk = Math.min((submission.riskScore ?? 0) + behaviorRisk, 100);
      await prisma.submission.update({
        where: { id: submission.id },
        data: { riskScore: newRisk, pasteAttempts: pastes },
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

    // NO BONUS and NO AUTO-PENALTY. The follow-up Q&A is a verification gate, not a
    // points source. AI use is allowed and expected, so we no longer dock points for a
    // declaration "mismatch" — that punished AI use rather than measuring judgment.
    // Instead the PR review's Verification dimension already scores whether the candidate
    // understood and verified their work, and `declarationMismatch` / `employerSummary`
    // are surfaced to the employer as the Verification Quality note (advisory, not a gate).
    const mismatchPenalty = 0;
    const effectiveBonus = 0;

    const updated = await prisma.followUpQuestion.update({
      where: { id: followUp.id },
      data: {
        answer1,
        answer2,
        scoreBonus: 0,
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
    await recomputeUserSkillScore(submission.userId);

    const bonusNote =
      scored.declarationMismatch
        ? `Your answers read as confident but didn't show how you verified the fix. No points were deducted — but a reviewer may probe your understanding. Strong answers explain how you know it works, not just what it does.`
        : aiDeclaration === "AI_USED_FOR_ANSWER"
        ? `You honestly declared AI wrote your answers. No penalty — transparency noted for the reviewer.`
        : aiDeclaration === "AI_USED_FOR_UNDERSTANDING"
        ? `You used AI to understand the concepts and answered in your own words. No penalty.`
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

// ── Verbal explanation (spoken aloud, transcribed; audio not stored) ──────────
const PR_RE = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

/** POST /submissions/:id/verbal-question — a fresh, on-the-spot spoken question. */
router.post("/:id/verbal-question", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  try {
    const sub = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: { ticket: { include: { codebase: true } } },
    });
    if (!sub || sub.userId !== userId) { res.status(404).json({ error: "Submission not found" }); return; }

    let question: string;
    if (sub.designDoc) {
      const result = await generateVerbalQuestionForDesign(sub.ticket as never, sub.designDoc);
      question = result.question;
    } else {
      const m = sub.prUrl ? PR_RE.exec(sub.prUrl) : null;
      if (!m) {
        // No PR to ask about → verbal doesn't apply. Finalize now so the score
        // isn't stuck hidden waiting for a verbal step that can't happen.
        await prisma.submission.update({ where: { id: sub.id }, data: { finalized: true } });
        res.status(400).json({ error: "No valid PR on this submission" });
        return;
      }
      const diff = await fetchPrDiff(m[1], m[2], parseInt(m[3], 10));
      const result = await generateVerbalQuestion(sub.ticket as never, diff);
      question = result.question;
    }

    res.json({ data: { question } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to generate verbal question" });
  }
});

/**
 * Shared verbal scoring: given a transcript (from Whisper or browser STT), compare
 * it to the written answers + code via Claude and apply the graduated penalty.
 */
async function processVerbal(
  submissionId: string,
  userId: string,
  question: string,
  transcript: string
): Promise<{ status: number; body: object }> {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { followUp: true },
  });
  if (!sub || sub.userId !== userId) return { status: 404, body: { error: "Submission not found" } };
  if (!sub.followUp) return { status: 400, body: { error: "Complete the follow-up first" } };

  // ONLY a genuinely empty transcript (mic denied / silence / STT failure) is "not
  // captured" — don't penalise a technical issue. A real short answer like "I don't
  // know" is a FAILING answer and must be scored, not skipped.
  const words = (transcript ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    await prisma.followUpQuestion.update({
      where: { id: sub.followUp.id },
      data: {
        verbalTranscript: transcript ?? "",
        verbalScore: null,
        verbalNote: "No spoken answer captured — not scored; flag for review.",
      },
    });
    return { status: 200, body: { data: { score: null, consistent: null, note: "No spoken answer captured.", penalty: 0, newScoreTotal: sub.scoreTotal ?? 0 } } };
  }

  let scored: Awaited<ReturnType<typeof scoreVerbalAnswer>>;
  if (sub.designDoc) {
    scored = await scoreVerbalAnswerForDesign(
      question, transcript, sub.followUp.answer1 ?? "", sub.followUp.answer2 ?? "", sub.designDoc
    );
  } else {
    const m = sub.prUrl ? PR_RE.exec(sub.prUrl) : null;
    if (!m) return { status: 400, body: { error: "No valid PR on this submission" } };
    const diff = await fetchPrDiff(m[1], m[2], parseInt(m[3], 10));
    scored = await scoreVerbalAnswer(
      question, transcript, sub.followUp.answer1 ?? "", sub.followUp.answer2 ?? "", diff
    );
  }

  // Graduated penalty — >=7: no change. Can't defend it aloud / inconsistent: full -20.
  let verbalPenalty = 0;
  if (!scored.consistent || scored.score <= 3) verbalPenalty = 20;
  else if (scored.score < 7) verbalPenalty = (7 - scored.score) * 4; // 4 / 8 / 12

  // Attribute the deduction to the two "understanding" dimensions the verbal
  // actually tests — Diagnosis (40) and Design (30) — instead of a flat hit on
  // the total. Split 40:30, take from Diagnosis first, and never drive a
  // dimension below 0. This keeps the breakdown coherent: a weak spoken defence
  // lowers the very scores (root-cause understanding + design judgement) it
  // calls into question. The original per-dimension scores are preserved in the
  // stored claudeReview JSON for audit.
  const curDiag = sub.scoreDiagnosis ?? 0;
  const curDesign = sub.scoreDesign ?? 0;
  const actualPenalty = Math.min(verbalPenalty, curDiag + curDesign);
  let diagCut = Math.min(curDiag, Math.round(actualPenalty * (40 / 70)));
  let designCut = Math.min(curDesign, actualPenalty - diagCut);
  diagCut = Math.min(curDiag, diagCut + (actualPenalty - diagCut - designCut)); // rounding spill → diagnosis
  const newDiag = curDiag - diagCut;
  const newDesign = curDesign - designCut;
  const newScoreTotal = Math.max(0, (sub.scoreTotal ?? 0) - actualPenalty);

  // Verbal is scored — the assessment is now complete, so publish it.
  await prisma.submission.update({
    where: { id: sub.id },
    data: {
      scoreTotal: newScoreTotal,
      scoreDiagnosis: newDiag,
      scoreDesign: newDesign,
      verbalPenalty: actualPenalty,
      finalized: true,
    },
  });
  await prisma.followUpQuestion.update({
    where: { id: sub.followUp.id },
    data: { verbalTranscript: transcript, verbalScore: scored.score, verbalNote: scored.note },
  });
  await recomputeUserSkillScore(sub.userId); // reflect the verbal deduction in Skill Score

  return {
    status: 200,
    body: {
      data: {
        ...scored,
        penalty: actualPenalty,
        newScoreTotal,
        scoreDiagnosis: newDiag,
        scoreDesign: newDesign,
      },
    },
  };
}

/** POST /submissions/:id/verbal — body { question, transcript } (browser STT). */
router.post("/:id/verbal", async (req: Request, res: Response): Promise<void> => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { question, transcript } = req.body as { question?: string; transcript?: string };
  try {
    const r = await processVerbal(req.params.id, userId, question ?? "", transcript ?? "");
    res.status(r.status).json(r.body);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to score verbal answer" });
  }
});

/**
 * POST /submissions/:id/verbal-transcribe — raw audio body (audio/webm).
 * Transcribes with Whisper and returns the text ONLY (no scoring), so the
 * candidate can review exactly what was captured before it's scored.
 */
router.post(
  "/:id/verbal-transcribe",
  raw({ type: () => true, limit: "25mb" }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const audio = req.body as Buffer;
      if (!audio || !audio.length) { res.status(400).json({ error: "No audio received" }); return; }
      const mime = (req.headers["content-type"] as string) || "audio/webm";
      const transcript = await transcribeAudio(audio, mime);
      res.json({ data: { transcript } });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to transcribe audio" });
    }
  }
);

/**
 * POST /submissions/:id/verbal-audio?question=... — raw audio body (audio/webm).
 * Transcribes with Whisper, then runs the same scoring. Used when OPENAI_API_KEY is set.
 */
router.post(
  "/:id/verbal-audio",
  raw({ type: () => true, limit: "25mb" }),
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = (req as AuthenticatedRequest).user;
    const question = (req.query.question as string) ?? "";
    try {
      const audio = req.body as Buffer;
      if (!audio || !audio.length) { res.status(400).json({ error: "No audio received" }); return; }
      const mime = (req.headers["content-type"] as string) || "audio/webm";
      const transcript = await transcribeAudio(audio, mime);
      const r = await processVerbal(req.params.id, userId, question, transcript);
      res.status(r.status).json(r.body);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to transcribe/score audio" });
    }
  }
);

export default router;
