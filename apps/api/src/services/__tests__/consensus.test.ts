import { test } from "node:test";
import assert from "node:assert/strict";
import { median, consensusReview, consensusVerbal, gatherRuns } from "../consensus";
import type { ClaudeReviewResult } from "../../types/index";
import type { VerbalScoreResult } from "../review.service";

function review(
  diagnosis: number, design: number, communication: number, execution: number, tag = ""
): ClaudeReviewResult {
  return {
    scoreDiagnosis: diagnosis,
    scoreDesign: design,
    scoreCommunication: communication,
    scoreExecution: execution,
    scoreTotal: diagnosis + design + communication + execution,
    feedback: { diagnosis: tag, design: tag, communication: tag, execution: tag },
    summary: tag,
    topStrength: tag,
    topImprovement: tag,
  };
}

// ── median ───────────────────────────────────────────────────────────────────

test("median of an odd count is the middle value", () => {
  assert.equal(median([30, 10, 20]), 20);
});

test("median of an even count rounds DOWN — never round a candidate up on a tie", () => {
  assert.equal(median([10, 15]), 12); // 12.5 → 12
  assert.equal(median([1, 2, 3, 4]), 2); // 2.5 → 2
});

test("median of a single value is that value", () => {
  assert.equal(median([7]), 7);
});

test("median rejects an empty list rather than inventing a score", () => {
  assert.throws(() => median([]), /at least one value/);
});

// ── consensusReview ──────────────────────────────────────────────────────────

test("three runs: median is taken PER DIMENSION, not on the totals", () => {
  // Totals are 70 / 70 / 70, but the dimensions disagree sharply. A median of
  // totals would return 70; the correct per-dimension median is 30+20+15+8=73.
  const { result } = consensusReview([
    review(40, 10, 15, 5),
    review(20, 30, 15, 5),
    review(30, 20, 12, 8),
  ]);

  assert.equal(result.scoreDiagnosis, 30);
  assert.equal(result.scoreDesign, 20);
  assert.equal(result.scoreCommunication, 15);
  assert.equal(result.scoreExecution, 5);
  assert.equal(result.scoreTotal, 70);
});

test("total always equals the sum of the consensus dimensions", () => {
  const { result } = consensusReview([
    review(35, 25, 18, 9),
    review(30, 20, 15, 7),
    review(25, 22, 16, 8),
  ]);
  assert.equal(
    result.scoreTotal,
    result.scoreDiagnosis + result.scoreDesign + result.scoreCommunication + result.scoreExecution
  );
  assert.equal(result.scoreTotal, 30 + 22 + 16 + 8);
});

test("two runs: per-dimension average rounded down, not flagged low confidence", () => {
  const { result, meta } = consensusReview([review(30, 21, 15, 7), review(35, 24, 16, 8)]);

  assert.equal(result.scoreDiagnosis, 32);    // 32.5 → 32
  assert.equal(result.scoreDesign, 22);       // 22.5 → 22
  assert.equal(result.scoreCommunication, 15); // 15.5 → 15
  assert.equal(result.scoreExecution, 7);     // 7.5 → 7
  assert.equal(result.scoreTotal, 76);
  assert.equal(meta.runCount, 2);
  assert.equal(meta.lowConfidenceScoring, false);
});

test("one run is used as-is but flagged low confidence", () => {
  const { result, meta } = consensusReview([review(31, 19, 14, 6)]);
  assert.equal(result.scoreTotal, 70);
  assert.equal(meta.runCount, 1);
  assert.equal(meta.lowConfidenceScoring, true);
});

test("narrative comes from the run closest to the consensus total", () => {
  const { result } = consensusReview([
    review(40, 30, 20, 10, "generous"),
    review(30, 20, 15, 8, "middle"),
    review(10, 5, 5, 2, "harsh"),
  ]);
  assert.equal(result.scoreTotal, 30 + 20 + 15 + 8);
  assert.equal(result.summary, "middle");
});

test("zero successful runs throws rather than producing a score", () => {
  assert.throws(() => consensusReview([]), /at least one successful run/);
});

// ── consensusVerbal ──────────────────────────────────────────────────────────

const verbal = (score: number, consistent: boolean, note = ""): VerbalScoreResult => ({ score, consistent, note });

test("verbal takes the median score across runs", () => {
  const { result } = consensusVerbal([verbal(9, true), verbal(4, true), verbal(7, true)]);
  assert.equal(result.score, 7);
});

test("verbal inconsistency needs a majority, not a single dissenting run", () => {
  const { result } = consensusVerbal([verbal(8, true), verbal(8, false), verbal(8, true)]);
  assert.equal(result.consistent, true);
});

test("verbal majority marks inconsistent when most runs agree it is", () => {
  const { result } = consensusVerbal([verbal(3, false), verbal(4, false), verbal(8, true)]);
  assert.equal(result.consistent, false);
});

test("a 1-1 tie resolves in the candidate's favour — no full penalty on a coin flip", () => {
  const { result } = consensusVerbal([verbal(6, true), verbal(6, false)]);
  assert.equal(result.consistent, true);
});

// ── gatherRuns ───────────────────────────────────────────────────────────────

test("gatherRuns keeps successes and drops failures", async () => {
  const got = await gatherRuns(3, async (i) => {
    if (i === 1) throw new Error("boom");
    return i;
  }, "test");
  assert.deepEqual(got.sort(), [0, 2]);
});

test("gatherRuns runs in parallel, not sequentially", async () => {
  const started: number[] = [];
  const t0 = Date.now();
  await gatherRuns(3, async (i) => {
    started.push(i);
    await new Promise((r) => setTimeout(r, 60));
    return i;
  }, "test");
  // All three must have started before any finished; 3 sequential 60ms calls
  // would take ~180ms.
  assert.equal(started.length, 3);
  assert.ok(Date.now() - t0 < 150, `expected parallel execution, took ${Date.now() - t0}ms`);
});
