-- Add the finalized flag: a submission is only shown on leaderboards/certificates
-- once the whole assessment (including the verbal defence) is complete.
--
-- The column and its backfill are guarded TOGETHER, and that pairing is
-- load-bearing. This migration was originally applied by hand, so `migrate
-- deploy` still wants to replay it. Guarding only the ADD COLUMN would let the
-- backfill re-run against live data and set finalized = true on every REVIEWED
-- submission — including the ones legitimately waiting on a verbal defence,
-- which would publish unfinished assessments to public leaderboards.
--
-- The backfill is only ever correct at the moment the column is created.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Submission' AND column_name = 'finalized'
  ) THEN
    ALTER TABLE "Submission" ADD COLUMN "finalized" BOOLEAN NOT NULL DEFAULT false;

    -- Backfill: submissions reviewed under the OLD logic were already visible,
    -- so keep them visible (don't make historical leaderboards vanish).
    UPDATE "Submission" SET "finalized" = true WHERE "status" = 'REVIEWED';
  END IF;
END $$;
