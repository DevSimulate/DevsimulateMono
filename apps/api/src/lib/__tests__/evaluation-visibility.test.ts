import { test } from "node:test";
import assert from "node:assert/strict";
import { CampaignType } from "@prisma/client";
import {
  canCandidateSeeEvaluation,
  redactSubmissionEvaluation,
  redactFollowUpEvaluation,
  submissionForCandidate,
} from "../evaluation-visibility";

const hiringLink = { campaign: { type: CampaignType.HIRING, roleName: "Backend Eng", companyName: "Acme" } };
const contestLink = { campaign: { type: CampaignType.CONTEST, roleName: "DevFest", companyName: "GDG" } };

// ── canCandidateSeeEvaluation ────────────────────────────────────────────────

test("hiring submissions hide the evaluation", () => {
  assert.equal(canCandidateSeeEvaluation({ campaignCandidates: [hiringLink] }), false);
});

test("contest submissions show the evaluation", () => {
  assert.equal(canCandidateSeeEvaluation({ campaignCandidates: [contestLink] }), true);
});

test("organic submissions (no campaign) show the evaluation", () => {
  assert.equal(canCandidateSeeEvaluation({}), true);
  assert.equal(canCandidateSeeEvaluation({ campaignCandidates: [] }), true);
});

test("a submission in ANY hiring campaign hides — even if also in a contest", () => {
  assert.equal(canCandidateSeeEvaluation({ campaignCandidates: [contestLink, hiringLink] }), false);
});

// ── redactSubmissionEvaluation ───────────────────────────────────────────────

test("redaction nulls every scoring field but keeps the candidate's own artifacts", () => {
  const redacted = redactSubmissionEvaluation({
    id: "s1",
    scoreTotal: 82,
    scorePrBase: 90,
    scoreDiagnosis: 35,
    scoreDesign: 25,
    scoreCommunication: 15,
    scoreExecution: 7,
    claudeReview: { summary: "great" },
    graderResult: { result: "pass" },
    verbalPenalty: 12,
    hiddenTestPenalty: 45,
    riskScore: 40,
    needsAttention: true,
    needsAttentionReason: "low confidence",
    prDescription: "I fixed the radius bug",
    branchName: "ds/fix",
    followUp: {
      question1: "Why?",
      answer1: "Because X",
      verbalTranscript: "I changed the filter",
      claudeFeedback: "solid",
      verbalScore: 8,
      declarationMismatch: true,
    },
  });

  // Evaluation gone
  assert.equal(redacted.scoreTotal, null);
  assert.equal(redacted.scorePrBase, null);
  assert.equal(redacted.scoreDiagnosis, null);
  assert.equal(redacted.claudeReview, null);
  assert.equal(redacted.graderResult, null);
  assert.equal(redacted.verbalPenalty, 0);
  assert.equal(redacted.hiddenTestPenalty, 0);
  assert.equal(redacted.riskScore, 0);
  assert.equal(redacted.needsAttention, false);
  assert.equal(redacted.needsAttentionReason, null);

  // Candidate's own work kept
  assert.equal(redacted.prDescription, "I fixed the radius bug");
  assert.equal(redacted.branchName, "ds/fix");
  assert.equal((redacted.followUp as Record<string, unknown>).question1, "Why?");
  assert.equal((redacted.followUp as Record<string, unknown>).answer1, "Because X");
  assert.equal((redacted.followUp as Record<string, unknown>).verbalTranscript, "I changed the filter");

  // followUp evaluation gone
  assert.equal((redacted.followUp as Record<string, unknown>).claudeFeedback, null);
  assert.equal((redacted.followUp as Record<string, unknown>).verbalScore, null);
  assert.equal((redacted.followUp as Record<string, unknown>).declarationMismatch, false);
});

test("redactFollowUpEvaluation keeps answers, drops feedback/scores", () => {
  const fu = redactFollowUpEvaluation({
    answer1: "mine",
    verbalTranscript: "my words",
    claudeFeedback: "leaked",
    verbalNote: "leaked",
    scoreBonus: 5,
  });
  assert.equal(fu.answer1, "mine");
  assert.equal(fu.verbalTranscript, "my words");
  assert.equal(fu.claudeFeedback, null);
  assert.equal(fu.verbalNote, null);
  assert.equal(fu.scoreBonus, null);
});

// ── submissionForCandidate ───────────────────────────────────────────────────

test("submissionForCandidate strips hiring and stamps role/company", () => {
  const out = submissionForCandidate({
    id: "s1",
    scoreTotal: 82,
    campaignCandidates: [hiringLink],
  }) as Record<string, unknown>;

  assert.equal(out.scoreTotal, null);
  assert.equal(out.hideResults, true);
  assert.equal(out.campaignRole, "Backend Eng");
  assert.equal(out.campaignCompany, "Acme");
  // internal join is never leaked to the candidate
  assert.equal("campaignCandidates" in out, false);
});

test("submissionForCandidate passes contest through untouched apart from hideResults:false", () => {
  const out = submissionForCandidate({
    id: "s2",
    scoreTotal: 74,
    campaignCandidates: [contestLink],
  }) as Record<string, unknown>;

  assert.equal(out.scoreTotal, 74);
  assert.equal(out.hideResults, false);
  assert.equal("campaignRole" in out, false);
  assert.equal("campaignCandidates" in out, false);
});
