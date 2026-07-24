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
