/**
 * seedDemo — idempotent demo data loader for the investor demo.
 * Callable from the API reset endpoint and from the CLI seed script.
 */

import {
  PrismaClient,
  Stack,
  SubmissionStatus,
  AIUsageDeclaration,
} from "@prisma/client";

const prisma = new PrismaClient();

const TICKET_ID = "ticket-nova-47-seed-id-001";

const CANDIDATES = [
  {
    userId:         "demo-user-ahmed-khan-001",
    githubId:       "demo-gh-90000001",
    githubUsername: "ahmed-khan",
    email:          "ahmed.khan@demo.devsimulate.io",
    submissionId:   "demo-sub-ahmed-khan-001",
    followUpId:     "demo-fup-ahmed-khan-001",
    scores: { total: 82, diagnosis: 34, design: 25, communication: 15, execution: 8 },
    riskScore: 6,
    timeMinutes: 47,
    claudeReview: {
      scoreDiagnosis: 34, scoreDesign: 25, scoreCommunication: 15, scoreExecution: 8, scoreTotal: 82,
      feedback: {
        diagnosis:
          "Ahmed correctly identified the fire-and-forget async void pattern in OrderService.cs as the root cause of silent order failures. He traced exactly why orders over $500 were affected — the FraudShield timeout happened inside an async void call, so the exception was swallowed before reaching any error handler.",
        design:
          "His fix using IHostedService with proper awaiting demonstrates strong understanding of .NET async patterns. The use of a channel-based background queue with retry logic was well-considered.",
        communication:
          "Communication was clear and professional. The PR description explained root cause, impact, and fix without ambiguity. The business consequence (silent order loss) was explicitly called out.",
        execution:
          "The fix correctly converts async void to async Task, adds proper await, and integrates the hosted service. The change is targeted and does not introduce unnecessary surface area.",
      },
      summary:
        "Ahmed correctly identified the fire-and-forget async void pattern in OrderService.cs as the root cause of silent order failures. His fix using IHostedService with proper awaiting demonstrates strong understanding of .NET async patterns. Communication was clear and professional.",
      topStrength:    "Root cause diagnosis — precisely identified the async void exception-swallowing behaviour",
      topImprovement: "Communication — could include a brief note on monitoring/alerting to confirm the fix holds in production",
    },
    followUp: {
      question1:
        "Why does async void specifically cause silent failures in OrderService, and what is the fundamental difference between async void and async Task in terms of exception handling?",
      question2:
        "What alternative patterns did you consider for fixing the notification issue, and why did you choose IHostedService over a simple try-catch wrapper?",
      answer1:
        "async void prevents the calling thread from awaiting the operation, so any exceptions thrown inside are not propagated to the caller and are swallowed by the runtime unless an AppDomain.UnhandledException handler catches them. In OrderService.cs, ProcessOrderAsync called NotifyAsync as async void — when the FraudShield API timed out on orders over $500, the exception was silently discarded and the order appeared confirmed. async Task returns an awaitable that preserves the exception in its fault state, allowing it to surface when the caller awaits.",
      answer2:
        "I considered a simple try-catch but rejected it — it still runs fire-and-forget on a background thread without lifecycle management. I looked at BackgroundService and IHostedService. IHostedService gives proper startup and shutdown hooks and integrates with the DI container, so the notification processor survives application restarts and IIS application pool recycles. A bare Task.Run would have the same problem as async void if the process recycles mid-order.",
      aiDeclaration:       AIUsageDeclaration.AI_USED_FOR_PHRASING,
      declarationMismatch: false,
      employerSummary:
        "No authenticity concerns. Answers show genuine understanding of async void exception behaviour and .NET hosting lifecycle. The follow-up answers are consistent with the depth of the PR and diagnosis.",
    },
  },
  {
    userId:         "demo-user-ali-raza-001",
    githubId:       "demo-gh-90000002",
    githubUsername: "ali-raza",
    email:          "ali.raza@demo.devsimulate.io",
    submissionId:   "demo-sub-ali-raza-001",
    followUpId:     "demo-fup-ali-raza-001",
    scores: { total: 79, diagnosis: 28, design: 28, communication: 13, execution: 10 },
    riskScore: 69,
    timeMinutes: 11,
    claudeReview: {
      scoreDiagnosis: 28, scoreDesign: 28, scoreCommunication: 13, scoreExecution: 10, scoreTotal: 79,
      feedback: {
        diagnosis:
          "Execution was correct — the code fix works. However the diagnosis was generic and did not demonstrate understanding of why async void causes silent failures in this specific context. The FraudShield integration was not mentioned.",
        design:
          "The design score is high because the proposed solution is architecturally sound — IHostedService with proper retry is a correct approach. However the design appears to have been chosen by pattern-matching rather than traced from the actual failure mode.",
        communication:
          "Communication lacked technical depth. The PR description explained what was changed but not why the async void pattern specifically caused silent failures for orders above $500.",
        execution:
          "Execution was perfect. The code compiles, handles cancellation tokens correctly, and the fix prevents the specific failure. Full marks here.",
      },
      summary:
        "Execution was correct — the code fix works. However the diagnosis was generic and did not demonstrate understanding of why async void causes silent failures in this specific context. Communication lacked technical depth.",
      topStrength:    "Execution — the code fix is correct and handles edge cases properly",
      topImprovement: "Diagnosis — need to demonstrate understanding of the specific failure mechanism, not just apply a known pattern",
    },
    followUp: {
      question1:
        "Why does async void specifically cause silent failures in OrderService, and what is the fundamental difference between async void and async Task in terms of exception handling?",
      question2:
        "What alternative patterns did you consider for fixing the notification issue, and why did you choose IHostedService over a simple try-catch wrapper?",
      answer1:
        "The primary difference between async void and async Task is exception handling behavior. When using async void, any exceptions that occur within the method cannot be caught by the caller since there is no task to await. This results in unhandled exceptions that are typically fatal or silently discarded depending on the synchronization context. With async Task, exceptions are captured in the returned task and can be properly observed and handled by awaiting callers. In the OrderService context, this means failures in the notification pipeline were silently swallowed without any error propagation.",
      answer2:
        "Several alternative patterns were considered including traditional try-catch exception handling, BackgroundService implementation, and message queue approaches. The IHostedService pattern was selected as the optimal solution due to its integration with the application lifecycle, support for graceful shutdown through CancellationToken, and proper exception propagation mechanisms. This ensures notifications are processed reliably without silent failures occurring in the pipeline.",
      aiDeclaration:       AIUsageDeclaration.NO_AI_USED,
      declarationMismatch: true,
      employerSummary:
        "Authenticity concern flagged. Candidate declared no AI use, but follow-up answers are markedly more formal and generic than the PR code and description. Key tell: the PR shows practical understanding of the NovaTech codebase (correct file paths, specific method names) but the follow-up answers describe async void in textbook terms without referencing OrderService.cs or FraudShield. The 11-minute completion time is also a significant outlier — median for this ticket is 52 minutes.",
    },
  },
  {
    userId:         "demo-user-sara-malik-001",
    githubId:       "demo-gh-90000003",
    githubUsername: "sara-malik",
    email:          "sara.malik@demo.devsimulate.io",
    submissionId:   "demo-sub-sara-malik-001",
    followUpId:     "demo-fup-sara-malik-001",
    scores: { total: 71, diagnosis: 30, design: 20, communication: 14, execution: 7 },
    riskScore: 12,
    timeMinutes: 52,
    claudeReview: {
      scoreDiagnosis: 30, scoreDesign: 20, scoreCommunication: 14, scoreExecution: 7, scoreTotal: 71,
      feedback: {
        diagnosis:
          "Sara showed solid understanding of the async issue and its business impact on order processing. She correctly identified the async void pattern and linked it to the FraudShield integration. She missed the specific >$500 threshold connection.",
        design:
          "Design could have been stronger with cancellation token handling and a dead-letter queue for failed notifications. The basic IHostedService fix is correct but incomplete for a production system.",
        communication:
          "Communication was adequate. The PR description covered the root cause clearly, though the business impact statement could have been more precise about which orders were affected.",
        execution:
          "The execution fix works for the happy path but has a gap — the cancellation token is not threaded through to the FraudShield API call, meaning a graceful shutdown could still lose an in-flight notification.",
      },
      summary:
        "Sara showed solid understanding of the async issue and its business impact on order processing. Design could have been stronger with cancellation token handling. Overall a competent diagnosis with room for improvement.",
      topStrength:    "Diagnosis — correctly identified the async void and FraudShield connection",
      topImprovement: "Execution — cancellation token handling needs to be complete through the entire call chain",
    },
    followUp: {
      question1:
        "Why does async void specifically cause silent failures in OrderService, and what is the fundamental difference between async void and async Task in terms of exception handling?",
      question2:
        "What alternative patterns did you consider for fixing the notification issue, and why did you choose IHostedService over a simple try-catch wrapper?",
      answer1:
        "async void in C# breaks the async/await chain because you can't await it from the caller. When NotifyAsync threw an exception during the FraudShield check for orders over $500, OrderService had no way to observe it — the exception was raised on the thread pool and went unhandled. With async Task, the exception is stored in the task object and re-thrown when you await it, giving the caller a chance to handle it properly.",
      answer2:
        "I thought about wrapping in try-catch first but that just hides the error rather than fixing the underlying fire-and-forget problem. Task.Run was another option but without shutdown management it's unreliable. IHostedService was the right call because the .NET host manages its lifetime — if the server restarts, pending notifications don't get silently dropped.",
      aiDeclaration:       AIUsageDeclaration.AI_USED_FOR_PHRASING,
      declarationMismatch: false,
      employerSummary:
        "No authenticity concerns. Answers are technically accurate and written in a natural conversational style consistent with the PR. Sara understands the async void problem from first principles. The declaration of AI-assisted phrasing is plausible and there are no indicators of AI-generated content.",
    },
  },
];

