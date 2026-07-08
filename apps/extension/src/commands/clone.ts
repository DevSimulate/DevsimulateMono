import * as vscode from "vscode";
import { getAssignedTickets } from "../services/ticket.service";
import { cloneAndOpenCodebase } from "../services/git.service";
import { getGitHubToken } from "../services/auth.service";
import { openInBrowser } from "../services/browser.service";
import { Ticket, Codebase, TicketAssignment } from "../types";

type FullAssignment = TicketAssignment & { ticket: Ticket & { codebase: Codebase } };

/**
 * Handles the devsimulate.cloneCodebase command.
 * Fetches the assigned ticket, prompts for a clone destination,
 * clones the codebase repo, creates the ticket branch, and opens it.
 */
export async function cloneCommand(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    const assignments = await getAssignedTickets(context);

    if (assignments.length === 0) {
      const choice = await vscode.window.showInformationMessage(
        "DevSimulate: No ticket assigned. Visit the web dashboard to get a ticket first.",
        "Open Dashboard"
      );
      if (choice === "Open Dashboard") {
        await openInBrowser("https://www.devsimulate.com/dashboard");
      }
      return;
    }

    let picked: FullAssignment;
    if (assignments.length === 1) {
      picked = assignments[0] as FullAssignment;
    } else {
      const items = assignments.map((a) => ({
        label: (a as FullAssignment).ticket?.title ?? a.ticketId,
        assignment: a as FullAssignment,
      }));
      const choice = await vscode.window.showQuickPick(items, { placeHolder: "Select a ticket to clone" });
      if (!choice) return;
      picked = choice.assignment;
    }

    const creds = await getGitHubToken(context);
    await cloneAndOpenCodebase(picked.ticket, picked.branchName, creds);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clone codebase";
    if (message === "Not authenticated") {
      const choice = await vscode.window.showInformationMessage(
        "DevSimulate: Connect your web session first.",
        "Connect"
      );
      if (choice === "Connect") {
        void openInBrowser("https://www.devsimulate.com/auth/vscode-link");
      }
    } else {
      vscode.window.showErrorMessage(`DevSimulate: ${message}`);
    }
  }
}
