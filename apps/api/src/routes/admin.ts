/**
 * Admin operations for recovering stuck assessments.
 *
 * Gated by a shared secret in the `x-admin-key` header rather than the normal
 * candidate/employer JWT: these actions publish scores, so they must not be
 * reachable by any signed-in user. If ADMIN_API_KEY is unset the whole router
 * is closed — an unset secret must never mean "open".
 */

import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { finalizeSubmission } from "../services/score.service";
import { sweepStuckSubmissions, sweepInviteReminders } from "../lib/stale-sweep";
import { resumeUrl } from "../lib/resume";
import { sendEmail, grantEmail, stuckAssessmentEmail } from "../lib/email";
import { reviewQueue } from "../lib/queue";
import { ReviewJobData } from "../types/index";

const router = Router();

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    res.status(503).json({ error: "Admin endpoints are disabled — ADMIN_API_KEY is not configured" });
    return;
  }
  if (req.header("x-admin-key") !== expected) {
    res.status(401).json({ error: "Invalid admin key" });
    return;
  }
  next();
}

router.use(requireAdminKey);

/**
 * Why this candidate is stuck, computed rather than left to be inferred from
 * timestamps. The whole point of the console is that the answer to "what is
 * wrong with this person's assessment" is on screen, not reconstructed.
 *
 * Order matters — the first matching rule wins, most actionable first.
 */
function deriveStatus(
  subs: { status: string; finalized: boolean; reviewedAt: Date | null; submittedAt: Date; ticketId: string }[],
  invite: { status: string; invitedAt: Date } | null,
  deadline: Date | null
): { state: string; detail: string; suggest: string | null } {
  const now = Date.now();
  const live = subs.filter((s) => s.status !== "VOID");
  const past = deadline !== null && deadline.getTime() < now;

  const dupes = new Map<string, number>();
  for (const s of live) dupes.set(s.ticketId, (dupes.get(s.ticketId) ?? 0) + 1);
  const duped = [...dupes.values()].some((n) => n > 1);

  if (duped) {
    return { state: "Duplicate submissions", detail: "More than one live submission on the same ticket.", suggest: "void" };
  }

  const pending = live.find((s) => s.status === "PENDING");
  if (pending) {
    const mins = Math.round((now - pending.submittedAt.getTime()) / 60000);
    if (mins > 10) {
      return {
        state: "Review never ran",
        detail: `Pending for ${mins} min — the queued job is missing or the worker was down.`,
        suggest: "requeue",
      };
    }
    return { state: "Review in progress", detail: `Submitted ${mins} min ago.`, suggest: null };
  }

  const reviewed = live.find((s) => s.status === "REVIEWED" && !s.finalized);
  if (reviewed) {
    const hrs = reviewed.reviewedAt ? Math.round((now - reviewed.reviewedAt.getTime()) / 3_600_000) : 0;
    if (hrs >= 2) {
      return {
        state: "Stuck at the spoken defence",
        detail: `Reviewed ${hrs}h ago and never completed — usually a failed mic or a closed tab.`,
        suggest: "grant-typed",
      };
    }
    return { state: "Mid-assessment", detail: "Reviewed, working through the questions.", suggest: null };
  }

  if (live.some((s) => s.finalized)) {
    return { state: "Complete", detail: "Assessment finished and published to the employer.", suggest: null };
  }

  if (live.length === 0 && subs.length > 0) {
    return { state: "No live submission", detail: "Every submission was voided — awaiting a resubmit.", suggest: null };
  }

  if (invite && invite.status === "INVITED") {
    const days = Math.floor((now - invite.invitedAt.getTime()) / 86_400_000);
    if (past) return { state: "Expired", detail: "Never started, and the deadline has passed.", suggest: null };
    return { state: "Not started", detail: `Invited ${days} day(s) ago, hasn't opened the assessment.`, suggest: "resend" };
  }

  return { state: "No activity", detail: "Joined but nothing submitted yet.", suggest: null };
}

/**
 * GET /admin/candidates?q=<email | github username | partial>
 * Search. Returns enough to pick the right person, not their full record.
 */
