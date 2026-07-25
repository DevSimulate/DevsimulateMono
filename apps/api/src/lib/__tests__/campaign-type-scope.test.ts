import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCampaignType, campaignTypeWhere, InvalidCampaignTypeError } from "../campaign-type-scope";

// Each of these exercises the exact scoping used by one section of the
// employer app (GET /employer/campaigns, /employer/dashboard-summary, and
// /employer/candidates all build their Prisma `where` through these two
// functions) — the Hiring and DevFest sections must never see each other's
// campaigns or candidates.

test("Hiring dashboard/roles/candidates scope to HIRING only", () => {
  const where = campaignTypeWhere(parseCampaignType("HIRING"));
  assert.deepEqual(where, { type: "HIRING" });
});

test("DevFest events scope to CONTEST only", () => {
  const where = campaignTypeWhere(parseCampaignType("CONTEST"));
  assert.deepEqual(where, { type: "CONTEST" });
});

test("All-campaigns view omits the filter, so it (correctly) shows both types", () => {
  const where = campaignTypeWhere(parseCampaignType(undefined));
  assert.deepEqual(where, {});
});

test("an invalid type value is rejected rather than silently returning everything", () => {
  assert.throws(() => parseCampaignType("BOGUS"), InvalidCampaignTypeError);
  assert.throws(() => parseCampaignType(""), InvalidCampaignTypeError);
});

test("HIRING and CONTEST filters never overlap", () => {
  const hiring = campaignTypeWhere(parseCampaignType("HIRING"));
  const contest = campaignTypeWhere(parseCampaignType("CONTEST"));
  assert.notDeepEqual(hiring, contest);
});
