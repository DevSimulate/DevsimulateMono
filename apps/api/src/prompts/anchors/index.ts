/**
 * Renders scoring calibration (band descriptors + worked anchor examples) into
 * a prompt block.
 *
 * Two-part design, on purpose:
 *
 *  - BAND DESCRIPTORS are drafted from the existing rubric intent and go live
 *    immediately. They cost nothing to be wrong-ish and they remove most of the
 *    "where exactly is the line" ambiguity.
 *
 *  - ANCHOR EXAMPLES only reach the model once they hold REAL excerpts. Every
 *    anchor ships with `placeholder: true` and is filtered out here. Injecting
 *    invented excerpts would calibrate scoring against fiction and move real
 *    candidates' scores, which is worse than having no anchors at all.
 *
 * Editing anchors requires no worker changes — edit ./diagnosis.ts et al.
 *
 * NOTE: these anchors are written for CODE review. The system-design reviewer
 * reuses the same four score fields but with different semantics (Requirements
 * & Scope / Architecture Quality / Trade-offs / Completeness), so it gets no
 * calibration block until a separate design-specific anchor set exists.
 * TODO(ossama): add src/prompts/anchors/design-review/ for the SD path.
 */

import { DimensionCalibration } from "./types";
import { DIAGNOSIS } from "./diagnosis";
import { DESIGN } from "./design";
import { COMMUNICATION } from "./communication";
import { EXECUTION } from "./execution";

export * from "./types";
export { DIAGNOSIS, DESIGN, COMMUNICATION, EXECUTION };

/** Ordered by weight — heaviest dimension first, matching the rubric. */
export const CALIBRATION: DimensionCalibration[] = [DIAGNOSIS, DESIGN, COMMUNICATION, EXECUTION];

/** Anchors that hold real content and are therefore safe to send to the model. */
export function liveAnchors(dim: DimensionCalibration) {
  return dim.anchors.filter((a) => a.placeholder !== true);
}

/** True once at least one real anchor exists anywhere — used for RUBRIC_VERSION. */
export function hasLiveAnchors(): boolean {
  return CALIBRATION.some((d) => liveAnchors(d).length > 0);
}

function renderDimension(dim: DimensionCalibration): string {
  const bands = dim.bands.map((b) => `  ${b.band} — ${b.criteria}`).join("\n");

  const anchors = liveAnchors(dim);
  const anchorBlock = anchors.length
    ? "\n  Worked examples:\n" +
      anchors
        .map(
          (a) =>
            `  · scored ${a.score}/${dim.max} (band ${a.band})\n` +
            `    excerpt: "${a.excerpt.replace(/\s+/g, " ").trim()}"\n` +
            `    why: ${a.why}`
        )
        .join("\n")
    : "";

  return `${dim.label} (0-${dim.max}) — ${dim.key}\n${bands}${anchorBlock}`;
}

/**
 * The full calibration block appended to the code-review system prompt.
 * Returns "" if there is nothing to say, so the prompt is never padded with an
 * empty heading.
 */
export function calibrationBlock(): string {
  const body = CALIBRATION.map(renderDimension).join("\n\n");
  if (!body.trim()) return "";

  return `CALIBRATION EXAMPLES — score consistently with these.

These bands define where each score sits. Two submissions of equal quality must
receive the same score, whoever submitted them and whenever they were assessed.
Place the submission in a band FIRST, then pick a point within it. Do not drift
above or below a band because a submission is long, short, polished or terse.

${body}`;
}

let logged = false;

/**
 * Logs the composed calibration block once per process outside production, so
 * the live prompt can be eyeballed without instrumenting the worker.
 */
export function logCalibrationBlockOnce(): void {
  if (logged || process.env.NODE_ENV === "production") return;
  logged = true;
  console.log(
    `[anchors] calibration block in use (${CALIBRATION.reduce((n, d) => n + liveAnchors(d).length, 0)} live anchors, ` +
      `${CALIBRATION.reduce((n, d) => n + d.anchors.length, 0)} total):\n${calibrationBlock()}`
  );
}
