import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { githubUsername: "OSSAMA-prog-droid" },
  });

  if (!user) {
    console.log("User not found");
    return;
  }

  console.log("User ID:", user.id);

  const assignments = await prisma.ticketAssignment.deleteMany({
    where: { userId: user.id },
  });
  console.log("Deleted assignments:", assignments.count);

  const pending = await prisma.submission.deleteMany({
    where: { userId: user.id, status: "PENDING" },
  });
  console.log("Deleted PENDING submissions:", pending.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
