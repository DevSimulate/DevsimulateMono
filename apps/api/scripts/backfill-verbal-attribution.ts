/**
 * One-time backfill: re-attribute existing verbal penalties.
 *
 * Old behaviour deducted the verbal penalty from the total only, leaving the
 * per-dimension scores untouched. The new behaviour takes it out of Diagnosis
 * (40) and Design (30). This script re-applies that split to every already-
 * scored submission so historical results match the new model.
 *
 * It reads the ORIGINAL dimension scores from the immutable `claudeReview` JSON,
 * so it's idempotent — safe to run more than once. `scoreTotal` is left as-is
 * (it was already reduced by the same penalty under the old logic).
 *
 * Run:  cd apps/api && npx ts-node --transpile-only scripts/backfill-verbal-attribution.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.submission.findMany({
    where: { verbalPenalty: { gt: 0 } },
    select: {
      id: true,
      verbalPenalty: true,
      scoreDiagnosis: true,
      scoreDesign: true,
      claudeReview: true,
    },
  });

  console.log(`Found ${subs.length} submission(s) with a verbal penalty to re-attribute.`);
  let updated = 0;

  for (const s of subs) {
    // Original (pre-penalty) dimension scores — prefer the immutable review JSON
    // so re-running never double-deducts. Fall back to the current values.
    const review = (s.claudeReview ?? {}) as { scoreDiagnosis?: number; scoreDesign?: number };
    const origDiag = review.scoreDiagnosis ?? s.scoreDiagnosis ?? 0;
    const origDesign = review.scoreDesign ?? s.scoreDesign ?? 0;

    // Same split as processVerbal: take from Diagnosis first (40:30), clamp at 0.
    const penalty = Math.min(s.verbalPenalty, origDiag + origDesign);
    let diagCut = Math.min(origDiag, Math.round(penalty * (40 / 70)));
    const designCut = Math.min(origDesign, penalty - diagCut);
    diagCut = Math.min(origDiag, diagCut + (penalty - diagCut - designCut)); // rounding spill → diagnosis
    const newDiag = origDiag - diagCut;
    const newDesign = origDesign - designCut;

    if (newDiag !== s.scoreDiagnosis || newDesign !== s.scoreDesign) {
      await prisma.submission.update({
        where: { id: s.id },
        data: { scoreDiagnosis: newDiag, scoreDesign: newDesign },
      });
      updated++;
      console.log(
        `  ${s.id}: Diag ${origDiag}→${newDiag}, Design ${origDesign}→${newDesign} (penalty ${penalty})`
      );
    }
  }

  console.log(`Re-attributed ${updated} submission(s). Done.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
