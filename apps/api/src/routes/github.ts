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
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
      head: `${owner}:${branch}`,
      per_page: 5,
    });

    const prs = data.map((pr) => ({
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
