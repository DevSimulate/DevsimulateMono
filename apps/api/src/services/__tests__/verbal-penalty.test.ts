import { test } from "node:test";
import assert from "node:assert/strict";
import { consensusVerbal } from "../consensus";

/**
 * The verbal deduction is the single largest automated swing in the product —
 * up to 20 points off a candidate's total. These pin the rule that it is only
 * ever applied on a verdict we actually received.
 */

const run = (o: Partial<{ score: number; consistent: boolean; note: string; unscorable: boolean }> = {}) => ({
  score: 8, consistent: true, note: "solid", ...o,
});

/** Mirrors the penalty ladder in routes/submissions.ts. */
function penaltyFor(scored: { consistent: boolean; score: number; unscorable?: boolean }): number {
  if (scored.unscorable) return 0;
  if (!scored.consistent || scored.score <= 3) return 20;
  if (scored.score < 7) return (7 - scored.score) * 4;
  return 0;
}

// ── the regression ───────────────────────────────────────────────────────────

test("an unscorable verdict costs nothing", () => {
  // A judge that replied in prose used to have a digit scraped out of it and
  // used as the score. A transcript mentioning "longitude was 31" or "changed
  // from 0 to 1" could yield 1 — which trips the MAXIMUM penalty. A real
  // candidate lost 20 points this way.
  assert.equal(penaltyFor({ consistent: true, score: 0, unscorable: true }), 0);
});

test("unscorable survives consensus rather than averaging to a low score", () => {
  const { result } = consensusVerbal([run({ unscorable: true, score: 0 })]);
  assert.equal(result.unscorable, true);
  assert.equal(penaltyFor(result), 0);
});

test("one unscorable run does not drag down the runs that did return a verdict", () => {
  // Folding the placeholder 0 into the median would turn an 8 into a 0-ish
  // score and manufacture a penalty out of a parse failure.
  const { result } = consensusVerbal([run({ score: 8 }), run({ unscorable: true, score: 0 }), run({ score: 8 })]);
  assert.equal(result.unscorable, undefined);
  assert.equal(result.score, 8);
  assert.equal(penaltyFor(result), 0);
});

test("all runs unscorable means the whole verdict is unscorable", () => {
  const { result } = consensusVerbal([run({ unscorable: true, score: 0 }), run({ unscorable: true, score: 0 })]);
  assert.equal(result.unscorable, true);
  assert.equal(penaltyFor(result), 0);
});

test("an unscorable verdict never asserts a contradiction it didn't detect", () => {
  // consistent:false alone triggers the full 20, so the fallback must not
  // invent one.
  const { result } = consensusVerbal([run({ unscorable: true, score: 0 })]);
  assert.equal(result.consistent, true);
});

// ── the ladder still works for real verdicts ─────────────────────────────────

test("a genuine failure is still penalised in full", () => {
  assert.equal(penaltyFor({ consistent: true, score: 3 }), 20);
  assert.equal(penaltyFor({ consistent: false, score: 9 }), 20);
});

test("middling verdicts are graduated, not all-or-nothing", () => {
  assert.equal(penaltyFor({ consistent: true, score: 6 }), 4);
  assert.equal(penaltyFor({ consistent: true, score: 5 }), 8);
  assert.equal(penaltyFor({ consistent: true, score: 4 }), 12);
});

test("a good defence costs nothing", () => {
  assert.equal(penaltyFor({ consistent: true, score: 7 }), 0);
  assert.equal(penaltyFor({ consistent: true, score: 10 }), 0);
});
