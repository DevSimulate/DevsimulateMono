import "dotenv/config";
import prisma from "../src/lib/prisma";
import { mockReviewPullRequest } from "../src/services/mock-review.service";
import { Ticket, Codebase } from "@prisma/client";

async function main(): Promise<void> {
  // Pick the submission with the richest PR description (highest riskScore = best description)
  const submission = await prisma.submission.findFirst({
    where: { status: "PENDING" },
    orderBy: { riskScore: "desc" },
    include: {
      ticket: { include: { codebase: true } },
    },
  });

  if (!submission) {
    console.log("No PENDING submissions found.");
    return;
  }

  console.log(`\nProcessing submission: ${submission.id}`);
  console.log(`Ticket: ${submission.ticket.title}`);
  console.log(`PR: ${submission.prUrl}`);
  console.log(`Risk score: ${submission.riskScore}`);
  console.log(`PR description length: ${submission.prDescription.length} chars\n`);

  const ticket = submission.ticket as Ticket & { codebase: Codebase };
  const rubric = ticket.rubric as Record<string, string>;

  // Inline the actual diff we know was pushed (since we have no GitHub token)
  const knownDiff = `
diff --git a/src/NovaTechCRM.Services/OrderService.cs b/src/NovaTechCRM.Services/OrderService.cs
index b221cfa..a31d883 100644
--- a/src/NovaTechCRM.Services/OrderService.cs
+++ b/src/NovaTechCRM.Services/OrderService.cs
@@ -33,10 +33,24 @@ public class OrderService
         order.Status = OrderStatus.FraudCheckPending;
         await _orderRepo.SaveAsync(order, ct);

-        // BUG (NOVA-47): FraudShield check is fired without awaiting the result.
-        // The _ discard means we never inspect whether the check passed or failed.
-        // FulfillOrderAsync runs immediately after, racing against the fraud check.
-        _ = _fraudShield.CheckAsync(order, ct);
-
-        await FulfillOrderAsync(order, ct);
-
-        return order;
+        var fraudResult = await _fraudShield.CheckAsync(order, ct);
+
+        if (!fraudResult.Passed)
+        {
+            order.Status = OrderStatus.Rejected;
+            order.FraudCheckPassed = false;
+            await _orderRepo.SaveAsync(order, ct);
+            await _notifications.SendFraudAlertAsync(order, fraudResult, ct);
+            _logger.LogWarning("Order {OrderId} rejected by FraudShield: risk={RiskLevel}, reason={Reason}",
+                order.Id, fraudResult.RiskLevel, fraudResult.Reason);
+            return order;
+        }
+
+        order.FraudCheckId = fraudResult.CheckId;
+        order.FraudCheckPassed = true;
+        await FulfillOrderAsync(order, ct);
+
+        return order;
     }
`;

  console.log("Running mock review...");
  const result = mockReviewPullRequest(
    ticket.title,
    rubric,
    knownDiff,
    submission.prDescription
  );

  console.log("\n--- SCORES ---");
  console.log(`Diagnosis:     ${result.scoreDiagnosis}/40`);
  console.log(`Design:        ${result.scoreDesign}/30`);
  console.log(`Communication: ${result.scoreCommunication}/20`);
  console.log(`Execution:     ${result.scoreExecution}/10`);
  console.log(`TOTAL:         ${result.scoreTotal}/100`);
  console.log("\n--- FEEDBACK ---");
  console.log("Summary:", result.summary);
  console.log("Top strength:", result.topStrength);
  console.log("Top improvement:", result.topImprovement);

  // Mark other PENDING submissions as FAILED (duplicates from retries)
  await prisma.submission.updateMany({
    where: { status: "PENDING", id: { not: submission.id } },
    data: { status: "VOID" },
  });

  // Write review to the chosen submission
  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "REVIEWED",
      scoreTotal: result.scoreTotal,
      scoreDiagnosis: result.scoreDiagnosis,
      scoreDesign: result.scoreDesign,
      scoreCommunication: result.scoreCommunication,
      scoreExecution: result.scoreExecution,
      claudeReview: result as object,
      reviewedAt: new Date(),
    },
  });

  console.log(`\nSubmission ${updated.id} updated to REVIEWED.`);
  console.log(`Final score: ${updated.scoreTotal}/100`);
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
