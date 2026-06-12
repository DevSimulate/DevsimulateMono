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

  const { submissionId, ticketId, passed } = req.body as {
    submissionId?: string;
    ticketId?: string;
    passed?: boolean;
  };
  if (!submissionId) {
    res.status(400).json({ error: "submissionId is required" });
    return;
  }

  try {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { graderResult: { ticketId: ticketId ?? null, passed: !!passed, at: new Date().toISOString() } },
    });
    console.log(`[grader] result stored for ${submissionId}: passed=${!!passed}`);
    res.json({ ok: true });
  } catch (e) {
    console.error("[grader] failed to store result:", e instanceof Error ? e.message : e);
    res.status(500).json({ error: "Failed to store result" });
  }
});

export default router;
