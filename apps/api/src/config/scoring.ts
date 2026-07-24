/**
 * Single source of truth for every model / sampling decision that can move a
 * candidate's score.
 *
 * Why this exists: scoring calls previously carried inline model strings. A
 * silent model update or sampling variance would then shift scores with no
 * record of what produced them, and two candidates assessed a week apart could
 * be graded by different judges. Everything routes through here, and the model
 * + rubric version are persisted on each submission so any historical score is
 * reproducible and auditable.
 *
 * RULE: no `model:` string literal may appear anywhere outside this file.
 */

/** Exact pinned scoring model. Override per-environment, never per-call-site. */
export const SCORING_MODEL = process.env.SCORING_MODEL ?? "claude-sonnet-4-6";

/**
 * Scoring must be deterministic — the same submission has to produce the same
 * score. Applies to PR review, system-design review, follow-up answer scoring
 * and verbal-defence evaluation.
 */
export const SCORING_TEMPERATURE = 0;

/**
 * Question GENERATION is deliberately NOT temperature 0.
 *
 * A candidate who abandons the verbal step and resumes it later gets a fresh
 * question on re-entry (see the stuck-submission recovery flow). At temperature
 * 0 the "fresh" question would come back byte-identical to the one they already
 * saw and had time to prepare for, which quietly defeats the anti-preparation
 * property of on-the-spot questions. Variety here is a fairness feature, not
 * drift — question wording never contributes points.
 */
export const QUESTION_TEMPERATURE = Number(process.env.QUESTION_TEMPERATURE ?? 1);

/** Question generation runs on the same pinned model unless explicitly split. */
export const QUESTION_MODEL = process.env.QUESTION_MODEL ?? SCORING_MODEL;

/**
 * Version of the rubric + prompt scaffolding that produced a score. Bump this
 * whenever the scoring prompt changes in a way that could move scores, so old
 * and new scores are never silently compared as if they were like-for-like.
 *
 * v1 — original four-dimension rubric, no calibration anchors.
 *
 * TODO(ossama): bump to "v2" once the real anchor excerpts from the 27 DevFest
 * submissions are pasted into src/prompts/anchors/*.ts. Placeholder anchors are
 * not injected into the prompt, so the live rubric is still v1 until then.
 */
export const RUBRIC_VERSION = "v1";

/**
 * Cheaper model used ONLY when question generation has exhausted its retries.
 *
 * Scoring never falls back. A score produced by an unpinned model would be
 * incomparable to every other score and invisible in the audit trail, so a
 * scoring call retries and then fails loudly instead. Questions are different:
 * a slightly weaker question still lets the candidate finish, and losing the
 * whole assessment to a rate limit is far worse than a cheaper question.
 */
export const FALLBACK_MODEL = process.env.FALLBACK_MODEL ?? "claude-haiku-4-5-20251001";

/**
 * Throughput ceiling for Anthropic calls, enforced by the BullMQ worker.
 * Set ANTHROPIC_RPM to match your API tier — during DevFest the queue happily
 * saturated the account limit and question generation started failing.
 *
 * Note each submission now issues SCORING_RUNS parallel scoring calls, so the
 * effective request rate is roughly 3× the job rate. Defaults are conservative.
 */
export const ANTHROPIC_RPM = Number(process.env.ANTHROPIC_RPM ?? 20);
export const ANTHROPIC_CONCURRENCY = Number(process.env.ANTHROPIC_CONCURRENCY ?? 2);

/** Max attempts for a single Anthropic call before it gives up. */
export const ANTHROPIC_MAX_RETRIES = Number(process.env.ANTHROPIC_MAX_RETRIES ?? 5);

/** Spread into a scoring `messages.create` call: `{ ...SCORING_CALL, max_tokens }`. */
export const SCORING_CALL = {
  model: SCORING_MODEL,
  temperature: SCORING_TEMPERATURE,
} as const;

/** Spread into a question-generation `messages.create` call. */
export const QUESTION_CALL = {
  model: QUESTION_MODEL,
  temperature: QUESTION_TEMPERATURE,
} as const;
