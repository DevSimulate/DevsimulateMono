import * as vscode from "vscode";
import { getToken } from "../services/auth.service";
import { getAssignedTickets } from "../services/ticket.service";
import { getCurrentBranch } from "../services/git.service";
import { SidebarProvider } from "../views/sidebar";

const WEB_URL = "https://devsimulate-mono-web.vercel.app";

/**
 * Handles the devsimulate.submitPR command.
 *
 * Collects the PR URL, then opens the web submission form which handles
 * description input, follow-up questions, and scoring — all in one page.
 */
export async function submitCommand(
  context: vscode.ExtensionContext,
  _sidebar: SidebarProvider
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
        const items = assignments.map((a) => ({
          label: (a as any).ticket?.title ?? a.ticketId,
          assignment: a,
        }));
        const choice = await vscode.window.showQuickPick(items, {
          placeHolder: "Select the ticket you are submitting",
        });
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
      if (proceed !== "Submit Anyway") return;
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

    if (!prUrl) return;

    const submitUrl = `${WEB_URL}/submit?ticketId=${encodeURIComponent(assignment.ticketId)}&prUrl=${encodeURIComponent(prUrl)}&branchName=${encodeURIComponent(assignment.branchName)}`;

    await vscode.env.openExternal(vscode.Uri.parse(submitUrl));

    vscode.window.showInformationMessage(
      "DevSimulate: Submission form opened in your browser — describe your approach and get your score."
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed";
    vscode.window.showErrorMessage(`DevSimulate: ${message}`);
  }
}
