import prisma from "../lib/prisma";
import { ClaudeReviewResult } from "../types/index";
import { Submission } from "@prisma/client";
import { SCORING_MODEL, RUBRIC_VERSION } from "../config/scoring";
import { allHiringTicketIds } from "../lib/evaluation-visibility";

/**
 * Persists the Claude review result to the Submission record and updates
 * the user's cumulative skill score.
 *
 * The skill score uses an exponential moving average so early scores don't
 * permanently anchor a developer's reputation:
 *   newScore = 0.8 * previousScore + 0.2 * latestSubmissionScore
 *
 * On first submission the skill score is set directly to the submission score.
 */
export async function saveReviewResult(
  submissionId: string,
  review: ClaudeReviewResult,
  scoring?: {
    /** Every raw scoring run, kept verbatim for audit. */
    scoringRuns?: ClaudeReviewResult[];
    /** True when only one run survived and no median cross-check happened. */
    lowConfidenceScoring?: boolean;
  }
): Promise<Submission> {
  const existing = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!existing) throw new Error(`Submission ${submissionId} no longer exists — skipping review save`);

  const submission = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: "REVIEWED",
      // `review` is the CONSENSUS result — scorePrBase keeps its existing
      // meaning (the raw pre-deduction score), it is just now a median.
      scoreTotal: review.scoreTotal,
      scorePrBase: review.scoreTotal,
      scoreDiagnosis: review.scoreDiagnosis,
      scoreDesign: review.scoreDesign,
      scoreCommunication: review.scoreCommunication,
      scoreExecution: review.scoreExecution,
      lowConfidenceScoring: scoring?.lowConfidenceScoring ?? false,
      claudeReview: {
        ...review,
        ...(scoring?.scoringRuns ? { scoringRuns: scoring.scoringRuns } : {}),
        ...(scoring?.lowConfidenceScoring ? { lowConfidenceScoring: true } : {}),
      } as object,
      // Provenance — pin every score to the judge that produced it.
      modelUsed: SCORING_MODEL,
      rubricVersion: RUBRIC_VERSION,
      reviewedAt: new Date(),
    },
    include: { user: true },
  });

  // EMA update intentionally deferred — runs after follow-up answers
  // so skill score reflects the final combined score, not the base score.

  return submission;
}

/**
 * THE publication path. Setting `finalized` is what makes a score real —
 * leaderboards, employer results and certificates all filter on it — so every
 * route that completes an assessment must go through here rather than writing
 * the flag itself. Forking this logic is how a score ends up published without
 * its skill-score recompute, or recomputed without being published.
 *
 * Idempotent: finalizing an already-finalized submission is a no-op recompute.
 *
 * @param scores optional score adjustments applied atomically with the flag
 *               (the verbal deduction uses this).
 */
export async function finalizeSubmission(
  submissionId: string,
  scores: {
    scoreTotal?: number;
    scoreDiagnosis?: number;
    scoreDesign?: number;
    verbalPenalty?: number;
  } = {}
): Promise<void> {
  const submission = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      ...scores,
      finalized: true,
      // Completing the assessment clears any stuck-assessment flag and the
      // pending-action nudge (the dashboard/extension card).
      needsAttention: false,
      needsAttentionReason: null,
      pendingAction: null,
      pendingActionAt: null,
    },
    select: { userId: true },
  });

  await recomputeUserSkillScore(submission.userId);
}

/**
 * Recomputes the user's skill score from the FINAL scoreTotal of their reviewed
 * submissions (newest-weighted EWMA). Idempotent — safe to call again after a
 * deduction (verbal / hidden test) so the Skill Score reflects the adjusted score,
 * not the pre-deduction one.
 *
 * HIRING WORK IS EXCLUDED. Skill score is a public reputation number: it is
 * returned by /auth/me, rendered on the dashboard and the extension badge, and
 * served by the UNAUTHENTICATED profile and leaderboard endpoints. An employer's
 * private evaluation must never reach any of those, so it is kept out of the
 * input rather than stripped from each output — stripping would mean every
 * future endpoint returning a user is a fresh leak.
 *
 * The exposure this closes was not theoretical: with a single hiring submission
 * the EWMA seeds directly from it, so skillScore equalled the assessment's exact
 * scoreTotal and showed the candidate the score they were never meant to see.
 */
export async function recomputeUserSkillScore(userId: string): Promise<void> {
  const hidden = new Set(await allHiringTicketIds(userId));

  const subs = await prisma.submission.findMany({
    where: { userId, status: "REVIEWED", finalized: true },
    select: { scoreTotal: true, ticketId: true },
    orderBy: { submittedAt: "asc" },
  });

  await prisma.user.updateMany({
    where: { id: userId },
    data: { skillScore: skillScoreFrom(subs, hidden) },
  });
}

/**
 * The skill-score decision, pure so it can be tested without a database — the
 * privacy rule it encodes is worth a regression test, and the surrounding query
 * isn't.
 *
 * Takes submissions oldest-first and returns the EWMA over the ones that count.
 * Hiring submissions are dropped BEFORE the fold, not scored and hidden after:
 * with a single hiring assessment the EWMA seeds directly from it, so the stored
 * number would equal that assessment's exact scoreTotal.
 *
 * Returns 0 — never "leave it alone" — when nothing scoreable remains. A
 * candidate whose only work is a hiring assessment has no public track record,
 * and an early return here would strand a previously-leaked value on the row
 * where every recompute would then decline to correct it.
 */
export function skillScoreFrom(
  subs: { scoreTotal: number | null; ticketId: string }[],
  hiddenTicketIds: Set<string>
): number {
  const scoreable = subs.filter((s) => !hiddenTicketIds.has(s.ticketId));
  if (scoreable.length === 0) return 0;

  let s = scoreable[0].scoreTotal ?? 0;
  for (let i = 1; i < scoreable.length; i++) {
    s = Math.round(0.8 * s + 0.2 * (scoreable[i].scoreTotal ?? 0));
  }
  return s;
}

/**
 * Calculates a risk score for a submission based on heuristics:
 * - Very short PR description (< 100 chars) = developer may not have read the ticket
 * - No mention of root cause in description = possible surface-level fix
 * - Score submitted within 5 minutes = suspiciously fast for a complex ticket
 *
 * Risk score is 0-100; higher means more likely to be low-effort or AI-generated
 * without genuine understanding. Not used for grading — advisory only.
 */
export function calculateRiskScore(
  prDescription: string,
  submittedAt: Date,
  expectedMinutes: number
): number {
  let risk = 0;

  if (prDescription.length < 100) risk += 40;
  else if (prDescription.length < 300) risk += 15;

  const elapsedMinutes =
    (Date.now() - submittedAt.getTime()) / 1000 / 60;
  if (elapsedMinutes < 5) risk += 40;
  else if (elapsedMinutes < expectedMinutes * 0.1) risk += 20;

  const rootCauseKeywords = [
    "root cause",
    "because",
    "reason",
    "why",
    "caused by",
    "due to",
    "underlying",
  ];
  const hasRootCauseExplanation = rootCauseKeywords.some((kw) =>
    prDescription.toLowerCase().includes(kw)
  );
  if (!hasRootCauseExplanation) risk += 20;

  return Math.min(risk, 100);
}
