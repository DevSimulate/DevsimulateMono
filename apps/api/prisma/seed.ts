import { PrismaClient, Stack, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding database...");

  // Create the NovaTech CRM codebase
  const codebase = await prisma.codebase.upsert({
    where: { id: "novatech-crm-seed-id-001" },
    update: {},
    create: {
      id: "novatech-crm-seed-id-001",
      name: "NovaTech CRM",
      stack: Stack.DOTNET,
      repoUrl: "https://github.com/OSSAMA-prog-droid/novatech-crm",
      description:
        "A mid-market CRM system serving 2,000+ enterprise clients. Built in .NET 6 with a SQL Server backend and Angular frontend.",
      companyLore: `NovaTech Solutions was founded in 2014 by two ex-Salesforce engineers who believed the SMB market was underserved by bloated enterprise CRM tools.

The CRM started as a clean .NET monolith and has grown to ~180,000 lines of code across 6 major modules: Sales, Orders, Customer Management, Reporting, Discounting, and Notifications.

The engineering team is 14 developers across 3 squads. Technical debt has accumulated across the Order and Discount modules following a rushed migration from SQL Server 2012 to 2019 last quarter. The original architects left the company in 2022. Documentation is sparse.

Key facts engineers must know:
- Orders over $500 go through a secondary fraud check via an external API (FraudShield)
- Discount rules cascade in a specific priority order: Contract > Promotional > Volume > Default
- The notification system uses a fire-and-forget pattern that does not retry on failure
- Customer dashboard data is denormalized into a reporting cache that was rebuilt during the SQL migration`,
    },
  });

  // Ticket 1 — NOVA-47
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-47-seed-id-001" },
    update: {},
    create: {
      id: "ticket-nova-47-seed-id-001",
      title: "NOVA-47: Intermittent Order Fulfillment Failure",
      description:
        "Customers are reporting that their orders sometimes get confirmed but never actually get fulfilled. It happens roughly 1 in 50 orders. The CEO was affected yesterday. We cannot reproduce it consistently. No exceptions appear in the logs. Only seems to affect orders over $500. Figure out what is going wrong and fix it properly.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.MID,
      filesInvolved: [
        "src/Services/OrderService.cs",
        "src/Services/NotificationService.cs",
        "src/Repositories/OrderRepository.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer identify the FraudShield integration as the root cause? Did they notice the fire-and-forget notification pattern masks the failure? Did they find the missing await/async bug or timeout misconfiguration causing silent drops for orders >$500?",
        design:
          "Did they propose proper error handling with retry logic? Did they consider idempotency? Did they add dead-letter queue or alerting rather than just catching exceptions?",
        communication:
          "Did they clearly explain root cause vs symptom? Did they document the FraudShield integration behaviour and its failure modes?",
        execution:
          "Does their fix actually prevent the silent failure? Does it handle the race condition or timeout correctly?",
      },
      expectedMinutes: 90,
      codebaseId: codebase.id,
    },
  });

  // Ticket 2 — NOVA-52
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-52-seed-id-002" },
    update: {},
    create: {
      id: "ticket-nova-52-seed-id-002",
      title: "NOVA-52: Dashboard Performance Degradation",
      description:
        "The main customer dashboard loads in under 2 seconds for new customers. For customers with more than 18 months of history it takes between 40 and 60 seconds. Product wants it under 2 seconds for everyone. This started after the data migration last quarter.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.MID,
      filesInvolved: [
        "src/Controllers/DashboardController.cs",
        "src/Repositories/CustomerRepository.cs",
        "src/Services/ReportingService.cs",
      ],
      rubric: {
        diagnosis:
          "Did they identify the N+1 query in CustomerRepository introduced during the SQL migration? Did they find that the reporting cache is not being populated correctly for customers created before the migration date?",
        design:
          "Did they choose an appropriate fix — e.g. fixing the cache rebuild, adding a composite index, or rewriting the query to use a single JOIN? Did they consider migration-safe rollout?",
        communication:
          "Did they clearly explain why new customers are fast but legacy customers are slow? Did they link the issue to the SQL migration?",
        execution:
          "Does their solution actually bring load time under 2 seconds for legacy customers? Did they add a query explain plan or benchmark?",
      },
      expectedMinutes: 75,
      codebaseId: codebase.id,
    },
  });

  // Ticket 3 — NOVA-58
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-58-seed-id-003" },
    update: {},
    create: {
      id: "ticket-nova-58-seed-id-003",
      title: "NOVA-58: Discount Calculation Conflict",
      description:
        "Finance and Sales are in a meeting room arguing. Finance says the discount engine is calculating wrong totals. Sales says the numbers are correct and Finance does not understand the business rules. Both have spreadsheets. You need to read the code, understand the actual business rules, determine who is right, document what the rules actually are, and fix any discrepancy you find.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.SENIOR,
      filesInvolved: [
        "src/Services/DiscountEngine.cs",
        "src/Models/DiscountRule.cs",
        "docs/business-rules.md",
      ],
      rubric: {
        diagnosis:
          "Did they correctly read the code and identify that the cascade priority order (Contract > Promotional > Volume > Default) is not being enforced? Did they determine that Finance is correct — the engine is applying discounts additively instead of using the highest-priority rule only?",
        design:
          "Did they fix the cascade logic correctly? Did they write the updated business rules documentation? Did they consider backwards compatibility for existing contracts?",
        communication:
          "Did they clearly adjudicate between Finance and Sales with evidence from the code? Did they write clear documentation that both teams could understand? Did they explain the impact of the bug?",
        execution:
          "Does the fixed engine pass the Finance team's test cases? Does it maintain the correct cascade priority?",
      },
      expectedMinutes: 120,
      codebaseId: codebase.id,
    },
  });

  console.log("Seed complete. Created NovaTech CRM codebase with 3 tickets.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
