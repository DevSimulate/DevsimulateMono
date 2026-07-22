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

/**
 * GET /survey/summary?event=<tag>&key=<adminKey>  (LIGHTLY GATED)
 * Aggregated results for the dashboard. Never returns contact PII — only counts,
 * averages, and anonymous open-text. If SURVEY_ADMIN_KEY is set, ?key must match.
 */
router.get("/summary", async (req: Request, res: Response): Promise<void> => {
  try {
    const adminKey = process.env.SURVEY_ADMIN_KEY;
    if (adminKey && req.query.key !== adminKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const event = typeof req.query.event === "string" && req.query.event ? req.query.event : undefined;

    const rows = await prisma.surveyResponse.findMany({
      where: event ? { event } : undefined,
      select: {
        overallRating: true, nps: true, vsTraditional: true,
        ticketClear: true, ticketRealistic: true, ticketChallenging: true,
        difficulty: true, timeGiven: true, instructionsClear: true,
        aiFeel: true, verbalFeel: true, fairChance: true,
        technicalIssues: true, issueResolution: true,
        bestPart: true, improve: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    type Row = (typeof rows)[number];
    const tally = (key: keyof Row): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const r of rows) {
        const v = r[key];
        if (typeof v === "string" && v) out[v] = (out[v] ?? 0) + 1;
      }
      return out;
    };
    const avg = (key: keyof Row): number | null => {
      const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === "number");
      return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    };

    // NPS: %promoters(9-10) − %detractors(0-6)
    const npsVals = rows.map((r) => r.nps).filter((v): v is number => typeof v === "number");
    const promoters = npsVals.filter((v) => v >= 9).length;
    const detractors = npsVals.filter((v) => v <= 6).length;
    const passives = npsVals.length - promoters - detractors;
    const npsScore = npsVals.length ? Math.round(((promoters - detractors) / npsVals.length) * 100) : null;

    // Overall 1–5 distribution
    const overallDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of rows) if (r.overallRating) overallDist[r.overallRating] = (overallDist[r.overallRating] ?? 0) + 1;

    // Technical issues (array field)
    const issues: Record<string, number> = {};
    for (const r of rows) for (const i of r.technicalIssues) issues[i] = (issues[i] ?? 0) + 1;

    const recent = rows.slice(0, 25).map((r) => ({
      overallRating: r.overallRating,
      nps: r.nps,
      difficulty: r.difficulty,
      bestPart: r.bestPart,
      improve: r.improve,
      createdAt: r.createdAt,
    }));

    res.json({
      data: {
        event: event ?? null,
        total: rows.length,
        overall: { avg: avg("overallRating"), distribution: overallDist },
        nps: { score: npsScore, promoters, passives, detractors, responses: npsVals.length },
        ticket: {
          clear: avg("ticketClear"),
          realistic: avg("ticketRealistic"),
          challenging: avg("ticketChallenging"),
        },
        vsTraditional: tally("vsTraditional"),
        difficulty: tally("difficulty"),
        timeGiven: tally("timeGiven"),
        instructionsClear: tally("instructionsClear"),
        aiFeel: tally("aiFeel"),
        verbalFeel: tally("verbalFeel"),
        fairChance: tally("fairChance"),
        technicalIssues: issues,
        issueResolution: tally("issueResolution"),
        recent,
      },
    });
  } catch (err) {
    console.error("[survey] summary error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

export default router;
