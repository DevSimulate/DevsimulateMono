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
 * Generates 2 follow-up questions tailored to the developer's specific fix.
 * Questions test whether they truly understood the root cause — not just fixed the symptom.
 */
export async function generateFollowUpQuestions(
  ticket: TicketWithCodebase,
  prDiff: string,
  review: ClaudeReviewResult
): Promise<FollowUpQuestionsResult> {
  const prompt = `You are a senior engineering interviewer. A developer just submitted a pull request fixing a bug and received this score:

Ticket: ${ticket.title}
Score: ${review.scoreTotal}/100
Diagnosis score: ${review.scoreDiagnosis}/40
Design score: ${review.scoreDesign}/30
Top strength: ${review.topStrength}
Top improvement: ${review.topImprovement}

Their actual code change (diff):
\`\`\`diff
${prDiff.slice(0, 3000)}
\`\`\`

Generate exactly 2 follow-up questions that:
1. Are specific to THEIR fix — not generic questions about the bug type
2. Test whether they truly understood the system, not just the syntax they changed
3. Cannot be answered by re-feeding the codebase to AI without already understanding it
4. Focus on their weakest dimension (score: ${review.scoreDiagnosis < 28 ? "Diagnosis" : review.scoreDesign < 20 ? "Design" : "Communication"})

Respond with ONLY valid JSON:
{
  "question1": "<specific question about their fix>",
  "question2": "<specific question about edge cases or tradeoffs>"
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");

  try {
    const clean = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(clean) as FollowUpQuestionsResult;
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