router.get("/candidates", async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.status(400).json({ error: "Query must be at least 2 characters" }); return; }
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { githubUsername: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 25,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, githubUsername: true, fullName: true,
        subscriptionTier: true, skillScore: true,
        _count: { select: { submissions: true } },
      },
    });
    res.json({ data: users });
  } catch (err) {
    console.error("[admin] candidate search error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * GET /admin/candidates/:userId
 * Everything about one candidate on one screen: identity, campaign, invite,
 * every submission, and the derived reason they're stuck.
 */
router.get("/candidates/:userId", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true, email: true, githubUsername: true, fullName: true,
        subscriptionTier: true, skillScore: true, createdAt: true,
        disqualifiedAt: true, disqualifiedReason: true,
      },
    });
    if (!user) { res.status(404).json({ error: "Candidate not found" }); return; }

    const candidacy = await prisma.campaignCandidate.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: "desc" },
      select: {
        joinedAt: true,
        campaign: {
          select: {
            id: true, roleName: true, companyName: true, type: true, status: true,
            deadline: true, blockPaste: true, requireFullscreen: true, ticketIds: true,
          },
        },
      },
    });

    const invite = user.email
      ? await prisma.campaignInvite.findFirst({
          where: { email: user.email },
          orderBy: { invitedAt: "desc" },
          select: { id: true, status: true, invitedAt: true, remindedAt: true, acceptedAt: true, campaignId: true },
        })
      : null;

    const submissions = await prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      take: 50,
      select: {
        id: true, ticketId: true, status: true, finalized: true, scoreTotal: true,
        submittedAt: true, reviewedAt: true, prUrl: true, branchName: true,
        pasteAttempts: true, riskScore: true, defenceMode: true, defenceTrigger: true,
        needsAttention: true, needsAttentionReason: true, pendingAction: true,
        ticket: { select: { title: true } },
        followUp: { select: { question1: true, answer1: true, answer2: true, verbalTranscript: true, verbalScore: true } },
      },
    });

    const status = deriveStatus(
      submissions.map((s) => ({
        status: s.status, finalized: s.finalized, reviewedAt: s.reviewedAt,
        submittedAt: s.submittedAt, ticketId: s.ticketId,
      })),
      invite ? { status: invite.status, invitedAt: invite.invitedAt } : null,
      candidacy?.campaign.deadline ?? null
    );

    res.json({ data: { user, campaign: candidacy?.campaign ?? null, joinedAt: candidacy?.joinedAt ?? null, invite, submissions, status } });
  } catch (err) {
    console.error("[admin] candidate detail error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load candidate" });
  }
});

/**
 * POST /admin/submissions/:id/void
 * Body: { reason? }
 *
 * Takes a submission out of play without deleting it. VOID is excluded from the
 * quota count and from every score aggregate, so this is the safe way to undo a
 * duplicate or let someone restart — the record stays for audit.
 */
router.post("/submissions/:id/void", async (req: Request, res: Response): Promise<void> => {
  const { reason } = req.body as { reason?: string };
  try {
    const sub = await prisma.submission.update({
      where: { id: req.params.id },
      data: {
        status: "VOID",
        needsAttention: false,
        needsAttentionReason: reason?.trim() || "Voided by an administrator",
        pendingAction: null,
        pendingActionAt: null,
      },
      select: { id: true, userId: true, status: true },
    });
    res.json({ data: sub });
  } catch (err) {
    console.error("[admin] void error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to void submission" });
  }
});

/**
 * POST /admin/submissions/:id/requeue
 *
 * Re-enqueues the AI review. Needed whenever a job is lost rather than failed —
 * a Redis outage, a swapped instance, a worker that died mid-job — where the
 * submission sits PENDING forever with nothing left to process it.
 *
 * Rebuilds the job from the submission itself rather than trusting a stored
 * payload, and reuses the same jobId so a stale copy can't stack up.
 */
