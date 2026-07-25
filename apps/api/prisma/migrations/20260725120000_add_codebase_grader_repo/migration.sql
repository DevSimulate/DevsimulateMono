-- Per-codebase hidden-test grader repo. Null keeps existing behavior exactly
-- as-is (falls back to the GRADER_REPO env var at dispatch time).
-- Additive and nullable — safe for `prisma migrate deploy` on boot.
ALTER TABLE "Codebase" ADD COLUMN IF NOT EXISTS "graderRepo" TEXT;
