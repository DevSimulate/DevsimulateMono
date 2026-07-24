/**
 * Stuck-assessment recovery.
 *
 * The verbal defence is the only thing that sets `finalized`, which makes it a
 * single point of failure: if a candidate's mic dies or they close the tab at
 * that step, their reviewed score silently never publishes. Nobody is told —
 * not the candidate, not the employer — and it surfaces days later as "my score
 * isn't on the leaderboard". This sweep closes that hole.
 *
 * The query predicate is exported separately and kept pure so the rules for
 * "stuck" are unit-testable without a database.
 */

import type { Prisma } from "@prisma/client";

/** How long after review a submission is considered stuck. */
export const STALE_AFTER_HOURS = Number(process.env.STALE_SUBMISSION_HOURS ?? 2);

/** How often the sweep runs. */
export const SWEEP_INTERVAL_MS = Number(process.env.STALE_SWEEP_INTERVAL_MS ?? 30 * 60 * 1000);

/** The moment before which a reviewed-but-unfinalized submission counts as stuck. */
export function staleCutoff(now: Date = new Date(), hours: number = STALE_AFTER_HOURS): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

/**
 * Submissions that finished AI review but never completed the assessment.
 *
 * `staleNotifiedAt: null` is the dedupe: each candidate is nudged exactly once,
 * however many times the sweep runs. Re-notifying someone every 30 minutes
 * about an assessment they may have deliberately abandoned would be spam.
 */
export function stuckSubmissionWhere(now: Date = new Date()): Prisma.SubmissionWhereInput {
  return {
    status: "REVIEWED",
    finalized: false,
    staleNotifiedAt: null,
    reviewedAt: { not: null, lt: staleCutoff(now) },
  };
}
