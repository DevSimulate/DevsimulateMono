-- Stuck-assessment recovery: a submission reviewed but never finalized
-- publishes nothing and the candidate is never told. These columns let a
-- periodic sweep nudge them exactly once and raise the case for an admin.
-- Additive with defaults — safe for `prisma migrate deploy` on boot.
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "staleNotifiedAt"      TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "needsAttention"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "needsAttentionReason" TEXT;

-- Sweep predicate hits (status, finalized, reviewedAt) on every run.
CREATE INDEX IF NOT EXISTS "Submission_stuck_sweep_idx"
  ON "Submission" ("status", "finalized", "reviewedAt");
