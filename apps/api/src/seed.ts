import { PrismaClient, Stack, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

export async function runSeed(): Promise<void> {
  console.log("[seed] Seeding database...");

  const codebase = await prisma.codebase.upsert({
    where: { id: "novatech-crm-seed-id-001" },
    update: {},
    create: {
      id: "novatech-crm-seed-id-001",
      name: "NovaTech CRM",
      stack: Stack.DOTNET,
      repoUrl: "https://github.com/OSSAMA-prog-droid/novatech-crm",
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
      difficulty: Difficulty.JUNIOR,
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
      repoUrl: "https://github.com/OSSAMA-prog-droid/ragcore",
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

  await prisma.$disconnect();
  console.log(
    `[seed] Done — ${tickets.length} NovaTech + ${sdTickets.length} SD + ${ragTickets.length} RAGCore tickets upserted.`
  );
}
