import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isRichGraderBody,
  decideHiddenTestOutcome,
  inTopBand,
  bandRange,
  legacyResultFor,
  CurrentScores,
} from "../hidden-test.service";

const CAP = 45;

function scores(scoreTotal: number, scoreDiagnosis: number, scoreExecution: number): CurrentScores {
  return { scoreTotal, scoreDiagnosis, scoreExecution };
}

// ── isRichGraderBody ─────────────────────────────────────────────────────────

test("rich body requires both a tests array and a status string", () => {
  assert.equal(isRichGraderBody({ tests: [], status: "passed" }), true);
  assert.equal(isRichGraderBody({ tests: [{ name: "x" }], status: "critical_failed" }), true);
});

test("legacy {result} / {passed} shapes are not mistaken for the rich shape", () => {
  assert.equal(isRichGraderBody({ result: "pass" }), false);
  assert.equal(isRichGraderBody({ passed: false, ticketId: "t1" }), false);
});

test("a tests array without a status string is not the rich shape", () => {
  assert.equal(isRichGraderBody({ tests: [] }), false);
});

test("non-object and null bodies are safely rejected", () => {
  assert.equal(isRichGraderBody(null), false);
  assert.equal(isRichGraderBody(undefined), false);
  assert.equal(isRichGraderBody("passed"), false);
});

// ── bandRange / inTopBand ────────────────────────────────────────────────────

test("bandRange parses a lo-hi band string", () => {
  assert.deepEqual(bandRange("34-40"), [34, 40]);
  assert.deepEqual(bandRange("9-10"), [9, 10]);
});

test("inTopBand is inclusive at both ends", () => {
  assert.equal(inTopBand(34, "34-40"), true);
  assert.equal(inTopBand(40, "34-40"), true);
  assert.equal(inTopBand(33, "34-40"), false);
  assert.equal(inTopBand(41, "34-40"), false);
});

test("inTopBand treats null (no score yet) as not in band", () => {
  assert.equal(inTopBand(null, "34-40"), false);
});

// ── decideHiddenTestOutcome — the actual scoring rule ────────────────────────

test("passed: no cap, no flag", () => {
  const outcome = decideHiddenTestOutcome("passed", scores(80, 35, 8), CAP);
  assert.deepEqual(outcome, {});
});

test("regression_failed: no cap, no flag — surfaced via graderResult alone", () => {
  const outcome = decideHiddenTestOutcome("regression_failed", scores(80, 35, 8), CAP);
  assert.deepEqual(outcome, {});
});

test("critical_failed above the cap: capped and the deduction is recorded", () => {
  const outcome = decideHiddenTestOutcome("critical_failed", scores(80, 25, 5), CAP);
  assert.equal(outcome.scoreTotal, 45);
  assert.equal(outcome.hiddenTestPenalty, 35);
  assert.equal(outcome.needsAttention, undefined);
});

test("bug_not_fixed (Objective Floor v2) routes identically to critical_failed — caps at 45", () => {
  const outcome = decideHiddenTestOutcome("bug_not_fixed", scores(80, 25, 5), CAP);
  assert.equal(outcome.scoreTotal, 45);
  assert.equal(outcome.hiddenTestPenalty, 35);
  assert.equal(outcome.needsAttention, undefined);
});

test("bug_not_fixed honours the human-review valve too (top-band Diagnosis+Execution → flag, no cap)", () => {
  const outcome = decideHiddenTestOutcome("bug_not_fixed", scores(90, 36, 10), CAP);
  assert.equal(outcome.needsAttention, true);
  assert.equal(outcome.scoreTotal, undefined);
  assert.ok(outcome.needsAttentionReason?.includes("still reproduced"));
});

test("bug_not_fixed maps to a 'fail' legacy result for old UI", () => {
  assert.equal(legacyResultFor("bug_not_fixed"), "fail");
});

test("critical_failed never RAISES a score already at or below the cap", () => {
  const atCap = decideHiddenTestOutcome("critical_failed", scores(45, 20, 5), CAP);
  assert.deepEqual(atCap, {});

  const belowCap = decideHiddenTestOutcome("critical_failed", scores(30, 15, 4), CAP);
  assert.deepEqual(belowCap, {});
});

test("critical_failed with a null scoreTotal treats it as 0 — never negative penalty", () => {
  const outcome = decideHiddenTestOutcome("critical_failed", { scoreTotal: null, scoreDiagnosis: 20, scoreExecution: 5 }, CAP);
  assert.deepEqual(outcome, {}); // 0 <= 45, no cap applies
});

test("human-review valve fires when BOTH Diagnosis and Execution are in their top band", () => {
  // Diagnosis top band 34-40, Execution top band 9-10 (from src/prompts/anchors).
  const outcome = decideHiddenTestOutcome("critical_failed", scores(90, 36, 10), CAP);
  assert.equal(outcome.needsAttention, true);
  assert.equal(outcome.scoreTotal, undefined, "the valve must prevent capping, not just flag alongside it");
  assert.equal(outcome.hiddenTestPenalty, undefined);
  assert.ok(outcome.needsAttentionReason?.includes("possible valid alternative"));
});

test("valve requires BOTH dimensions in top band — Diagnosis alone does not suffice", () => {
  const outcome = decideHiddenTestOutcome("critical_failed", scores(90, 36, 6), CAP);
  assert.equal(outcome.scoreTotal, 45, "Execution outside its top band must still cap");
  assert.equal(outcome.needsAttention, undefined);
});

test("valve requires BOTH dimensions in top band — Execution alone does not suffice", () => {
  const outcome = decideHiddenTestOutcome("critical_failed", scores(90, 20, 10), CAP);
  assert.equal(outcome.scoreTotal, 45, "Diagnosis outside its top band must still cap");
  assert.equal(outcome.needsAttention, undefined);
});

for (const status of ["build_failed", "timeout", "error"] as const) {
  test(`${status}: never caps, always flags for human review`, () => {
    const outcome = decideHiddenTestOutcome(status, scores(80, 10, 2), CAP);
    assert.equal(outcome.scoreTotal, undefined);
    assert.equal(outcome.hiddenTestPenalty, undefined);
    assert.equal(outcome.needsAttention, true);
    assert.ok(outcome.needsAttentionReason?.includes(status));
  });
}

test("a custom cap is honoured", () => {
  const outcome = decideHiddenTestOutcome("critical_failed", scores(80, 10, 2), 30);
  assert.equal(outcome.scoreTotal, 30);
  assert.equal(outcome.hiddenTestPenalty, 50);
});

// ── legacyResultFor ──────────────────────────────────────────────────────────

test("legacyResultFor maps every rich status to a legacy tri-state", () => {
  assert.equal(legacyResultFor("passed"), "pass");
  assert.equal(legacyResultFor("critical_failed"), "fail");
  assert.equal(legacyResultFor("regression_failed"), "fail");
  assert.equal(legacyResultFor("build_failed"), "inconclusive");
  assert.equal(legacyResultFor("timeout"), "inconclusive");
  assert.equal(legacyResultFor("error"), "inconclusive");
});
