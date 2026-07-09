-- Add the finalized flag: a submission is only shown on leaderboards/certificates
-- once the whole assessment (including the verbal defence) is complete.
ALTER TABLE "Submission" ADD COLUMN "finalized" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing REVIEWED submissions were already visible under the old
-- logic, so keep them visible (don't make historical leaderboards vanish).
UPDATE "Submission" SET "finalized" = true WHERE "status" = 'REVIEWED';
