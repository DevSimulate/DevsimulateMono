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
import { sweepStuckSubmissions } from "../lib/stale-sweep";

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
      select: { id: true, finalized: true, defenceMode: true },
    });
    if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
    if (sub.finalized) { res.status(409).json({ error: "Submission is already finalized" }); return; }

    // Keep VOICE so the chooser appears on resume; the trigger unlocks recovery.
    // (If the candidate already committed to TYPED, leave that as-is.)
    const updated = await prisma.submission.update({
      where: { id: sub.id },
      data: {
        defenceTrigger: "admin_grant",
        ...(sub.defenceMode === "TYPED" ? {} : { defenceMode: "VOICE" }),
      },
      select: { defenceMode: true, defenceTrigger: true },
    });
    console.log(`[admin] unlocked defence recovery for ${sub.id}`);
    res.json({ data: updated });
  } catch (err) {
    console.error("[admin] grant-typed error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to unlock defence recovery" });
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

export default router;
