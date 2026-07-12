/**
 * Prisma `where` fragment that scopes a submission lookup to what a campaign
 * actually assessed: its specific ticket(s) when defined, otherwise any
 * submission on the campaign's codebase (legacy campaigns with no ticketIds).
 *
 * Use this everywhere a candidate's campaign submission is resolved — results
 * page, CSV export, candidate detail, leaderboards, certificates. Matching by
 * codebase alone lets a higher-scoring submission on a DIFFERENT ticket of the
 * same codebase mask the ticket this campaign was for (e.g. a NOVA-105 score
 * hiding the candidate's NOVA-108 submission in a NOVA-108 campaign).
 */
export function campaignSubmissionScope(
  campaign: { ticketIds: string[]; codebaseId: string }
): { ticketId: { in: string[] } } | { ticket: { codebaseId: string } } {
  return campaign.ticketIds.length
    ? { ticketId: { in: campaign.ticketIds } }
    : { ticket: { codebaseId: campaign.codebaseId } };
}
