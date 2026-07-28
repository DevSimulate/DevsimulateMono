/**
 * Repeatable BullMQ job that finds assessments stuck one step from completion
 * and recovers them. See services/stale-submissions.ts for the predicate and
 * the reasoning.
 */

import { Queue, Worker, Job } from "bullmq";
import { InviteStatus, CampaignType, CampaignStatus } from "@prisma/client";
import { redisConnection } from "./queue";
import prisma from "./prisma";
import { sendEmail, stuckAssessmentEmail, assessmentReminderEmail } from "./email";
import { stuckSubmissionWhere, SWEEP_INTERVAL_MS, STALE_AFTER_HOURS } from "../services/stale-submissions";
import { isReminderDue, daysRemaining } from "../services/invite-reminders";
import { resumeUrl } from "./resume";

const QUEUE_NAME = "stale-sweep";
const REPEAT_JOB_NAME = "sweep";

/** Deep link back into the assessment (single source of truth in lib/resume). */
export const resumeLink = resumeUrl;

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
      if (await sendEmail({
        to: sub.user.email, subject, html,
        meta: { type: "STUCK_SWEEP", submissionId: sub.id, userId: sub.userId },
      })) emailed++;
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

const UNDELIVERED_AFTER_MS = 15 * 60 * 1000;

/**
 * Flags submissions whose grant/resume email never reached DELIVERED within 15
 * minutes (bounced, complained, failed, or still just SENT). So no grant
 * strands silently — the candidate shows up in the admin review queue and can
 * be resent. Deduped by the reason text so it flags once, not every sweep.
 */
export async function sweepUndeliveredGrants(): Promise<{ flagged: number }> {
  const cutoff = new Date(Date.now() - UNDELIVERED_AFTER_MS);
  const undelivered = await prisma.emailDelivery.findMany({
    where: {
      type: { in: ["GRANT", "STUCK_SWEEP"] },
      status: { not: "DELIVERED" },
      createdAt: { lt: cutoff },
      submissionId: { not: null },
    },
    take: 200,
    select: { submissionId: true, status: true },
  });

  let flagged = 0;
  for (const row of undelivered) {
    if (!row.submissionId) continue;
    const r = await prisma.submission.updateMany({
      where: {
        id: row.submissionId,
        finalized: false,
        NOT: { needsAttentionReason: { contains: "undelivered" } },
      },
      data: {
        needsAttention: true,
        needsAttentionReason: `Grant/resume email ${row.status.toLowerCase()} — undelivered after 15 min`,
      },
    });
    flagged += r.count;
  }
  if (flagged) console.log(`[stale-sweep] flagged ${flagged} submission(s) with an undelivered grant/resume email`);
  return { flagged };
}

/**
 * Nudges invited candidates who never opened their assessment, every
 * REMINDER_INTERVAL_DAYS until they start or the campaign deadline passes.
 *
 * Also retires invites whose deadline has gone by, so the recruiter's list stops
 * showing "invited" for people who can no longer act — EXPIRED existed in the
 * enum but nothing ever set it.
 */
export async function sweepInviteReminders(): Promise<{ due: number; emailed: number; expired: number }> {
  const now = new Date();

  const open = await prisma.campaignInvite.findMany({
    where: {
      status: InviteStatus.INVITED,
      userId: null,
      campaign: { type: CampaignType.HIRING, status: CampaignStatus.ACTIVE },
    },
    take: 500,
    include: {
      campaign: {
        select: {
          id: true, deadline: true, roleName: true, companyName: true,
          shareableSlug: true, ticketIds: true, codebaseId: true, difficulty: true,
          org: { select: { brandName: true, logoUrl: true, primaryColor: true } },
        },
      },
    },
  });

  const appUrl = process.env.FRONTEND_URL ?? "https://www.devsimulate.com";
  let emailed = 0;
  let due = 0;
  let expired = 0;

  for (const invite of open) {
    const deadline = invite.campaign.deadline;

    if (deadline && deadline.getTime() <= now.getTime()) {
      await prisma.campaignInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.EXPIRED },
      });
      expired++;
      continue;
    }

    // Reminder count comes from the delivery log rather than a schema column —
    // every invite send already writes one, so the cap needs no migration.
    const sends = await prisma.emailDelivery.count({
      where: { type: "INVITE", campaignId: invite.campaign.id, toEmail: invite.email },
    });

    if (!isReminderDue(invite, deadline, Math.max(0, sends - 1), now)) continue;
    due++;

    const { subject, html } = assessmentReminderEmail({
      candidateName: invite.name,
      brandName: invite.campaign.org.brandName || invite.campaign.companyName,
      logoUrl: invite.campaign.org.logoUrl,
      primaryColor: invite.campaign.org.primaryColor,
      roleName: invite.campaign.roleName,
      link: `${appUrl}/apply/${invite.campaign.shareableSlug}?invite=${invite.token}`,
      deadline,
      daysLeft: daysRemaining(deadline, now),
    });

    const sent = await sendEmail({
      to: invite.email,
      subject,
      html,
      meta: { type: "INVITE", campaignId: invite.campaign.id },
    });

    // Only move the clock on a successful send. Stamping regardless would let a
    // provider outage silently consume a candidate's entire reminder schedule.
    if (sent) {
      await prisma.campaignInvite.update({
        where: { id: invite.id },
        data: { remindedAt: now },
      });
      emailed++;
    }
  }

  if (due || expired) {
    console.log(`[invite-reminders] ${due} due, ${emailed} emailed, ${expired} expired`);
  }
  return { due, emailed, expired };
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
    async (_job: Job) => {
      await sweepStuckSubmissions();
      await sweepUndeliveredGrants();
      await sweepInviteReminders();
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on("failed", (_job, err) => console.error("[stale-sweep] sweep failed:", err.message));
  return worker;
}
