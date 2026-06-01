import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git";
import { Ticket, Codebase } from "../types";

type TicketWithCodebase = Ticket & { codebase: Codebase };

let _resolvedGitBinary: string | null = null;

/**
 * Resolves the absolute path to the git executable. Returns "git" as a
 * fallback so simpleGit still tries the system PATH.
 */
function resolveGitBinary(): string {
  if (_resolvedGitBinary !== null) {
    return _resolvedGitBinary;
  }

  // 1. Already on PATH — use it as-is
  try {
    const { execFileSync } = require("child_process") as typeof import("child_process");
    execFileSync("git", ["--version"], { timeout: 2000 });
    _resolvedGitBinary = "git";
    return _resolvedGitBinary;
  } catch { /* not on PATH */ }

  // 2. VS Code built-in git extension API (most reliable on Windows/Mac)
  try {
    const ext = vscode.extensions.getExtension("vscode.git");
    const api = ext?.exports?.getAPI?.(1);
    if (api?.git?.path && fs.existsSync(api.git.path as string)) {
      _resolvedGitBinary = api.git.path as string;
      return _resolvedGitBinary;
    }
  } catch { /* ignore */ }

  // 3. VS Code git.path setting
  try {
    const cfg = vscode.workspace.getConfiguration("git");
    const cfgPath = cfg.get<string | string[]>("path");
    if (cfgPath) {
      const p = Array.isArray(cfgPath) ? cfgPath[0] : cfgPath;
      if (p && fs.existsSync(p)) {
        _resolvedGitBinary = p;
        return _resolvedGitBinary;
      }
    }
  } catch { /* ignore */ }

  // 4. Common Windows install locations
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
        _resolvedGitBinary = p;
        return _resolvedGitBinary;
      }
    }
  }

  _resolvedGitBinary = "git";
  return _resolvedGitBinary;
}

/** @deprecated PATH patching is no longer needed — kept for backwards compat. */
export function ensureGitOnPath(): void {
  resolveGitBinary();
}

function makeGit(baseDir?: string): SimpleGit {
  const binary = resolveGitBinary();
  const opts: Partial<SimpleGitOptions> = { binary };
  if (baseDir) {
    opts.baseDir = baseDir;
  }
  return simpleGit(opts);
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
 * Creates a new branch at HEAD if it does not already exist, checks it out,
 * then pushes it to origin with --set-upstream so plain `git push` works.
 */
async function ensureBranch(git: SimpleGit, branchName: string): Promise<void> {
  const branches = await git.branch();

  if (branches.all.includes(branchName)) {
    await git.checkout(branchName);
  } else {
    await git.checkoutLocalBranch(branchName);
    // Push immediately so the upstream tracking is set — user can just run `git push`
    await git.push(["--set-upstream", "origin", branchName]);
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
