/**
 * Typed-defence fallback: a mic-failure alternate path for the spoken defence.
 * It is NEVER a candidate preference — it is granted only when the server (which
 * runs the STT) observes enough real audio failures, or by an admin grant. These
 * thresholds and the per-answer timer are env-tunable.
 */

/** Garbled pre-flight test clips before typed mode is offered. */
export const TYPED_DEFENCE_PREFLIGHT_FAILS = Number(process.env.TYPED_DEFENCE_PREFLIGHT_FAILS ?? 3);

/** Low-confidence spoken answers (same question) before typed mode is offered. */
export const TYPED_DEFENCE_LOWCONF_HITS = Number(process.env.TYPED_DEFENCE_LOWCONF_HITS ?? 2);

/** Hard per-answer timer in typed mode. Spoken answers are spontaneous; the
 *  timer is what keeps typed ones comparable. */
export const TYPED_DEFENCE_ANSWER_SECONDS = Number(process.env.TYPED_DEFENCE_ANSWER_SECONDS ?? 300);

/** Trigger reasons stored on Submission.defenceTrigger. */
export type DefenceTrigger = "preflight_failed" | "low_confidence_x2" | "admin_grant";
