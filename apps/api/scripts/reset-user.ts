import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { githubUsername: "OSSAMA-prog-droid" },
  });

  if (!user) { console.log("User not found"); return; }
  console.log("User ID:", user.id);

  // 1. Delete follow-up questions (no cascade — must go before submissions)
  const followUps = await prisma.followUpQuestion.deleteMany({
    where: { submission: { userId: user.id } },
  });
  console.log("Deleted follow-up questions:", followUps.count);

  // 2. Delete all submissions
  const submissions = await prisma.submission.deleteMany({
    where: { userId: user.id },
  });
  console.log("Deleted submissions:", submissions.count);

  // 3. Unassign all tickets
  const assignments = await prisma.ticketAssignment.deleteMany({
    where: { userId: user.id },
  });
  console.log("Deleted assignments:", assignments.count);

  // 4. Reset skill score
  await prisma.user.update({
    where: { id: user.id },
    data: { skillScore: 0 },
  });
  console.log("Skill score reset to 0");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
