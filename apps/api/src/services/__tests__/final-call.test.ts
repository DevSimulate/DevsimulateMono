import { test } from "node:test";
import assert from "node:assert/strict";
import { finalCallAt, isFinalCallDue } from "../final-call";

/**
 * This job emails an entire cohort with nobody watching, so the firing time is
 * pinned down here rather than trusted to a manual check on the morning.
 */

const PKT = 5;
const HOUR = 6;

/** Deadline used throughout: 23:59:59.999 on 6 Aug in Karachi. */
const DEADLINE = new Date("2026-08-06T18:59:59.999Z");
const FIRE = new Date("2026-08-06T01:00:00.000Z"); // 06:00 PKT the same morning

test("fires at 6am local on the deadline day", () => {
  assert.equal(finalCallAt(DEADLINE, PKT, HOUR).toISOString(), FIRE.toISOString());
});

test("the deadline day is the LOCAL day, not the UTC one", () => {
  // 01:00 on the 7th in Karachi is still the 6th in UTC. Reading the date off
  // the raw UTC instant would send on the wrong morning.
  const justAfterMidnightLocal = new Date("2026-08-06T20:00:00.000Z"); // 01:00 PKT, 7 Aug
  assert.equal(finalCallAt(justAfterMidnightLocal, PKT, HOUR).toISOString(), "2026-08-07T01:00:00.000Z");
});

test("silent before the firing time", () => {
  assert.equal(isFinalCallDue(DEADLINE, new Date("2026-08-05T17:40:00Z"), PKT, HOUR), false); // evening before
  assert.equal(isFinalCallDue(DEADLINE, new Date("2026-08-06T00:59:59Z"), PKT, HOUR), false); // one second early
});

test("due from the firing time onward", () => {
  assert.equal(isFinalCallDue(DEADLINE, FIRE, PKT, HOUR), true);
  assert.equal(isFinalCallDue(DEADLINE, new Date("2026-08-06T01:29:00Z"), PKT, HOUR), true); // next sweep
  assert.equal(isFinalCallDue(DEADLINE, new Date("2026-08-06T12:00:00Z"), PKT, HOUR), true);
});

test("stops at the deadline — never invites people to a locked door", () => {
  assert.equal(isFinalCallDue(DEADLINE, DEADLINE, PKT, HOUR), false);
  assert.equal(isFinalCallDue(DEADLINE, new Date("2026-08-07T02:00:00Z"), PKT, HOUR), false);
});

test("a campaign with no deadline never fires", () => {
  assert.equal(isFinalCallDue(null, new Date(), PKT, HOUR), false);
});

test("does not fire on days before the deadline day", () => {
  // The window is a single morning. A round running for weeks must not send
  // this every day.
  for (const d of ["2026-08-01", "2026-08-04", "2026-08-05"]) {
    assert.equal(isFinalCallDue(DEADLINE, new Date(`${d}T01:00:00Z`), PKT, HOUR), false, d);
    assert.equal(isFinalCallDue(DEADLINE, new Date(`${d}T09:00:00Z`), PKT, HOUR), false, d);
  }
});

test("a deadline earlier than the send hour simply never fires", () => {
  // 03:00 local closes before 06:00 local, so there is no valid moment to send.
  const early = new Date("2026-08-06T22:00:00.000Z"); // 03:00 PKT, 7 Aug
  const fire = finalCallAt(early, PKT, HOUR);
  assert.ok(fire.getTime() > early.getTime());
  assert.equal(isFinalCallDue(early, new Date("2026-08-06T21:00:00Z"), PKT, HOUR), false);
});

test("honours a different timezone", () => {
  // Same instant, UTC candidates: 6am UTC on the UTC deadline day.
  assert.equal(finalCallAt(DEADLINE, 0, HOUR).toISOString(), "2026-08-06T06:00:00.000Z");
});
