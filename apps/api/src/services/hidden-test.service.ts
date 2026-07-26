import prisma from "../lib/prisma";
import { recomputeUserSkillScore } from "./score.service";
import { HIDDEN_TESTS_SCORING_ENABLED, HIDDEN_TEST_SCORE_CAP } from "../config/hidden-tests";
import { DIAGNOSIS, EXECUTION } from "../prompts/anchors";

export type HiddenTestStatus =
  | "passed"
  // Objective Floor v2: the repro script still reproduces the planted bug.
  // Routed identically to the legacy "critical_failed" (cap at 45).
  | "bug_not_fixed"
  | "critical_failed"
  | "regression_failed"
  | "build_failed"
  | "timeout"
  | "error";

/** Statuses that mean "the reported issue was not actually fixed" → cap at 45. */
const BUG_UNFIXED_STATUSES: readonly HiddenTestStatus[] = ["bug_not_fixed", "critical_failed"];

export interface HiddenTestCase {
  name: string;
  weight: "CRITICAL" | "REGRESSION";
  passed: boolean;
  durationMs: number;
}

export interface HiddenTestCounts {
  critical: { passed: number; failed: number };
  regression: { passed: number; failed: number };
}

export interface HiddenTestCallbackBody {
  submissionId: string;
  ticketId: string;
  status: HiddenTestStatus;
  tests: HiddenTestCase[];
  counts: HiddenTestCounts;
  // Objective Floor v2 additions (optional, advisory). The repro outcome and
  // the names (module-level only) of visible-suite tests that newly fail vs the
  // base baseline. Never carries script contents or assertions.
  reproFixed?: boolean;
  regressions?: string[];
  at?: string;
}

/** Distinguishes the new per-test callback shape from the original {result|passed} shape. */
export function isRichGraderBody(body: unknown): body is HiddenTestCallbackBody {
  return (
    !!body &&
    typeof body === "object" &&
    Array.isArray((body as { tests?: unknown }).tests) &&
    typeof (body as { status?: unknown }).status === "string"
  );
}

/** Coarse pass/fail/inconclusive mirror of `status`, kept for UI code that only knows the old shape. */
export function legacyResultFor(status: HiddenTestStatus): "pass" | "fail" | "inconclusive" {
  if (status === "passed") return "pass";
  if (status === "bug_not_fixed" || status === "critical_failed" || status === "regression_failed") return "fail";
  return "inconclusive"; // build_failed | timeout | error
}

/** Parses a "lo-hi" band string, e.g. "34-40" → [34, 40]. */
export function bandRange(band: string): [number, number] {
  const [lo, hi] = band.split("-").map(Number);
  return [lo, hi];
}

/**
 * Human-review valve: if hidden tests failed a critical case but the AI
 * review already rated Execution AND Diagnosis in their own top calibration
 * bands, don't auto-cap — the tests may simply not cover a valid alternative
 * approach. Every such case is a signal to improve the suite, not just a
 * one-off exception, which is why it's logged distinctly (see needsAttention
 * reason below) rather than silently overridden.
 */
export function inTopBand(score: number | null, band: string): boolean {
  if (score === null) return false;
  const [lo, hi] = bandRange(band);
  return score >= lo && score <= hi;
}

export interface CurrentScores {
  scoreTotal: number | null;
  scoreDiagnosis: number | null;
  scoreExecution: number | null;
}

/** The DB patch decideHiddenTestOutcome() computes — applyHiddenTestResult() just writes it. */
export interface HiddenTestOutcome {
  scoreTotal?: number;
  hiddenTestPenalty?: number;
  needsAttention?: boolean;
  needsAttentionReason?: string;
}

/**
 * THE scoring rule, as a pure function of (status, current scores) — no
 * Prisma, no I/O, fully unit-testable. applyHiddenTestResult() below is a
 * thin wrapper that fetches the current scores, calls this, and persists
 * whatever it returns.
 *
 *  - critical_failed             → cap scoreTotal at `cap`, UNLESS the
 *                                   human-review valve fires, in which case
 *                                   flag instead of capping.
 *  - regression_failed            → no cap; stored + surfaced, employer decides.
 *  - build_failed/timeout/error   → no cap; flagged for human review. A
 *                                   grader failure is OUR failure, never the
 *                                   candidate's.
 *  - passed                       → no cap, no flag.
 *
 * Never RAISES a score: if scoreTotal is already at or below `cap`, no
 * deduction is recorded even on critical_failed.
 */
export function decideHiddenTestOutcome(
  status: HiddenTestStatus,
  current: CurrentScores,
  cap: number = HIDDEN_TEST_SCORE_CAP
): HiddenTestOutcome {
  if (status === "build_failed" || status === "timeout" || status === "error") {
    return {
      needsAttention: true,
      needsAttentionReason:
        `Hidden-test grader could not complete (${status}) — this is a tooling issue, not ` +
        `necessarily a problem with the candidate's fix. No score change applied.`,
    };
  }

  // "the reported issue still reproduces" — bug_not_fixed (Objective Floor v2)
  // and the legacy critical_failed share the cap-at-45 path and the same
  // human-review valve.
  if (BUG_UNFIXED_STATUSES.includes(status)) {
    const valveFires =
      inTopBand(current.scoreExecution, EXECUTION.bands[0].band) &&
      inTopBand(current.scoreDiagnosis, DIAGNOSIS.bands[0].band);

    if (valveFires) {
      return {
        needsAttention: true,
        needsAttentionReason:
          "The reported issue still reproduced, but the AI review rated Execution and Diagnosis in " +
          "their top bands — possible valid alternative fix the repro script doesn't cover. Not " +
          "auto-capped; needs human review, and is a signal to improve the repro script.",
      };
    }

    const total = current.scoreTotal ?? 0;
    if (total > cap) {
      return { scoreTotal: cap, hiddenTestPenalty: total - cap };
    }
    return {}; // already at/below cap — never raise it, no deduction needed
  }

  return {}; // regression_failed / passed: graderResult alone is enough
}

/**
 * Applies (or records, if the flag is off) a hidden-test grading result.
 * scorePrBase is never touched (existing semantics: the raw pre-deduction
 * score). The cap is recorded as `hiddenTestPenalty`, the same field the
 * receipt already reads for deductions.
 */
export async function applyHiddenTestResult(body: HiddenTestCallbackBody): Promise<void> {
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: body.submissionId },
    select: {
      userId: true,
      scoreTotal: true,
      scoreDiagnosis: true,
      scoreExecution: true,
      hiddenTestPenalty: true,
    },
  });

  const graderResult = {
    ticketId: body.ticketId,
    status: body.status,
    result: legacyResultFor(body.status), // back-compat for existing UI reading `.result`
    counts: body.counts,
    tests: body.tests,
    // Objective Floor v2: repro outcome + names of newly-failing visible tests
    // (module-level only) for the employer's regression surface. Advisory.
    ...(body.reproFixed !== undefined ? { reproFixed: body.reproFixed } : {}),
    ...(body.regressions ? { regressions: body.regressions } : {}),
    at: body.at ?? new Date().toISOString(),
  } as object;

  if (!HIDDEN_TESTS_SCORING_ENABLED) {
    await prisma.submission.update({ where: { id: body.submissionId }, data: { graderResult } });
    return;
  }

  const outcome = decideHiddenTestOutcome(body.status, submission);
  await prisma.submission.update({ where: { id: body.submissionId }, data: { graderResult, ...outcome } });

  if (outcome.scoreTotal !== undefined) {
    await recomputeUserSkillScore(submission.userId);
  }
}
