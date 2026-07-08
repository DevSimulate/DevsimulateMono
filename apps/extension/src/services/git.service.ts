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

// A user-facing error whose message is safe to show directly in a prompt.
export class FriendlyError extends Error {}

const GH_API = "https://api.github.com";

/** GitHub credentials provided by DevSimulate (captured at web sign-in). */
export interface GitHubCreds {
  token: string;
  username: string;
}

const NO_TOKEN_MESSAGE =
  "DevSimulate needs GitHub access to set up your code. Open devsimulate.com, sign out and sign in again to grant it, then reconnect VS Code.";

/** Builds a token-authenticated push URL so git never prompts for credentials. */
function authUrl(token: string, owner: string, repo: string): string {
  return `https://${token}@github.com/${owner}/${repo}.git`;
}

function parseOwnerRepo(url: string): { owner: string; repo: string } {
  const m = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?\/?$/.exec(url);
  if (!m) throw new FriendlyError("This codebase has an invalid repository URL. Contact support.");
  return { owner: m[1], repo: m[2] };
}

/**
 * Ensures a fork of {owner}/{repo} exists under the user's account, creating it
 * if needed and waiting until GitHub finishes provisioning it.
 * Returns the fork's owner login.
 */
async function ensureFork(token: string, owner: string, repo: string, username: string): Promise<string> {
  const headers = { Authorization: `token ${token}`, Accept: "application/vnd.github+json" };

  // 1. Already forked? (check the user's namespace, not the source)
  try {
    const existing = await axios.get(`${GH_API}/repos/${username}/${repo}`, { headers });
    if (existing.data?.fork || existing.data?.name) return username;
  } catch { /* no fork yet — create one */ }

  // 2. Create the fork
  let forkOwner = username;
  try {
    const res = await axios.post(`${GH_API}/repos/${owner}/${repo}/forks`, {}, { headers });
    forkOwner = (res.data?.owner?.login as string) ?? username;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      throw new FriendlyError(
        `The codebase “${repo}” could not be found on GitHub. It may have moved — contact support.`
      );
    }
    if (axios.isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) {
      throw new FriendlyError(
        "GitHub denied the fork. Re-run “Connect with web session” and approve repo access when prompted."
      );
    }
    throw new FriendlyError("Couldn’t fork the codebase to your account. Please try again in a moment.");
  }

  // 3. Forks are async — wait until it's ready (up to ~30s)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await axios.get(`${GH_API}/repos/${forkOwner}/${repo}`, { headers });
      return forkOwner;
    } catch { /* still provisioning */ }
  }
  throw new FriendlyError("Your fork is taking longer than usual to be created on GitHub. Wait a moment and try again.");
}

/**
 * Creates a PR from the user's fork branch into the source repo's main branch.
 * Returns the PR URL. If a PR already exists, returns its URL.
 */
export async function createPullRequest(
  repoDir: string,
  branchName: string,
  ticketTitle: string,
  originalRepoUrl: string,
  creds: GitHubCreds | null
): Promise<string> {
  if (!creds) throw new FriendlyError(NO_TOKEN_MESSAGE);
  const token = creds.token;
  const headers = { Authorization: `token ${token}`, Accept: "application/vnd.github+json" };

  const remotes = await makeGit(repoDir).getRemotes(true);
  const origin = remotes.find((r) => r.name === "origin");
  if (!origin?.refs?.fetch) throw new FriendlyError("No git remote found in this folder. Re-clone the codebase from your ticket.");

  const fork = parseOwnerRepo(origin.refs.fetch);
  const base = parseOwnerRepo(originalRepoUrl);
  const sameOwner = fork.owner.toLowerCase() === base.owner.toLowerCase();
  const head = sameOwner ? branchName : `${fork.owner}:${branchName}`;

  try {
    const res = await axios.post(
      `${GH_API}/repos/${base.owner}/${base.repo}/pulls`,
      { title: ticketTitle, head, base: "main", body: "Submitted via DevSimulate." },
      { headers }
    );
    return res.data.html_url as string;
  } catch (err) {
    // A PR for this branch may already exist — find and return it
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      try {
        const list = await axios.get(
          `${GH_API}/repos/${base.owner}/${base.repo}/pulls?head=${fork.owner}:${branchName}&state=open`,
          { headers }
        );
        if (list.data?.[0]?.html_url) return list.data[0].html_url as string;
      } catch { /* fall through */ }
      throw new FriendlyError("Push your branch first, then submit. (No commits found to open a PR from.)");
    }
    if (axios.isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) {
      throw new FriendlyError("GitHub denied creating the PR. Reconnect your web session and approve repo access.");
    }
    throw new FriendlyError("Couldn’t open the pull request automatically. Try again, or open it manually on GitHub.");
  }
}

