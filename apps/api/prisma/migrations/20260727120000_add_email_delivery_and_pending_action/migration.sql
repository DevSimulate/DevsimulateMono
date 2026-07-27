-- Transactional-email delivery tracking + the candidate's pending-action nudge.
-- Additive and idempotent — safe for `prisma migrate deploy` on boot and for
-- hand-running in the Supabase SQL editor.

-- CreateEnum (idempotent guards — Postgres has no CREATE TYPE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailType') THEN
    CREATE TYPE "EmailType" AS ENUM ('GRANT', 'STUCK_SWEEP', 'REJECTION', 'INTERVIEW', 'INVITE', 'MAGIC_LINK', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailStatus') THEN
    CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED');
  END IF;
END$$;

-- Candidate pending-action nudge (drives the dashboard/extension action card)
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "pendingAction" TEXT;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "pendingActionAt" TIMESTAMP(3);

-- Delivery tracking table
CREATE TABLE IF NOT EXISTS "EmailDelivery" (
  "id"           TEXT NOT NULL,
  "resendId"     TEXT,
  "type"         "EmailType" NOT NULL,
  "status"       "EmailStatus" NOT NULL DEFAULT 'SENT',
  "toEmail"      TEXT NOT NULL,
  "subject"      TEXT NOT NULL,
  "actionLine"   TEXT,
  "submissionId" TEXT,
  "campaignId"   TEXT,
  "userId"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt"  TIMESTAMP(3),
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailDelivery_resendId_idx" ON "EmailDelivery" ("resendId");
CREATE INDEX IF NOT EXISTS "EmailDelivery_submissionId_idx" ON "EmailDelivery" ("submissionId");
CREATE INDEX IF NOT EXISTS "EmailDelivery_userId_idx" ON "EmailDelivery" ("userId");
