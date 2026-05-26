require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk").default;
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUBMISSION_ID = process.argv[2];
if (!SUBMISSION_ID) {
  console.error("Usage: node gen-followup.js <submissionId>");
  process.exit(1);
}

async function run() {
  const sub = await prisma.submission.findUnique({
    where: { id: SUBMISSION_ID },
    include: { ticket: { include: { codebase: true } }, followUp: true },
  });

  if (!sub) {
    console.error("Submission not found");
    process.exit(1);
  }
  if (sub.followUp) {
    console.log("Follow-up already exists:", sub.followUp.id);
    process.exit(0);
  }
  if (sub.status !== "REVIEWED") {
    console.error("Submission is not yet reviewed (status:", sub.status + ")");
    process.exit(1);
  }

  const review = sub.claudeReview;

  const prompt = `You are a senior engineering interviewer. A developer just submitted a pull request fixing a bug and received this score:

Ticket: ${sub.ticket.title}
Codebase: ${sub.ticket.codebase.name}
Score: ${review.scoreTotal}/100
Diagnosis score: ${review.scoreDiagnosis}/40
Design score: ${review.scoreDesign}/30
Communication score: ${review.scoreCommunication}/20

Claude's review summary: ${review.summary}
Top strength: ${review.topStrength}
Top improvement: ${review.topImprovement}

Developer's PR description:
${sub.prDescription}

Generate exactly 2 follow-up questions that:
1. Are specific to THEIR fix — not generic questions about the bug type
2. Test whether they truly understood WHY the fix works, not just what they changed
3. Cannot be answered by re-feeding the codebase to AI without already understanding it
4. Target their weakest area — communication was ${review.scoreCommunication}/20, diagnosis was ${review.scoreDiagnosis}/40

Respond with ONLY valid JSON:
{
  "question1": "<question about the root cause mechanics or system behaviour>",
  "question2": "<question about edge cases, failure modes, or production tradeoffs>"
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text;
  console.log("Claude response:\n", text);

  let parsed;
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    console.error("Failed to parse JSON from Claude:", text);
    process.exit(1);
  }

  const saved = await prisma.followUpQuestion.create({
    data: {
      submissionId: SUBMISSION_ID,
      question1: parsed.question1,
      question2: parsed.question2,
    },
  });

  console.log("\nSaved follow-up questions (id:", saved.id + ")");
  console.log("Q1:", parsed.question1);
  console.log("Q2:", parsed.question2);

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1);
});
