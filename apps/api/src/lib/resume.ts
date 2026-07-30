import { DefenceMode } from "@prisma/client";

/**
 * Single source of truth for where an unfinished assessment resumes to, and the
 * deep link that lands there. Used by the /resume endpoint, the stuck-sweep and
 * grant emails, and the candidate dashboard/extension action cards — so a link
 * and the endpoint can never disagree.
 */
const APP_URL = process.env.FRONTEND_URL ?? "https://www.devsimulate.com";

export function resumeUrl(submissionId: string, ticketId: string): string {
  return `${APP_URL}/submit?resume=${encodeURIComponent(submissionId)}&ticketId=${encodeURIComponent(ticketId)}`;
}

/**
 * Every point a candidate can be returned to. This used to be "verbal" and
 * nothing else, which stranded anyone whose tab died BEFORE the defence: the
 * endpoint refused them ("the written follow-up questions were never
 * completed") and the only way forward was to redo the whole assessment.
 */
export type ResumeStageName = "analysing" | "q1" | "q2" | "verbal";

export interface ResumeStage {
  stage: ResumeStageName;
  defenceMode: DefenceMode;
  url: string;
}

/** The shape resolveResumeStage needs to place a candidate. */
export interface ResumableSubmission {
  id: string;
  ticketId: string;
  defenceMode: DefenceMode;
  status: string;
  finalized: boolean;
  followUp: {
    question1: string | null;
    question2: string | null;
    answer1: string | null;
    answer2: string | null;
    answeredAt: Date | null;
  } | null;
}

/**
 * Where this candidate actually left off, derived from what they have already
 * produced rather than assumed.
 *
 * Read in order, earliest incomplete step wins:
 *   review not finished       -> analysing (poll until Q1 exists)
 *   Q1 exists, unanswered     -> q1
 *   Q2 exists, unanswered     -> q2
 *   both answered             -> verbal
 *
 * A missing question2 with answer1 present also lands on q2 — the client
 * generates Q2 on arrival, so the candidate waits a moment rather than being
 * bounced back to a step they already finished.
 */
export function resolveResumeStage(sub: ResumableSubmission): ResumeStage {
  const url = resumeUrl(sub.id, sub.ticketId);
  const base = { defenceMode: sub.defenceMode, url };
  const fu = sub.followUp;

  if (sub.status !== "REVIEWED" || !fu?.question1) {
    return { ...base, stage: "analysing" };
  }
  if (!fu.answer1) return { ...base, stage: "q1" };
  if (!fu.answer2) return { ...base, stage: "q2" };
  return { ...base, stage: "verbal" };
}
