-- Records that a follow-up/verbal question was generated on the cheaper
-- fallback model because the pinned model was rate limited or overloaded.
-- Questions may degrade to keep a candidate moving; scores never do, so no
-- equivalent flag exists on Submission.
-- Additive with a default — safe for `prisma migrate deploy` on boot.
ALTER TABLE "FollowUpQuestion"
  ADD COLUMN IF NOT EXISTS "usedFallbackModel" BOOLEAN NOT NULL DEFAULT false;