/**
 * Fully automatic: ensures a fork, clones it to ~/DevSimulate/{repo} with an
 * authenticated remote (no credential prompts), creates the ticket branch,
 * pushes it, and opens the folder. Every failure surfaces a clear message.
 */
export async function cloneAndOpenCodebase(
  ticket: TicketWithCodebase,
  branchName: string,
  creds: GitHubCreds | null
): Promise<void> {
  if (!creds) throw new FriendlyError(NO_TOKEN_MESSAGE);
  const { owner: srcOwner, repo: repoName } = parseOwnerRepo(ticket.codebase.repoUrl);

  const token = creds.token;
  const username = creds.username;
  const isOwner = srcOwner.toLowerCase() === username.toLowerCase();

  const targetDir = path.join(os.homedir(), "DevSimulate", repoName);
  const parentDir = path.join(os.homedir(), "DevSimulate");
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DevSimulate: Setting up ${ticket.codebase.name}…`,
      cancellable: false,
    },
    async (progress) => {
      if (fs.existsSync(targetDir)) {
        progress.report({ message: "Already set up — switching to your branch…" });
        await ensureBranch(makeGit(targetDir), branchName);
        return;
      }

      // Owner pushes to the source directly; everyone else gets a fork.
      const cloneOwner = isOwner ? srcOwner : await (async () => {
        progress.report({ message: "Forking the codebase to your GitHub account…" });
        return ensureFork(token, srcOwner, repoName, username);
      })();

      // Clone the PUBLIC url (no token) — forks of public repos are public, so
      // this needs no auth and avoids credential prompts. Retry a few times in
      // case the fork is still provisioning on GitHub's side.
      progress.report({ message: "Downloading the code…" });
      const publicUrl = `https://github.com/${cloneOwner}/${repoName}.git`;
      let lastErr = "";
      let cloned = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await makeGit().clone(publicUrl, targetDir, ["--depth", "1"]);
          cloned = true;
          break;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      if (!cloned) {
        throw new FriendlyError(
          `Couldn't download the code from ${publicUrl}. ` +
          (lastErr.toLowerCase().includes("not found") || lastErr.includes("404")
            ? "Your fork may still be finishing on GitHub — wait a few seconds and click Open in VS Code again."
            : `Details: ${lastErr.slice(0, 200)}`)
        );
      }

      // Set origin to an authenticated URL so push works without prompts.
      progress.report({ message: "Creating your branch…" });
      const repoGit = makeGit(targetDir);
      try {
        await repoGit.remote(["set-url", "origin", authUrl(token, cloneOwner, repoName)]);
        await ensureBranch(repoGit, branchName);
        // Restore the clean URL afterward so the token isn't left in git config
        await repoGit.remote(["set-url", "origin", publicUrl]);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        throw new FriendlyError(
          `Downloaded the code, but couldn't push your branch. Open the folder and run:  git push -u origin ${branchName}\nDetails: ${detail.slice(0, 160)}`
        );
      }

      progress.report({ message: "Opening in VS Code…" });
    }
  );

  await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(targetDir), false);
}

/**
 * Creates the ticket branch if missing, checks it out, and pushes with upstream
 * tracking so a plain `git push` works afterwards.
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

/**
 * Returns true if there are any uncommitted changes (staged or unstaged) in the repo.
 */
export async function hasUncommittedChanges(repoDir: string): Promise<boolean> {
  try {
    const status = await makeGit(repoDir).status();
    return !status.isClean();
  } catch {
    return false;
  }
}

/**
 * Stages all changes and commits with the given message.
 */
export async function stageAndCommit(repoDir: string, message: string): Promise<void> {
  const git = makeGit(repoDir);
  await git.add("-A");
  await git.commit(message);
}

