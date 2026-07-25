/**
 * Shared ?type=HIRING|CONTEST query-param handling for every employer route
 * that lists campaigns, candidates, or aggregate stats. The Hiring and
 * DevFest sections of the app must never mix each other's data — this is
 * the one place that decides what "scoped to a type" means, so every route
 * that needs it stays in agreement.
 */

import { CampaignType } from "@prisma/client";

export class InvalidCampaignTypeError extends Error {}

/**
 * Parses the `type` query param. Returns undefined when omitted (no
 * filter — the "All campaigns" view, which shows both types, uses this).
 * Throws when a value is present but isn't a real CampaignType, so a typo
 * in a query string fails loudly instead of silently returning everything.
 */
export function parseCampaignType(raw: unknown): CampaignType | undefined {
  if (raw === undefined) return undefined;
  if (raw === CampaignType.HIRING || raw === CampaignType.CONTEST) return raw;
  throw new InvalidCampaignTypeError(`type must be HIRING or CONTEST, got "${String(raw)}"`);
}

/** Prisma where-fragment for scoping a campaign (or campaign-nested) query by type. */
export function campaignTypeWhere(type: CampaignType | undefined): { type: CampaignType } | Record<string, never> {
  return type ? { type } : {};
}
