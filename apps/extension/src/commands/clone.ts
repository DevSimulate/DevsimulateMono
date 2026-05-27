import * as vscode from "vscode";
import { getAssignedTickets } from "../services/ticket.service";
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
    const assignments = await getAssignedTickets(context);

    if (assignments.length === 0) {
      const choice = await vscode.window.showInformationMessage(
        "DevSimulate: No ticket assigned. Visit the web dashboard to get a ticket first.",
        "Open Dashboard"
      );
      if (choice === "Open Dashboard") {
        await vscode.env.openExternal(vscode.Uri.parse("https://devsimulate-mono-web.vercel.app/dashboard"));
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

    await cloneAndOpenCodebase(picked.ticket, picked.branchName);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clone codebase";
    vscode.window.showErrorMessage(`DevSimulate: ${message}`);
  }
}
