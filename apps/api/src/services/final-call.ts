/**
 * The final-call email: one last reminder on the morning of the deadline day,
 * to everyone who hasn't finished — invited-but-never-started and
 * started-but-stalled alike.
 *
 * Sent by the sweep rather than by a person, because the useful moment to send
 * it (early morning, hours before the round closes) is a moment nobody wants to
 * be awake for. The rules live here as pure functions so the firing time is
 * unit-testable without a clock, a database or a mail provider — the cost of
 * getting it wrong is emailing seventy strangers at the wrong hour, or on the
 * wrong day, or twice.
 *
 * Deliberately derived from the campaign's own deadline instead of a configured
 * timestamp. A one-off "send at 06:00 on 6 August" needs re-configuring for
 * every round and silently does nothing if the deadline moves; "06:00 on
 * whatever the deadline day is" follows the deadline automatically, which is
 * the behaviour you actually want the second time.
 */

/** Local hour of the deadline day to send at. 06:00 lands before the working day. */
export const FINAL_CALL_HOUR = Number(process.env.FINAL_CALL_HOUR ?? 6);

/**
 * Candidates' UTC offset. Pakistan (+5) for the current rounds — the deadline
 * is stored as an instant, but "the deadline day" and "6am" are wall-clock
 * ideas and need one.
 */
export const CAMPAIGN_UTC_OFFSET_HOURS = Number(process.env.CAMPAIGN_UTC_OFFSET_HOURS ?? 5);

/** Kill switch. Set FINAL_CALL_ENABLED=false to stop the automatic send. */
export const FINAL_CALL_ENABLED = process.env.FINAL_CALL_ENABLED !== "false";

/**
 * The instant to send: `hour` local time on the deadline's local date.
 *
 * Both conversions go through the offset. Reading the date off the raw UTC
 * deadline would pick the wrong day for any deadline late enough to have
 * already rolled over in UTC — 23:59 on the 6th in Karachi is 18:59 on the 6th
 * in UTC, but 01:00 on the 7th in Karachi is the 6th in UTC.
 */
export function finalCallAt(
  deadline: Date,
  offsetHours: number = CAMPAIGN_UTC_OFFSET_HOURS,
  hour: number = FINAL_CALL_HOUR
): Date {
  // Shift into local wall-clock so the calendar date can be read off directly.
  const local = new Date(deadline.getTime() + offsetHours * 3600_000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour - offsetHours, 0, 0, 0)
  );
}

/**
 * Whether the final call should go out now.
 *
 * The upper bound matters as much as the lower one: past the deadline the link
 * no longer works, so a "last chance" email would invite people to a door we
 * have already locked. The sweep runs on an interval, so this stays true for
 * the whole window and idempotency is enforced by the delivery log, not here.
 */
export function isFinalCallDue(
  deadline: Date | null,
  now: Date = new Date(),
  offsetHours: number = CAMPAIGN_UTC_OFFSET_HOURS,
  hour: number = FINAL_CALL_HOUR
): boolean {
  if (!deadline) return false;

  // Round already closed — nothing left to remind anyone about.
  if (now.getTime() >= deadline.getTime()) return false;

  return now.getTime() >= finalCallAt(deadline, offsetHours, hour).getTime();
}
