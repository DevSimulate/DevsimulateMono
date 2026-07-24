import { test } from "node:test";
import assert from "node:assert/strict";
import { staleCutoff, stuckSubmissionWhere, STALE_AFTER_HOURS } from "../stale-submissions";

const NOW = new Date("2026-07-24T12:00:00.000Z");

test("staleCutoff is the configured number of hours before now", () => {
  assert.equal(staleCutoff(NOW, 2).toISOString(), "2026-07-24T10:00:00.000Z");
  assert.equal(staleCutoff(NOW, 24).toISOString(), "2026-07-23T12:00:00.000Z");
});

test("default cutoff uses STALE_AFTER_HOURS", () => {
  const expected = new Date(NOW.getTime() - STALE_AFTER_HOURS * 3600_000);
  assert.equal(staleCutoff(NOW).toISOString(), expected.toISOString());
});

test("predicate targets reviewed-but-unfinalized submissions only", () => {
  const where = stuckSubmissionWhere(NOW);
  assert.equal(where.status, "REVIEWED");
  assert.equal(where.finalized, false);
});

test("predicate excludes anyone already notified — nobody is nudged twice", () => {
  assert.equal(stuckSubmissionWhere(NOW).staleNotifiedAt, null);
});

test("predicate only matches submissions reviewed before the cutoff", () => {
  const where = stuckSubmissionWhere(NOW);
  const reviewedAt = where.reviewedAt as { not: null; lt: Date };

  assert.equal(reviewedAt.not, null); // never-reviewed submissions are excluded
  assert.equal(reviewedAt.lt.toISOString(), staleCutoff(NOW).toISOString());

  // A submission reviewed one minute ago must NOT be swept.
  const justReviewed = new Date(NOW.getTime() - 60_000);
  assert.ok(justReviewed > reviewedAt.lt, "a fresh review must not be treated as stuck");

  // One reviewed well past the window must be.
  const longAgo = new Date(NOW.getTime() - (STALE_AFTER_HOURS + 1) * 3600_000);
  assert.ok(longAgo < reviewedAt.lt, "an old review must be treated as stuck");
});
