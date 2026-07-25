import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { verifyGraderSignature } from "../lib/grader";
import { applyHiddenTestResult, isRichGraderBody } from "../services/hidden-test.service";
import { HIDDEN_TESTS_SCORING_ENABLED } from "../config/hidden-tests";

const router = Router();

/**
 * POST /grader/result
 * Called by a private grader repo's GitHub Action with the hidden-test outcome.
 * Not behind requireAuth (it's an external CI caller) — authenticated by HMAC.
 *
 * Handles TWO payload shapes:
 *  - RICH (geoinsight-grader and any grader built to match it): per-test
 *    results + weight (CRITICAL/REGRESSION) + an expanded status enum. Routed
 *    through hidden-test.service.ts, which applies the scoring rule ONLY when
 *    HIDDEN_TESTS_SCORING_ENABLED — see that file for the exact rule.
 *  - LEGACY ({ result | passed }): the platform's original shape. Handled
 *    exactly as before — advisory only, never touches score — so any grader
 *    still dispatching in that shape keeps working unmodified.
 */
router.post("/result", async (req: Request, res: Response): Promise<void> => {
  const raw = JSON.stringify(req.body);
  if (!verifyGraderSignature(raw, req.header("x-grader-signature"))) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const body = req.body as { submissionId?: string; ticketId?: string; result?: string; passed?: boolean };
  if (!body.submissionId) {
    res.status(400).json({ error: "submissionId is required" });
    return;
  }

  try {
    if (isRichGraderBody(req.body)) {
      await applyHiddenTestResult(req.body);
      console.log(
        `[grader] ${req.body.status} for ${req.body.submissionId} ` +
        `(scoring ${HIDDEN_TESTS_SCORING_ENABLED ? "enabled" : "disabled — advisory only"})`
      );
      res.json({ ok: true });
      return;
    }

    // Legacy shape — unchanged from the original advisory-only handler.
    const result: "pass" | "fail" | "inconclusive" =
      body.result === "pass" || body.result === "fail" || body.result === "inconclusive"
        ? body.result
        : body.passed === true ? "pass" : body.passed === false ? "fail" : "inconclusive";

    await prisma.submission.update({
      where: { id: body.submissionId },
      data: { graderResult: { ticketId: body.ticketId ?? null, result, at: new Date().toISOString() } },
      select: { userId: true },
    });
    console.log(`[grader] legacy result stored (advisory, no score change) for ${body.submissionId}: ${result}`);
    res.json({ ok: true });
  } catch (e) {
    console.error("[grader] failed to store result:", e instanceof Error ? e.message : e);
    res.status(500).json({ error: "Failed to store result" });
  }
});

export default router;
