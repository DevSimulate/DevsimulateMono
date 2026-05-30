-- Add SYSTEM_DESIGN to Stack enum
ALTER TYPE "Stack" ADD VALUE 'SYSTEM_DESIGN';

-- AlterTable: make prUrl and branchName optional, add designDoc
ALTER TABLE "Submission" ALTER COLUMN "prUrl" DROP NOT NULL;
ALTER TABLE "Submission" ALTER COLUMN "branchName" DROP NOT NULL;
ALTER TABLE "Submission" ALTER COLUMN "prDescription" DROP NOT NULL;
ALTER TABLE "Submission" ADD COLUMN "designDoc" TEXT;
