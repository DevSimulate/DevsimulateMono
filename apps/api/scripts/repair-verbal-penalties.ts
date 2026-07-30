import "dotenv/config";
import prisma from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  // Anyone penalised on a verdict the judge never actually produced.
  const rows = await prisma.submission.findMany({
    where: {
      verbalPenalty: { gt: 0 },
      followUp: { verbalNote: { contains: "could not be automatically scored" } },
    },
    include: { followUp: true, user: { select: { githubUsername: true } } },
  });

  if (rows.length === 0) { console.log("No submissions affected."); return; }

  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${rows.length} affected\n`);

  for (const s of rows) {
    const pen = s.verbalPenalty;
    // Reverse the split the penalty path used: 40/70 to diagnosis, rest design.
    const diagBack = Math.min(40 - (s.scoreDiagnosis ?? 0), Math.round(pen * (40 / 70)));
    const designBack = Math.min(30 - (s.scoreDesign ?? 0), pen - diagBack);
    const newTotal = (s.scoreTotal ?? 0) + pen;

    console.log(`@${s.user.githubUsername}  ${s.id.slice(0, 8)}`);
    console.log(`   verbalScore ${s.followUp?.verbalScore} · penalty ${pen}`);
    console.log(`   total     ${s.scoreTotal} -> ${newTotal}`);
    console.log(`   diagnosis ${s.scoreDiagnosis} -> ${(s.scoreDiagnosis ?? 0) + diagBack}`);
    console.log(`   design    ${s.scoreDesign} -> ${(s.scoreDesign ?? 0) + designBack}\n`);

    if (!APPLY) continue;

    await prisma.submission.update({
      where: { id: s.id },
      data: {
        scoreTotal: newTotal,
        scoreDiagnosis: (s.scoreDiagnosis ?? 0) + diagBack,
        scoreDesign: (s.scoreDesign ?? 0) + designBack,
        verbalPenalty: 0,
        needsAttention: true,
        needsAttentionReason:
          "Verbal penalty reversed: the judge returned no usable verdict and a score was scraped from its prose. Defence is UNSCORED — needs a human listen before this result is used.",
      },
    });
    if (s.followUp) {
      await prisma.followUpQuestion.update({
        where: { id: s.followUp.id },
        data: {
          verbalScore: null,
          verbalNote:
            "The automatic judge did not return a usable verdict, so this defence was not scored. Transcript retained for manual review; no penalty applied.",
        },
      });
    }
  }
  console.log(APPLY ? "Done." : "Re-run with --apply to write.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
