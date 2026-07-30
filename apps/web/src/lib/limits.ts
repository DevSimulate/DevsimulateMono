/**
 * Free-tier monthly assessment allowance, mirrored from the API's
 * FREE_MONTHLY_SUBMISSIONS so the number is stated in one place rather than
 * retyped into every message that mentions it.
 *
 * Applies to self-serve practice only — candidates invited to a hiring
 * campaign are never metered, so none of this copy should reach them.
 *
 * Kept in sync via NEXT_PUBLIC_FREE_MONTHLY_SUBMISSIONS. If you change the
 * API's limit, set this too, or the app will quote a number it doesn't enforce.
 */
export const FREE_MONTHLY_ASSESSMENTS = Number(
  process.env.NEXT_PUBLIC_FREE_MONTHLY_SUBMISSIONS ?? 5
);

/** "You've used your 5 assessments this month — resets on the 1st." */
export const QUOTA_REACHED_MESSAGE =
  `You've used your ${FREE_MONTHLY_ASSESSMENTS} assessments this month — resets on the 1st.`;
