-- AlterTable
-- IF NOT EXISTS: this was originally applied by hand, so `migrate deploy` still
-- needs to replay it to record history. Replaying must be a no-op.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "devFestTag" TEXT;
