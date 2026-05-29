import anthropic from "../lib/anthropic";
import octokit from "../lib/github";
import { ClaudeReviewResult, FollowUpQuestionsResult, FollowUpScoreResult } from "../types/index";
import { Ticket, Codebase } from "@prisma/client";

type TicketWithCodebase = Ticket & { codebase: Codebase };

/**
 * Fetches the unified diff for a pull request from GitHub.
 * Returns the raw diff text (limited to 12,000 characters to stay within
 * the context budget while preserving meaningful signal).
 */
export async function fetchPrDiff(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: "diff" },
  });

  const diff = response.data as unknown as string;
  const MAX_DIFF_CHARS = 12_000;

  if (diff.length > MAX_DIFF_CHARS) {
    return (
      diff.slice(0, MAX_DIFF_CHARS) +
      "\n\n[diff truncated — showing first 12,000 characters]"
    );
  }

  return diff;
}

/**
 * Sends a PR diff and description to Claude for structured scoring.
 *
 * Uses prompt caching on the codebase context (company lore + ticket rubric)
 * so repeated reviews against the same codebase hit the cache and reduce
 * latency and cost.
 *
 * Returns a strongly-typed ClaudeReviewResult.
 */
export async function reviewPullRequest(
  ticket: TicketWithCodebase,
  prDiff: string,
  prDescription: string
): Promise<ClaudeReviewResult> {
  const rubric = ticket.rubric as Record<string, string>;

  const systemPrompt = `You are a senior software engineer conducting structured code reviews for a developer training platform. Your job is to score a developer's pull request against a specific ticket.

You must respond with ONLY a valid JSON object — no markdown, no prose, no code fences. The JSON must conform exactly to this shape:
{
  "scoreDiagnosis": <integer 0-40>,
  "scoreDesign": <integer 0-30>,
  "scoreCommunication": <integer 0-20>,
  "scoreExecution": <integer 0-10>,
  "scoreTotal": <integer 0-100>,
  "feedback": {
    "diagnosis": "<specific feedback on root cause understanding>",
    "design": "<specific feedback on solution design and trade-offs>",
    "communication": "<specific feedback on explanation quality in the PR description>",
    "execution": "<specific feedback on whether the solution actually works>"
  },
  "summary": "<2-3 sentence overall review written as a senior engineer speaking directly to the developer>",
  "topStrength": "<the single best thing they did>",
  "topImprovement": "<the single most important thing to improve>"
}

Scoring dimensions:
- scoreDiagnosis (0-40): Did they identify the ROOT CAUSE, not just the symptom? Did they understand WHY the bug exists, not just WHAT it does? Full marks require demonstrating deep understanding of the system behaviour.
- scoreDesign (0-30): Did they consider trade-offs and edge cases? Is the solution robust, maintainable, and appropriately scoped? Does it account for concurrency, failure modes, and production realities?
- scoreCommunication (0-20): Can they explain their reasoning clearly in the PR description? Does it convey WHY they made each decision, not just what they changed?
- scoreExecution (0-10): Does the code change actually address the problem? Are there obvious bugs, missing error handling, or broken logic in the implementation itself?

scoreTotal must equal the sum of the four dimension scores.

Be direct and specific. Name the specific code, pattern, or reasoning that earned or lost points. Never be vague.`;

  const codebaseContext = `## Codebase: ${ticket.codebase.name}

${ticket.codebase.companyLore}

## Ticket
**Title:** ${ticket.title}
**Difficulty:** ${ticket.difficulty}
**Files Involved:** ${ticket.filesInvolved.join(", ")}
**Expected Completion Time:** ${ticket.expectedMinutes} minutes

## Ticket Description
${ticket.description}

## Scoring Rubric
**Diagnosis criteria:** ${rubric.diagnosis}
**Design criteria:** ${rubric.design}
**Communication criteria:** ${rubric.communication}
**Execution criteria:** ${rubric.execution}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {
            type: "text",
            text: codebaseContext,
            cache_control: { type: "ephemeral" },
          } as any,
          {
            type: "text",
            text: `## PR Description (written by the developer)
${prDescription || "(no description provided)"}

## PR Diff
\`\`\`diff
${prDiff}
\`\`\`

Please score this pull request now. Return ONLY the JSON object.`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];

  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  let parsed: ClaudeReviewResult;

  try {
    parsed = JSON.parse(content.text) as ClaudeReviewResult;
  } catch {
    throw new Error(
      `Claude returned non-JSON response: ${content.text.slice(0, 200)}`
    );
  }

  // Guard: recompute scoreTotal in case Claude drifts from the constraint
  parsed.scoreTotal =
    parsed.scoreDiagnosis +
    parsed.scoreDesign +
    parsed.scoreCommunication +
    parsed.scoreExecution;

  return parsed;
}

