import * as vscode from "vscode";
import axios from "axios";
import { getToken, getApiUrl } from "../services/auth.service";
import { getAssignedTickets } from "../services/ticket.service";
import { getCurrentBranch, getRemoteUrl } from "../services/git.service";
import { pollForReview } from "../services/review.service";
import { SidebarProvider } from "../views/sidebar";

/**
 * Handles the devsimulate.submitPR command.
 *
 * Flow:
 * 1. Verify user is on the correct ticket branch
 * 2. Ask for the PR URL (user must have already pushed + opened PR on GitHub)
 * 3. Ask for the PR description (the "why" explanation)
 * 4. POST to /submissions to create the record
 * 5. Poll for the Claude review and update the sidebar when it arrives
 */
export async function submitCommand(
  context: vscode.ExtensionContext,
  sidebar: SidebarProvider
): Promise<void> {
  const token = await getToken(context);

  if (!token) {
    vscode.window.showErrorMessage(
      "DevSimulate: You must be logged in to submit. Run DevSimulate: Login with GitHub first."
    );
    return;
  }

  try {
    const assignments = await getAssignedTickets(context);

    if (assignments.length === 0) {
      vscode.window.showWarningMessage("DevSimulate: No active ticket assignment found.");
      return;
    }

    let assignment = assignments[0];
    if (assignments.length > 1) {
      const currentBranch = await getCurrentBranch();
      const match = assignments.find((a) => a.branchName === currentBranch);
      if (match) {
        assignment = match;
      } else {
        const items = assignments.map((a) => ({ label: (a as any).ticket?.title ?? a.ticketId, assignment: a }));
        const choice = await vscode.window.showQuickPick(items, { placeHolder: "Select the ticket you are submitting" });
        if (!choice) return;
        assignment = choice.assignment;
      }
    }

    const currentBranch = await getCurrentBranch();

    if (currentBranch !== assignment.branchName) {
      const proceed = await vscode.window.showWarningMessage(
        `DevSimulate: You are on branch '${currentBranch ?? "unknown"}', but your ticket branch is '${assignment.branchName}'. Submit anyway?`,
        "Submit Anyway",
        "Cancel"
      );

      if (proceed !== "Submit Anyway") {
        return;
      }
    }

    const prUrl = await vscode.window.showInputBox({
      prompt: "Paste your GitHub PR URL",
      placeHolder: "https://github.com/org/repo/pull/42",
      ignoreFocusOut: true,
      validateInput: (v) => {
        if (!v.startsWith("https://github.com/") || !v.includes("/pull/")) {
          return "Must be a valid GitHub PR URL";
        }
        return undefined;
      },
    });

    if (!prUrl) {
      return;
    }

    const prDescription = await vscode.window.showInputBox({
      prompt:
        "Describe your approach — explain the ROOT CAUSE you found, why you chose your solution, and any trade-offs considered. This is what Claude will score.",
      placeHolder:
        "e.g. Root cause: the FraudShield API call was fire-and-forget...",
      ignoreFocusOut: true,
    });

    if (!prDescription || prDescription.trim().length < 100) {
      const template = [
        "## What problem did you solve?",
        "<!-- Describe the issue in your own words — not the ticket text -->",
        "",
        "## What was the ROOT CAUSE?",
        "<!-- Not the symptom. The actual underlying reason this was broken. -->",
        "",
        "## How did you investigate?",
        "<!-- Walk through your thought process step by step -->",
        "",
        "## What did you try that did NOT work?",
        "<!-- Shows your thinking even when you got it wrong first -->",
        "",
        "## What alternatives did you consider?",
        "<!-- Other ways you could have fixed this and why you rejected them -->",
        "",
        "## How do you know your fix works?",
        "<!-- How did you validate it — tests, manual testing, reasoning -->",
        "",
        "## What could still go wrong?",
        "<!-- Edge cases or limitations of your fix -->",
      ].join("\n");

      const doc = await vscode.workspace.openTextDocument({
        content: template,
        language: "markdown",
      });

      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(
        "Fill in the PR description above, then click Submit again."
      );
      return;
    }

    const response = await axios.post<{ data: { id: string } }>(
      `${getApiUrl()}/submissions`,
      {
        ticketId: assignment.ticketId,
        prUrl,
        prDescription,
        branchName: assignment.branchName,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const submissionId = response.data.data.id;

    sidebar.update({
      submission: {
        id: submissionId,
        userId: "",
        ticketId: assignment.ticketId,
        prUrl,
        prDescription,
        branchName: assignment.branchName,
        status: "PENDING",
        scoreTotal: null,
        scoreDiagnosis: null,
        scoreDesign: null,
        scoreCommunication: null,
        scoreExecution: null,
        claudeReview: null,
        riskScore: 0,
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
      },
    });

    vscode.window.showInformationMessage(
      "PR submitted. Claude is reviewing your thinking. Check back in 60 seconds."
    );

    // Poll in the background — do not block the command
    pollForReview(context, submissionId).then((reviewed) => {
      if (reviewed) {
        sidebar.update({ submission: reviewed });
        const score = reviewed.scoreTotal ?? 0;
        vscode.window.showInformationMessage(
          `DevSimulate: Review complete! Score: ${score}/100 — check the sidebar for detailed feedback.`
        );
      } else {
        vscode.window.showWarningMessage(
          "DevSimulate: Review is taking longer than expected. Check the dashboard."
        );
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed";
    vscode.window.showErrorMessage(`DevSimulate: ${message}`);
  }
}
