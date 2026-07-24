/**
 * How much to trust a Whisper transcript.
 *
 * The verbal step can cost 20 points, and a garbled transcript is scored as a
 * weak answer even when the candidate spoke perfectly well — a bad mic, a noisy
 * room or an unfamiliar accent becomes a score deduction. That is an AUDIO
 * failure being charged to the candidate, and it lands hardest on exactly the
 * people least likely to have a quiet room and a good headset.
 *
 * Below the threshold we do not score at all: we store the transcript, flag it
 * for a human, and apply NO penalty. Being unscored is never worse for the
 * candidate than being wrongly scored.
 *
 * Pure module — no network, no Prisma — so the arithmetic is unit-testable.
 */

/** Confidence below this routes to human review instead of scoring. */
export const MIN_CONFIDENCE = Number(process.env.WHISPER_MIN_CONFIDENCE ?? 0.45);

/** One segment of Whisper's verbose_json response (fields we care about). */
export interface WhisperSegment {
  avg_logprob?: number;
  no_speech_prob?: number;
  start?: number;
  end?: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Confidence from Whisper's own per-segment statistics — the real signal when
 * verbose_json is available.
 *
 * `avg_logprob` is a mean log-probability per token, so exp() turns it back
 * into a rough per-token probability (-0.3 → 0.74, -1.0 → 0.37). It is scaled
 * by (1 - no_speech_prob) so segments Whisper thinks are silence or noise drag
 * confidence down. Segments are weighted by duration: a 15-second confident
 * stretch should count for more than a 0.2-second filler.
 */
export function confidenceFromSegments(segments: WhisperSegment[]): number | null {
  const usable = segments.filter((s) => typeof s.avg_logprob === "number");
  if (usable.length === 0) return null;

  let weighted = 0;
  let totalWeight = 0;

  for (const s of usable) {
    const duration = Math.max(0.1, (s.end ?? 0) - (s.start ?? 0));
    const tokenProb = Math.exp(s.avg_logprob as number);
    const speech = 1 - clamp01(s.no_speech_prob ?? 0);
    weighted += clamp01(tokenProb * speech) * duration;
    totalWeight += duration;
  }

  return totalWeight === 0 ? null : clamp01(weighted / totalWeight);
}

/** Words per second either side of this range don't look like natural speech. */
const MIN_WPS = 0.5;
const MAX_WPS = 6;

/**
 * Fallback confidence when segment stats aren't available (older API shape, or
 * a transcript that arrived from the browser's speech recognition).
 *
 * Two cheap signals:
 *  - what fraction of tokens look like real words rather than fragments and
 *    stray punctuation, which is what heavy noise produces;
 *  - whether the speaking rate is physically plausible. A 90-second recording
 *    that yields four words means the mic barely caught anything.
 *
 * Deliberately generous: this decides whether to SKIP scoring, and skipping a
 * good answer wastes a reviewer's time, while scoring a garbled one costs the
 * candidate 20 points.
 */
export function proxyConfidence(transcript: string, durationSeconds?: number): number {
  const tokens = transcript.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  const wordLike = tokens.filter((t) => /^[a-z][a-z'’-]*[.,!?;:]?$/i.test(t)).length;
  const wordRatio = wordLike / tokens.length;

  let rateFactor = 1;
  if (durationSeconds && durationSeconds > 1) {
    const wps = tokens.length / durationSeconds;
    if (wps < MIN_WPS) rateFactor = clamp01(wps / MIN_WPS);
    else if (wps > MAX_WPS) rateFactor = clamp01(MAX_WPS / wps);
  }

  return clamp01(wordRatio * rateFactor);
}

/**
 * Should this transcript be scored?
 *
 * A null confidence means we have no signal (browser speech recognition, or a
 * transcript the candidate reviewed and confirmed themselves) — that is NOT
 * evidence of bad audio, so it scores normally.
 *
 * Note this is purely about AUDIO quality. A clear, confident "I don't know"
 * has high confidence and is still scored as the failing answer it is.
 */
export function isLowConfidence(
  confidence: number | null | undefined,
  threshold: number = MIN_CONFIDENCE
): boolean {
  return typeof confidence === "number" && confidence < threshold;
}
