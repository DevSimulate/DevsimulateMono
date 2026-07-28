/**
 * Invite reminders.
 *
 * An invited candidate who never opens the link is invisible: the recruiter
 * sees "invited" and assumes silence means disinterest, when it usually means
 * the email arrived on a Friday and got buried. This nudges them on a fixed
 * cadence until they start or the campaign deadline passes.
 *
 * The rules live here as pure functions so the cadence, the stop conditions and
 * the spam cap are unit-testable without a database or a mail provider — the
 * cost of getting them wrong is emailing a stranger every 30 minutes.
 */

/** Days between reminders. */
export const REMINDER_INTERVAL_DAYS = Number(process.env.INVITE_REMINDER_DAYS ?? 2);

/**
 * Hard cap on reminders per candidate, counted from delivery rows rather than a
 * schema column. Belt and braces: the deadline is the real stop condition, but a
 * campaign saved without one would otherwise nudge forever.
 */
export const MAX_REMINDERS = Number(process.env.INVITE_MAX_REMINDERS ?? 5);

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RemindableInvite {
  /** Set the moment they accept the invite — the clearest "they turned up" signal. */
  userId: string | null;
  invitedAt: Date;
  remindedAt: Date | null;
}

/** Whole days from `now` until `deadline`, rounded up. Null when open-ended. */
export function daysRemaining(deadline: Date | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS));
}

/**
 * Whether this invite is due a nudge right now.
 *
 * The clock runs from the last contact — `remindedAt` if we've nudged before,
 * otherwise `invitedAt`. Measuring from `invitedAt` alone would fire every sweep
 * once the first interval elapsed.
 */
export function isReminderDue(
  invite: RemindableInvite,
  deadline: Date | null,
  remindersSent: number,
  now: Date = new Date(),
  intervalDays: number = REMINDER_INTERVAL_DAYS,
  maxReminders: number = MAX_REMINDERS
): boolean {
  // Turned up already — nothing to chase.
  if (invite.userId) return false;

  // Past the deadline the link no longer works, so a nudge is worse than
  // silence: it invites someone to a door we've already locked.
  if (deadline && deadline.getTime() <= now.getTime()) return false;

  if (remindersSent >= maxReminders) return false;

  const lastContact = invite.remindedAt ?? invite.invitedAt;
  return now.getTime() - lastContact.getTime() >= intervalDays * DAY_MS;
}
