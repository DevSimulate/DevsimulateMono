-- Integrity disqualification flags on User (admin-reversible: clear to restore).
-- IF NOT EXISTS: applied by hand originally; replaying must be a no-op.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disqualifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disqualifiedReason" TEXT;
