-- Server-authoritative failure counters that gate the typed-defence fallback:
-- garbled pre-flight clips and low-confidence spoken answers. Only the server
-- (which runs the STT) increments these, so typed mode can never be
-- self-selected. Additive with defaults — safe for `prisma migrate deploy`.
ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "preflightFails" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Submission"
  ADD COLUMN IF NOT EXISTS "verbalLowConfHits" INTEGER NOT NULL DEFAULT 0;
