/**
 * Keystroke-cadence summary for a typed defence answer. The client records
 * keydown timestamps only (no content beyond what's in the answer box); the
 * server derives a small, human-readable summary. This is an ADVISORY signal
 * for the employer — a 400-word answer arriving in three bursts with near-zero
 * inter-key variance reads as machine-generated — and never affects scoring.
 */

/** A pause longer than this (ms) separates one typing "burst" from the next. */
const BURST_GAP_MS = 2000;

export interface CadenceSummary {
  charsPerMin: number;
  longestPauseMs: number;
  burstCount: number;
  /** Total keystrokes observed — context for the numbers above. */
  keystrokes: number;
}

/**
 * @param timestamps keydown times in ms (epoch or performance.now — only deltas matter), any order
 * @param charCount  final length of the typed answer
 */
export function summarizeCadence(timestamps: number[], charCount: number): CadenceSummary {
  const ts = [...timestamps].filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  if (ts.length < 2) {
    return { charsPerMin: 0, longestPauseMs: 0, burstCount: ts.length, keystrokes: ts.length };
  }

  let longestPauseMs = 0;
  let burstCount = 1; // the first keystroke opens the first burst
  for (let i = 1; i < ts.length; i++) {
    const gap = ts[i] - ts[i - 1];
    if (gap > longestPauseMs) longestPauseMs = gap;
    if (gap > BURST_GAP_MS) burstCount++;
  }

  const spanMinutes = (ts[ts.length - 1] - ts[0]) / 60000;
  const charsPerMin = spanMinutes > 0 ? Math.round(charCount / spanMinutes) : 0;

  return { charsPerMin, longestPauseMs: Math.round(longestPauseMs), burstCount, keystrokes: ts.length };
}
