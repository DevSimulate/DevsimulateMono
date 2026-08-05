/**
 * Re-applies the rebanded verbal penalty (max 8, was 20) to defences already
 * scored under the old table.
 *
 * Without this, candidates assessed earlier in the same hiring round are judged
 * on a harsher scale than everyone after them — which is the one thing a
 * ranking must never do.
 *
 * Rebuilds from the ORIGINAL per-dimension scores stored in claudeReview rather
 * than trying to reverse the old deduction, so rounding in the 40:30 split
 * cannot accumulate.
 *
 *   npm run rescore:verbal            # dry run
 *   npm run rescore:verbal -- --apply
 */
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { verbalPenaltyFor } from "../src/services/verbal-penalty";

const APPLY = process.argv.includes("--apply");

async function main() {
  const camps = await prisma.campaign.findMany({ where: { type: "HIRING" }, select: { id: true, ticketIds: true } });
  const ticketIds = [...new Set(camps.flatMap((c) => c.ticketIds))];
  const cands = await prisma.campaignCandidate.findMany({
    where: { campaignId: { in: camps.map((c) => c.id) } }, select: { userId: true },
  });

  const subs = await prisma.submission.findMany({
    where: {
      userId: { in: [...new Set(cands.map((c) => c.userId))] },
      ticketId: { in: ticketIds },
      status: { not: "VOID" },
      verbalPenalty: { gt: 0 },
    },
    include: { followUp: true, user: { select: { githubUsername: true } } },
  });

  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${subs.length} penalised hiring submission(s)\n`);
  let changed = 0;

  for (const s of subs) {
    const score = s.followUp?.verbalScore;
    if (score == null) { console.log(`  skip @${s.user.githubUsername} — no verbal score`); continue; }

    const cr = s.claudeReview as Record<string, number> | null;
    const baseDiag = cr?.scoreDiagnosis;
    const baseDesign = cr?.scoreDesign;
    const baseTotal = s.scorePrBase;
    if (baseDiag == null || baseDesign == null || baseTotal == null) {
      console.log(`  skip @${s.user.githubUsername} — original dimensions not on file`);
      continue;
    }

    const pen = verbalPenaltyFor({ score, consistent: true, note: "" });
    // Same 40:30 attribution the scoring path uses.
    const capped = Math.min(pen, baseDiag + baseDesign);
    let diagCut = Math.min(baseDiag, Math.round(capped * (40 / 70)));
    const designCut = Math.min(baseDesign, capped - diagCut);
    diagCut = Math.min(baseDiag, diagCut + (capped - diagCut - designCut));

    const newTotal = Math.max(0, baseTotal - capped);
    if (newTotal === s.scoreTotal && capped === s.verbalPenalty) continue;
    changed++;

    console.log(`@${(s.user.githubUsername ?? "?").padEnd(20)} verbal ${score}/10   -${s.verbalPenalty} -> -${capped}   ${s.scoreTotal} -> ${newTotal}`);

    if (APPLY) {
      await prisma.submission.update({
        where: { id: s.id },
        data: {
          scoreTotal: newTotal,
          scoreDiagnosis: baseDiag - diagCut,
          scoreDesign: baseDesign - designCut,
          verbalPenalty: capped,
        },
      });
    }
  }

  console.log(`\n${changed} score(s) ${APPLY ? "updated" : "would change"}.`);
  if (!APPLY) console.log("Re-run with --apply to write.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
