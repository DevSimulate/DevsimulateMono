/**
 * reset-forks.ts
 *
 * Deletes all DevSimulate ticket branches (ds/*) from every user's fork
 * of a given repo so candidates can start completely fresh.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/reset-forks.ts
 *   npx ts-node --transpile-only scripts/reset-forks.ts --repo novatech-crm
 *   npx ts-node --transpile-only scripts/reset-forks.ts --dry-run
 */

import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GH_API = "https://api.github.com";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REPO_FILTER = (() => {
  const idx = args.indexOf("--repo");
  return idx !== -1 ? args[idx + 1] : null;
})();

async function getDevSimulateBranches(
  token: string,
  owner: string,
  repo: string
): Promise<string[]> {
  try {
    const res = await axios.get<Array<{ name: string }>>(
      `${GH_API}/repos/${owner}/${repo}/branches`,
      {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
        params: { per_page: 100 },
      }
    );
    return res.data
      .map((b) => b.name)
      .filter((name) => name.startsWith("ds/"));
  } catch {
    return [];
  }
}

async function deleteBranch(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<boolean> {
  try {
    await axios.delete(
      `${GH_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
      }
    );
    return true;
  } catch {
    return false;
  }
}

async function getForkRepos(token: string, username: string): Promise<string[]> {
  try {
    const res = await axios.get<Array<{ name: string; fork: boolean }>>(
      `${GH_API}/users/${username}/repos`,
      {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
        params: { type: "fork", per_page: 100 },
      }
    );
    return res.data
      .filter((r) => r.fork)
      .map((r) => r.name)
      .filter((name) => !REPO_FILTER || name === REPO_FILTER);
  } catch {
    return [];
  }
}

async function main() {
  console.log(DRY_RUN ? "--- DRY RUN (no changes will be made) ---\n" : "");

  const users = await prisma.user.findMany({
    where: {
      githubAccessToken: { not: null },
      githubUsername: { not: null },
    },
    select: {
      id: true,
      githubUsername: true,
      githubAccessToken: true,
    },
  });

  console.log(`Found ${users.length} users with GitHub tokens\n`);

  let totalDeleted = 0;
  let totalFailed = 0;

  for (const user of users) {
    const token = user.githubAccessToken!;
    const username = user.githubUsername!;

    const forks = await getForkRepos(token, username);
    if (forks.length === 0) continue;

    console.log(`[${username}] forks: ${forks.join(", ")}`);

    for (const repo of forks) {
      const branches = await getDevSimulateBranches(token, username, repo);
      if (branches.length === 0) {
        console.log(`  ${repo}: no ds/* branches`);
        continue;
      }

      for (const branch of branches) {
        if (DRY_RUN) {
          console.log(`  WOULD DELETE ${repo}/${branch}`);
          totalDeleted++;
        } else {
          const ok = await deleteBranch(token, username, repo, branch);
          if (ok) {
            console.log(`  ✓ deleted ${repo}/${branch}`);
            totalDeleted++;
          } else {
            console.log(`  ✗ failed  ${repo}/${branch}`);
            totalFailed++;
          }
        }
      }
    }
  }

  console.log(`\nDone. ${DRY_RUN ? "Would delete" : "Deleted"}: ${totalDeleted} branches. Failed: ${totalFailed}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
