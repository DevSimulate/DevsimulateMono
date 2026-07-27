import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serializeSubmissionForCandidate,
  redactSubmissionEvaluation,
  redactFollowUpEvaluation,
  HiringInfo,
} from "../evaluation-visibility";

const HIRING = new Map<string, HiringInfo>([
  ["t-hiring", { roleName: "Backend Eng", companyName: "Acme" }],
]);

/** Every field a candidate on a hiring campaign must never receive. */
const STRIPPED = [
  "scoreTotal", "scorePrBase", "scoreDiagnosis", "scoreDesign",
  "scoreCommunication", "scoreExecution", "claudeReview", "graderResult",
] as const;

function fullSubmission(ticketId: string) {
  return {
    id: "s1",
    ticketId,
    prUrl: "https://github.com/acme/repo/pull/7",
    prDescription: "I fixed the radius bug",
    branchName: "ds/fix",
    scoreTotal: 82, scorePrBase: 90,
    scoreDiagnosis: 35, scoreDesign: 25, scoreCommunication: 15, scoreExecution: 7,
    claudeReview: { summary: "great" },
    graderResult: { result: "pass" },
    verbalPenalty: 12, hiddenTestPenalty: 45, riskScore: 40,
    needsAttention: true, needsAttentionReason: "low confidence",
    followUp: {
      question1: "Why?", answer1: "Because X", verbalTranscript: "I changed the filter",
      claudeFeedback: "solid", verbalScore: 8, employerSummary: "ok", scoreBonus: 3,
      declarationMismatch: true,
    },
  };
}

// ── serializeSubmissionForCandidate ──────────────────────────────────────────

test("hiring submission: strips evaluation, stamps hideResults + role/company", () => {
  const out = serializeSubmissionForCandidate(fullSubmission("t-hiring"), HIRING) as Record<string, unknown>;
  assert.equal(out.hideResults, true);
  assert.equal(out.campaignRole, "Backend Eng");
  assert.equal(out.campaignCompany, "Acme");
  for (const f of STRIPPED) assert.equal(out[f], null, `${f} must be null`);
  assert.equal(out.verbalPenalty, 0);
  assert.equal(out.hiddenTestPenalty, 0);
  assert.equal(out.riskScore, 0);
  assert.equal(out.needsAttention, false);
  // Candidate's own artifacts survive
  assert.equal(out.prDescription, "I fixed the radius bug");
  assert.equal(out.branchName, "ds/fix");
  assert.equal(out.prUrl, "https://github.com/acme/repo/pull/7");
});

test("contest/organic submission (ticket not hiring): full evaluation passes through", () => {
  const out = serializeSubmissionForCandidate(fullSubmission("t-contest"), HIRING) as Record<string, unknown>;
  assert.equal(out.hideResults, false);
  assert.equal(out.scoreTotal, 82);
  assert.equal(out.scoreDiagnosis, 35);
  assert.equal("campaignRole" in out, false);
});

test("REGRESSION (the leak): serialized hiring JSON contains none of the stripped fields", () => {
  // Tests the JSON body, not the rendered UI — the network tab is the real leak
  // surface. The bug was that detection relied on an unpopulated relation, so
  // this asserts the serializer output directly.
  const json = JSON.stringify(serializeSubmissionForCandidate(fullSubmission("t-hiring"), HIRING));
  const body = JSON.parse(json) as Record<string, unknown>;
  for (const f of STRIPPED) assert.equal(body[f], null, `leaked ${f}`);
  const fu = body.followUp as Record<string, unknown>;
  assert.equal(fu.verbalScore, null);
  assert.equal(fu.verbalNote, null);
  assert.equal(fu.claudeFeedback, null);
  assert.equal(fu.scoreBonus, null);
  assert.equal(fu.employerSummary, null);
  assert.equal(fu.declarationMismatch, false);
  // ...but the candidate's own words are still there
  assert.equal(fu.answer1, "Because X");
  assert.equal(fu.verbalTranscript, "I changed the filter");
});

test("internal campaignCandidates join is never leaked even if present on the input", () => {
  const withJoin = { ...fullSubmission("t-contest"), campaignCandidates: [{ campaign: { type: "HIRING" } }] };
  const out = serializeSubmissionForCandidate(withJoin, HIRING) as Record<string, unknown>;
  assert.equal("campaignCandidates" in out, false);
});

// ── redactSubmissionEvaluation / redactFollowUpEvaluation ────────────────────

test("redactSubmissionEvaluation nulls scores but keeps artifacts and redacts followUp", () => {
  const r = redactSubmissionEvaluation(fullSubmission("t-hiring")) as Record<string, unknown>;
  assert.equal(r.scoreTotal, null);
  assert.equal(r.claudeReview, null);
  assert.equal(r.prDescription, "I fixed the radius bug");
  assert.equal((r.followUp as Record<string, unknown>).claudeFeedback, null);
  assert.equal((r.followUp as Record<string, unknown>).answer1, "Because X");
});

test("redactFollowUpEvaluation keeps answers, drops feedback/scores", () => {
  const fu = redactFollowUpEvaluation({
    answer1: "mine", verbalTranscript: "my words",
    claudeFeedback: "leaked", verbalNote: "leaked", scoreBonus: 5,
  });
  assert.equal(fu.answer1, "mine");
  assert.equal(fu.verbalTranscript, "my words");
  assert.equal(fu.claudeFeedback, null);
  assert.equal(fu.verbalNote, null);
  assert.equal(fu.scoreBonus, null);
});
