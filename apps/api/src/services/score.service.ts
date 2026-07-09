import prisma from "../lib/prisma";
import { ClaudeReviewResult } from "../types/index";
import { Submission } from "@prisma/client";

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
  review: ClaudeReviewResult
): Promise<Submission> {
  const submission = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: "REVIEWED",
      scoreTotal: review.scoreTotal,
      scorePrBase: review.scoreTotal,
      scoreDiagnosis: review.scoreDiagnosis,
      scoreDesign: review.scoreDesign,
      scoreCommunication: review.scoreCommunication,
      scoreExecution: review.scoreExecution,
      claudeReview: review as object,
      reviewedAt: new Date(),
    },
    include: { user: true },
  });

  // EMA update intentionally deferred — runs after follow-up answers
  // so skill score reflects the final combined score, not the base score.

  return submission;
}

/**
 * Recalculates and persists the user's skill score using an exponential
 * moving average weighted toward recent performance.
 */
export async function updateUserSkillScore(
  userId: string,
  latestScore: number
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const isFirstSubmission = user.skillScore === 0;
  const newSkillScore = isFirstSubmission
    ? latestScore
    : Math.round(0.8 * user.skillScore + 0.2 * latestScore);

  await prisma.user.update({
    where: { id: userId },
    data: { skillScore: newSkillScore },
  });
}

/**
 * Recomputes the user's skill score from the FINAL scoreTotal of their reviewed
 * submissions (newest-weighted EWMA). Idempotent — safe to call again after a
 * deduction (verbal / hidden test) so the Skill Score reflects the adjusted score,
 * not the pre-deduction one. Replaces the running update for post-deduction refreshes.
 */
export async function recomputeUserSkillScore(userId: string): Promise<void> {
  const subs = await prisma.submission.findMany({
    where: { userId, status: "REVIEWED", finalized: true },
    select: { scoreTotal: true },
    orderBy: { submittedAt: "asc" },
  });
  if (subs.length === 0) return;

  let s = subs[0].scoreTotal ?? 0;
  for (let i = 1; i < subs.length; i++) {
    s = Math.round(0.8 * s + 0.2 * (subs[i].scoreTotal ?? 0));
  }
  await prisma.user.update({ where: { id: userId }, data: { skillScore: s } });
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
