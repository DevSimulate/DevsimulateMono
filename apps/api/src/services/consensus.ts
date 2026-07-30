/**
 * Consensus scoring — turns several independent scoring runs into one score.
 *
 * Why: a single LLM call decides ~90 of the 100 points. Even at temperature 0
 * there is run-to-run variance, which means two candidates who did equally well
 * can end up visibly apart. Scoring the same submission N times and taking the
 * MEDIAN removes the single-call outlier without changing the rubric.
 *
 * The median is taken PER DIMENSION, not on the totals. Taking the median of
 * totals would let one run's generous Diagnosis cancel another's harsh Design
 * and report a total no run actually assigned. Per-dimension medians keep each
 * dimension defensible on its own, and the total is recomputed from them so it
 * always equals the sum of its parts.
 *
 * This module is intentionally pure — no network, no Prisma — so the arithmetic
 * that decides scores is unit-testable in isolation.
 */

import type { ClaudeReviewResult } from "../types/index";
import type { VerbalScoreResult } from "./review.service";

/** How many independent scoring runs to launch per submission. */
export const SCORING_RUNS = 3;

export interface ConsensusMeta {
  /** Number of runs that returned a usable result. */
  runCount: number;
  /** True when only ONE run survived, so no cross-check was possible. */
  lowConfidenceScoring: boolean;
}

/**
 * Median of a numeric list. For an even count this returns the mean of the two
 * middle values ROUNDED DOWN — never round a candidate up on a coin flip.
 */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median() requires at least one value");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Runs the same async producer `count` times in PARALLEL and returns every run
 * that succeeded. Latency stays that of a single call, not count× it.
 * Rejections are logged and dropped — the caller decides what a thin result set
 * means.
 */
export async function gatherRuns<T>(
  count: number,
  produce: (runIndex: number) => Promise<T>,
  label = "run"
): Promise<T[]> {
  const settled = await Promise.allSettled(
    Array.from({ length: count }, (_, i) => produce(i))
  );

  const ok: T[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") ok.push(s.value);
    else console.warn(`[consensus] ${label} ${i + 1}/${count} failed:`, s.reason instanceof Error ? s.reason.message : s.reason);
  });
  return ok;
}

const DIMENSIONS = [
  "scoreDiagnosis",
  "scoreDesign",
  "scoreCommunication",
  "scoreExecution",
] as const;

/**
 * Collapses several review runs into one.
 *
 *  3+ runs → per-dimension median
 *  2 runs  → per-dimension average, rounded DOWN
 *  1 run   → that run, flagged lowConfidenceScoring for admin review
 *
 * The narrative (feedback / summary / strengths) is taken WHOLE from the single
 * run whose total sits closest to the consensus total, so the prose a candidate
 * reads actually matches the numbers they were given. Splicing feedback across
 * runs would produce a review no reviewer ever wrote.
 */
export function consensusReview(
  runs: ClaudeReviewResult[]
): { result: ClaudeReviewResult; meta: ConsensusMeta } {
  if (runs.length === 0) throw new Error("consensusReview() requires at least one successful run");

  const dims = {} as Record<(typeof DIMENSIONS)[number], number>;
  for (const dim of DIMENSIONS) {
    const values = runs.map((r) => r[dim] ?? 0);
    dims[dim] =
      values.length === 2
        ? Math.floor((values[0] + values[1]) / 2) // even split: never round up
        : median(values);
  }

  const scoreTotal =
    dims.scoreDiagnosis + dims.scoreDesign + dims.scoreCommunication + dims.scoreExecution;

  // Narrative comes from the run closest to the consensus total.
  const representative = runs.reduce((best, r) =>
    Math.abs((r.scoreTotal ?? 0) - scoreTotal) < Math.abs((best.scoreTotal ?? 0) - scoreTotal) ? r : best
  );

  return {
    result: { ...representative, ...dims, scoreTotal },
    meta: { runCount: runs.length, lowConfidenceScoring: runs.length === 1 },
  };
}

/**
 * Same treatment for the verbal-defence evaluation, which can cost 20 points.
 *
 * `consistent: false` triggers the maximum penalty on its own, so it is decided
 * by majority vote and ties resolve to TRUE — a candidate should never take a
 * full deduction because two runs disagreed.
 */
export function consensusVerbal(
  runs: VerbalScoreResult[]
): { result: VerbalScoreResult; meta: ConsensusMeta } {
  if (runs.length === 0) throw new Error("consensusVerbal() requires at least one successful run");

  // A run that produced no usable verdict has no score to contribute. Folding
  // its placeholder 0 into the median would drag an honest defence down, so
  // score only the runs that actually returned one. If none did, the whole
  // result is unscorable and the caller applies no penalty.
  const usable = runs.filter((r) => !r.unscorable);
  if (usable.length === 0) {
    return {
      result: { ...runs[0], score: 0, consistent: true, unscorable: true },
      meta: { runCount: runs.length, lowConfidenceScoring: runs.length === 1 },
    };
  }
  runs = usable;

  const scores = runs.map((r) => r.score ?? 0);
  const score = scores.length === 2 ? Math.floor((scores[0] + scores[1]) / 2) : median(scores);

  const inconsistentVotes = runs.filter((r) => r.consistent === false).length;
  const consistent = inconsistentVotes <= runs.length - inconsistentVotes;

  const representative = runs.reduce((best, r) =>
    Math.abs((r.score ?? 0) - score) < Math.abs((best.score ?? 0) - score) ? r : best
  );

  return {
    result: { ...representative, score, consistent },
    meta: { runCount: runs.length, lowConfidenceScoring: runs.length === 1 },
  };
}
