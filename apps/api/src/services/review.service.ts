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

  const systemPrompt = `You are a senior staff engineer reviewing a candidate's pull request. You are NOT grading whether the code merely works. You are judging whether this person can be trusted to own outcomes in a real system: to diagnose the real problem, make sound decisions under constraints, verify their own work, and communicate their reasoning.

Assume the candidate may have used AI tools. That is allowed and expected. You are measuring their JUDGMENT and OWNERSHIP, not whether they typed the code themselves. A candidate who used AI but deeply understands, verifies, and can defend the result is strong. A candidate who accepted plausible-looking output without understanding it is weak — even if the code works.

You must respond with ONLY a valid JSON object — no markdown, no prose, no code fences. The JSON must conform exactly to this shape:
{
  "scoreDiagnosis": <integer 0-40>,
  "scoreDesign": <integer 0-30>,
  "scoreCommunication": <integer 0-20>,
  "scoreExecution": <integer 0-10>,
  "scoreTotal": <integer 0-100>,
  "feedback": {
    "diagnosis": "<specific feedback on whether they found the REAL problem vs the stated one>",
    "design": "<specific feedback on decision quality and acknowledged trade-offs>",
    "communication": "<specific feedback on verification and how legible their reasoning is>",
    "execution": "<specific feedback on whether the solution actually works>"
  },
  "summary": "<2-3 sentence overall review written as a senior staff engineer speaking directly to the candidate>",
  "topStrength": "<the single best thing they did>",
  "topImprovement": "<the single most important thing to improve>"
}

Scoring dimensions:
- scoreDiagnosis (0-40) — THE MOST IMPORTANT. Did they identify the REAL problem, not just the literal ask? Did they question the premise of the ticket, find root cause vs treating a symptom, and notice what the ticket did NOT say (missing context, hidden assumptions, edge conditions)? Did they investigate the existing system before acting? Penalize heavily if they solved the literal ask while missing the actual underlying problem — even if the code works.
- scoreDesign (0-30) — DECISION QUALITY under real constraints, not code elegance. Did they consider alternatives and choose one for defensible reasons? Did they acknowledge trade-offs — what they sacrificed and why? Did they respect the existing system's patterns and downstream effects? Reward explicit reasoning of the form "I chose X over Y because Z, at the cost of W." Penalize arbitrary choices with no justification and changes that ignore system-wide impact.
- scoreCommunication (0-20) — VERIFICATION & COMMUNICATION, the defining skill of the AI era. Can they tell whether their own (possibly AI-generated) solution is actually correct? Did they show skepticism toward plausible-but-unverified output rather than trusting it blindly? Can they explain HOW they know it works in production conditions? Reward candidates who interrogate their solution; penalize those who present working-looking code with no evidence they checked it.
- scoreExecution (0-10) — a correctness gate, not the main signal. Does the code run and solve the stated task, free of obvious defects? Do NOT over-reward clean or fast code. Execution is commoditized; judgment is not.

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
- Probes VERIFICATION and JUDGMENT: how do they know this fix is correct? What did they check, what did they NOT trust, what edge case or failure mode did they consider? Or why this decision over an alternative?
- Cannot be answered correctly without having written and verified this specific fix (a candidate who pasted a plausible solution without understanding it should not be able to answer)
- Is NOT a generic question about the bug type, pattern, or concept

Bad example: "How does mutex locking prevent race conditions?"
Good example: "You added Lock() before calling ProcessInvoice() on line 34 — how did you confirm that's the right scope for the lock, and what breaks if a second request arrives while it's held?"

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
- Directly responds to something specific in their A1 — a gap, an unverified claim, an assumption they made, or something they glossed over
- References their actual words or reasoning from A1
- Pressure-tests whether they actually understand and verified what they claimed: "You said X — how would you confirm that holds under Y?" or "You assumed Z — what evidence do you have, and what would you check before shipping?"
- Cannot be generated without having read their specific answer; a candidate who relayed an AI answer without understanding it should struggle here

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

/**
 * Reviews a system design document and scores it on architecture quality.
 * Maps to the same 4-dimension scoring schema as code review:
 *  scoreDiagnosis     → Requirements & Scope (0-40)
 *  scoreDesign        → Architecture Quality  (0-30)
 *  scoreCommunication → Communication         (0-20)
 *  scoreExecution     → Completeness          (0-10)
 */
export async function reviewSystemDesign(
  ticket: TicketWithCodebase,
  designDoc: string
): Promise<ClaudeReviewResult> {
  const rubric = ticket.rubric as Record<string, string>;

  const systemPrompt = `You are a senior staff engineer and system design interviewer. You are judging whether this person can be trusted to own outcomes: to scope the real problem, make defensible decisions under constraints, and reason about how they'd verify the design holds in production. Assume AI tools may have been used — that is allowed. You are measuring judgment and ownership, not whether they typed it themselves: a candidate who can defend and stress-test their design is strong; one who lists plausible components they can't justify is weak.

