import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// Small coercion helpers so a malformed/oversized payload can't corrupt the table.
const clampInt = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
};
const str = (v: unknown, max = 4000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/**
 * POST /survey  (PUBLIC)
 * Participant feedback survey. Anonymous by default — the shareable /feedback link
 * (optionally ?event=LMKR-DEVFEST-2026) posts here. Every field is optional; we
 * only reject a completely empty submission so bots can't flood the table.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;

    const hasAnswer =
      clampInt(b.overallRating, 1, 5) !== null ||
      clampInt(b.nps, 0, 10) !== null ||
      str(b.vsTraditional) !== null ||
      str(b.bestPart) !== null ||
      str(b.improve) !== null;

    if (!hasAnswer) {
      res.status(400).json({ error: "Please answer at least one question before submitting." });
      return;
    }

    const technicalIssues = Array.isArray(b.technicalIssues)
      ? (b.technicalIssues as unknown[])
          .filter((x): x is string => typeof x === "string")
          .slice(0, 12)
          .map((x) => x.slice(0, 200))
      : [];

    await prisma.surveyResponse.create({
      data: {
        event:             str(b.event, 100),
        overallRating:     clampInt(b.overallRating, 1, 5),
        nps:               clampInt(b.nps, 0, 10),
        vsTraditional:     str(b.vsTraditional, 100),
        vsTraditionalWhy:  str(b.vsTraditionalWhy),
        ticketClear:       clampInt(b.ticketClear, 1, 5),
        ticketRealistic:   clampInt(b.ticketRealistic, 1, 5),
        ticketChallenging: clampInt(b.ticketChallenging, 1, 5),
        difficulty:        str(b.difficulty, 50),
        timeGiven:         str(b.timeGiven, 50),
        instructionsClear: str(b.instructionsClear, 50),
        instructionsIssue: str(b.instructionsIssue),
        aiFeel:            str(b.aiFeel, 100),
        aiComments:        str(b.aiComments),
        verbalFeel:        str(b.verbalFeel, 100),
        verbalComments:    str(b.verbalComments),
        fairChance:        str(b.fairChance, 50),
        technicalIssues,
        issueResolution:   str(b.issueResolution, 50),
        bestPart:          str(b.bestPart),
        improve:           str(b.improve),
        contact:           str(b.contact, 200),
        userAgent:         str(req.headers["user-agent"], 300),
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[survey] submit error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

export default router;
