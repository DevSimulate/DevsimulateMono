import * as vscode from "vscode";
import axios from "axios";
import { SidebarProvider } from "./views/sidebar";
import { loginCommand } from "./commands/login";
import { cloneCommand } from "./commands/clone";
import { submitCommand } from "./commands/submit";
import { getCurrentUser, storeToken, getApiUrl, getToken } from "./services/auth.service";
import { getAssignedTickets } from "./services/ticket.service";
import { getLatestReview } from "./services/review.service";
import { ensureGitOnPath, watchForPush, cloneAndOpenCodebase, createPullRequest } from "./services/git.service";
import { LoginResponse, TicketAssignment, Ticket, Codebase } from "./types";

type FullAssignment = TicketAssignment & { ticket: Ticket & { codebase: Codebase } };

/**
 * Extension activation entry point.
 * Called by VS Code when the extension activates (onStartupFinished).
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  ensureGitOnPath();

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
    vscode.commands.registerCommand("devsimulate.pasteCode", async () => {
      const code = await vscode.window.showInputBox({
        prompt: "Paste the connection code from devsimulate.com/auth/vscode-link",
        placeHolder: "Paste code here…",
        ignoreFocusOut: true,
      });
      if (code?.trim()) {
        await handleDeepLinkAuth(code.trim(), context, sidebar);
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

  // Handle vscode://devsimulate-app.devsimulate/auth  and  /clone
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        const params = new URLSearchParams(uri.query);

        if (uri.path === "/auth") {
          const linkToken = params.get("token");
          if (linkToken) {
            await handleDeepLinkAuth(linkToken, context, sidebar);
          }
        }

        if (uri.path === "/clone") {
          const assignmentId = params.get("assignmentId");
          if (assignmentId) {
            await handleCloneFromDeepLink(assignmentId, context, sidebar);
          }
        }
      },
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

async function handleCloneFromDeepLink(
  assignmentId: string,
  context: vscode.ExtensionContext,
  sidebar: SidebarProvider
): Promise<void> {
  const token = await getToken(context);
  if (!token) {
    // Save the intent so it runs automatically after the user connects
    await context.globalState.update("ds_pending_clone", assignmentId);
    const choice = await vscode.window.showInformationMessage(
      "DevSimulate: Connect your web session first — your ticket will open automatically after.",
      "Connect"
    );
    if (choice === "Connect") {
      vscode.env.openExternal(vscode.Uri.parse("https://www.devsimulate.com/auth/vscode-link"));
    }
    return;
  }

  try {
    const apiUrl = getApiUrl();

    // Use /tickets/assigned (already deployed) and filter by ID
    const res = await axios.get<{ data: FullAssignment[] }>(
      `${apiUrl}/tickets/assigned`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const assignment = res.data.data.find((a) => a.id === assignmentId);
    if (!assignment) {
      vscode.window.showErrorMessage("DevSimulate: Assignment not found. Make sure you are logged in with the correct account.");
      return;
    }
    const user = await getCurrentUser(context);
    if (!user) return;

    await cloneAndOpenCodebase(assignment.ticket, assignment.branchName, user.githubUsername);

    // Watch for push — when branch appears on origin, prompt to submit
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders?.[0]) {
      const repoDir = workspaceFolders[0].uri.fsPath;
      const disposable = watchForPush(repoDir, assignment.branchName, async () => {
        vscode.window.showInformationMessage("DevSimulate: Push detected — creating PR automatically…");
        try {
          const prUrl = await createPullRequest(
            repoDir,
            assignment.branchName,
            assignment.ticket.title,
            assignment.ticket.codebase.repoUrl
          );
          const submitUrl =
            `https://www.devsimulate.com/submit` +
            `?ticketId=${encodeURIComponent(assignment.ticketId)}` +
            `&prUrl=${encodeURIComponent(prUrl)}` +
            `&branchName=${encodeURIComponent(assignment.branchName)}`;
          await vscode.env.openExternal(vscode.Uri.parse(submitUrl));
          vscode.window.showInformationMessage("DevSimulate: PR created! Submit form opened — describe your fix.");
        } catch {
          // Fallback to manual submit if auto-PR fails
          const choice = await vscode.window.showInformationMessage(
            `DevSimulate: Branch pushed! Open submit form?`,
            "Submit PR →"
          );
          if (choice === "Submit PR →") {
            vscode.commands.executeCommand("devsimulate.submitPR");
          }
        }
      });
      context.subscriptions.push(disposable);
    }

    sidebar.update({ assignments: [assignment] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`DevSimulate: ${msg}`);
  }
}

async function handleDeepLinkAuth(
  linkToken: string,
  context: vscode.ExtensionContext,
  sidebar: SidebarProvider
): Promise<void> {
  try {
    const apiUrl = getApiUrl();
    const res = await axios.post<{ data: LoginResponse }>(
      `${apiUrl}/auth/vscode-exchange`,
      { token: linkToken }
    );
    const { token, user } = res.data.data;
    await storeToken(context, token);

    const [assignments, submission] = await Promise.all([
      getAssignedTickets(context),
      getLatestReview(context),
    ]);

    sidebar.update({ user, assignments, submission: submission ?? null });
    vscode.window.showInformationMessage(
      `DevSimulate: Welcome, ${user.githubUsername}! You're connected.`
    );

    // Replay any pending clone intent from before the user was logged in
    const pendingClone = context.globalState.get<string>("ds_pending_clone");
    if (pendingClone) {
      await context.globalState.update("ds_pending_clone", undefined);
      await handleCloneFromDeepLink(pendingClone, context, sidebar);
    }
  } catch {
    vscode.window.showErrorMessage(
      "DevSimulate: Connection failed. The link may have expired — please try again."
    );
  }
}

export function deactivate(): void {
  // No cleanup required
}
