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

  // Ticket 8 — NOVA-96
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-96-seed-id-008" },
    update: {},
    create: {
      id: "ticket-nova-96-seed-id-008",
      title: "NOVA-96: Invoice Emails Sent Without PDF Attachment",
      description:
        "Customers are complaining they receive invoice emails with no PDF attached. Support has confirmed it reproducibly: the email arrives, the body is correct, but there is no PDF link and no downloadable document. The code team says 'PDF generation works fine' because when they test GeneratePdfAsync directly it produces a URL. The bug only appears when invoices are sent via the automated flow. Find where the PDF URL is being dropped and fix it.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/InvoiceService.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer find that SendAsync calls GeneratePdfAsync but ignores its return value, leaving the local invoice object with a null PdfUrl? Did they trace the call: GeneratePdfAsync saves the URL to DB but the in-memory invoice is never updated, so SendInvoiceAsync receives an invoice with PdfUrl = null?",
        design:
          "Did they fix it by capturing the return value of GeneratePdfAsync and updating invoice.PdfUrl before calling SendInvoiceAsync? Did they consider that re-fetching the invoice from DB after GeneratePdfAsync is an alternative correct fix?",
        communication:
          "Did they clearly explain that the PDF is generated successfully but the in-memory object is stale? Did they distinguish between the DB state (correct) and the object passed to the notification (wrong)?",
        execution:
          "Does the fix ensure invoice.PdfUrl is non-null before calling SendInvoiceAsync? Does the generated PDF URL reach the email?",
      },
      expectedMinutes: 40,
      codebaseId: codebase.id,
    },
  });

  // Ticket 9 — NOVA-99
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-99-seed-id-009" },
    update: {},
    create: {
      id: "ticket-nova-99-seed-id-009",
      title: "NOVA-99: Soft-Deleted Customers Appear in Search and Order Assignment",
      description:
        "Sales reps are complaining that closed customer accounts keep appearing when they search for customers to assign an order to. We closed 47 accounts last month after failed debt collection. Those accounts should be invisible to the UI. They still show up in search results and in the 'assign order' dropdown. The DeleteAsync method does soft-delete them (status = Closed) but something is not filtering them out downstream.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/CustomerService.cs",
        "src/NovaTechCRM.Repositories/CustomerRepository.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer identify that CustomerService.SearchAsync and GetAllAsync pass no status filter to the repository? Did they find that the repository queries do not exclude Status = Closed records?",
        design:
          "Did they add a status filter — either at the service layer (filtering the returned list) or at the repository layer (adding a WHERE Status != Closed clause)? Did they consider that adding the filter at the repository layer is more efficient as it avoids loading closed records from the DB at all?",
        communication:
          "Did they explain the soft-delete pattern and why the filter needs to be explicit? Did they note that EvaluateTierAsync and GetAllDashboardsAsync may have the same issue?",
        execution:
          "Does the fix prevent Closed customers from appearing in search results? Does GetAllAsync also exclude them?",
      },
      expectedMinutes: 35,
      codebaseId: codebase.id,
    },
  });

  // Ticket 10 — NOVA-102
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-102-seed-id-010" },
    update: {},
    create: {
      id: "ticket-nova-102-seed-id-010",
      title: "NOVA-102: Duplicate Invoice Numbers Generated Under Load",
      description:
        "Finance has flagged 11 invoices this quarter with duplicate numbers — two separate invoices both assigned INV-2026-00034, for example. They only discovered it when a customer called about a payment that was applied to the wrong account. The invoice sequence supposedly comes from the database but somehow two invoices are getting the same number. It never happens during normal usage but appears under traffic spikes.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.MID,
      filesInvolved: [
        "src/NovaTechCRM.Services/InvoiceService.cs",
        "src/NovaTechCRM.Repositories/InvoiceRepository.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer identify that GetNextSequenceAsync likely uses a non-atomic read-then-increment pattern (SELECT MAX(sequence) + 1) rather than a database sequence or atomic increment? Under concurrent load two transactions can both read the same MAX value before either commits, resulting in duplicate sequence numbers.",
        design:
          "Did they propose replacing the read-increment pattern with a proper database sequence (CREATE SEQUENCE) or an atomic UPDATE ... OUTPUT / RETURNING clause? Did they consider a Redis counter as an alternative? Did they note the static _invoiceSequence field is also a cross-instance risk?",
        communication:
          "Did they explain why the race condition is invisible in single-request testing but surfaces under concurrent load? Did they assess the financial impact of duplicate invoice numbers?",
        execution:
          "Does the proposed fix guarantee uniqueness under concurrent requests across multiple API instances? Is it deadlock-safe?",
      },
      expectedMinutes: 75,
      codebaseId: codebase.id,
    },
  });

  // Ticket 11 — NOVA-105
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-105-seed-id-011" },
    update: {},
    create: {
      id: "ticket-nova-105-seed-id-011",
      title: "NOVA-105: Customer Tier Not Recalculated After Large Refunds",
      description:
        "The sales team noticed 9 enterprise customers have Gold or Platinum tier badges but should have been downgraded months ago. Each of these customers had large refunds processed — one customer spent $22,000 (Platinum) but was refunded $19,000, leaving effective lifetime spend of $3,000 (Silver). They are still Platinum and receiving Platinum-tier discounts worth thousands of dollars. Figure out why tier evaluation is not accounting for refunds.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.MID,
      filesInvolved: [
        "src/NovaTechCRM.Services/CustomerService.cs",
        "src/NovaTechCRM.Services/PaymentService.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer find that EvaluateTierAsync calculates lifetime value using only fulfilled orders (Sum of TotalAmount) with no deduction for refunds? Did they identify that refunds in PaymentService update the Payment record but do not adjust order totals or trigger a tier re-evaluation?",
        design:
          "Did they propose either (a) deducting refunded amounts from LTV in EvaluateTierAsync, or (b) triggering EvaluateTierAsync after a refund is processed in RefundAsync? Did they consider backwards compatibility — running a one-time backfill to fix existing incorrect tiers?",
        communication:
          "Did they explain why the bug is hard to notice — tiers only get re-evaluated explicitly, and refunds flow through a different code path? Did they quantify the business impact (incorrect discounts)?",
        execution:
          "Does the fix correctly reduce LTV by refunded amounts when evaluating tier? Does a $22,000 spend with $19,000 in refunds correctly resolve to Silver tier ($3,000)?",
      },
      expectedMinutes: 60,
      codebaseId: codebase.id,
    },
  });

  // Ticket 12 — NOVA-108
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-108-seed-id-012" },
    update: {},
    create: {
      id: "ticket-nova-108-seed-id-012",
      title: "NOVA-108: Overdue Invoice Notification Has No Grace Period",
      description:
        "We are getting angry emails from enterprise customers. They receive an aggressive 'Your invoice is OVERDUE' notification on the exact day the invoice is due — sometimes within hours of the due date — before they have had a chance to pay. Two accounts threatened to cancel. The contract says we must allow 3 business days before sending overdue notices. The code sends them at midnight on the due date. Find it and add the grace period.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/InvoiceService.cs",
        "src/NovaTechCRM.Infrastructure/BackgroundJobs/InvoiceOverdueJob.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer find ProcessOverdueAsync uses `i.DueAt < now` with no grace period, so the very first midnight after the due date triggers the overdue notification? Did they find the TODO comment referencing NOVA-64 that explicitly called this out?",
        design:
          "Did they change the condition to `i.DueAt.AddDays(3) < now` or introduce a configurable GracePeriodDays setting? Did they consider that 'business days' vs 'calendar days' may matter for enterprise contracts and suggest making it configurable?",
        communication:
          "Did they explain the customer impact clearly and reference the contract SLA? Did they suggest whether the grace period should be configurable per customer tier or global?",
        execution:
          "Does the fix prevent notifications from firing within 3 days of the due date? Does it correctly handle invoices that were already past the grace period before the fix is deployed?",
      },
      expectedMinutes: 45,
      codebaseId: codebase.id,
    },
  });

  // Ticket 13 — NOVA-111
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-111-seed-id-013" },
    update: {},
    create: {
      id: "ticket-nova-111-seed-id-013",
      title: "NOVA-111: Any Authenticated User Can Delete Another Customer's Payment Method",
      description:
        "Our security team ran an internal penetration test and found that DELETE /api/payments/methods/{id} deletes the payment method with no check that the authenticated user actually owns it. An attacker who knows (or guesses) a payment method UUID can delete any customer's saved card. We already fixed a similar read vulnerability in NOVA-83. This is the same class of bug on the delete endpoint. Fix it before the pen test report goes to the board.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.MID,
      filesInvolved: [
        "src/NovaTechCRM.Services/PaymentService.cs",
        "src/NovaTechCRM.Api/Controllers/PaymentsController.cs",
        "src/NovaTechCRM.Repositories/IPaymentRepository.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer identify that DeletePaymentMethodAsync in PaymentService calls the repository with no ownership verification? Did they confirm the controller passes the ID directly without checking the authenticated user's customerId against the payment method's customerId?",
        design:
          "Did they add a lookup before delete — fetch the payment method, verify PaymentMethod.CustomerId == authenticated user's customerId, return 403 if mismatch? Did they discuss whether the check belongs in the service layer (preferred) or controller layer?",
        communication:
          "Did they classify this as an IDOR (Insecure Direct Object Reference) vulnerability? Did they reference NOVA-83 as a prior instance of the same pattern in the codebase and suggest an audit of other endpoints?",
        execution:
          "Does the fix return 403 (not 404) when attempting to delete another customer's payment method? Is the fix placed at the service layer so it cannot be bypassed by different controller routes?",
      },
      expectedMinutes: 50,
      codebaseId: codebase.id,
    },
  });

  // Ticket 14 — NOVA-114
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-114-seed-id-014" },
    update: {},
    create: {
      id: "ticket-nova-114-seed-id-014",
      title: "NOVA-114: Audit Logs Missing for Entire Production System",
      description:
        "Compliance ran a quarterly audit review and found zero audit entries in the database for the last 90 days — despite the system processing thousands of orders. The AuditFlushJob logs show it running successfully every 30 seconds and always reporting 0 entries flushed. The development team insists the AuditService.LogAsync is being called correctly on every create/update/delete. Somehow entries are going in but never coming out. Find out why and fix it.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.SENIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/AuditService.cs",
        "src/NovaTechCRM.Infrastructure/BackgroundJobs/AuditFlushJob.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer discover that AuditService is registered as Scoped in DI? Each HTTP request creates its own AuditService instance with its own _batch list. The AuditFlushJob creates a new DI scope and gets a fresh AuditService with an empty batch — it never sees the entries accumulated in request-scoped instances. Request scopes are disposed at end-of-request, taking the unflushed batch with them.",
        design:
          "Did they propose the correct fix — registering AuditService as Singleton so the same _batch is shared across all requests and the flush job? Did they address thread safety — the existing SemaphoreSlim _lock is already present and handles this correctly for Singleton lifetime. Did they suggest running a compensating migration or re-audit for the missing 90 days?",
        communication:
          "Did they clearly explain the DI lifetime mismatch? Did they explain why the flush job always reports 0 — it is genuinely seeing an empty batch, not a logging bug? Did they connect the Scoped vs Singleton lifetime to the symptom?",
        execution:
          "Does changing to Singleton registration cause the flush job to see and flush the accumulated entries? Is the SemaphoreSlim thread-safe under Singleton usage across concurrent requests?",
      },
      expectedMinutes: 90,
      codebaseId: codebase.id,
    },
  });

  // Ticket 15 — NOVA-117
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-117-seed-id-015" },
    update: {},
    create: {
      id: "ticket-nova-117-seed-id-015",
      title: "NOVA-117: Customers Charged Twice After Payment Timeout",
      description:
        "Three enterprise customers have contacted us saying they were double-charged. In each case the story is the same: they submitted payment, it appeared to hang or time out, they hit submit again, and two charges appeared on their statement. Our logs show two separate payment records for each case, both with status Succeeded. The payment provider (Stripe) confirms both charges as legitimate transactions. We created the payment twice. Find the root cause and implement the fix.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.SENIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/PaymentService.cs",
        "src/NovaTechCRM.Infrastructure/Payments/StripePaymentProvider.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer find that ChargeAsync creates a payment record in the DB before calling the provider, but if the DB update (step 3) fails or times out, the payment is stuck in Processing status? On retry, a new payment record is created and the provider is called again — the customer is charged twice. Did they identify the lack of an idempotency key as the root cause?",
        design:
          "Did they propose using a deterministic idempotency key (e.g., derived from customerId + invoiceId + amount + date) passed to the provider on every charge attempt? Did they consider using the existing Payment.Id GUID as the idempotency key since it is created before the provider call? Did they consider checking for existing Processing payments for the same invoice before creating a new record?",
        communication:
          "Did they explain the exact failure sequence — provider succeeds, DB update fails, payment stuck in Processing, retry creates second charge? Did they distinguish user-triggered retry from automated retry? Did they assess liability/refund process for the affected customers?",
        execution:
          "Does the fix prevent a second charge when the same invoice payment is retried? Does it handle the case where the provider has the charge but the DB does not, and reconcile correctly?",
      },
      expectedMinutes: 120,
      codebaseId: codebase.id,
    },
  });

  // Ticket 16 — NOVA-120
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-120-seed-id-016" },
    update: {},
    create: {
      id: "ticket-nova-120-seed-id-016",
      title: "NOVA-120: Race Condition in Set-Default Payment Method",
      description:
        "Customer support has escalated a recurring complaint: customers update their default payment method in the app and the next subscription renewal charges the old card instead. When we look in the DB we sometimes find two payment methods both marked IsDefault = true for the same customer. This causes the charge to go to whichever record the payment service happens to load first. It seems to happen when the customer saves a new card on the mobile app and web app at the same time.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.SENIOR,
      filesInvolved: [
        "src/NovaTechCRM.Services/PaymentService.cs",
        "src/NovaTechCRM.Repositories/IPaymentRepository.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer identify the read-modify-write race condition in SavePaymentMethodAsync? Two concurrent requests both read the existing payment methods, both see the old method as default, both clear it and set their own new method as default. The second write does not undo the first — both end up with IsDefault = true.",
        design:
          "Did they propose an atomic fix — either a database-level UPDATE ... SET IsDefault = false WHERE CustomerId = @id (all at once before inserting the new default), or a pessimistic lock (SELECT FOR UPDATE), or an optimistic concurrency check? Did they rule out the current approach of loading-and-updating individual records as inherently racy?",
        communication:
          "Did they explain why this is invisible in single-user testing but surfaces under concurrent mobile+web sessions? Did they describe the customer impact (wrong card charged on renewal)?",
        execution:
          "Does the fix ensure exactly one payment method per customer is marked IsDefault at all times, even under concurrent requests? Is the fix deadlock-safe?",
      },
      expectedMinutes: 90,
      codebaseId: codebase.id,
    },
  });

  // Ticket 17 — NOVA-123
  await prisma.ticket.upsert({
    where: { id: "ticket-nova-123-seed-id-017" },
    update: {},
    create: {
      id: "ticket-nova-123-seed-id-017",
      title: "NOVA-123: Overdue Invoice Notification Silently Lost on Process Restart",
      description:
        "Finance discovered 34 invoices that are marked Overdue in the database but the customers never received an overdue notification. These are real past-due balances that customers are unaware of. The pattern: every case corresponds to a deployment window — the API was restarted between midnight and 1 AM when the overdue job runs. Find out exactly how the notification gets lost and propose a fix that guarantees either the notification is sent or the invoice stays Issued so the job retries it tomorrow.",
      stack: Stack.DOTNET,
      difficulty: Difficulty.MID,
      filesInvolved: [
        "src/NovaTechCRM.Services/InvoiceService.cs",
        "src/NovaTechCRM.Infrastructure/BackgroundJobs/InvoiceOverdueJob.cs",
      ],
      rubric: {
        diagnosis:
          "Did the developer find that ProcessOverdueAsync updates the invoice status to Overdue in the DB BEFORE sending the notification? If the process is killed after the DB update but before SendInvoiceOverdueAsync completes, the invoice is permanently Overdue in the DB but no notification was sent. The job only queries Issued invoices so it will never retry.",
        design:
          "Did they propose reordering operations — send the notification first, then update status — so that a crash before the DB update leaves the invoice as Issued and the job retries tomorrow? Did they discuss the trade-off: reordering means a crash after notification but before DB update sends a duplicate notification. Did they suggest an outbox pattern or idempotency field as the robust solution?",
        communication:
          "Did they clearly explain the at-most-once vs at-least-once delivery trade-off? Did they link the failure to deployment restarts during the job window? Did they recommend a monitoring alert for the gap between Overdue invoices and notification send logs?",
        execution:
          "Does the proposed fix eliminate silent notification loss in the common deployment-restart scenario? If reordering is chosen, is the duplicate-notification risk correctly acknowledged and mitigated?",
      },
      expectedMinutes: 75,
      codebaseId: codebase.id,
    },
  });

  console.log("Seed complete. Created NovaTech CRM codebase with 17 tickets.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
