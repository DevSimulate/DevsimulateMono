import * as vscode from "vscode";
import { getToken, getGitHubToken } from "../services/auth.service";
import { getAssignedTickets } from "../services/ticket.service";
import {
  getCurrentBranch,
  getRemoteUrl,
  hasUncommittedChanges,
  stageAndCommit,
  pushBranch,
  createPullRequest,
  FriendlyError,
} from "../services/git.service";
import { SidebarProvider } from "../views/sidebar";
import { TicketAssignment, Ticket, Codebase } from "../types";

type FullAssignment = TicketAssignment & { ticket: Ticket & { codebase: Codebase } };

export async function pushAndCreatePRCommand(
  context: vscode.ExtensionContext,
  _sidebar: SidebarProvider
): Promise<void> {
  const token = await getToken(context);
  if (!token) {
    vscode.window.showErrorMessage(
      "DevSimulate: You must be logged in. Run DevSimulate: Login with GitHub first."
    );
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      "DevSimulate: Open the codebase folder first using Fork & Clone."
    );
    return;
  }
  const repoDir = workspaceFolders[0].uri.fsPath;

  try {
    const assignments = await getAssignedTickets(context);
    if (assignments.length === 0) {
      vscode.window.showWarningMessage("DevSimulate: No active ticket assignment found.");
      return;
    }

    let assignment: FullAssignment = assignments[0] as FullAssignment;
    if (assignments.length > 1) {
      const currentBranch = await getCurrentBranch();
      const match = assignments.find((a) => a.branchName === currentBranch) as FullAssignment | undefined;
      if (match) {
        assignment = match;
      } else {
        const items = assignments.map((a) => ({
          label: (a as FullAssignment).ticket?.title ?? a.ticketId,
          assignment: a as FullAssignment,
        }));
        const choice = await vscode.window.showQuickPick(items, {
          placeHolder: "Select the ticket you are submitting",
        });
        if (!choice) return;
        assignment = choice.assignment;
      }
    }

    // If there are uncommitted changes, prompt for a commit message
    const dirty = await hasUncommittedChanges(repoDir);
    if (dirty) {
      const commitMsg = await vscode.window.showInputBox({
        prompt: "You have uncommitted changes. Enter a commit message to commit them now",
        placeHolder: "e.g. Fix null pointer in user service",
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim() ? undefined : "Commit message cannot be empty"),
      });
      if (!commitMsg) return;
      await stageAndCommit(repoDir, commitMsg.trim());
    }

    const creds = await getGitHubToken(context);

    let prUrl = "";
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "DevSimulate: Pushing your code…",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Pushing branch to GitHub…" });
        await pushBranch(repoDir, assignment.branchName, creds);

        progress.report({ message: "Creating pull request…" });
        const ticketTitle = assignment.ticket?.title ?? "DevSimulate Submission";
        const originalRepoUrl =
          assignment.ticket?.codebase?.repoUrl ?? (await getRemoteUrl()) ?? "";

        prUrl = await createPullRequest(
          repoDir,
          assignment.branchName,
          ticketTitle,
          originalRepoUrl,
          creds
        );
      }
    );

    const choice = await vscode.window.showInformationMessage(
      `DevSimulate: Code pushed and PR created! Now click "Submit PR for Review" to get your AI score.`,
      "View PR on GitHub"
    );
    if (choice === "View PR on GitHub") {
      await vscode.env.openExternal(vscode.Uri.parse(prUrl));
    }
  } catch (err) {
    const message =
      err instanceof FriendlyError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Push failed";
    vscode.window.showErrorMessage(`DevSimulate: ${message}`);
  }
}