/**
 * Pushes the current branch to origin using a short-lived authenticated remote URL
 * so the user is never prompted for credentials. The public URL is restored after.
 * Handles two GitHub-specific failure modes gracefully:
 *  - Repository moved: detects the new URL from the error and retries automatically.
 *  - Push Protection (secret detected): surfaces a clear, actionable message.
 */
export async function pushBranch(
  repoDir: string,
  branchName: string,
  creds: GitHubCreds | null
): Promise<void> {
  if (!creds) throw new FriendlyError(NO_TOKEN_MESSAGE);
  const git = makeGit(repoDir);
  const remotes = await git.getRemotes(true);
  const origin = remotes.find((r) => r.name === "origin");
  if (!origin?.refs?.fetch) {
    throw new FriendlyError("No git remote found in this folder. Re-clone the codebase from your ticket.");
  }

  let { owner, repo } = parseOwnerRepo(origin.refs.fetch);
  let currentPublicUrl = `https://github.com/${owner}/${repo}.git`;

  function isSecretViolation(msg: string): boolean {
    return (
      msg.includes("GITHUB PUSH PROTECTION") ||
      msg.includes("push declined due to repository rule violations") ||
      msg.includes("Push cannot contain secrets")
    );
  }

  function extractMovedUrl(msg: string): string | null {
    const m = /Please use the new location:\s*\n?\s*(https:\/\/github\.com\/[^\s]+)/i.exec(msg);
    if (!m) return null;
    return m[1].endsWith(".git") ? m[1] : m[1] + ".git";
  }

  const restorePublicUrl = async () => {
    try { await git.remote(["set-url", "origin", currentPublicUrl]); } catch { /* ignore */ }
  };

  await git.remote(["set-url", "origin", authUrl(creds.token, owner, repo)]);

  try {
    await git.push(["--set-upstream", "origin", branchName]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (isSecretViolation(msg)) {
      await restorePublicUrl();
      throw new FriendlyError(
        "GitHub blocked this push because a secret (API key or token) was detected in your code.\n" +
        "Remove the secret from your files, then commit and push again."
      );
    }

    // Repository moved — update remote and retry automatically
    const newPublicUrl = extractMovedUrl(msg);
    if (newPublicUrl) {
      const newParsed = parseOwnerRepo(newPublicUrl);
      owner = newParsed.owner;
      repo  = newParsed.repo;
      currentPublicUrl = newPublicUrl;

      await git.remote(["set-url", "origin", authUrl(creds.token, owner, repo)]);
      try {
        await git.push(["--set-upstream", "origin", branchName]);
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        if (isSecretViolation(retryMsg)) {
          throw new FriendlyError(
            "GitHub blocked this push because a secret (API key or token) was detected in your code.\n" +
            "Remove the secret from your files, then commit and push again."
          );
        }
        throw retryErr;
      }
    } else {
      throw err;
    }
  } finally {
    await restorePublicUrl();
  }
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

/**
 * Schedules deletion of the candidate's local clone so no assessment code
 * remains on their machine after they've pushed and opened a PR. The work is
 * already safely on GitHub (fork + PR) at this point.
 *
 * Deleting the *currently open* workspace in-process fails on Windows because
 * VS Code holds handles on `.git`, so we spawn a DETACHED OS process that waits
 * a couple of seconds (for the caller to close the folder and release handles)
 * and then force-removes the directory. As a safety guard it ONLY ever targets
 * a path under ~/DevSimulate — the location cloneAndOpenCodebase clones into.
 */
export function scheduleLocalCloneWipe(): { scheduled: boolean; dir?: string } {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return { scheduled: false };

  const dir = path.resolve(folders[0].uri.fsPath);
  const root = path.resolve(path.join(os.homedir(), "DevSimulate")) + path.sep;
  if (!dir.startsWith(root)) return { scheduled: false, dir };

  try {
    const { spawn } = require("child_process") as typeof import("child_process");
    if (process.platform === "win32") {
      spawn("cmd.exe", ["/c", `timeout /t 2 /nobreak >nul & rmdir /s /q "${dir}"`], {
        detached: true, stdio: "ignore", windowsHide: true,
      }).unref();
    } else {
      spawn("/bin/sh", ["-c", `sleep 2; rm -rf "${dir}"`], {
        detached: true, stdio: "ignore",
      }).unref();
    }
    return { scheduled: true, dir };
  } catch {
    return { scheduled: false, dir };
  }
}
