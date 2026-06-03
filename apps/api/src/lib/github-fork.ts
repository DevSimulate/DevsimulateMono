import axios from "axios";
import prisma from "./prisma";

const GH_API = "https://api.github.com";

/**
 * Forks a repo to the user's GitHub account using their stored access token —
 * best-effort and non-blocking. Called when a candidate is assigned a ticket so
 * the fork already exists by the time they open VS Code. Silently no-ops if the
 * user has no stored token (they authenticated before the `repo` scope was added).
 */
export async function preForkForUser(userId: string, repoUrl: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubAccessToken: true, githubUsername: true },
    });
    if (!user?.githubAccessToken || !user.githubUsername) return;

    const m = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?\/?$/.exec(repoUrl);
    if (!m) return;
    const [, owner, repo] = m;

    // Owner doesn't need a fork
    if (owner.toLowerCase() === user.githubUsername.toLowerCase()) return;

    const headers = {
      Authorization: `token ${user.githubAccessToken}`,
      Accept: "application/vnd.github+json",
    };

    // Already forked?
    try {
      await axios.get(`${GH_API}/repos/${user.githubUsername}/${repo}`, { headers });
      return;
    } catch { /* not yet */ }

    // Create the fork (fire and forget — GitHub provisions it async)
    await axios.post(`${GH_API}/repos/${owner}/${repo}/forks`, {}, { headers });
  } catch {
    // Non-fatal: the extension will fork on demand if this didn't happen
  }
}
