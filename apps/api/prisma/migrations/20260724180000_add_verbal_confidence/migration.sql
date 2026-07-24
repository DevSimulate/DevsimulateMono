-- Trust score (0-1) for the Whisper transcript of the spoken defence.
-- Below the configured threshold the answer is routed to human review instead
-- of being scored, so a bad microphone can no longer cost a candidate points.
-- Additive and nullable — safe for `prisma migrate deploy` on boot.
ALTER TABLE "FollowUpQuestion" ADD COLUMN IF NOT EXISTS "verbalConfidence" DOUBLE PRECISION;
