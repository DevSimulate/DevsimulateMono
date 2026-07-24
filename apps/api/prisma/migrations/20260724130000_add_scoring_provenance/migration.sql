-- Scoring provenance: record which model + rubric version produced each score.
-- Additive and nullable — safe for `prisma migrate deploy` on boot. Existing
-- rows stay NULL, which correctly reads as "scored before provenance tracking".
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "modelUsed"     TEXT;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "rubricVersion" TEXT;
