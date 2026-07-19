import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { AuthenticatedRequest } from "../types/index";
import octokit from "../lib/github";

const router = Router();

router.use(requireAuth as (req: Request, res: Response, next: () => void) => void);

/**
 * GET /github/pr?owner=X&repo=Y&branch=Z
 * Returns open PRs for the given branch, using the server's GITHUB_TOKEN.
 * Allows the VS Code extension to auto-detect the PR URL without requiring
 * the developer to manually copy-paste it.
 *
 * The extension passes the candidate's FORK (its git `origin`). But a PR from a
 * fork lives on the UPSTREAM (base) repo, not the fork — listing the fork
 * returns nothing. So we resolve the fork's parent and list PRs there, filtered
 * natively by `head=<forkOwner>:<branch>` so only THIS branch's PR is returned
 * (never a different ticket's still-open PR).
 */
router.get("/pr", async (req: Request, res: Response): Promise<void> => {
  const { owner, repo, branch } = req.query as {
    owner?: string;
    repo?: string;
    branch?: string;
  };

  if (!owner || !repo || !branch) {
    res.status(400).json({ error: "owner, repo, and branch are required" });
    return;
  }

  try {
    // Resolve the base repo: if `owner/repo` is a fork, PRs live on its parent.
    let baseOwner = owner;
    let baseRepo = repo;
    try {
      const { data: repoInfo } = await octokit.repos.get({ owner, repo });
      const parent = repoInfo.parent ?? repoInfo.source;
      if (repoInfo.fork && parent) {
        baseOwner = parent.owner.login;
        baseRepo = parent.name;
      }
    } catch {
      // Repo lookup failed (private/renamed) — fall back to listing the repo as-is.
    }

    // `head` filters to a specific fork+branch, e.g. "candidate:ds/abcd1234-fix".
    const { data } = await octokit.pulls.list({
      owner: baseOwner,
      repo: baseRepo,
      state: "open",
      head: `${owner}:${branch}`,
      per_page: 50,
    });

    // Safety net: keep only exact head-ref matches in case `head` was ignored.
    const matching = data.filter((pr) => pr.head.ref === branch);

    const prs = matching.map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
    }));

    res.json({ data: prs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch PRs";
    console.error("[github] pr lookup error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
