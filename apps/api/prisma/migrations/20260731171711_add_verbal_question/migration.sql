-- The defence question the candidate was actually asked.
--
-- Without it a -20 verbal deduction cannot be audited: the answer and the
-- grader's complaint are both stored, but not the question — so nobody can tell
-- whether the candidate dodged it or the grader judged them against something
-- else. That ambiguity is not defensible when the deduction decides a hire.
--
-- Idempotent: safe to run more than once (migrations here are applied by hand
-- in the Supabase SQL editor, not by `prisma migrate deploy`).
ALTER TABLE "FollowUpQuestion"
  ADD COLUMN IF NOT EXISTS "verbalQuestion" TEXT;