export async function seedDemo(): Promise<void> {
  console.log("[seed-demo] Resetting demo data...");

  const baseDate = new Date("2026-05-20T09:00:00.000Z");

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    const submittedAt = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
    const reviewedAt  = new Date(submittedAt.getTime() + c.timeMinutes * 60 * 1000);
    const answeredAt  = new Date(reviewedAt.getTime() + 2 * 60 * 60 * 1000);

    await prisma.user.upsert({
      where:  { id: c.userId },
      update: { githubUsername: c.githubUsername, email: c.email, skillScore: c.scores.total },
      create: {
        id: c.userId, githubId: c.githubId, githubUsername: c.githubUsername,
        email: c.email, primaryStack: Stack.DOTNET, skillScore: c.scores.total,
      },
    });

    await prisma.submission.upsert({
      where:  { id: c.submissionId },
      update: {
        scoreTotal: c.scores.total, scoreDiagnosis: c.scores.diagnosis,
        scoreDesign: c.scores.design, scoreCommunication: c.scores.communication,
        scoreExecution: c.scores.execution, claudeReview: c.claudeReview,
        riskScore: c.riskScore, status: SubmissionStatus.REVIEWED, reviewedAt,
      },
      create: {
        id: c.submissionId, userId: c.userId, ticketId: TICKET_ID,
        prUrl: `https://github.com/DevSimulator/novatech-crm/pull/${100 + i}`,
        prDescription: c.claudeReview.summary,
        branchName: `fix/nova-47-${c.githubUsername}`,
        status: SubmissionStatus.REVIEWED,
        scoreTotal: c.scores.total, scoreDiagnosis: c.scores.diagnosis,
        scoreDesign: c.scores.design, scoreCommunication: c.scores.communication,
        scoreExecution: c.scores.execution, claudeReview: c.claudeReview,
        riskScore: c.riskScore, submittedAt, reviewedAt,
      },
    });

    await prisma.followUpQuestion.upsert({
      where:  { id: c.followUpId },
      update: {
        answer1: c.followUp.answer1, answer2: c.followUp.answer2,
        aiDeclaration: c.followUp.aiDeclaration,
        declarationMismatch: c.followUp.declarationMismatch,
        employerSummary: c.followUp.employerSummary, answeredAt,
      },
      create: {
        id: c.followUpId, submissionId: c.submissionId,
        question1: c.followUp.question1, question2: c.followUp.question2,
        answer1: c.followUp.answer1, answer2: c.followUp.answer2,
        scoreBonus: 0, claudeFeedback: null,
        aiDeclaration: c.followUp.aiDeclaration,
        declarationMismatch: c.followUp.declarationMismatch,
        employerSummary: c.followUp.employerSummary, answeredAt,
      },
    });

    console.log(`[seed-demo] ✓ ${c.githubUsername} (score: ${c.scores.total})`);
  }

  await prisma.$disconnect();
  console.log("[seed-demo] Done.");
}
