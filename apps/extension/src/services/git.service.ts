import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import axios from "axios";
import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git";
import { Ticket, Codebase } from "../types";

type TicketWithCodebase = Ticket & { codebase: Codebase };

let _resolvedGitBinary: string | null = null;

function resolveGitBinary(): string {
  if (_resolvedGitBinary !== null) return _resolvedGitBinary;

  try {
    const { execFileSync } = require("child_process") as typeof import("child_process");
    execFileSync("git", ["--version"], { timeout: 2000 });
    _resolvedGitBinary = "git";
    return _resolvedGitBinary;
  } catch { /* not on PATH */ }

  try {
    const ext = vscode.extensions.getExtension("vscode.git");
    const api = ext?.exports?.getAPI?.(1);
    if (api?.git?.path && fs.existsSync(api.git.path as string)) {
      _resolvedGitBinary = api.git.path as string;
      return _resolvedGitBinary;
    }
  } catch { /* ignore */ }

  try {
    const cfg = vscode.workspace.getConfiguration("git");
    const cfgPath = cfg.get<string | string[]>("path");
    if (cfgPath) {
      const p = Array.isArray(cfgPath) ? cfgPath[0] : cfgPath;
      if (p && fs.existsSync(p)) { _resolvedGitBinary = p; return _resolvedGitBinary; }
    }
  } catch { /* ignore */ }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Git\\cmd\\git.exe",
      "C:\\Program Files\\Git\\bin\\git.exe",
      `${process.env["LOCALAPPDATA"] ?? ""}\\Programs\\Git\\cmd\\git.exe`,
      `${process.env["USERPROFILE"] ?? ""}\\AppData\\Local\\Programs\\Git\\cmd\\git.exe`,
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) { _resolvedGitBinary = p; return _resolvedGitBinary; }
    }
  }

  _resolvedGitBinary = "git";
  return _resolvedGitBinary;
}

export function ensureGitOnPath(): void {
  try {
    const { execFileSync } = require("child_process") as typeof import("child_process");
    execFileSync("git", ["--version"], { timeout: 2000 });
    return; // already on PATH
  } catch { /* not on PATH */ }

  const gitDir = resolveGitDir();
  if (!gitDir) return;
  const sep = process.platform === "win32" ? ";" : ":";
  const current = process.env["PATH"] ?? "";
  if (!current.includes(gitDir)) {
    process.env["PATH"] = `${gitDir}${sep}${current}`;
  }
}

function resolveGitDir(): string | undefined {
  try {
    const ext = vscode.extensions.getExtension("vscode.git");
    const api = ext?.exports?.getAPI?.(1);
    if (api?.git?.path) return path.dirname(api.git.path as string);
  } catch { /* ignore */ }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Git\\cmd",
      "C:\\Program Files\\Git\\bin",
      `${process.env["LOCALAPPDATA"] ?? ""}\\Programs\\Git\\cmd`,
      `${process.env["USERPROFILE"] ?? ""}\\AppData\\Local\\Programs\\Git\\cmd`,
    ];
    for (const dir of candidates) {
      if (dir && fs.existsSync(path.join(dir, "git.exe"))) return dir;
    }
  }
  return undefined;
}

function makeGit(baseDir?: string): SimpleGit {
  if (baseDir) return simpleGit(baseDir);
  return simpleGit();
}

/**
 * Gets the user's GitHub session from VS Code's built-in auth provider.
 * Requests repo scope so we can fork and create PRs automatically.
 */
async function getGitHubSession(): Promise<vscode.AuthenticationSession> {
  return vscode.authentication.getSession("github", ["repo", "read:user"], { createIfNone: true });
}

/**
 * Forks the repo to the user's GitHub account via API.
 * Returns the clone URL of the fork.
 */
async function autoFork(githubToken: string, repoOwner: string, repoName: string): Promise<string> {
  // Check if fork already exists
  try {
    const check = await axios.get(
      `https://api.github.com/repos/${repoOwner}/${repoName}`,
      { headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github+json" } }
    );
    if (check.data.fork || check.data.name === repoName) {
      return check.data.clone_url as string;
    }
  } catch { /* fork doesn't exist yet */ }

  // Create fork
  const res = await axios.post(
    `https://api.github.com/repos/${repoOwner}/${repoName}/forks`,
    {},
    { headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github+json" } }
  );

  // GitHub forks are async — wait for it to be ready
  const forkCloneUrl = res.data.clone_url as string;
  const forkOwner = res.data.owner.login as string;
  await waitForFork(githubToken, forkOwner, repoName);
  return forkCloneUrl;
}

async function waitForFork(githubToken: string, owner: string, repo: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `token ${githubToken}` },
      });
      return;
    } catch { /* not ready yet */ }
  }
}

/**
 * Creates a PR from the user's fork branch to the original repo's main branch.
 * Returns the PR URL.
 */