You must respond with ONLY a valid JSON object — no markdown, no prose, no code fences. The JSON must conform exactly to this shape:
{
  "scoreDiagnosis": <integer 0-40>,
  "scoreDesign": <integer 0-30>,
  "scoreCommunication": <integer 0-20>,
  "scoreExecution": <integer 0-10>,
  "scoreTotal": <integer 0-100>,
  "feedback": {
    "diagnosis": "<specific feedback on requirements coverage and problem scoping>",
    "design": "<specific feedback on architecture quality, scalability, and soundness>",
    "communication": "<specific feedback on how clearly trade-offs and decisions were explained>",
    "execution": "<specific feedback on completeness — did they cover all required components>"
  },
  "summary": "<2-3 sentence overall review written as a senior staff engineer speaking directly to the candidate>",
  "topStrength": "<the single best aspect of their design>",
  "topImprovement": "<the single most important gap to address>"
}

Scoring dimensions:
- scoreDiagnosis (0-40): Requirements & Scope — Did they identify functional requirements, non-functional requirements, and scale constraints? Did they clarify QPS, storage volume, latency targets, and key trade-off drivers?
- scoreDesign (0-30): Architecture Quality — Is the design sound, scalable, and appropriately complex for the stated scale? Does it handle failure modes, avoid single points of failure, and choose appropriate data stores and services?
- scoreCommunication (0-20): Communication & Trade-offs — Did they explain WHY they chose each component? Did they discuss alternatives and trade-offs? Did they structure the design clearly?
- scoreExecution (0-10): Completeness — Did they cover all required components at sufficient depth? Did they address the specific constraints in the problem?

scoreTotal must equal the sum of the four dimension scores.

Be direct and specific. Name the exact design decisions that earned or lost points. Never be vague.`;

  const codebaseContext = `## Problem
**Title:** ${ticket.title}
**Difficulty:** ${ticket.difficulty}
**Required Components:** ${ticket.filesInvolved.join(", ")}
**Expected Completion Time:** ${ticket.expectedMinutes} minutes

## Problem Statement
${ticket.description}

## Scoring Rubric
**Requirements & Scope (0-40):** ${rubric.diagnosis}
**Architecture Quality (0-30):** ${rubric.design}
**Communication & Trade-offs (0-20):** ${rubric.communication}
**Completeness (0-10):** ${rubric.execution}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: codebaseContext,
            cache_control: { type: "ephemeral" },
          } as any,
          {
            type: "text",
            text: `## Candidate's System Design Answer
${designDoc}

Please score this system design now. Return ONLY the JSON object.`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  let parsed: ClaudeReviewResult;
  try {
    parsed = JSON.parse(content.text) as ClaudeReviewResult;
  } catch {
    throw new Error(`Claude returned non-JSON response: ${content.text.slice(0, 200)}`);
  }

  parsed.scoreTotal =
    parsed.scoreDiagnosis + parsed.scoreDesign + parsed.scoreCommunication + parsed.scoreExecution;

  return parsed;
}

/**
 * Generates Q1 for a system design submission — asks about a specific architectural
 * decision in the candidate's design that reveals depth of understanding.
 */
