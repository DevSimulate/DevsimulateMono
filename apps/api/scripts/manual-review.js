require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk").default;
const { Octokit } = require("@octokit/rest");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const SUBMISSION_ID = process.argv[2];
if (!SUBMISSION_ID) {
  console.error("Usage: node manual-review.js <submissionId>");
  process.exit(1);
}

function stripFences(text) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function run() {
  const sub = await prisma.submission.findUnique({
    where: { id: SUBMISSION_ID },
    include: { ticket: { include: { codebase: true } } },
  });

  if (!sub) { console.error("Submission not found"); process.exit(1); }
  console.log("Reviewing:", sub.ticket.title);

  // Fetch diff
  const prMatch = sub.prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  const [, owner, repo, prNum] = prMatch;

  const diffResp = await octokit.pulls.get({
    owner, repo, pull_number: parseInt(prNum),
    mediaType: { format: "diff" },
  });
  let prDiff = diffResp.data;
  if (prDiff.length > 12000) prDiff = prDiff.slice(0, 12000) + "\n\n[diff truncated]";
  console.log("Diff fetched:", prDiff.length, "chars");

  const rubric = sub.ticket.rubric;
  const systemPrompt = `You are a senior software engineer conducting structured code reviews for a developer training platform. Your job is to score a developer's pull request against a specific ticket.

You must respond with ONLY a valid JSON object — no markdown, no prose, no code fences. The JSON must conform exactly to this shape:
{
  "scoreDiagnosis": <integer 0-40>,
  "scoreDesign": <integer 0-30>,
  "scoreCommunication": <integer 0-20>,
  "scoreExecution": <integer 0-10>,
  "scoreTotal": <integer 0-100>,
  "feedback": {
    "diagnosis": "<specific feedback>",
    "design": "<specific feedback>",
    "communication": "<specific feedback>",
    "execution": "<specific feedback>"
  },
  "summary": "<2-3 sentence overall review>",
  "topStrength": "<the single best thing they did>",
  "topImprovement": "<the single most important thing to improve>"
}

scoreDiagnosis (0-40): Root cause understanding
scoreDesign (0-30): Solution robustness and trade-offs
scoreCommunication (0-20): PR description clarity
scoreExecution (0-10): Does it actually work?
scoreTotal must equal sum of four scores.`;

  const codebaseContext = `## Codebase: ${sub.ticket.codebase.name}
${sub.ticket.codebase.companyLore}

## Ticket
**Title:** ${sub.ticket.title}
**Difficulty:** ${sub.ticket.difficulty}
**Files Involved:** ${sub.ticket.filesInvolved.join(", ")}

## Ticket Description
${sub.ticket.description}

## Scoring Rubric
**Diagnosis criteria:** ${rubric.diagnosis}
**Design criteria:** ${rubric.design}
**Communication criteria:** ${rubric.communication}
**Execution criteria:** ${rubric.execution}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: codebaseContext, cache_control: { type: "ephemeral" } },
        { type: "text", text: `## PR Description\n${sub.prDescription}\n\n## PR Diff\n\`\`\`diff\n${prDiff}\n\`\`\`\n\nPlease score this pull request now. Return ONLY the JSON object.` },
      ],
    }],
  });

  const raw = response.content[0].text;
  const review = JSON.parse(stripFences(raw));
  review.scoreTotal = review.scoreDiagnosis + review.scoreDesign + review.scoreCommunication + review.scoreExecution;
  console.log("Score:", review.scoreTotal, "/ 100");

  // Save review
  await prisma.submission.update({
    where: { id: SUBMISSION_ID },
    data: {
      status: "REVIEWED",
      reviewedAt: new Date(),
      scoreTotal: review.scoreTotal,
      scoreDiagnosis: review.scoreDiagnosis,
      scoreDesign: review.scoreDesign,
      scoreCommunication: review.scoreCommunication,
      scoreExecution: review.scoreExecution,
      claudeReview: review,
    },
  });

  // Update user skill score
  const user = await prisma.user.findUnique({ where: { id: sub.userId } });
  const prev = user.skillScore ?? review.scoreTotal;
  await prisma.user.update({
    where: { id: sub.userId },
    data: { skillScore: Math.round(0.8 * prev + 0.2 * review.scoreTotal) },
  });

  // Generate follow-up questions
  const fuPrompt = `You are a senior engineering interviewer. A developer just submitted a pull request and received this score:

Ticket: ${sub.ticket.title}
Score: ${review.scoreTotal}/100
Diagnosis: ${review.scoreDiagnosis}/40, Design: ${review.scoreDesign}/30
Top strength: ${review.topStrength}
Top improvement: ${review.topImprovement}

PR diff (excerpt):
\`\`\`diff
${prDiff.slice(0, 3000)}
\`\`\`

Generate exactly 2 follow-up questions specific to their fix. Respond with ONLY valid JSON:
{
  "question1": "<question about root cause or system behaviour>",
  "question2": "<question about edge cases or tradeoffs>"
}`;

  const fuResp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: fuPrompt }],
  });

  const fu = JSON.parse(stripFences(fuResp.content[0].text));
  await prisma.followUpQuestion.create({
    data: { submissionId: SUBMISSION_ID, question1: fu.question1, question2: fu.question2 },
  });

  console.log("\nReview complete!");
  console.log("Summary:", review.summary);
  console.log("Q1:", fu.question1.slice(0, 80));
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1);
});
