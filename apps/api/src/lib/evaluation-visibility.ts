import { CampaignType } from "@prisma/client";
import prisma from "./prisma";

/**
 * Single source of truth for the rule: in a HIRING campaign the evaluation
 * (scores, tiers, bands, receipt, deductions, risk, flags, feedback prose)
 * belongs to the employer's decision process — the candidate never sees it on
 * their dashboard, result page, or in the extension. CONTEST (DevFest)
 * candidates see everything, exactly as before.
 *
 * DETECTION: a submission is "hiring" iff its ticket belongs to a HIRING
 * campaign the user is a candidate in. We deliberately do NOT use
 * CampaignCandidate.submissionId — the app never populates that column, so the
 * old relation-based check silently returned "not hiring" for every real
 * candidate and leaked their scores. Ticket membership is the same reliable
 * signal /tickets/:id already uses.
 *
 * The rule lives here and nowhere else: the API strips fields with these
 * helpers before responding, and the UI reads the `hideResults` boolean the
 * API stamps on. A candidate's OWN artifacts (write-up, answers, transcript,
 * PR link) are never hidden — only the evaluation of them.
 */

export interface HiringInfo {
  roleName: string;
  companyName: string;
}

/**
 * Maps each of `ticketIds` that belongs to one of this user's HIRING campaigns
 * to that campaign's role/company. Tickets not in a hiring campaign are absent
 * from the map (⇒ contest/organic ⇒ evaluation visible).
 */
export async function hiringTicketMap(
  userId: string,
  ticketIds: string[]
): Promise<Map<string, HiringInfo>> {
  const map = new Map<string, HiringInfo>();
  const unique = [...new Set(ticketIds)].filter(Boolean);
  if (unique.length === 0) return map;

  const candidacies = await prisma.campaignCandidate.findMany({
    where: {
      userId,
      campaign: { type: CampaignType.HIRING, ticketIds: { hasSome: unique } },
    },
    orderBy: { joinedAt: "desc" },
    select: { campaign: { select: { ticketIds: true, roleName: true, companyName: true } } },
  });

  const wanted = new Set(unique);
  for (const c of candidacies) {
    for (const t of c.campaign.ticketIds) {
      // First (most recent) campaign wins for a shared ticket.
      if (wanted.has(t) && !map.has(t)) {
        map.set(t, { roleName: c.campaign.roleName, companyName: c.campaign.companyName });
      }
    }
  }
  return map;
}

/** Single-submission convenience: the hiring campaign for this user+ticket, or null. */
export async function hiringInfoForTicket(userId: string, ticketId: string): Promise<HiringInfo | null> {
  return (await hiringTicketMap(userId, [ticketId])).get(ticketId) ?? null;
}

/** The ticketIds (of those passed) that fall under a HIRING campaign for this user. */
export async function hiringTicketIds(userId: string, ticketIds: string[]): Promise<string[]> {
  return [...(await hiringTicketMap(userId, ticketIds)).keys()];
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
 * Shapes ONE submission for a candidate response (pure — takes the precomputed
 * hiring map so lists resolve with a single query). Strips evaluation for
 * hiring submissions and stamps `hideResults` plus (when hidden) the
 * role/company for the received-state copy. Contest/organic submissions pass
 * through unchanged apart from `hideResults: false`.
 */
export function serializeSubmissionForCandidate<T extends { ticketId: string }>(
  sub: T,
  hiringMap: Map<string, HiringInfo>
) {
  // Never leak the internal join if a caller happened to include it.
  const { campaignCandidates: _drop, ...rest } = sub as T & { campaignCandidates?: unknown };
  const hiring = hiringMap.get(sub.ticketId);
  if (!hiring) {
    return { ...rest, hideResults: false as const };
  }
  return {
    ...redactSubmissionEvaluation(rest),
    hideResults: true as const,
    campaignRole: hiring.roleName,
    campaignCompany: hiring.companyName,
  };
}
