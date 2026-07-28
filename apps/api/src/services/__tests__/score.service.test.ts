import { test } from "node:test";
import assert from "node:assert/strict";
import { skillScoreFrom } from "../score.service";

/**
 * Skill score is a PUBLIC number — /auth/me, the dashboard tile, the extension
 * badge, and the unauthenticated profile and leaderboard endpoints all read it.
 * These tests pin the rule that an employer's private evaluation never reaches
 * it, including the case that actually leaked in production.
 */

const sub = (ticketId: string, scoreTotal: number | null) => ({ ticketId, scoreTotal });
const none = new Set<string>();

// ── the leak this fix closes ─────────────────────────────────────────────────

test("a lone hiring submission does not become the skill score", () => {
  // The regression: one hiring assessment seeds the EWMA directly, so the
  // stored score was the assessment's exact scoreTotal — the candidate read
  // their own hidden score off the dashboard as "88 pts".
  const subs = [sub("t-hiring", 88)];
  assert.equal(skillScoreFrom(subs, none), 88, "sanity: unfiltered, it is verbatim");
  assert.equal(skillScoreFrom(subs, new Set(["t-hiring"])), 0);
});

test("returns 0 rather than leaving a stale value when all work is hiring", () => {
  // Must not early-return: a recompute that declines to write is how an
  // already-leaked score survives the fix.
  const subs = [sub("t-h1", 91), sub("t-h2", 74)];
  assert.equal(skillScoreFrom(subs, new Set(["t-h1", "t-h2"])), 0);
});

test("no submissions at all scores 0", () => {
  assert.equal(skillScoreFrom([], none), 0);
});

// ── the EWMA itself is unchanged for contest work ────────────────────────────

test("contest submissions still fold newest-weighted, oldest first", () => {
  // 0.8*60 + 0.2*90 = 66, then 0.8*66 + 0.2*40 = 60.8 → 61
  const subs = [sub("t1", 60), sub("t2", 90), sub("t3", 40)];
  assert.equal(skillScoreFrom(subs, none), 61);
});

test("a single contest submission is taken verbatim", () => {
  assert.equal(skillScoreFrom([sub("t1", 77)], none), 77);
});

test("hiring submissions are dropped before the fold, not after", () => {
  // The hiring 100 sits between two contest scores. If it were folded in and
  // then hidden, the result would carry it; dropping first gives the same
  // answer as if the candidate had never taken the assessment.
  const mixed = [sub("t1", 60), sub("t-hiring", 100), sub("t2", 90)];
  const contestOnly = [sub("t1", 60), sub("t2", 90)];
  assert.equal(
    skillScoreFrom(mixed, new Set(["t-hiring"])),
    skillScoreFrom(contestOnly, none)
  );
  assert.equal(skillScoreFrom(mixed, new Set(["t-hiring"])), 66);
});

test("an unscored submission counts as 0, not as a skip", () => {
  assert.equal(skillScoreFrom([sub("t1", null)], none), 0);
  // 0.8*80 + 0.2*0 = 64
  assert.equal(skillScoreFrom([sub("t1", 80), sub("t2", null)], none), 64);
});

test("hiding a ticket the user never solved changes nothing", () => {
  const subs = [sub("t1", 70)];
  assert.equal(skillScoreFrom(subs, new Set(["t-unrelated"])), 70);
});
