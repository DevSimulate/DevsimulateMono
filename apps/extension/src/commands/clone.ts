import * as vscode from "vscode";
import { getAssignedTicket } from "../services/ticket.service";
import { cloneAndOpenCodebase } from "../services/git.service";
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
    const assignment = await getAssignedTicket(context);

    if (!assignment) {
      const choice = await vscode.window.showInformationMessage(
        "DevSimulate: No ticket assigned. Visit the web dashboard to get a ticket first.",
        "Open Dashboard"
      );

      if (choice === "Open Dashboard") {
        await vscode.env.openExternal(
          vscode.Uri.parse("https://devsimulate.io/dashboard")
        );
      }

      return;
    }

    const fullAssignment = assignment as FullAssignment;
    await cloneAndOpenCodebase(fullAssignment.ticket, fullAssignment.branchName);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clone codebase";
    vscode.window.showErrorMessage(`DevSimulate: ${message}`);
  }
}
