/**
 * Hiring signals — derives the richer, role-aware candidate signals the employer
 * dashboard shows, entirely from data already stored on a scored submission:
 *   - skill profile   (the four dimensions, normalized 0–100 so they're weightable)
 *   - verbal defense  (could they defend their work aloud?)
 *   - consistency     (do code, written answers, and spoken defense agree?)
 *   - confidence      (how much to trust the score — flags noisy/contradictory ones)
 *   - strength/concern + weakest dimension (from Claude's review, for the interview pack)
 *
 * Role weighting itself is applied on the client so the recruiter can switch roles
 * instantly; the API just returns the normalized dimensions it operates on.
 */

export const DIMENSION_MAX = { diagnosis: 40, design: 30, communication: 20, execution: 10 } as const;
export type DimensionKey = keyof typeof DIMENSION_MAX;

/** Role → per-dimension weights (each set sums to 1). Shared with the client. */
export const ROLE_WEIGHTS: Record<string, Record<DimensionKey, number>> = {
  balanced:  { diagnosis: 0.40, design: 0.30, communication: 0.20, execution: 0.10 },
  architect: { diagnosis: 0.25, design: 0.45, communication: 0.20, execution: 0.10 },
  debugger:  { diagnosis: 0.50, design: 0.20, communication: 0.15, execution: 0.15 },
  lead:      { diagnosis: 0.20, design: 0.25, communication: 0.40, execution: 0.15 },
};

export type DefenseLevel = "DEFENDED" | "SHAKY" | "FAILED" | "NONE";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface HiringSignals {
  /** Each dimension as raw points, its max, and a 0–100 normalized value. */
  skillProfile: Record<DimensionKey, { value: number; max: number; pct: number }>;
  /** The dimension the candidate is weakest at — what the interview should probe. */
  weakestDimension: DimensionKey;
  defense: { level: DefenseLevel; score: number | null };
  /** 0 = diverges, 0.5 = partial, 1 = aligned. One node per source. */
  consistency: { code: number; written: number; spoken: number };
  /** How much to trust the score. LOW = re-review before deciding. */
  confidence: ConfidenceLevel;
  strength: string | null;
  concern: string | null;
}

interface SubmissionLike {
  scoreDiagnosis: number | null;
  scoreDesign: number | null;
  scoreCommunication: number | null;
  scoreExecution: number | null;
  scoreTotal: number | null;
  riskScore: number;
  claudeReview: unknown;
}
interface FollowUpLike {
  verbalScore: number | null;
  declarationMismatch: boolean;
}

function defenseFromVerbal(score: number | null): DefenseLevel {
  if (score == null) return "NONE";
  if (score >= 7) return "DEFENDED";
  if (score >= 4) return "SHAKY";
  return "FAILED";
}

function spokenNode(score: number | null): number | null {
  if (score == null) return null;
  if (score >= 7) return 1;
  if (score >= 4) return 0.5;
  return 0;
}

/**
 * Confidence in the score. We can't statistically bound a single LLM score, but
 * we can flag the cases that most warrant a human re-check: a strong written
 * score the candidate couldn't defend aloud, a declaration mismatch, or a failed
 * verbal on an otherwise passing score. Those get LOW ("re-review before deciding").
 */
function confidenceFrom(sub: SubmissionLike, fu: FollowUpLike | null): ConfidenceLevel {
  const total = sub.scoreTotal ?? 0;
  const verbal = fu?.verbalScore ?? null;
  const mismatch = fu?.declarationMismatch ?? false;

  const contradiction = verbal != null && verbal <= 3 && total >= 55;
  if (contradiction || (mismatch && total >= 65)) return "LOW";
  if (verbal != null && verbal >= 7 && !mismatch) return "HIGH";
  return "MEDIUM";
}

function reviewText(claudeReview: unknown, key: "topStrength" | "topImprovement"): string | null {
  if (claudeReview && typeof claudeReview === "object") {
    const v = (claudeReview as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function computeHiringSignals(sub: SubmissionLike, fu: FollowUpLike | null): HiringSignals {
  const raw: Record<DimensionKey, number> = {
    diagnosis: sub.scoreDiagnosis ?? 0,
    design: sub.scoreDesign ?? 0,
    communication: sub.scoreCommunication ?? 0,
    execution: sub.scoreExecution ?? 0,
  };

  const skillProfile = {} as HiringSignals["skillProfile"];
  let weakestDimension: DimensionKey = "diagnosis";
  let weakestPct = Infinity;
  for (const key of Object.keys(DIMENSION_MAX) as DimensionKey[]) {
    const max = DIMENSION_MAX[key];
    const pct = Math.round((raw[key] / max) * 100);
    skillProfile[key] = { value: raw[key], max, pct };
    if (pct < weakestPct) { weakestPct = pct; weakestDimension = key; }
  }

  const verbal = fu?.verbalScore ?? null;
  const mismatch = fu?.declarationMismatch ?? false;

  return {
    skillProfile,
    weakestDimension,
    defense: { level: defenseFromVerbal(verbal), score: verbal },
    consistency: {
      code: 1, // a reviewed submission means working code that scored
      written: mismatch ? 0.5 : 1,
      spoken: spokenNode(verbal) ?? 0.5, // 0.5 shown as "not yet defended" when null
    },
    confidence: confidenceFrom(sub, fu),
    strength: reviewText(sub.claudeReview, "topStrength"),
    concern: reviewText(sub.claudeReview, "topImprovement"),
  };
}
