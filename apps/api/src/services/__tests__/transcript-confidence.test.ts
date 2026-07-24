import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confidenceFromSegments,
  proxyConfidence,
  isLowConfidence,
  MIN_CONFIDENCE,
} from "../transcript-confidence";

// ── confidenceFromSegments ───────────────────────────────────────────────────

test("clean speech scores high confidence", () => {
  const c = confidenceFromSegments([
    { avg_logprob: -0.15, no_speech_prob: 0.01, start: 0, end: 5 },
    { avg_logprob: -0.2, no_speech_prob: 0.02, start: 5, end: 10 },
  ]);
  assert.ok(c !== null && c > 0.7, `expected >0.7, got ${c}`);
  assert.ok(!isLowConfidence(c));
});

test("garbled audio scores low confidence and routes to review", () => {
  const c = confidenceFromSegments([
    { avg_logprob: -1.8, no_speech_prob: 0.6, start: 0, end: 8 },
    { avg_logprob: -2.2, no_speech_prob: 0.7, start: 8, end: 15 },
  ]);
  assert.ok(c !== null && c < MIN_CONFIDENCE, `expected < ${MIN_CONFIDENCE}, got ${c}`);
  assert.ok(isLowConfidence(c));
});

test("a high no_speech_prob drags confidence down even with good logprob", () => {
  const speech = confidenceFromSegments([{ avg_logprob: -0.2, no_speech_prob: 0.0, start: 0, end: 5 }]);
  const noise  = confidenceFromSegments([{ avg_logprob: -0.2, no_speech_prob: 0.9, start: 0, end: 5 }]);
  assert.ok(speech !== null && noise !== null);
  assert.ok(noise < speech / 2, `noise ${noise} should be far below speech ${speech}`);
});

test("segments are weighted by duration, not counted equally", () => {
  // One long confident segment plus a tiny bad one should stay confident.
  const c = confidenceFromSegments([
    { avg_logprob: -0.15, no_speech_prob: 0.0, start: 0, end: 30 },
    { avg_logprob: -3.0, no_speech_prob: 0.9, start: 30, end: 30.2 },
  ]);
  assert.ok(c !== null && c > 0.7, `expected long segment to dominate, got ${c}`);
});

test("segments without logprob data yield null, not a fabricated score", () => {
  assert.equal(confidenceFromSegments([]), null);
  assert.equal(confidenceFromSegments([{ start: 0, end: 3 }]), null);
});

test("confidence is always within 0..1", () => {
  const extreme = confidenceFromSegments([{ avg_logprob: 5, no_speech_prob: -1, start: 0, end: 2 }]);
  assert.ok(extreme !== null && extreme >= 0 && extreme <= 1, `got ${extreme}`);
});

// ── proxyConfidence ──────────────────────────────────────────────────────────

test("a normal spoken answer proxies as confident", () => {
  const text = "The root cause was that the discount was applied as a raw percentage " +
               "instead of a fraction, so the total went negative.";
  assert.ok(proxyConfidence(text, 8) > 0.8);
});

test("noise fragments proxy as low confidence", () => {
  assert.ok(proxyConfidence("... uh -- ### %% ~~ ,, ??", 10) < MIN_CONFIDENCE);
});

test("an implausibly slow speaking rate lowers confidence — the mic barely caught anything", () => {
  const fast = proxyConfidence("the lock scope was wrong", 6);
  const slow = proxyConfidence("the lock scope was wrong", 120);
  assert.ok(slow < fast, `slow ${slow} should be below normal ${fast}`);
  assert.ok(isLowConfidence(slow));
});

test("an empty transcript has zero confidence", () => {
  assert.equal(proxyConfidence(""), 0);
  assert.equal(proxyConfidence("   "), 0);
});

// ── isLowConfidence ──────────────────────────────────────────────────────────

test("null confidence scores normally — no signal is not bad audio", () => {
  // Browser speech recognition gives no confidence data; that must not be
  // treated as a failure, or every such candidate would skip scoring.
  assert.equal(isLowConfidence(null), false);
  assert.equal(isLowConfidence(undefined), false);
});

test('a clear "I don\'t know" is high confidence and therefore still scored', () => {
  // The whole point: low confidence means bad AUDIO, never a weak answer.
  const c = confidenceFromSegments([{ avg_logprob: -0.12, no_speech_prob: 0.01, start: 0, end: 2 }]);
  assert.ok(!isLowConfidence(c), "a clearly-spoken failing answer must still be scored");
});

test("threshold is respected exactly at the boundary", () => {
  assert.equal(isLowConfidence(MIN_CONFIDENCE), false); // not below
  assert.equal(isLowConfidence(MIN_CONFIDENCE - 0.001), true);
});
