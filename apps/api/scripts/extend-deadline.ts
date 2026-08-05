/**
 * Moves a campaign's deadline.
 *
 * The deadline is display-only in the employer UI, so extending a live round
 * otherwise means hand-writing a Prisma call against production under time
 * pressure — which is how you end up setting UTC midnight and quietly cutting
 * the last day off instead of adding one.
 *
 * A bare date is read as END of that day in the candidates' timezone, not the
 * start. "Extend to 6 August" means the 6th is playable; `new Date("2026-08-06")`
 * is 00:00Z, which closes the round as the 6th begins and is five hours before
 * the 5th even ends in PKT.
 *
 *   npx tsx scripts/extend-deadline.ts <campaignId> 2026-08-06           # dry run
 *   npx tsx scripts/extend-deadline.ts <campaignId> 2026-08-06 --apply
 *   ... --utc-offset=0        # candidates elsewhere
 *   ... --at=2026-08-06T15:30 # exact local time instead of end of day
 */
import "dotenv/config";
import prisma from "../src/lib/prisma";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const positional = args.filter((a) => !a.startsWith("--"));

/** Candidates are in Pakistan; their "6 August" ends at 23:59:59 PKT. */
const UTC_OFFSET_HOURS = Number(flag("utc-offset") ?? 5);

/** `YYYY-MM-DD` -> the last instant of that day at the given offset. */
function endOfLocalDay(date: string, offsetHours: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Expected YYYY-MM-DD, got "${date}"`);
  return new Date(Date.UTC(y, m - 1, d, 23 - offsetHours, 59, 59, 999));
}

/** `YYYY-MM-DDTHH:MM` local -> UTC. */
function atLocalTime(stamp: string, offsetHours: number): Date {
  const [date, time] = stamp.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "").split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error(`Expected YYYY-MM-DDTHH:MM, got "${stamp}"`);
  }
  return new Date(Date.UTC(y, m - 1, d, hh - offsetHours, mm, 0, 0));
}

async function main() {
  const [campaignId, dateArg] = positional;
  const at = flag("at");
  if (!campaignId || (!dateArg && !at)) {
    console.error("usage: extend-deadline.ts <campaignId> <YYYY-MM-DD | --at=YYYY-MM-DDTHH:MM> [--apply]");
    process.exit(1);
  }

  const next = at ? atLocalTime(at, UTC_OFFSET_HOURS) : endOfLocalDay(dateArg, UTC_OFFSET_HOURS);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true, roleName: true, companyName: true, type: true, status: true,
      deadline: true, _count: { select: { candidates: true } },
    },
  });
  if (!campaign) throw new Error(`No campaign ${campaignId}`);

  const now = new Date();
  const local = (d: Date) =>
    new Date(d.getTime() + UTC_OFFSET_HOURS * 3600_000)
      .toISOString().replace("T", " ").slice(0, 19) + ` UTC+${UTC_OFFSET_HOURS}`;

  console.log(`${campaign.companyName} / ${campaign.roleName}`);
  console.log(`  ${campaign.type} · ${campaign.status} · ${campaign._count.candidates} candidates\n`);
  console.log(`  from  ${campaign.deadline?.toISOString() ?? "none"}   ${campaign.deadline ? local(campaign.deadline) : ""}`);
  console.log(`  to    ${next.toISOString()}   ${local(next)}\n`);

  if (next < now) console.log("  ! that is in the PAST — the round would stay closed\n");
  if (campaign.deadline && next < campaign.deadline) console.log("  ! this SHORTENS the round\n");

  // A CLOSED campaign rejects submissions regardless of the date, so moving the
  // deadline alone would look applied and change nothing for candidates.
  if (campaign.status === "CLOSED") console.log("  ! status is CLOSED — reopen it too, or the new date has no effect\n");

  if (!APPLY) {
    console.log("DRY RUN — pass --apply to write.");
    return;
  }

  await prisma.campaign.update({ where: { id: campaign.id }, data: { deadline: next } });
  console.log("Applied.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
