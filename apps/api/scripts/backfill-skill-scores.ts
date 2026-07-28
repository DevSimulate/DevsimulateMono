/**
 * One-off backfill: recompute skillScore for every hiring candidate so the
 * values written BEFORE hiring work was excluded stop leaking.
 *
 * Why this is needed at all: `recomputeUserSkillScore` now filters hiring
 * submissions out, but it only runs when a submission is finalized. Rows already
 * on disk keep whatever they were last given — and for a candidate whose only
 * submission was a hiring assessment, that value IS the assessment's scoreTotal,
 * visible on their dashboard and on the public profile/leaderboard. Nothing
 * clears it until a recompute is forced.
 *
 * Reads DATABASE_URL from apps/api/.env — point that at the environment you
 * mean to correct before running.
 *
 * Run AFTER the API is deployed. This script computes correct values either way
 * — it runs against local source, not the deployed build — but until the fix is
 * live, the running API still recomputes skill score WITH hiring included on
 * every finalize. Backfilling first just leaves a window where the next
 * submission to complete re-poisons the row you cleaned.
 *
 *   cd apps/api && npm run backfill:skill-scores           # dry run, no writes
 *   cd apps/api && npm run backfill:skill-scores -- --apply
 *
 * Idempotent — safe to re-run.
 */
import "dotenv/config";
import { CampaignType } from "@prisma/client";
import prisma from "../src/lib/prisma";
import { recomputeUserSkillScore } from "../src/services/score.service";

const APPLY = process.argv.includes("--apply");

async function main() {
  const candidacies = await prisma.campaignCandidate.findMany({
    where: { campaign: { type: CampaignType.HIRING } },
    select: { userId: true },
  });
  const userIds = [...new Set(candidacies.map((c) => c.userId))];

  if (userIds.length === 0) {
    console.log("No hiring candidates found — nothing to backfill.");
    return;
  }

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — ${userIds.length} hiring candidate(s)\n`
  );

  const before = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, githubUsername: true, skillScore: true },
      })
    ).map((u) => [u.id, u])
  );

  let changed = 0;

  for (const userId of userIds) {
    const prev = before.get(userId);
    if (!prev) continue;

    if (!APPLY) {
      // Mirror the real computation without writing, so a dry run reports the
      // same numbers the apply pass would produce.
      const hiring = await prisma.campaignCandidate.findMany({
        where: { userId, campaign: { type: CampaignType.HIRING } },
        select: { campaign: { select: { ticketIds: true } } },
      });
      const hidden = new Set(hiring.flatMap((c) => c.campaign.ticketIds));
      const subs = (
        await prisma.submission.findMany({
          where: { userId, status: "REVIEWED", finalized: true },
          select: { scoreTotal: true, ticketId: true },
          orderBy: { submittedAt: "asc" },
        })
      ).filter((s) => !hidden.has(s.ticketId));

      let next = 0;
      if (subs.length > 0) {
        next = subs[0].scoreTotal ?? 0;
        for (let i = 1; i < subs.length; i++) {
          next = Math.round(0.8 * next + 0.2 * (subs[i].scoreTotal ?? 0));
        }
      }
      if (next !== prev.skillScore) {
        changed++;
        console.log(`  @${prev.githubUsername}: ${prev.skillScore} → ${next}`);
      }
      continue;
    }

    await recomputeUserSkillScore(userId);
    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: { skillScore: true },
    });
    if (after && after.skillScore !== prev.skillScore) {
      changed++;
      console.log(`  @${prev.githubUsername}: ${prev.skillScore} → ${after.skillScore}`);
    }
  }

  console.log(
    `\n${changed} score(s) ${APPLY ? "corrected" : "would change"}.` +
      (APPLY ? "" : "\nRe-run with --apply to write.")
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
