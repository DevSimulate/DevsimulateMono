-- Spoken-defence channel + why it was granted, plus a keystroke-cadence
-- summary for typed answers. TYPED is only reached via a mic-failure trigger
-- or an admin grant; scoring is identical to VOICE, so these are advisory
-- signals only. Additive with defaults / nullable — safe for
-- `prisma migrate deploy` on boot.

-- CreateEnum (idempotent: CREATE TYPE has no IF NOT EXISTS in Postgres)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DefenceMode') THEN
    CREATE TYPE "DefenceMode" AS ENUM ('VOICE', 'TYPED');
  END IF;
END$$;

ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "defenceMode" "DefenceMode" NOT NULL DEFAULT 'VOICE';
ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "defenceTrigger" TEXT;
ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "typedCadence" JSONB;
