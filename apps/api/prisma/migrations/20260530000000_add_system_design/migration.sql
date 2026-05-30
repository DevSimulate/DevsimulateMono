-- Add SYSTEM_DESIGN to Stack enum (IF NOT EXISTS makes this idempotent / safe to re-run)
ALTER TYPE "Stack" ADD VALUE IF NOT EXISTS 'SYSTEM_DESIGN';

-- AlterTable: make prUrl and branchName optional, add designDoc (all idempotent)
ALTER TABLE "Submission" ALTER COLUMN "prUrl" DROP NOT NULL;
ALTER TABLE "Submission" ALTER COLUMN "branchName" DROP NOT NULL;
ALTER TABLE "Submission" ALTER COLUMN "prDescription" DROP NOT NULL;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "designDoc" TEXT;
