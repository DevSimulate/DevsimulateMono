import { test } from "node:test";
import assert from "node:assert/strict";
import { backoffMs, retryAfterMs, statusOf, RETRYABLE } from "../claude";

test("rate limits and overloads are retryable; client errors are not", () => {
  assert.ok(RETRYABLE.has(429), "429 rate limit must be retried");
  assert.ok(RETRYABLE.has(529), "529 overloaded must be retried");
  assert.ok(RETRYABLE.has(503));

  // Retrying these would just burn quota — the request itself is wrong.
  assert.ok(!RETRYABLE.has(400));
  assert.ok(!RETRYABLE.has(401));
  assert.ok(!RETRYABLE.has(404));
  assert.ok(!RETRYABLE.has(413));
});

test("backoff grows exponentially and is capped", () => {
  // With full jitter each value lands in [50%, 100%] of the capped ceiling.
  for (const [attempt, ceiling] of [[0, 1000], [1, 2000], [2, 4000], [3, 8000]] as const) {
    for (let i = 0; i < 50; i++) {
      const ms = backoffMs(attempt);
      assert.ok(ms >= ceiling * 0.5 - 1, `attempt ${attempt}: ${ms} below floor`);
      assert.ok(ms <= ceiling, `attempt ${attempt}: ${ms} above ceiling ${ceiling}`);
    }
  }
  // Never waits more than the 30s cap, however many attempts.
  for (let i = 0; i < 50; i++) assert.ok(backoffMs(20) <= 30_000);
});

test("backoff is jittered — a burst must not retry in lockstep", () => {
  const values = new Set(Array.from({ length: 40 }, () => backoffMs(3)));
  assert.ok(values.size > 1, "identical delays would re-trigger the same rate limit together");
});

test("retry-after in seconds is honoured", () => {
  assert.equal(retryAfterMs({ headers: { "retry-after": "12" } }), 12_000);
  assert.equal(retryAfterMs({ headers: { "Retry-After": "0" } }), 0);
});

test("retry-after as an HTTP date is honoured", () => {
  const future = new Date(Date.now() + 5_000).toUTCString();
  const ms = retryAfterMs({ headers: { "retry-after": future } });
  assert.ok(ms !== undefined && ms > 3_000 && ms <= 6_000, `got ${ms}`);
});

test("a past retry-after date never yields a negative wait", () => {
  const past = new Date(Date.now() - 60_000).toUTCString();
  assert.equal(retryAfterMs({ headers: { "retry-after": past } }), 0);
});

test("missing or unparseable retry-after falls back to computed backoff", () => {
  assert.equal(retryAfterMs({}), undefined);
  assert.equal(retryAfterMs(null), undefined);
  assert.equal(retryAfterMs({ headers: {} }), undefined);
  assert.equal(retryAfterMs({ headers: { "retry-after": "soon" } }), undefined);
});

test("statusOf reads a status off plain SDK-shaped errors", () => {
  assert.equal(statusOf({ status: 429 }), 429);
  assert.equal(statusOf(new Error("boom")), undefined);
  assert.equal(statusOf(null), undefined);
});
