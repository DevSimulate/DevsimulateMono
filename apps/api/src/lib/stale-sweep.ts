/**
 * Repeatable BullMQ job that finds assessments stuck one step from completion
 * and recovers them. See services/stale-submissions.ts for the predicate and
 * the reasoning.
 */

import { Queue, Worker, Job } from "bullmq";
import { redisConnection } from "./queue";
import prisma from "./prisma";
import { sendEmail, stuckAssessmentEmail } from "./email";
import { stuckSubmissionWhere, SWEEP_INTERVAL_MS, STALE_AFTER_HOURS } from "../services/stale-submissions";

const QUEUE_NAME = "stale-sweep";
const REPEAT_JOB_NAME = "sweep";

const APP_URL = process.env.FRONTEND_URL ?? "https://www.devsimulate.com";

/** Deep link back into the assessment, straight to the unfinished verbal step. */
export function resumeLink(submissionId: string, ticketId: string): string {
  return `${APP_URL}/submit?resume=${encodeURIComponent(submissionId)}&ticketId=${encodeURIComponent(ticketId)}`;
}

/**
 * One sweep. Nudges each stuck candidate exactly once and raises the submission
 * for an admin. Never finalizes anything by itself — publishing a score without
 * the verbal step is a human decision.
 */
export async function sweepStuckSubmissions(): Promise<{ found: number; emailed: number }> {
  const stuck = await prisma.submission.findMany({
    where: stuckSubmissionWhere(),
    take: 200, // bound the batch; the rest are caught next sweep
    include: {
      user: { select: { email: true, fullName: true } },
      ticket: { select: { id: true, title: true } },
    },
  });

  if (stuck.length === 0) return { found: 0, emailed: 0 };

  let emailed = 0;
  for (const sub of stuck) {
    // Only chase candidates who can still act on it.
    const candidacy = await prisma.campaignCandidate.findFirst({
      where: { userId: sub.userId, campaign: { ticketIds: { has: sub.ticketId } } },
      select: { campaign: { select: { deadline: true } } },
      orderBy: { joinedAt: "desc" },
    });
    const deadline = candidacy?.campaign.deadline ?? null;
    const past = deadline !== null && deadline < new Date();

    if (!past && sub.user.email) {
      const { subject, html } = stuckAssessmentEmail({
        candidateName: sub.user.fullName,
        ticketTitle: sub.ticket.title,
        resumeLink: resumeLink(sub.id, sub.ticket.id),
        deadline,
      });
      if (await sendEmail({ to: sub.user.email, subject, html })) emailed++;
    }

    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        staleNotifiedAt: new Date(),
        needsAttention: true,
        needsAttentionReason: past
          ? "Assessment never finalized and the campaign deadline has passed — needs a manual decision"
          : `Assessment reviewed but not finalized after ${STALE_AFTER_HOURS}h — candidate notified`,
      },
    });
  }

  console.log(`[stale-sweep] ${stuck.length} stuck submission(s), ${emailed} candidate(s) emailed`);
  return { found: stuck.length, emailed };
}

/**
 * Registers the repeatable job and starts its worker. The repeat entry is keyed
 * on the interval, so re-registering on every boot is safe — BullMQ dedupes it
 * rather than stacking a new schedule per deploy.
 */
export function startStaleSweepWorker(): Worker {
  const queue = new Queue(QUEUE_NAME, { connection: redisConnection });

  void queue
    .add(REPEAT_JOB_NAME, {}, {
      repeat: { every: SWEEP_INTERVAL_MS },
      removeOnComplete: 20,
      removeOnFail: 20,
    })
    .catch((e) => console.error("[stale-sweep] failed to schedule:", e instanceof Error ? e.message : e));

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => { await sweepStuckSubmissions(); },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on("failed", (_job, err) => console.error("[stale-sweep] sweep failed:", err.message));
  return worker;
}
