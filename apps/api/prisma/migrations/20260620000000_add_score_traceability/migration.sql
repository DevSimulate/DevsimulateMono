-- Add score traceability fields to Submission
-- scorePrBase: raw Claude PR score, written once at review time, never mutated
-- verbalPenalty: points deducted by the verbal defence check
-- hiddenTestPenalty: points deducted when the hidden CI test fails

ALTER TABLE "Submission" ADD COLUMN "scorePrBase" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "verbalPenalty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Submission" ADD COLUMN "hiddenTestPenalty" INTEGER NOT NULL DEFAULT 0;
