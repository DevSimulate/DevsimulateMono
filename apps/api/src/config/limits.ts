/**
 * How many assessments a FREE user may submit per calendar month, resetting on
 * the 1st.
 *
 * This meters SELF-SERVE practice only. Hiring assessments are exempt entirely
 * (see routes/submissions.ts) — an employer-invited candidate is not spending a
 * personal practice allowance on someone else's interview, and metering them
 * once locked a live candidate out mid-assessment.
 *
 * Env-tunable so the ceiling can be raised during a pilot without a deploy.
 */
export const FREE_MONTHLY_SUBMISSIONS = Number(process.env.FREE_MONTHLY_SUBMISSIONS ?? 5);
