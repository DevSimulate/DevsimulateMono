/**
 * Config for hidden-test (CI grader) scoring. Separate from config/scoring.ts,
 * which is about the LLM judge — this is about the objective, CI-run
 * correctness check and how much it's allowed to move a score.
 */

/**
 * Master switch. OFF means the grader callback still runs and stores its
 * result (graderResult / needsAttention), exactly as before — it just never
 * touches scoreTotal. Default OFF until the suites in geoinsight-grader have
 * run against real candidate submissions and the cap threshold is trusted.
 */
export const HIDDEN_TESTS_SCORING_ENABLED = process.env.HIDDEN_TESTS_SCORING_ENABLED === "true";

/** A submission with a failing CRITICAL hidden test is capped at this score. Never raises a score. */
export const HIDDEN_TEST_SCORE_CAP = Number(process.env.HIDDEN_TEST_SCORE_CAP ?? 45);