router.post("/submissions/:id/requeue", async (req: Request, res: Response): Promise<void> => {
  try {
    const sub = await prisma.submission.findUnique({
      where: { id: req.params.id },
      select: { id: true, ticketId: true, prUrl: true, prDescription: true, branchName: true, designDoc: true },
    });
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }

    let jobData: ReviewJobData;
    if (sub.designDoc) {
      jobData = { submissionId: sub.id, submissionType: "SYSTEM_DESIGN", ticketId: sub.ticketId, designDoc: sub.designDoc };
    } else {
      const m = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(sub.prUrl ?? "");
      if (!m) { res.status(400).json({ error: "Submission has no usable PR URL to review" }); return; }
      const [, repoOwner, repoName, prNumber] = m;
      jobData = {
        submissionId: sub.id, submissionType: "CODE", ticketId: sub.ticketId,
        prUrl: sub.prUrl!, prDescription: sub.prDescription ?? "", branchName: sub.branchName ?? "",
        repoOwner, repoName, prNumber: parseInt(prNumber, 10),
      };
    }

    // Clear a previous job under this id, or add() is a silent no-op.
    await reviewQueue.remove(`review-${sub.id}`).catch(() => {});
    await reviewQueue.add("review-pr", jobData, { jobId: `review-${sub.id}` });

    await prisma.submission.update({
      where: { id: sub.id },
      data: { status: "PENDING", needsAttention: false, needsAttentionReason: null },
    });

    res.json({ data: { requeued: sub.id } });
  } catch (err) {
    console.error("[admin] requeue error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to requeue review" });
  }
});

/**
 * GET /admin/submissions/needs-attention
 * Assessments that stalled before publication and need a human decision.
 */
router.get("/submissions/needs-attention", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.submission.findMany({
      where: { needsAttention: true, finalized: false },
      orderBy: { reviewedAt: "asc" },
      take: 200,
      select: {
        id: true,
        scoreTotal: true,
        lowConfidenceScoring: true,
        needsAttentionReason: true,
        staleNotifiedAt: true,
        reviewedAt: true,
        submittedAt: true,
        defenceMode: true,
        defenceTrigger: true,
        user: { select: { githubUsername: true, email: true, fullName: true } },
        ticket: { select: { title: true } },
        followUp: { select: { answeredAt: true, verbalScore: true, verbalTranscript: true } },
      },
    });
    res.json({ data: rows });
  } catch (err) {
    console.error("[admin] needs-attention error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to list submissions needing attention" });
  }
});

/**
 * POST /admin/submissions/:id/finalize
 * Body: { reason? }
 *
 * Publishes a submission that could not complete its verbal step (genuine mic
 * failure, low-confidence audio). Goes through the SAME finalizeSubmission path
 * as a normal completion — EWMA recompute, leaderboard and employer visibility
 * — so a manually recovered score is indistinguishable from any other.
 *
 * No penalty is applied: the candidate is not at fault for broken hardware, and
 * inventing a deduction here would be a score we cannot defend.
 */
router.post("/submissions/:id/finalize", async (req: Request, res: Response): Promise<void> => {
  const { reason } = req.body as { reason?: string };
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, finalized: true, scoreTotal: true },
    });
    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    if (submission.status !== "REVIEWED") {
      res.status(409).json({ error: `Cannot finalize a submission with status ${submission.status}` });
      return;
    }
    if (submission.finalized) {
      res.json({ data: { finalized: true, alreadyFinalized: true, scoreTotal: submission.scoreTotal } });
      return;
    }

    await finalizeSubmission(submission.id);
    console.log(`[admin] manually finalized ${submission.id}${reason ? ` — ${reason}` : ""}`);

    res.json({ data: { finalized: true, scoreTotal: submission.scoreTotal } });
  } catch (err) {
    console.error("[admin] finalize error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to finalize submission" });
  }
});

/**
 * POST /admin/submissions/:id/grant-typed
 *
 * Unlocks defence recovery for a flagged submission (e.g. a candidate whose mic
 * failed). This no longer forces typed mode — it opens the recovery chooser on
 * the candidate's next resume (they still pick voice-retry or typed). Recorded
 * as a chooser-open so it shows in the per-campaign recovery tripwire.
 */
