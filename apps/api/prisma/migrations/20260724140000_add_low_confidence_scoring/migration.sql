-- Flags a submission whose score came from a single surviving scoring run,
-- so the per-dimension median cross-check never happened.
-- Additive with a default — safe for `prisma migrate deploy` on boot.
ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "lowConfidenceScoring" BOOLEAN NOT NULL DEFAULT false;
