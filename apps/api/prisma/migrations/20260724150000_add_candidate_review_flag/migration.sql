-- Proctoring flag for HUMAN review. Replaces the automatic paste
-- disqualification: repeated paste attempts now flag the candidate and the
-- assessment continues, instead of banning the account outright.
-- Additive with defaults — safe for `prisma migrate deploy` on boot.
ALTER TABLE "CampaignCandidate"
  ADD COLUMN IF NOT EXISTS "flaggedForReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CampaignCandidate"
  ADD COLUMN IF NOT EXISTS "flaggedReason" TEXT;
ALTER TABLE "CampaignCandidate"
  ADD COLUMN IF NOT EXISTS "flaggedAt" TIMESTAMP(3);
