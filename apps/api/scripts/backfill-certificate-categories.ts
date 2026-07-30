/**
 * Backfills Certificate.category where it was never set.
 *
 * Certificates issued through POST /campaigns/:campaignId/certificates omitted
 * the field, so they carried null — and category is what the DevFest
 * leaderboard and certificate ranking group by. A null one ranks against
 * nothing.
 *
 * Derives each from its OWN campaign's codebase stack via the same
 * categoryForStack map the issuance path uses. Nothing is hardcoded.
 *
 *   npm run backfill:cert-categories            # dry run
 *   npm run backfill:cert-categories -- --apply
 */
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { categoryForStack } from "../src/lib/devfest-categories";

const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = await prisma.certificate.findMany({
    where: { category: null },
    include: {
      user: { select: { githubUsername: true, fullName: true } },
      campaign: { select: { roleName: true, codebaseId: true } },
    },
  });

  if (rows.length === 0) { console.log("No certificates with a null category."); return; }
  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${rows.length} certificate(s)\n`);

  for (const c of rows) {
    const t = await prisma.ticket.findFirst({
      where: { codebaseId: c.campaign.codebaseId },
      select: { stack: true },
    });
    const category = categoryForStack(t?.stack?.toString()).name;

    console.log(`  ${(c.user.fullName ?? c.user.githubUsername ?? "?").padEnd(24)} ${c.campaign.roleName}`);
    console.log(`     stack=${t?.stack ?? "unknown"} -> category="${category}"  (cert ${c.id})`);

    if (APPLY) {
      await prisma.certificate.update({ where: { id: c.id }, data: { category } });
    }
  }

  const after = await prisma.certificate.groupBy({ by: ["category"], _count: true });
  console.log("\ncategory distribution" + (APPLY ? " (after)" : " (unchanged — dry run)") + ":");
  for (const g of after) console.log(`  ${JSON.stringify(g.category)}  x${g._count}`);
  if (!APPLY) console.log("\nRe-run with --apply to write.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