/**
 * Generates Q1 only — a single diff-specific question that names exact
 * variables, functions, or line decisions from the developer's actual change.
 * Cannot be answered generically without having read the specific code.
 */
export async function generateFirstQuestion(
  ticket: TicketWithCodebase,
  prDiff: string,
  review: ClaudeReviewResult
): Promise<{ question1: string }> {
  const prompt = `You are a senior engineering interviewer. A developer fixed a bug and you need to ask them ONE targeted follow-up question.

Ticket: ${ticket.title}
Score: ${review.scoreTotal}/100 — weakest dimension: ${review.scoreDiagnosis < 28 ? "Diagnosis" : review.scoreDesign < 20 ? "Design" : "Communication"}
Top improvement needed: ${review.topImprovement}

Their actual code change:
\`\`\`diff
${prDiff.slice(0, 3000)}
\`\`\`

Generate ONE question that:
- Names a SPECIFIC variable, function, method call, or line-level decision visible in the diff above
- Tests whether they understood WHY that specific change was necessary, not just what it does
- Cannot be answered correctly without having written and understood this specific fix
- Is NOT a generic question about the bug type, pattern, or concept

Bad example: "How does mutex locking prevent race conditions?"
Good example: "You added Lock() before calling ProcessInvoice() on line 34 — why there specifically, rather than at the start of the handler function?"

Respond with ONLY valid JSON:
{ "question1": "<your specific question referencing exact code from the diff>" }`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");

  try {
    const clean = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(clean) as { question1: string };
  } catch {
    throw new Error(`Claude returned non-JSON: ${content.text.slice(0, 200)}`);
  }
}

/**
 * Generates Q2 based on the developer's actual A1 answer.
 * Drills into a gap, assumption, or interesting point from their response.
 * Q2 cannot be pre-generated by AI because it doesn't exist until A1 is submitted.
 */
export async function generateQ2FromA1(
  ticket: TicketWithCodebase,
  prDiff: string,
  question1: string,
  answer1: string
): Promise<{ question2: string }> {
  const prompt = `You are a senior engineering interviewer conducting a technical debrief.

Ticket: ${ticket.title}

Their code change (diff):
\`\`\`diff
${prDiff.slice(0, 2000)}
\`\`\`

Q1 you asked: ${question1}

Their answer to Q1: ${answer1}

Now generate ONE follow-up question (Q2) that:
- Directly responds to something specific in their A1 — a gap, an assumption they made, an interesting point they raised, or something they glossed over
- References their actual words or reasoning from A1
- Tests deeper understanding: "You said X — what happens when Y?" or "You mentioned Z but didn't explain why — can you elaborate?"
- Cannot be generated without having read their specific answer

Do NOT ask a generic second question. Q2 must feel like a natural continuation of the conversation.

Respond with ONLY valid JSON:
{ "question2": "<your follow-up question based on their A1 answer>" }`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");

  try {
    const clean = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(clean) as { question2: string };
  } catch {
    throw new Error(`Claude returned non-JSON: ${content.text.slice(0, 200)}`);
  }
}

