import * as vscode from "vscode";
import { SidebarProvider } from "./views/sidebar";
import { loginCommand } from "./commands/login";
import { cloneCommand } from "./commands/clone";
import { submitCommand } from "./commands/submit";
import { getCurrentUser } from "./services/auth.service";
import { getAssignedTickets } from "./services/ticket.service";
import { getLatestReview } from "./services/review.service";

/**
 * Extension activation entry point.
 * Called by VS Code when the extension activates (onStartupFinished).
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const sidebar = new SidebarProvider(context.extensionUri);

  // Register the sidebar webview view provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("devsimulate.sidebar", sidebar)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("devsimulate.login", () =>
      loginCommand(context, sidebar)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devsimulate.cloneCodebase", () =>
      cloneCommand(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devsimulate.submitPR", () =>
      submitCommand(context, sidebar)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devsimulate.viewScore", async () => {
      const submission = await getLatestReview(context);
      if (submission?.status === "REVIEWED" && submission.scoreTotal !== null) {
        vscode.window.showInformationMessage(
          `DevSimulate: Latest score — ${submission.scoreTotal}/100`
        );
      } else {
        vscode.window.showInformationMessage(
          "DevSimulate: No completed review found yet."
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devsimulate.refresh", async () => {
      sidebar.update({ refreshing: true });
      await hydrateInitialState(context, sidebar);
      sidebar.update({ refreshing: false });
    })
  );

  // Hydrate sidebar on startup if already logged in
  await hydrateInitialState(context, sidebar);
}

/**
 * Loads the current user, ticket assignment, and latest submission on startup
 * so the sidebar shows meaningful data without requiring a manual refresh.
 */
async function hydrateInitialState(
  context: vscode.ExtensionContext,
  sidebar: SidebarProvider
): Promise<void> {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return;
    }

    const [assignments, submission] = await Promise.all([
      getAssignedTickets(context),
      getLatestReview(context),
    ]);

    sidebar.update({
      user,
      assignments,
      submission: submission ?? null,
    });
  } catch {
    // Startup hydration failure is non-fatal — sidebar will show login view
  }
}

export function deactivate(): void {
  // No cleanup required
}
