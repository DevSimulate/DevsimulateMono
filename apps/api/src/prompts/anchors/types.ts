/**
 * Shared shape for scoring calibration data.
 *
 * The rubric tells the model WHAT to judge; anchors tell it WHERE the line
 * sits. Without them the standard is silently reinvented on every call, which
 * is the main remaining source of score drift once temperature is pinned to 0.
 */

/** A band of the 0-N range with plain-language criteria for landing in it. */
export interface BandDescriptor {
  /** Inclusive range, e.g. "34-40". */
  band: string;
  /** What a submission must demonstrate to score in this band. */
  criteria: string;
}

/** A worked example: a real excerpt, the score it earned, and why. */
export interface AnchorExample {
  /** Which band this example sits in, e.g. "34-40". */
  band: string;
  /** Short excerpt from a real candidate write-up or diff summary. */
  excerpt: string;
  /** The score this excerpt actually earned on this dimension. */
  score: number;
  /** One line on why it earned that score. */
  why: string;
  /**
   * Placeholder anchors are NEVER injected into a live scoring prompt.
   *
   * Shipping invented excerpts would calibrate the model against fiction and
   * quietly move real candidates' scores. Set this to false (or delete the
   * field) only once `excerpt` holds a genuine excerpt.
   */
  placeholder?: boolean;
}

/** Everything needed to calibrate one scoring dimension. */
export interface DimensionCalibration {
  /** Dimension key as it appears in the JSON contract, e.g. "scoreDiagnosis". */
  key: string;
  /** Human label used in the prompt heading. */
  label: string;
  /** Maximum points for this dimension. */
  max: number;
  bands: BandDescriptor[];
  anchors: AnchorExample[];
}
