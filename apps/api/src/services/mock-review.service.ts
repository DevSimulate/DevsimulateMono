import { ClaudeReviewResult } from "../types/index";

function countMatches(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.filter((t) => lower.includes(t.toLowerCase())).length;
}

export function mockReviewPullRequest(
  ticketTitle: string,
  rubric: Record<string, string>,
  prDiff: string,
  prDescription: string
): ClaudeReviewResult {
  const combined = `${prDescription}\n${prDiff}`.toLowerCase();

  // --- Diagnosis (0-40) ---
  const diagnosisHits = countMatches(combined, [
    "fire-and-forget",
    "fire and forget",
    "await",
    "race condition",
    "async",
    "task",
    "discarded",
    "not awaited",
    "root cause",
    "latency",
    "concurrent",
    "fraudshield",
    "fraud",
  ]);
  const scoreDiagnosis = Math.min(40, 10 + diagnosisHits * 3);

  // --- Design (0-30) ---
  const designHits = countMatches(combined, [
    "rejected",
    "orderStatus.Rejected",
    "fraudcheckpassed",
    "fraudcheckid",
    "notification",
    "alert",
    "status",
    "save",
    "await _orderRepo",
    "return order",
    "edge case",
    "idempotent",
    "rollback",
    "error handling",
  ]);
  const scoreDesign = Math.min(30, 8 + designHits * 2);

  // --- Communication (0-20) ---
  const commHits = countMatches(prDescription.toLowerCase(), [
    "root cause",
    "because",
    "why",
    "race",
    "latency",
    "fix",
    "before",
    "await",
    "without",
    "fraud",
    "result",
    "task",
    "bypassing",
    "controls",
    "intermittent",
  ]);
  const hasStructure =
    prDescription.includes("##") || prDescription.includes("**");
  const scoreCommunication = Math.min(20, 4 + commHits * 1 + (hasStructure ? 3 : 0));

  // --- Execution (0-10) ---
  const hasFix =
    prDiff.includes("await _fraudShield") ||
    prDiff.includes("fraudResult.Passed") ||
    prDiff.includes("OrderStatus.Rejected");
  const removedBug =
    prDiff.includes("-        _ = _fraudShield") ||
    prDiff.includes("- _ = _fraudShield") ||
    prDiff.includes("-        _ =");
  const scoreExecution = hasFix ? (removedBug ? 10 : 8) : 4;

  const scoreTotal = scoreDiagnosis + scoreDesign + scoreCommunication + scoreExecution;

  return {
    scoreDiagnosis,
    scoreDesign,
    scoreCommunication,
    scoreExecution,
    scoreTotal,
    feedback: {
      diagnosis: `${scoreDiagnosis >= 30 ? "Strong" : "Partial"} identification of the fire-and-forget anti-pattern. ${scoreDiagnosis >= 35 ? "You clearly articulated that discarding the Task<FraudCheckResult> meant the fraud check outcome was never inspected before fulfillment." : "Could go deeper on why the race condition is non-deterministic — FraudShield's variable latency (200-800ms) is what makes this intermittent rather than consistently broken."}`,
      design: `${scoreDesign >= 22 ? "Solid" : "Adequate"} solution design. ${scoreDesign >= 25 ? "Correctly sets FraudCheckId and FraudCheckPassed on the order before fulfilling, and dispatches the fraud alert notification on rejection." : "Consider also ensuring the order status transitions are persisted atomically — a crash between SaveAsync calls could leave the order in an inconsistent state."}`,
      communication: `${scoreCommunication >= 15 ? "Clear" : "Basic"} PR description. ${scoreCommunication >= 16 ? "The root cause/fix structure helps reviewers understand the change quickly." : "The description names the fix but could better explain the impact: which order amounts were affected, how often, and what the production blast radius was."}`,
      execution: `${scoreExecution === 10 ? "The fix is correct" : "The fix mostly works"}. ${hasFix ? "Awaiting the fraud check result and branching on Passed before fulfillment is exactly right." : "The core await is missing — FulfillOrderAsync still runs unconditionally."}`,
    },
    summary: `${scoreTotal >= 75 ? "Good work overall" : "Decent attempt"}. You correctly identified and fixed the fire-and-forget pattern in OrderService — awaiting the FraudShield result and gating fulfillment on Passed is the right solution. ${scoreTotal >= 80 ? "The implementation is clean and handles both the happy path and rejection branch properly." : "The implementation covers the main case but a production-grade fix would also handle FraudShield timeouts and transient failures rather than letting exceptions propagate."}`,
    topStrength:
      scoreExecution >= 8
        ? "Correct fix: replaced the discarded Task with await + conditional fulfillment, directly closing the race condition."
        : "Identified the async pattern as the culprit, which is the non-obvious part of this bug.",
    topImprovement:
      "Add a timeout + retry wrapper around the FraudShield call — if the external service is down, the current code throws an unhandled exception and the order is left stuck in FraudCheckPending with no alert.",
  };
}
