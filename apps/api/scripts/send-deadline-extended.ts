/**
 * Sends the "we've extended the deadline" notice to everyone mid-assessment.
 *
 * Same targeting and same template as the employer button — both call
 * services/campaign-notices — so running this out of hours can't reach a
 * different list from the one the UI would have shown.
 *
 *   npx tsx scripts/send-deadline-extended.ts <campaignId>            # dry run
 *   npx tsx scripts/send-deadline-extended.ts <campaignId> --apply
 *   ... --preview=you@example.com   # send one copy to yourself, nobody else
 */
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { startedUnfinished, sendDeadlineExtended } from "../src/services/campaign-notices";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const preview = args.find((a) => a.startsWith("--preview="))?.split("=")[1];
const campaignId = args.find((a) => !a.startsWith("--"));

async function main() {
  if (!campaignId) {
    console.error("usage: send-deadline-extended.ts <campaignId> [--apply] [--preview=addr]");
    process.exit(1);
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true, roleName: true, companyName: true, shareableSlug: true,
      ticketIds: true, deadline: true, status: true,
      org: { select: { brandName: true, logoUrl: true, primaryColor: true } },
    },
  });
  if (!campaign) throw new Error(`No campaign ${campaignId}`);
  if (!campaign.deadline) throw new Error("Campaign has no deadline");

  const appUrl = process.env.FRONTEND_URL ?? "https://www.devsimulate.com";
  const targets = await startedUnfinished(campaign);

  console.log(`${campaign.companyName} / ${campaign.roleName}`);
  console.log(`  deadline: ${campaign.deadline.toISOString()}`);
  console.log(`  started and unfinished: ${targets.length}\n`);

  // One copy to the operator, addressed as if to the first real recipient, so
  // the exact rendering can be checked before the cohort sees it.
  if (preview) {
    const sample = targets[0];
    const n = await sendDeadlineExtended(
      campaign,
      [{ id: "preview", email: preview, name: sample?.name ?? null, token: sample?.token ?? "preview", userId: null }],
      appUrl,
      { stamp: false }
    );
    console.log(n ? "Preview sent." : "Preview FAILED to send.");
    return;
  }

  if (!APPLY) {
    console.log("DRY RUN — pass --apply to send.");
    return;
  }

  const sent = await sendDeadlineExtended(campaign, targets, appUrl);
  console.log(`Sent ${sent}/${targets.length}.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
