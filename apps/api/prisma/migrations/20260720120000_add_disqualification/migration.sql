-- Integrity disqualification flags on User (admin-reversible: clear to restore).
ALTER TABLE "User" ADD COLUMN "disqualifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "disqualifiedReason" TEXT;
