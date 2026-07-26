import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeCadence } from "../cadence";

test("fewer than two keystrokes yields a zeroed summary", () => {
  assert.deepEqual(summarizeCadence([], 0), { charsPerMin: 0, longestPauseMs: 0, burstCount: 0, keystrokes: 0 });
  assert.deepEqual(summarizeCadence([100], 1), { charsPerMin: 0, longestPauseMs: 0, burstCount: 1, keystrokes: 1 });
});

test("steady typing is a single burst with the right chars/min", () => {
  // 61 keystrokes, 100ms apart → 6000ms = 0.1 min span; 60 chars → 600 cpm
  const ts = Array.from({ length: 61 }, (_, i) => i * 100);
  const c = summarizeCadence(ts, 60);
  assert.equal(c.burstCount, 1);
  assert.equal(c.longestPauseMs, 100);
  assert.equal(c.charsPerMin, 600);
  assert.equal(c.keystrokes, 61);
});

test("gaps over the burst threshold split bursts and set the longest pause", () => {
  // three tight clusters separated by 5s pauses → 3 bursts, 5000ms longest pause
  const ts = [0, 50, 100, 5100, 5150, 5200, 10200, 10250, 10300];
  const c = summarizeCadence(ts, 400);
  assert.equal(c.burstCount, 3);
  assert.equal(c.longestPauseMs, 5000);
});

test("unsorted timestamps are handled (deltas computed in order)", () => {
  const c = summarizeCadence([300, 0, 100, 200], 4);
  assert.equal(c.burstCount, 1);
  assert.equal(c.longestPauseMs, 100);
});
