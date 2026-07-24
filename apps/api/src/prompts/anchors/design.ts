import { DimensionCalibration } from "./types";

/**
 * Design (0-30) — decision quality under constraints, NOT code elegance.
 * Reward "I chose X over Y because Z, at the cost of W."
 */
export const DESIGN: DimensionCalibration = {
  key: "scoreDesign",
  label: "Design",
  max: 30,

  bands: [
    {
      band: "25-30",
      criteria:
        "Weighed real alternatives and chose one for stated reasons. Named what was sacrificed. Respected the existing system's patterns and reasoned about downstream effects of the change.",
    },
    {
      band: "18-24",
      criteria:
        "Defensible choice that fits the codebase, but alternatives are unmentioned or the trade-off is asserted without substance. Reasonable engineer, reasoning left implicit.",
    },
    {
      band: "10-17",
      criteria:
        "The change works but the approach is arbitrary — no justification offered, or it ignores system-wide impact and existing conventions.",
    },
    {
      band: "0-9",
      criteria:
        "No discernible reasoning, or the change actively fights the existing design and introduces problems elsewhere.",
    },
  ],

  // TODO(ossama): replace with real excerpts from the 27 DevFest submissions,
  // then set placeholder: false. Placeholder anchors are NOT sent to the model.
  anchors: [
    {
      band: "25-30",
      score: 27,
      excerpt:
        "TODO(ossama): paste a high-band 'Why this fix' excerpt — one naming a rejected alternative and the cost accepted.",
      why: "TODO(ossama): one line on what makes this top-band decision quality.",
      placeholder: true,
    },
    {
      band: "18-24",
      score: 21,
      excerpt:
        "TODO(ossama): paste a mid-band excerpt — sound choice, no alternatives considered.",
      why: "TODO(ossama): one line on the missing trade-off reasoning.",
      placeholder: true,
    },
    {
      band: "10-17",
      score: 13,
      excerpt:
        "TODO(ossama): paste a low-band excerpt — a fix with no stated rationale, or one that ignores downstream effects.",
      why: "TODO(ossama): one line on why this reads as arbitrary.",
      placeholder: true,
    },
  ],
};