export async function generateFirstQuestionFromDesign(
  ticket: TicketWithCodebase,
  designDoc: string,
  review: ClaudeReviewResult
): Promise<{ question1: string }> {
  const prompt = `You are a senior engineering interviewer. A candidate answered a system design question and you need to ask them ONE targeted follow-up question.

Problem: ${ticket.title}
Score: ${review.scoreTotal}/100 — weakest dimension: ${review.scoreDiagnosis < 28 ? "Requirements & Scope" : review.scoreDesign < 20 ? "Architecture Design" : "Communication"}
Top improvement needed: ${review.topImprovement}

Their system design answer:
${designDoc.slice(0, 3000)}

Generate ONE question that:
- References a SPECIFIC decision, component, or claim in their actual answer above
- Tests whether they truly understand the implications of that decision
- Cannot be answered correctly without having written and understood this specific design
- Is NOT a generic question about system design patterns

Bad example: "How does consistent hashing work?"
Good example: "You chose Redis for your hot URL cache — what happens to your cache when a Redis node fails, and how does your design handle that?"

Respond with ONLY valid JSON:
{ "question1": "<your specific question referencing a decision from their design>" }`;

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
 * Generates Q2 for a system design submission, based on the candidate's A1.
 */
export async function generateQ2FromA1ForDesign(
  ticket: TicketWithCodebase,
  designDoc: string,
  question1: string,
  answer1: string
): Promise<{ question2: string }> {
  const prompt = `You are a senior engineering interviewer conducting a system design debrief.

Problem: ${ticket.title}

Their original design (excerpt):
${designDoc.slice(0, 1500)}

Q1 you asked: ${question1}
Their answer to Q1: ${answer1}

Now generate ONE follow-up question (Q2) that:
- Directly responds to something specific in their A1 — a gap, an assumption, or an interesting point
- References their actual words or reasoning from A1
- Digs deeper: "You said X — what happens when Y?" or "You mentioned Z but didn't cover — can you elaborate?"
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

  const prompt = `You are a senior engineering interviewer scoring follow-up answers after a code review. AI use is allowed and expected — you are assessing whether the candidate genuinely understands and verified their own work, not whether they used AI.

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

## Task 2 — Verification Quality assessment (for employer only, not shown to developer)
AI use is allowed and expected. Do NOT judge whether AI was used. Judge whether this candidate genuinely INTERROGATED their solution and any AI output, or accepted it uncritically. This is the signal an employer most needs.
- Signals of genuine ownership: they can explain HOW they know the fix works, reference their specific diff, name what they checked or did NOT trust, acknowledge edge cases or limits, reason in their own voice with appropriate uncertainty.
- Signals of uncritical acceptance: confident but hollow — describes WHAT the code does but never HOW it was verified; generic textbook framing ungrounded in THIS fix; no checks, no edge cases, no doubt; collapses or goes vague when the follow-up probes deeper.

Set declarationMismatch to true ONLY when the answers show clear signs the candidate did NOT understand or verify their own solution — confident, generic, ungrounded in the actual diff, with zero evidence of checking. This is now a weak/uncritical signal flag, NOT an "AI was used" flag. Require a clear signal; do not flag for polish, brevity, or honest declared AI use.

Write employerSummary as 1-3 sentences: did this candidate genuinely interrogate their solution and any AI output, or accept it uncritically? Point to specifics from their answers. This is the Verification Quality note for an employer — be factual, not accusatory.

## Task 3 — Developer feedback
Write 2 sentences of constructive feedback the developer will see. Focus on what they got right and what was shallow. Never mention AI usage detection, flagging, or authenticity.

Respond with ONLY valid JSON:
{
  "score1": <0-10>,
  "score2": <0-10>,
  "scoreBonus": <sum of score1 + score2>,
  "feedback": "<2 sentences for the developer — constructive, no mention of AI detection>",
  "declarationMismatch": <true|false>,
  "employerSummary": "<1-3 sentence Verification Quality note for employer — did they interrogate their solution or accept it uncritically>"
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

/**
 * Generates ONE pointed question the candidate must answer ALOUD (transcribed),
 * derived from their actual diff so it can't be pre-scripted. Someone who
 * understands their fix answers it fluently; a conduit who relayed AI cannot.
 */
export async function generateVerbalQuestion(
  ticket: TicketWithCodebase,
  prDiff: string
): Promise<{ question: string }> {
  const prompt = `You are a senior engineering interviewer. The candidate will answer your question OUT LOUD on camera, in their own words, in 90 seconds — they cannot prepare or paste it.

Ticket: ${ticket.title}
Their actual code change:
\`\`\`diff
${prDiff.slice(0, 3000)}
\`\`\`

Generate ONE question that:
- Names a SPECIFIC decision, variable, or line from THEIR diff.
- Asks WHY they did it, or "what would break if…", or "what did you check" — never "what does it do".
- Someone who genuinely understands their fix can answer fluently in 1-2 sentences; someone who relayed an AI answer will be vague or contradict their written explanation.

Respond with ONLY valid JSON: { "question": "<your spoken-answer question referencing their exact code>" }`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");
  const clean = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(clean) as { question: string };
}

export interface VerbalScoreResult {
  score: number;       // 0-10 verbal understanding
  consistent: boolean; // does the spoken answer match the written answers + the code?
  note: string;        // 1-2 sentence employer-facing note
}

/**
 * Compares the candidate's SPOKEN answer (transcribed) to their WRITTEN follow-up
 * answers and their code. The signal: does their out-loud explanation genuinely
 * match what they wrote and did, or did they relay AI text they can't defend aloud.
 * Advisory in v1 — produces a verbal-understanding signal, does not move the score.
 */
export async function scoreVerbalAnswer(
  question: string,
  transcript: string,
  answer1: string,
  answer2: string,
  prDiff: string
): Promise<VerbalScoreResult> {
  const prompt = `Compare a candidate's SPOKEN answer (auto-transcribed — judge the CONTENT, ignore grammar/transcription errors) to their WRITTEN follow-up answers and their code. You are checking whether they genuinely understand their own fix or relayed AI output they can't defend out loud.

Question asked aloud: ${question}
Spoken answer (transcribed): ${transcript || "(no speech captured)"}

Their written answer 1: ${answer1}
Their written answer 2: ${answer2}

Their code change:
\`\`\`diff
${prDiff.slice(0, 2500)}
\`\`\`

Score 0-10:
- HIGH: the spoken explanation is specific to THIS fix, first-person, consistent with their written answers and the actual code, and fluent.
- LOW: vague, generic, contradicts their written answers or the code, or sounds read/scripted rather than understood.

Set "consistent" to false if the spoken answer contradicts the written answers or the actual fix, or if no real explanation was given.

Respond with ONLY valid JSON: { "score": <integer 0-10>, "consistent": <true|false>, "note": "<1-2 sentence employer note on verbal understanding>" }`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");
  const clean = content.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(clean) as VerbalScoreResult;
}
