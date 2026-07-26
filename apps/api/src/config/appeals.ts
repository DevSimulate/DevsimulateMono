/**
 * A hiring candidate never sees a result page, so the "request human review"
 * action lives in the rejection/feedback email instead. This is the window,
 * counted from that email, during which they can appeal their result.
 * Env-tunable; defaults to 7 days.
 */
export const APPEAL_WINDOW_DAYS = Number(process.env.APPEAL_WINDOW_DAYS ?? 7);

/** Where a hiring candidate's "request human review" reply is directed. */
export const REVIEW_CONTACT_EMAIL =
  process.env.REVIEW_CONTACT_EMAIL ?? "ossama@devsimulate.com";