const DECLARATION_LABELS: Record<string, string> = {
  NO_AI_USED: "wrote their answers independently without AI assistance",
  AI_USED_FOR_PHRASING: "used AI only to help phrase their answers (not for the thinking)",
  AI_USED_FOR_UNDERSTANDING: "used AI to understand the concepts before answering",
  AI_USED_FOR_ANSWER: "used AI to generate their answers",
};

/**
 * Scores the developer's follow-up answers. Returns 0-20 bonus points.
 * Also assesses declaration authenticity for the employer summary.
 * The developer never sees declarationMismatch or employerSummary.
 */
export async function scoreFollowUpAnswers(
  ticket: TicketWithCodebase,
  question1: string,
  question2: string,
  answer1: string,
  answer2: string,
  aiDeclaration: string
): Promise<FollowUpScoreResult> {
  const declaredLabel = DECLARATION_LABELS[aiDeclaration] ?? "unknown AI usage";

  const prompt = `You are a senior engineering interviewer scoring follow-up answers after a code review. You also assess whether the developer's self-declared AI usage matches the writing patterns you observe.

Ticket: ${ticket.title}
Codebase: ${ticket.codebase.name}

Developer declared they: ${declaredLabel}

Q1: ${question1}
A1: ${answer1}

Q2: ${question2}
A2: ${answer2}

## Task 1 — Score the answers
Score each answer 0-10 based on:
- Specificity to THIS system and THIS fix (not textbook answers that would apply anywhere)
- Genuine personal understanding (first-person reasoning, uncertainty, tradeoffs)
- Engineering maturity (real-world thinking, edge cases, production awareness)

## Task 2 — Authenticity assessment (for employer only, not shown to developer)
Assess whether the answer patterns match the declared usage:
- Signals of AI-generated content: overly structured, uses generic engineering buzzwords, no personal voice, no hesitation, covers every angle perfectly, lacks grounding in their specific diff
- Signals of genuine independent thinking: personal phrasing, some uncertainty, specific references to their own code change, occasional imprecision, developer-voice reasoning

Set declarationMismatch to true ONLY if the developer declared NO_AI_USED or AI_USED_FOR_PHRASING but the answers strongly resemble AI-generated content. Do not flag for minor polish. High bar — require clear signal.

IMPORTANT RULE FOR AI_USED_FOR_PHRASING:
Developer declared they used AI only to polish their own writing. Their answers will naturally sound professional and well-structured. Do NOT flag mismatch based on writing quality alone.

Only flag declarationMismatch: true for AI_USED_FOR_PHRASING if BOTH of these are true:
1. Answers contain absolutely zero references to specific file names, line numbers, method names, or variable names from the actual PR diff
2. Answers read like a generic textbook explanation that could apply to any bug of this type anywhere — not grounded in THIS codebase or THIS fix

If answers sound polished BUT contain specific code references — declarationMismatch: false. This is exactly what honest AI phrasing looks like.
If answers contain zero specific references AND read like a textbook explanation — declarationMismatch: true. This suggests AI wrote the understanding, not just the phrasing.

Write employerSummary as 2-3 sentences describing what you observed: the declared level, what patterns you detected, and your confidence in the authenticity signal. This is for an employer reviewing the candidate — be factual, not accusatory.

## Task 3 — Developer feedback
Write 2 sentences of constructive feedback the developer will see. Focus on what they got right and what was shallow. Never mention AI usage detection, flagging, or authenticity.

Respond with ONLY valid JSON:
{
  "score1": <0-10>,
  "score2": <0-10>,
  "scoreBonus": <sum of score1 + score2>,
  "feedback": "<2 sentences for the developer — constructive, no mention of AI detection>",
  "declarationMismatch": <true|false>,
  "employerSummary": "<2-3 sentences for employer — factual pattern description>"
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 768,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");

  try {
    const clean = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const result = JSON.parse(clean) as FollowUpScoreResult;
    result.scoreBonus = result.score1 + result.score2;
    return result;
  } catch {
    throw new Error(`Claude returned non-JSON: ${content.text.slice(0, 200)}`);
  }
}
