import { test } from "node:test";
import assert from "node:assert/strict";
import { verbalPenaltyFor } from "../verbal-penalty";
import { consensusVerbal } from "../consensus";

/**
 * The largest automated deduction in the product. These test the real function
 * the route calls — an earlier version of this file re-implemented the ladder
 * to test it, which proves only that the copy agrees with itself.
 */

const v = (score: number, o: Partial<{ consistent: boolean; unscorable: boolean }> = {}) =>
  ({ score, consistent: true, note: "", ...o });

// ── the rebanded table ───────────────────────────────────────────────────────

test("a weak defence costs 8, not 20", () => {
  // Was -20, which on its own moved a candidate from Yes to No. One went
  // 69 -> 49 on a verdict that had misread his answer.
  assert.equal(verbalPenaltyFor(v(0)), 8);
  assert.equal(verbalPenaltyFor(v(3)), 8);
});

test("the middle band slopes instead of cliffing", () => {
  assert.equal(verbalPenaltyFor(v(4)), 5);
  assert.equal(verbalPenaltyFor(v(5)), 3);
  assert.equal(verbalPenaltyFor(v(6)), 1);
});

test("a defence that holds up costs nothing", () => {
  assert.equal(verbalPenaltyFor(v(7)), 0);
  assert.equal(verbalPenaltyFor(v(10)), 0);
});

test("the step between adjacent scores is never more than 3", () => {
  // The old table jumped 8 points between a 3 and a 4, so one point of grader
  // judgement swung the outcome. Nothing here should be that sharp.
  for (let s = 0; s < 10; s++) {
    const step = Math.abs(verbalPenaltyFor(v(s)) - verbalPenaltyFor(v(s + 1)));
    assert.ok(step <= 3, `step from ${s} to ${s + 1} was ${step}`);
  }
});

test("the penalty never increases as the score improves", () => {
  for (let s = 0; s < 10; s++) {
    assert.ok(verbalPenaltyFor(v(s)) >= verbalPenaltyFor(v(s + 1)), `not monotonic at ${s}`);
  }
});

// ── the two overrides ────────────────────────────────────────────────────────

test("a contradiction takes the top of the band whatever the score", () => {
  // The spoken answer disagreeing with the written work is the strongest
  // signal the defence produces.
  assert.equal(verbalPenaltyFor(v(9, { consistent: false })), 8);
});

test("no usable verdict costs nothing", () => {
  assert.equal(verbalPenaltyFor(v(0, { unscorable: true })), 0);
  assert.equal(verbalPenaltyFor(v(0, { unscorable: true, consistent: false })), 0);
});

test("an out-of-range or fractional score is clamped, not crashed", () => {
  assert.equal(verbalPenaltyFor(v(-3)), 8);
  assert.equal(verbalPenaltyFor(v(99)), 0);
  assert.equal(verbalPenaltyFor(v(5.4)), 3);
});

// ── consensus still feeds it correctly ───────────────────────────────────────

test("an unscorable consensus result is not penalised", () => {
  const { result } = consensusVerbal([v(0, { unscorable: true })]);
  assert.equal(verbalPenaltyFor(result), 0);
});

test("one unscorable run does not drag a good verdict into a penalty", () => {
  const { result } = consensusVerbal([v(8), v(0, { unscorable: true }), v(8)]);
  assert.equal(result.score, 8);
  assert.equal(verbalPenaltyFor(result), 0);
});
