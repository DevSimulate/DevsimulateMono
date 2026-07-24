/**
 * Every Anthropic call goes through here.
 *
 * During DevFest the queue crossed the account usage limit and question
 * generation simply died — candidates were left mid-assessment with no retry,
 * no fallback and no explanation. This wrapper is the fix: bounded retries with
 * backoff, a cheaper model as a last resort for questions, and loud failure for
 * anything that produces a score.
 */

import Anthropic from "@anthropic-ai/sdk";
import anthropic from "./anthropic";
import { FALLBACK_MODEL, ANTHROPIC_MAX_RETRIES } from "../config/scoring";

/** Status codes worth waiting out: rate limited, overloaded, transient 5xx. */
export const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 529]);

export type CallKind = "scoring" | "question";

export type ClaudeCallParams = Anthropic.MessageCreateParamsNonStreaming & {
  /**
   * "scoring" calls NEVER silently fall back to another model — a score must
   * always be attributable to the pinned model. "question" calls may.
   */
  kind: CallKind;
  /** Short name for logs, e.g. "generateFirstQuestion". */
  label: string;
};

export type ClaudeResponse = Anthropic.Message & { usedFallbackModel: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function statusOf(err: unknown): number | undefined {
  if (err instanceof Anthropic.APIError) return err.status;
  const s = (err as { status?: number } | null)?.status;
  return typeof s === "number" ? s : undefined;
}

/** Honours a server-supplied Retry-After (seconds or HTTP date) when present. */
export function retryAfterMs(err: unknown): number | undefined {
  const headers = (err as { headers?: Record<string, string> } | null)?.headers;
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const at = Date.parse(raw);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

/**
 * Exponential backoff with full jitter. Jitter matters here: a DevFest burst
 * puts many jobs into the same rate-limit window, and without it they would all
 * wake up together and re-trigger the same 429.
 */
export function backoffMs(attempt: number): number {
  const capped = Math.min(1000 * 2 ** attempt, 30_000);
  return Math.round(capped * (0.5 + Math.random() * 0.5));
}

async function attemptCall(
  params: Anthropic.MessageCreateParamsNonStreaming,
  label: string,
  maxRetries: number
): Promise<Anthropic.Message> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err) {
      lastErr = err;
      const status = statusOf(err);

      if (status === undefined || !RETRYABLE.has(status) || attempt === maxRetries) throw err;

      const wait = retryAfterMs(err) ?? backoffMs(attempt);
      console.warn(
        `[claude] ${label} got ${status} (attempt ${attempt + 1}/${maxRetries + 1}) — retrying in ${wait}ms`
      );
      await sleep(wait);
    }
  }

  throw lastErr;
}

/**
 * Calls Anthropic with retries. Returns the SDK message, plus a flag recording
 * whether the pinned model was substituted, so a fallback can never happen
 * invisibly.
 */
export async function claudeCall(args: ClaudeCallParams): Promise<ClaudeResponse> {
  const { kind, label, ...params } = args;

  try {
    const message = await attemptCall(params, label, ANTHROPIC_MAX_RETRIES);
    return Object.assign(message, { usedFallbackModel: false });
  } catch (err) {
    // Scoring fails loudly: BullMQ's own retry/backoff takes it from here, and
    // the job surfaces rather than producing an unattributable score.
    if (kind === "scoring") {
      console.error(
        `[claude] ${label} exhausted retries — failing the job rather than scoring with an unpinned model:`,
        err instanceof Error ? err.message : err
      );
      throw err;
    }

    // A question is worth degrading to keep the candidate moving.
    if (params.model === FALLBACK_MODEL) throw err; // already the fallback
    console.warn(`[claude] ${label} exhausted retries — retrying on fallback model ${FALLBACK_MODEL}`);

    const message = await attemptCall({ ...params, model: FALLBACK_MODEL }, `${label}/fallback`, 2);
    return Object.assign(message, { usedFallbackModel: true });
  }
}

/** Extracts the text of the first content block, or throws if it isn't text. */
export function textOf(response: Anthropic.Message): string {
  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response type from Claude");
  return content.text;
}
