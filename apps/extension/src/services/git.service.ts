import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import simpleGit, { SimpleGit } from "simple-git";
import { Ticket, Codebase } from "../types";

type TicketWithCodebase = Ticket & { codebase: Codebase };

/**
 * Resolves the git binary path using multiple strategies so the extension
 * works regardless of how VS Code was launched (app icon, terminal, etc.).
 *
 * Order of precedence:
 *  1. VS Code built-in git extension API (most reliable when activated)
 *  2. user's git.path VS Code setting
 *  3. Common Windows installation paths (covers most Windows users)
 *  4. `where git` / `which git` shell lookup
 *  5. Plain "git" fallback
 */
function resolveGitBinary(): string {
  // 1. VS Code built-in git extension
  try {
    const ext = vscode.extensions.getExtension("vscode.git");
    const api = ext?.exports?.getAPI?.(1);
    if (api?.git?.path) {
      return api.git.path as string;
    }
  } catch { /* ignore */ }

  // 2. User-configured git.path setting
  try {
    const cfg = vscode.workspace.getConfiguration("git");
    const cfgPath = cfg.get<string | string[]>("path");
    if (cfgPath) {
      return Array.isArray(cfgPath) ? cfgPath[0] : cfgPath;
    }
  } catch { /* ignore */ }

  // 3. Common Windows install locations
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Git\\cmd\\git.exe",
      "C:\\Program Files\\Git\\bin\\git.exe",
      "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
      `${process.env["LOCALAPPDATA"] ?? ""}\\Programs\\Git\\cmd\\git.exe`,
      `${process.env["USERPROFILE"] ?? ""}\\AppData\\Local\\Programs\\Git\\cmd\\git.exe`,
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) {
        return p;
      }
    }
  }

  // 4. Shell lookup — where (Windows) / which (Unix)
  try {
    const { execFileSync } = require("child_process") as typeof import("child_process");
    const cmd = process.platform === "win32" ? "where" : "which";
    const result = execFileSync(cmd, ["git"], { encoding: "utf8", timeout: 3000 }).trim();
    const first = result.split(/\r?\n/)[0].trim();
    if (first) {
      return first;
    }
  } catch { /* ignore */ }

  return "git";
}

function makeGit(baseDir?: string): SimpleGit {
  const binary = resolveGitBinary();
  return simpleGit(baseDir ? { baseDir, binary } : { binary });
}

/**
 * Clones the codebase repository to a user-selected folder, creates the
 * correct DevSimulate branch, and opens it in VS Code.
 *
 * Handles the "already cloned" case by skipping the clone and just switching
 * to the correct branch.
 */
export async function cloneAndOpenCodebase(
  ticket: TicketWithCodebase,
  branchName: string
): Promise<void> {
  // Show folder picker
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select folder to clone into",
    title: "DevSimulate: Choose clone destination",
  });

  if (!selected || selected.length === 0) {
    return;
  }

  const parentDir = selected[0].fsPath;
  const repoName = ticket.codebase.repoUrl.split("/").pop()?.replace(/\.git$/, "") ?? "codebase";
  const targetDir = path.join(parentDir, repoName);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DevSimulate: Setting up ${ticket.codebase.name}...`,
      cancellable: false,
    },
    async (progress) => {
      const git: SimpleGit = makeGit();

      if (fs.existsSync(targetDir)) {
        progress.report({ message: "Repository already exists — switching branch..." });

        const repoGit = makeGit(targetDir);
        await ensureBranch(repoGit, branchName);
      } else {
        progress.report({ message: "Cloning repository..." });

        await git.clone(ticket.codebase.repoUrl, targetDir, [
          "--progress",
          "--depth",
          "1",
        ]);

        progress.report({ message: "Creating branch..." });

        const repoGit = makeGit(targetDir);
        await ensureBranch(repoGit, branchName);
      }

      progress.report({ message: "Opening in VS Code..." });
    }
  );

  // Open the cloned folder as the workspace
  await vscode.commands.executeCommand(
    "vscode.openFolder",
    vscode.Uri.file(targetDir),
    false
  );
}

/**
 * Creates a new branch at HEAD if it does not already exist, then checks it out.
 * If the branch already exists locally, just checks it out.
 */
async function ensureBranch(git: SimpleGit, branchName: string): Promise<void> {
  const branches = await git.branch();

  if (branches.all.includes(branchName)) {
    await git.checkout(branchName);
  } else {
    await git.checkoutLocalBranch(branchName);
  }
}

/**
 * Returns the current git branch name for the active workspace folder.
 * Returns undefined if the workspace is not a git repository.
 */
export async function getCurrentBranch(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  try {
    const git = makeGit(workspaceFolders[0].uri.fsPath);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    return branch.trim();
  } catch {
    return undefined;
  }
}

/**
 * Returns the remote origin URL for the active workspace, if available.
 */
export async function getRemoteUrl(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  try {
    const git = makeGit(workspaceFolders[0].uri.fsPath);
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === "origin");
    return origin?.refs.fetch;
  } catch {
    return undefined;
  }
}
