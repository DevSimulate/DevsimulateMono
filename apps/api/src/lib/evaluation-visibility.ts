import { CampaignType } from "@prisma/client";

/**
 * Single source of truth for the rule: in a HIRING campaign the evaluation
 * (scores, tiers, bands, receipt, deductions, risk, flags, feedback prose)
 * belongs to the employer's decision process — the candidate never sees it on
 * their dashboard or result page. CONTEST (DevFest) candidates see everything,
 * exactly as before.
 *
 * The rule lives here and nowhere else: the API strips fields with these
 * helpers before responding, and the UI reads the `hideResults` boolean the
 * API stamps on, so both sides agree without duplicating the campaign-type
 * check. A candidate's OWN artifacts (their write-up, answers, transcript) are
 * never hidden — only the evaluation of them.
 */

/** Anything carrying the campaign join we load to make the visibility decision. */
export type CampaignTypeCarrier = {
  campaignCandidates?: Array<{
    campaign: { type: CampaignType; roleName?: string; companyName?: string };
  }>;
};

/** false ⇒ this submission is part of a HIRING campaign; hide the evaluation. */
export function canCandidateSeeEvaluation(sub: CampaignTypeCarrier): boolean {
  const links = sub.campaignCandidates ?? [];
  return !links.some((c) => c.campaign.type === CampaignType.HIRING);
}

/** The hiring campaign this submission belongs to (for "at {company}" copy), if any. */
export function hiringCampaignOf(
  sub: CampaignTypeCarrier
): { roleName?: string; companyName?: string } | null {
  return (
    sub.campaignCandidates?.find((c) => c.campaign.type === CampaignType.HIRING)?.campaign ?? null
  );
}

/** Nulls every evaluation field on a FollowUpQuestion; keeps the candidate's own words. */
export function redactFollowUpEvaluation<T extends Record<string, unknown>>(fu: T): T {
  return {
    ...fu,
    scoreBonus: null,
    claudeFeedback: null,
    verbalScore: null,
    verbalNote: null,
    employerSummary: null,
    declarationMismatch: false,
  };
}

/**
 * Returns a copy of a submission with all evaluation stripped. Keeps the
 * candidate's own artifacts intact (prDescription, designDoc, branchName, and
 * — on an included followUp — questions, answers, and the verbal transcript).
 */
export function redactSubmissionEvaluation<T extends Record<string, unknown>>(sub: T): T {
  const followUp = (sub as { followUp?: Record<string, unknown> | null }).followUp;
  return {
    ...sub,
    scoreTotal: null,
    scorePrBase: null,
    scoreDiagnosis: null,
    scoreDesign: null,
    scoreCommunication: null,
    scoreExecution: null,
    claudeReview: null,
    graderResult: null,
    verbalPenalty: 0,
    hiddenTestPenalty: 0,
    riskScore: 0,
    lowConfidenceScoring: false,
    modelUsed: null,
    rubricVersion: null,
    needsAttention: false,
    needsAttentionReason: null,
    ...(followUp ? { followUp: redactFollowUpEvaluation(followUp) } : {}),
  } as T;
}

/**
 * Shapes ONE submission for a candidate response: drops the internal campaign
 * join, strips evaluation for hiring submissions, and stamps `hideResults` plus
 * (when hidden) the role/company for the received-state copy. Contest/organic
 * submissions pass through unchanged apart from `hideResults: false`.
 */
export function submissionForCandidate<T extends CampaignTypeCarrier>(sub: T) {
  const canSee = canCandidateSeeEvaluation(sub);
  const { campaignCandidates: _drop, ...rest } = sub as T & { campaignCandidates?: unknown };
  if (canSee) {
    return { ...rest, hideResults: false as const };
  }
  const hiring = hiringCampaignOf(sub);
  return {
    ...redactSubmissionEvaluation(rest),
    hideResults: true as const,
    campaignRole: hiring?.roleName ?? null,
    campaignCompany: hiring?.companyName ?? null,
  };
}

/** The campaignCandidates include used across candidate-facing endpoints. */
export const campaignVisibilityInclude = {
  campaignCandidates: {
    select: { campaign: { select: { type: true, roleName: true, companyName: true } } },
  },
} as const;