router.post("/submissions/:id/grant-typed", async (req: Request, res: Response): Promise<void> => {
  try {
    const sub = await prisma.submission.findUnique({
      where: { id: req.params.id },
      select: { id: true, ticketId: true, userId: true, finalized: true, defenceMode: true },
    });
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
    if (sub.finalized) { res.status(409).json({ error: "Submission is already finalized" }); return; }

    // Keep VOICE so the chooser appears on resume; the trigger unlocks recovery.
    // (If the candidate already committed to TYPED, leave that as-is.) pendingAction
    // drives the dashboard/extension "one step remaining" card.
    const updated = await prisma.submission.update({
      where: { id: sub.id },
      data: {
        defenceTrigger: "admin_grant",
        pendingAction: "recovery_enabled",
        pendingActionAt: new Date(),
        ...(sub.defenceMode === "TYPED" ? {} : { defenceMode: "VOICE" }),
      },
      select: { defenceMode: true, defenceTrigger: true },
    });
    console.log(`[admin] unlocked defence recovery for ${sub.id}`);

    // Notify the candidate — the email is the nudge, the dashboard is the door.
    let emailed = false;
    const user = await prisma.user.findUnique({
      where: { id: sub.userId },
      select: { email: true, fullName: true, githubUsername: true },
    });
    if (user?.email) {
      const candidacy = await prisma.campaignCandidate.findFirst({
        where: { userId: sub.userId, campaign: { ticketIds: { has: sub.ticketId } } },
        orderBy: { joinedAt: "desc" },
        select: { campaign: { select: { roleName: true, companyName: true, deadline: true } } },
      });
      const actionLine = "A retry of your verbal defence has been enabled — you can answer aloud again or switch to typed answers";
      const { subject, html } = grantEmail({
        candidateName: user.fullName ?? user.githubUsername ?? null,
        roleName: candidacy?.campaign.roleName ?? null,
        companyName: candidacy?.campaign.companyName ?? null,
        actionLine,
        resumeLink: resumeUrl(sub.id, sub.ticketId),
        deadline: candidacy?.campaign.deadline ?? null,
      });
      emailed = await sendEmail({
        to: user.email, subject, html,
        meta: { type: "GRANT", submissionId: sub.id, userId: sub.userId, actionLine },
      });
    }

    res.json({ data: { ...updated, emailed } });
  } catch (err) {
    console.error("[admin] grant-typed error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to unlock defence recovery" });
  }
});

/**
 * GET /admin/submissions/:id/emails
 * Send history for a submission — status chips + resend live off this.
 */
router.get("/submissions/:id/emails", async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.emailDelivery.findMany({
      where: { submissionId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, type: true, status: true, toEmail: true, subject: true,
        actionLine: true, createdAt: true, deliveredAt: true,
      },
    });
    res.json({ data: rows });
  } catch (err) {
    console.error("[admin] email-history error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load email history" });
  }
});

/**
 * POST /admin/emails/:id/resend
 * One-click resend of a grant/resume email (rebuilt from the submission). Other
 * types are re-triggered through their normal action, not here.
 */
