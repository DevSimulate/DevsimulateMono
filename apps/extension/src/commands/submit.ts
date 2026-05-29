import * as vscode from "vscode";
import axios from "axios";
import { getToken, getApiUrl } from "../services/auth.service";
import { getAssignedTickets } from "../services/ticket.service";
import { getCurrentBranch, getRemoteUrl } from "../services/git.service";
import { SidebarProvider } from "../views/sidebar";

const WEB_URL = "https://www.devsimulate.com";

/**
 * Parses "owner" and "repo" from a GitHub remote URL.
 * Handles both HTTPS (https://github.com/owner/repo.git) and
 * SSH (git@github.com:owner/repo.git) formats.
 */
function parseGitHubOwnerRepo(remoteUrl: string): { owner: string; repo: string } | null {
  const httpsMatch = /github\.com\/([^/]+)\/([^/.]+)(\.git)?$/.exec(remoteUrl);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  const sshMatch = /github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/.exec(remoteUrl);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }
  return null;
}

/**
 * Queries the DevSimulate API for open PRs on the given branch.
 * Returns an array of { number, title, url } objects.
 */
async function findOpenPRs(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<Array<{ number: number; title: string; url: string }>> {
  const response = await axios.get<{ data: Array<{ number: number; title: string; url: string }> }>(
    `${getApiUrl()}/github/pr`,
    {
      params: { owner, repo, branch },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data.data ?? [];
}

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

    // --- Auto-detect PR URL from GitHub API ---
    let prUrl: string | undefined;

    const remoteUrl = await getRemoteUrl();
    const parsed = remoteUrl ? parseGitHubOwnerRepo(remoteUrl) : null;
    const branchForPR = assignment.branchName;

    if (parsed && branchForPR) {
      try {
        const prs = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DevSimulate: Looking up open PR…",
            cancellable: false,
          },
          () => findOpenPRs(token, parsed.owner, parsed.repo, branchForPR)
        );

        if (prs.length === 1) {
          prUrl = prs[0].url;
          vscode.window.showInformationMessage(
            `DevSimulate: Found PR #${prs[0].number} — "${prs[0].title}"`
          );
        } else if (prs.length > 1) {
          const items = prs.map((pr) => ({
            label: `#${pr.number}: ${pr.title}`,
            url: pr.url,
          }));
          const choice = await vscode.window.showQuickPick(items, {
            placeHolder: "Multiple open PRs found — select one",
          });
          if (!choice) return;
          prUrl = choice.url;
        } else {
          // No PRs found via API — fall through to manual input
          const openBrowser = await vscode.window.showWarningMessage(
            `DevSimulate: No open PR found for branch '${branchForPR}'. Create a PR on GitHub first.`,
            "Open GitHub",
            "Enter URL Manually"
          );
          if (openBrowser === "Open GitHub") {
            await vscode.env.openExternal(
              vscode.Uri.parse(`https://github.com/${parsed.owner}/${parsed.repo}/compare/${encodeURIComponent(branchForPR)}`)
            );
            return;
          }
        }
      } catch {
        // API lookup failed — silently fall back to manual input
      }
    }

    if (!prUrl) {
      prUrl = await vscode.window.showInputBox({
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
    }

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
