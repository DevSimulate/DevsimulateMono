import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";

const router = Router();

/**
 * A "marks receipt" — an itemized, tamper-evident record of exactly how a
 * submission's final score was reached: the base PR review broken into its four
 * dimensions, then each deduction (verbal defence, hidden-test failure), then the
 * final total. Candidates keep/share it like a receipt.
 *
 * Tamper-evidence: the payload is HMAC-signed. Anyone can re-fetch this URL to
 * get the authoritative numbers straight from the DB, and the short verification
 * code lets a viewer confirm a printed/PDF copy matches the live record.
 */
function receiptSecret(): string {
  return process.env.RECEIPT_SECRET ?? process.env.JWT_SECRET ?? "dev-receipt-secret";
}

function signReceipt(canonical: string): string {
  return crypto.createHmac("sha256", receiptSecret()).update(canonical).digest("hex");
}

/**
 * GET /receipts/:id  (PUBLIC — the id is an unguessable submission uuid)
 * Returns the itemized score trail for a finalized/reviewed submission.
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const sub = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { githubUsername: true, fullName: true } },
        ticket: { select: { title: true, difficulty: true, stack: true } },
        followUp: { select: { verbalScore: true, verbalNote: true } },
      },
    });

    if (!sub) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }
    if (sub.status !== "REVIEWED") {
      res.status(409).json({ error: "This submission has not been scored yet." });
      return;
    }

    const issuedAt = sub.reviewedAt ?? sub.submittedAt;
    const year = new Date(issuedAt).getFullYear();
    const receiptNumber = `DS-${year}-RC-${sub.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;

    // Line items — the four scored dimensions of the base PR review.
    const lineItems = [
      { label: "Diagnosis", weight: 40, score: sub.scoreDiagnosis ?? 0 },
      { label: "Design", weight: 30, score: sub.scoreDesign ?? 0 },
      { label: "Communication", weight: 20, score: sub.scoreCommunication ?? 0 },
      { label: "Execution", weight: 10, score: sub.scoreExecution ?? 0 },
    ];

    // Deductions applied after the base review. (Hidden tests are advisory only —
    // they never affect the score — so they don't appear on the receipt.)
    const deductions: Array<{ label: string; amount: number; note?: string }> = [];
    if (sub.verbalPenalty > 0) {
      deductions.push({
        label: "Verbal defence penalty",
        amount: sub.verbalPenalty,
        note: sub.followUp?.verbalNote ?? undefined,
      });
    }

    // Claude's qualitative read — the "why" behind the score.
    const cr = (sub.claudeReview ?? null) as {
      summary?: string;
      topStrength?: string;
      topImprovement?: string;
      feedback?: { diagnosis?: string; design?: string; communication?: string; execution?: string };
    } | null;
    const review = cr
      ? {
          summary: cr.summary ?? null,
          topStrength: cr.topStrength ?? null,
          topImprovement: cr.topImprovement ?? null,
          feedback: cr.feedback ?? null,
        }
      : null;

    const payload = {
      id: sub.id,
      receiptNumber,
      issuedAt,
      finalized: sub.finalized,
      candidate: {
        name: sub.user.fullName || sub.user.githubUsername || "Candidate",
        githubUsername: sub.user.githubUsername ?? null,
      },
      ticket: {
        title: sub.ticket.title,
        difficulty: sub.ticket.difficulty,
        stack: sub.ticket.stack,
      },
      prUrl: sub.prUrl,
      prBaseScore: sub.scorePrBase ?? sub.scoreTotal ?? 0,
      lineItems,
      deductions,
      review,
      verbal: sub.followUp
        ? { score: sub.followUp.verbalScore, note: sub.followUp.verbalNote }
        : null,
      riskScore: sub.riskScore,
      finalScore: sub.scoreTotal ?? 0,
      submittedAt: sub.submittedAt,
    };

    // Sign the numbers that matter. The verification code is a short prefix a
    // viewer can eyeball against the live receipt page.
    const canonical = [
      payload.id,
      payload.finalScore,
      payload.prBaseScore,
      lineItems.map((l) => `${l.label}:${l.score}`).join("|"),
      deductions.map((d) => `${d.label}:${d.amount}`).join("|"),
      new Date(issuedAt).toISOString(),
    ].join("~");
    const signature = signReceipt(canonical);

    res.json({
      data: {
        ...payload,
        signature,
        verificationCode: signature.slice(0, 8).toUpperCase(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load receipt";
    console.error("[receipts] load error:", message);
    res.status(500).json({ error: "Failed to load receipt" });
  }
});

export default router;