router.post("/emails/:id/resend", async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await prisma.emailDelivery.findUnique({ where: { id: req.params.id } });
    if (!row) { res.status(404).json({ error: "Email not found" }); return; }
    if (row.type !== "GRANT" && row.type !== "STUCK_SWEEP") {
      res.status(400).json({ error: "One-click resend supports grant/resume emails only." });
      return;
    }
    if (!row.submissionId) { res.status(400).json({ error: "No submission context to rebuild from" }); return; }

    const sub = await prisma.submission.findUnique({
      where: { id: row.submissionId },
      select: { id: true, ticketId: true, userId: true, ticket: { select: { title: true } } },
    });
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
    const user = await prisma.user.findUnique({
      where: { id: sub.userId },
      select: { email: true, fullName: true, githubUsername: true },
    });
    if (!user?.email) { res.status(400).json({ error: "Candidate has no email on file" }); return; }

    const candidacy = await prisma.campaignCandidate.findFirst({
      where: { userId: sub.userId, campaign: { ticketIds: { has: sub.ticketId } } },
      orderBy: { joinedAt: "desc" },
      select: { campaign: { select: { roleName: true, companyName: true, deadline: true } } },
    });
    const deadline = candidacy?.campaign.deadline ?? null;
    const link = resumeUrl(sub.id, sub.ticketId);

    const built = row.type === "GRANT"
      ? grantEmail({
          candidateName: user.fullName ?? user.githubUsername ?? null,
          roleName: candidacy?.campaign.roleName ?? null,
          companyName: candidacy?.campaign.companyName ?? null,
          actionLine: row.actionLine ?? "A step remains on your assessment",
          resumeLink: link,
          deadline,
        })
      : stuckAssessmentEmail({
          candidateName: user.fullName,
          ticketTitle: sub.ticket.title,
          resumeLink: link,
          deadline,
        });

    const ok = await sendEmail({
      to: user.email, subject: built.subject, html: built.html,
      meta: { type: row.type, submissionId: sub.id, userId: sub.userId, actionLine: row.actionLine },
    });
    console.log(`[admin] resent ${row.type} email for ${sub.id} — ${ok ? "sent" : "failed"}`);
    res.json({ data: { resent: ok } });
  } catch (err) {
    console.error("[admin] resend error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to resend email" });
  }
});

/**
 * GET /admin/campaigns/typed-mode-rate
 *
 * Per-campaign share of submissions that opened the defence-recovery chooser
 * (a real audio/technical failure occurred — pre-flight garble, low-confidence
 * answer, technical error, or an admin unlock — regardless of whether they then
 * chose voice or typed). Above 10% (with a meaningful sample) is a PRODUCT
 * signal — a browser/device capture pattern to investigate — not a candidate
 * pattern, so it's surfaced here for admins.
 */
router.get("/campaigns/typed-mode-rate", async (_req: Request, res: Response): Promise<void> => {
  try {
    const campaigns = await prisma.campaign.findMany({
      select: {
        id: true,
        roleName: true,
        companyName: true,
        type: true,
        candidates: {
          select: {
            submission: {
              select: { defenceMode: true, defenceTrigger: true, preflightFails: true, verbalLowConfHits: true },
            },
          },
        },
      },
    });

    // A chooser "open" = any server-observed defence failure/unlock.
    const openedChooser = (s: { defenceMode: string; defenceTrigger: string | null; preflightFails: number; verbalLowConfHits: number }) =>
      s.defenceMode === "TYPED" || s.defenceTrigger !== null || s.preflightFails > 0 || s.verbalLowConfHits > 0;

    const rows = campaigns
      .map((c) => {
        const withSub = c.candidates.filter((x) => x.submission);
        const total = withSub.length;
        const opened = withSub.filter((x) => openedChooser(x.submission!)).length;
        const rate = total > 0 ? opened / total : 0;
        return {
          campaignId: c.id,
          roleName: c.roleName,
          companyName: c.companyName,
          type: c.type,
          opened,
          total,
          rate: Math.round(rate * 1000) / 1000,
          flagged: total >= 5 && rate > 0.1,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.rate - a.rate);

    res.json({ data: rows });
  } catch (err) {
    console.error("[admin] recovery-rate error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to compute defence-recovery rate" });
  }
});

/**
 * POST /admin/stale-sweep
 * Runs the stuck-submission sweep immediately instead of waiting for the timer.
 */
router.post("/stale-sweep", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ data: await sweepStuckSubmissions() });
  } catch (err) {
    console.error("[admin] stale-sweep error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Sweep failed" });
  }
});

/**
 * POST /admin/invite-reminders
 * Runs the invite-reminder sweep immediately instead of waiting for the timer.
 * Respects the same cadence and cap as the scheduled run, so calling it twice
 * in a row does not double-nudge anyone.
 */
router.post("/invite-reminders", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ data: await sweepInviteReminders() });
  } catch (err) {
    console.error("[admin] invite-reminders error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Reminder sweep failed" });
  }
});

export default router;
