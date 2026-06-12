import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { verifyGraderSignature } from "../lib/grader";

const router = Router();

/**
 * POST /grader/result
 * Called by the private grader repo's GitHub Action with the hidden-test outcome.
 * Not behind requireAuth (it's an external CI caller) — authenticated by HMAC.
 * Stores { ticketId, passed, at } on the submission's graderResult column.
 */
router.post("/result", async (req: Request, res: Response): Promise<void> => {
  const raw = JSON.stringify(req.body);
  if (!verifyGraderSignature(raw, req.header("x-grader-signature"))) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const body = req.body as { submissionId?: string; ticketId?: string; result?: string; passed?: boolean };
  const submissionId = body.submissionId;
  // result: "pass" | "fail" | "inconclusive". Fall back to the old boolean shape.
  const result: "pass" | "fail" | "inconclusive" =
    body.result === "pass" || body.result === "fail" || body.result === "inconclusive"
      ? body.result
      : body.passed === true ? "pass" : body.passed === false ? "fail" : "inconclusive";

  if (!submissionId) {
    res.status(400).json({ error: "submissionId is required" });
    return;
  }

  try {
    const data: {
      graderResult: object;
      scoreExecution?: number;
      scoreTotal?: number;
    } = {
      graderResult: { ticketId: body.ticketId ?? null, result, at: new Date().toISOString() },
    };

    // ONLY a real test failure (compiled fine, but the fix didn't hold) is objective
    // proof the code is broken — zero Execution and cap the total into the fail band,
    // which also forces verdict NO (verdict derives from score). A "pass" is the floor
    // (no bonus). "inconclusive" means it couldn't even compile (stale base / build
    // error) — we do NOT penalise; it's flagged for a human instead.
    if (result === "fail") {
      const sub = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { scoreDiagnosis: true, scoreDesign: true, scoreCommunication: true },
      });
      if (sub) {
        const withoutExecution =
          (sub.scoreDiagnosis ?? 0) + (sub.scoreDesign ?? 0) + (sub.scoreCommunication ?? 0);
        data.scoreExecution = 0;
        data.scoreTotal = Math.min(withoutExecution, 45); // hard fail — broken code can't pass
      }
    }

    await prisma.submission.update({ where: { id: submissionId }, data });
    console.log(`[grader] result stored for ${submissionId}: ${result}`);
    res.json({ ok: true });
  } catch (e) {
    console.error("[grader] failed to store result:", e instanceof Error ? e.message : e);
    res.status(500).json({ error: "Failed to store result" });
  }
});

export default router;
