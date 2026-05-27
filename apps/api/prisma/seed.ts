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

  // Ticket 4 — NOVA-61
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-61-seed-id-004" },
    update: {},
    create: {
      id: "ticket-nova-61-seed-id-004",
      title: "NOVA-61: Inventory Over-Commitment Under Load",
      description:
        "During last week's flash sale, 340 units of SKU-8821 were sold but we only had 200 in stock. Fulfilment is furious. Orders are going out with a backorder status that customers were never told about. It only seems to happen when traffic spikes. Normal single-user testing works fine. Find the root cause and fix it so we can't sell stock we don't have.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.SENIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/InventoryService.cs",
        "src/NovaTechCRM.Repositories/InventoryRepository.cs",
        "src/NovaTechCRM.Domain/Models/Inventory.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer identify the read-check-write race condition in ReserveAsync? Did they understand that two concurrent requests both read QuantityAvailable before either writes, allowing both to pass the stock check against the same stale snapshot?",
        design:
          "Did they choose a correct fix — optimistic concurrency (RowVersion/ETag), a database-level atomic update, pessimistic locking, or a serialised reservation queue? Did they consider the trade-offs of each approach for a high-throughput sale scenario?",
        communication:
          "Did they explain why the bug is invisible in single-user testing but surfaces under concurrent load? Did they describe the race window clearly in the PR?",
        execution:
          "Does the fix actually prevent over-commitment? Is the solution deadlock-safe? Does it handle the retry/conflict path correctly?",
      },
      expectedMinutes: 90,
      codebaseId: codebase.id,
    },
  });

  // Ticket 5 — NOVA-74
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-74-seed-id-005" },
    update: {},
    create: {
      id: "ticket-nova-74-seed-id-005",
      title: "NOVA-74: API Memory Usage Grows Over Time",
      description:
        "Ops is restarting the API every 48 hours because memory climbs from ~300 MB at startup to over 2 GB. It never comes back down. A heap dump shows thousands of ReportService instances still reachable even though the requests that created them finished long ago. The service is registered as Scoped in DI so each request should get a fresh instance — yet they are not being collected. Find out why and fix it.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.SENIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/ReportService.cs",
        "src/NovaTechCRM.Api/Program.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer find the static event handler list or static dictionary in ReportService that accumulates a reference to every instance ever constructed? Did they understand that static fields in a Scoped service pin instances in memory permanently, defeating GC?",
        design:
          "Did they propose the correct fix — removing the static state, using weak references, or moving the shared state to a Singleton service? Did they consider thread safety of any replacement?",
        communication:
          "Did they clearly explain why Scoped lifetime does not protect against static field leaks? Did they quantify the growth rate and connect it to request volume?",
        execution:
          "Does the fix eliminate the static reference? Does memory stabilise after the fix is applied under load?",
      },
      expectedMinutes: 75,
      codebaseId: codebase.id,
    },
  });

  // Ticket 6 — NOVA-83
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-83-seed-id-006" },
    update: {},
    create: {
      id: "ticket-nova-83-seed-id-006",
      title: "NOVA-83: Payment Method Details Exposed to Wrong Users",
      description:
        "A customer emailed us saying they could see another customer's saved card details in the mobile app. Our security team has confirmed it is reproducible. Any authenticated user can retrieve the full card metadata for any payment method in the system just by knowing — or guessing — the payment method ID. The IDs are UUIDs so guessing is hard, but the exposure is real and we need it fixed before legal finds out.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.MID,
      filesInvolved: [
        "src/NovaTechCRM.Api/Controllers/PaymentsController.cs",
        "src/NovaTechCRM.Services/PaymentService.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer identify the missing ownership check on GET /api/payments/methods/{id}/details? Did they see that the endpoint fetches all payment methods across all customers and returns whichever matches the ID, with no check that the authenticated user owns it?",
        design:
          "Did they add the correct ownership check — verifying the payment method's CustomerId matches the authenticated user's customer ID before returning it? Did they consider whether the service layer or controller layer is the right place for this check?",
        communication:
          "Did they classify this as an IDOR (Insecure Direct Object Reference) vulnerability? Did they assess the impact — full card metadata exposure for all customers?",
        execution:
          "Does the fix correctly prevent cross-customer access? Does it return 403 (not 404) for unauthorised access to another user's payment method?",
      },
      expectedMinutes: 45,
      codebaseId: codebase.id,
    },
  });

  // Ticket 7 — NOVA-91
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-91-seed-id-007" },
    update: {},
    create: {
      id: "ticket-nova-91-seed-id-007",
      title: "NOVA-91: Shipment Report Shows Wrong Date Range in Some Regions",
      description:
        "Customers in the UAE and Singapore are complaining that the 'last 30 days' shipment report is missing shipments from the most recent day and including shipments from 31 days ago. UK and EU customers report it correctly. It works fine on the developer machines in the Dublin office. We deploy to servers in UTC+0 and the bug only appears for tenants in UTC+4 and UTC+8 timezones. Find it and fix it.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/ShipmentService.cs",
        "src/NovaTechCRM.Domain/ValueObjects/DateRange.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer find that DateRange.LastNDays uses DateTime.Now (local server time) instead of DateTime.UtcNow? Did they understand that on UTC+0 servers the bug is invisible but shifts the window by the tenant's UTC offset in other regions?",
        design:
          "Did they fix it by replacing DateTime.Now with DateTime.UtcNow throughout the date range calculation? Did they consider whether tenant timezone conversion is needed at the display layer vs the query layer?",
        communication:
          "Did they explain why the bug is invisible on UTC servers? Did they link the symptom (wrong day boundary) to the root cause (local time vs UTC)?",
        execution:
          "Does the fix use UTC consistently? Does it pass a test that runs in a non-UTC timezone without drift?",
      },
      expectedMinutes: 30,
      codebaseId: codebase.id,
    },
  });

  console.log("Seed complete. Created NovaTech CRM codebase with 7 tickets.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
