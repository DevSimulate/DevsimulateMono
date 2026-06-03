/**
 * Usage: npx ts-node scripts/grant-tickets.ts <userId> <count>
 * Voids the oldest N non-void submissions this month for a user,
 * effectively freeing up N ticket slots on the free tier.
 */
import prisma from "../src/lib/prisma";

async function main() {
  const userId = process.argv[2];
  const count = parseInt(process.argv[3] ?? "3", 10);

  if (!userId) {
    console.error("Usage: npx ts-node scripts/grant-tickets.ts <userId> <count>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`User ${userId} not found`);
    process.exit(1);
  }

  console.log(`User: ${user.githubUsername} (${user.email})`);
  console.log(`Tier: ${user.subscriptionTier}`);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const submissions = await prisma.submission.findMany({
    where: { userId, submittedAt: { gte: startOfMonth }, status: { not: "VOID" } },
    orderBy: { submittedAt: "asc" },
    take: count,
  });

  if (submissions.length === 0) {
    console.log("No submissions to void this month — user already has free slots.");
    process.exit(0);
  }

  const ids = submissions.map((s) => s.id);
  await prisma.submission.updateMany({
    where: { id: { in: ids } },
    data: { status: "VOID" },
  });

  console.log(`Voided ${ids.length} submission(s) — user now has ${ids.length} free slot(s) restored.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
