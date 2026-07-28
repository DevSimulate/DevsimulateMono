import { test } from "node:test";
import assert from "node:assert/strict";
import { isReminderDue, daysRemaining } from "../invite-reminders";

/**
 * These rules decide whether a stranger gets an unsolicited email, on a sweep
 * that runs every 30 minutes. Every stop condition is pinned here.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-28T10:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

const invited = (o: Partial<Parameters<typeof isReminderDue>[0]> = {}) => ({
  userId: null,
  invitedAt: ago(3 * DAY),
  remindedAt: null,
  ...o,
});

// ── cadence ──────────────────────────────────────────────────────────────────

test("due once the interval has elapsed since the invite", () => {
  assert.equal(isReminderDue(invited(), ahead(10 * DAY), 0, NOW), true);
});

test("not due before the interval has elapsed", () => {
  const fresh = invited({ invitedAt: ago(DAY) });
  assert.equal(isReminderDue(fresh, ahead(10 * DAY), 0, NOW), false);
});

test("exactly at the interval boundary counts as due", () => {
  const boundary = invited({ invitedAt: ago(2 * DAY) });
  assert.equal(isReminderDue(boundary, ahead(10 * DAY), 0, NOW), true);
});

test("the clock runs from the last reminder, not the invite", () => {
  // Invited a week ago but nudged an hour ago: measuring from invitedAt would
  // re-fire on every sweep, i.e. every 30 minutes.
  const justNudged = invited({ invitedAt: ago(7 * DAY), remindedAt: ago(60 * 60 * 1000) });
  assert.equal(isReminderDue(justNudged, ahead(10 * DAY), 1, NOW), false);

  const nudgedLongAgo = invited({ invitedAt: ago(7 * DAY), remindedAt: ago(2 * DAY) });
  assert.equal(isReminderDue(nudgedLongAgo, ahead(10 * DAY), 1, NOW), true);
});

// ── stop conditions ──────────────────────────────────────────────────────────

test("a candidate who has started is never chased", () => {
  const started = invited({ userId: "u1" });
  assert.equal(isReminderDue(started, ahead(10 * DAY), 0, NOW), false);
});

test("no reminder once the deadline has passed", () => {
  // The link is dead — inviting someone through a locked door is worse than silence.
  assert.equal(isReminderDue(invited(), ago(DAY), 0, NOW), false);
});

test("a deadline exactly now is treated as closed", () => {
  assert.equal(isReminderDue(invited(), NOW, 0, NOW), false);
});

test("the cap stops reminders even with time left on the clock", () => {
  assert.equal(isReminderDue(invited(), ahead(30 * DAY), 4, NOW, 2, 5), true);
  assert.equal(isReminderDue(invited(), ahead(30 * DAY), 5, NOW, 2, 5), false);
  assert.equal(isReminderDue(invited(), ahead(30 * DAY), 9, NOW, 2, 5), false);
});

test("an open-ended campaign still reminds, but the cap bounds it", () => {
  assert.equal(isReminderDue(invited(), null, 0, NOW), true);
  assert.equal(isReminderDue(invited(), null, 5, NOW, 2, 5), false);
});

// ── daysRemaining ────────────────────────────────────────────────────────────

test("daysRemaining rounds part-days up so 'today' never reads as 0 days early", () => {
  assert.equal(daysRemaining(ahead(DAY * 3), NOW), 3);
  assert.equal(daysRemaining(ahead(DAY * 2.4), NOW), 3);
  assert.equal(daysRemaining(ahead(60 * 60 * 1000), NOW), 1);
});

test("daysRemaining never goes negative, and is null when open-ended", () => {
  assert.equal(daysRemaining(ago(5 * DAY), NOW), 0);
  assert.equal(daysRemaining(null, NOW), null);
});