export async function createPullRequest(
  repoDir: string,
  branchName: string,
  ticketTitle: string,
  originalRepoUrl: string
): Promise<string> {
  const session = await getGitHubSession();
  const githubToken = session.accessToken;
  const username = session.account.label;

  const git = makeGit(repoDir);
  const remotes = await git.getRemotes(true);
  const origin = remotes.find((r) => r.name === "origin");
  if (!origin?.refs?.fetch) throw new Error("No remote origin found");

  const originMatch = /github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/.exec(origin.refs.fetch);
  if (!originMatch) throw new Error("Could not parse remote URL");

  const forkOwner = originMatch[1];
  const repoName = originMatch[2];

  const originalMatch = /github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/.exec(originalRepoUrl);
  const baseOwner = originalMatch?.[1] ?? forkOwner;

  const isDirectPush = forkOwner.toLowerCase() === baseOwner.toLowerCase();
  const head = isDirectPush ? branchName : `${forkOwner}:${branchName}`;

  const res = await axios.post(
    `https://api.github.com/repos/${baseOwner}/${repoName}/pulls`,
    { title: ticketTitle, head, base: "main", body: "" },
    { headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github+json" } }
  );

  return res.data.html_url as string;
}

/**
 * Fully automatic: forks repo, clones to ~/DevSimulate/{repo},
 * creates branch, pushes upstream — no dialogs, no folder picker.
 */
export async function cloneAndOpenCodebase(
  ticket: TicketWithCodebase,
  branchName: string,
  _githubUsername: string
): Promise<void> {
  const repoUrl = ticket.codebase.repoUrl;
  const repoName = repoUrl.split("/").pop()?.replace(/\.git$/, "") ?? "codebase";
  const repoOwner = repoUrl.split("/").slice(-2)[0] ?? "";

  // Get GitHub token from VS Code auth
  const session = await getGitHubSession();
  const githubToken = session.accessToken;
  const username = session.account.label;

  const isOwner = repoOwner.toLowerCase() === username.toLowerCase();

  // Default location: ~/DevSimulate/{repoName}
  const targetDir = path.join(os.homedir(), "DevSimulate", repoName);
  const devSimDir = path.join(os.homedir(), "DevSimulate");
  if (!fs.existsSync(devSimDir)) fs.mkdirSync(devSimDir, { recursive: true });

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DevSimulate: Setting up ${ticket.codebase.name}…`,
      cancellable: false,
    },
    async (progress) => {
      if (fs.existsSync(targetDir)) {
        progress.report({ message: "Already cloned — switching to your branch…" });
        await ensureBranch(makeGit(targetDir), branchName);
      } else {
        let cloneUrl: string;

        if (isOwner) {
          cloneUrl = repoUrl;
          progress.report({ message: "Cloning repository…" });
        } else {
          progress.report({ message: "Forking repository to your account…" });
          cloneUrl = await autoFork(githubToken, repoOwner, repoName);
          progress.report({ message: "Cloning your fork…" });
        }

        await makeGit().clone(cloneUrl, targetDir, ["--depth", "1"]);

        progress.report({ message: "Creating branch…" });
        await ensureBranch(makeGit(targetDir), branchName);
      }

      progress.report({ message: "Opening in VS Code…" });
    }
  );

  await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(targetDir), false);
}

/**
 * Creates branch and pushes with upstream tracking set.
 */
async function ensureBranch(git: SimpleGit, branchName: string): Promise<void> {
  const branches = await git.branch();
  if (branches.all.includes(branchName)) {
    await git.checkout(branchName);
  } else {
    await git.checkoutLocalBranch(branchName);
    await git.push(["--set-upstream", "origin", branchName]);
  }
}

/**
 * Watches for a push on the given branch by monitoring the remote ref file.
 * Fires onPushed once when the branch appears on origin.
 */
export function watchForPush(
  repoDir: string,
  branchName: string,
  onPushed: () => void
): vscode.Disposable {
  const refGlob = new vscode.RelativePattern(
    vscode.Uri.file(path.join(repoDir, ".git", "refs", "remotes", "origin")),
    "**"
  );
  let fired = false;
  const watcher = vscode.workspace.createFileSystemWatcher(refGlob);
  const handler = () => {
    if (fired) return;
    const refFile = path.join(repoDir, ".git", "refs", "remotes", "origin", ...branchName.split("/"));
    if (fs.existsSync(refFile)) {
      fired = true;
      watcher.dispose();
      onPushed();
    }
  };
  watcher.onDidCreate(handler);
  watcher.onDidChange(handler);
  return watcher;
}

export async function getCurrentBranch(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return undefined;
  try {
    const git = makeGit(workspaceFolders[0].uri.fsPath);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    return branch.trim();
  } catch { return undefined; }
}

export async function getRemoteUrl(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return undefined;
  try {
    const git = makeGit(workspaceFolders[0].uri.fsPath);
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === "origin");
    return origin?.refs.fetch;
  } catch { return undefined; }
}
