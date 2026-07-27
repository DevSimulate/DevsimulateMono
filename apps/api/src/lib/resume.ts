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

export interface ResumeStage {
  /** The only resumable stage today is the spoken/typed defence. */
  stage: "verbal";
  defenceMode: DefenceMode;
  url: string;
}

export function resolveResumeStage(sub: {
  id: string;
  ticketId: string;
  defenceMode: DefenceMode;
}): ResumeStage {
  return {
    stage: "verbal",
    defenceMode: sub.defenceMode,
    url: resumeUrl(sub.id, sub.ticketId),
  };
}
