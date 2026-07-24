import { DimensionCalibration } from "./types";

/**
 * Communication (0-20) — VERIFICATION, the defining skill of the AI era.
 * Can they tell whether their own (possibly AI-generated) solution is correct?
 *
 * Judge specificity, not length. A tight, concrete answer must score at least
 * as well as a long one.
 */
export const COMMUNICATION: DimensionCalibration = {
  key: "scoreCommunication",
  label: "Communication",
  max: 20,

  bands: [
    {
      band: "17-20",
      criteria:
        "States HOW they know it works: specific checks run, edge cases considered, and what they explicitly did NOT trust. Shows appropriate uncertainty about what remains unproven.",
    },
    {
      band: "12-16",
      criteria:
        "Verification is claimed but not evidenced — 'I tested it' with no account of what was tested or what the test would have caught.",
    },
    {
      band: "6-11",
      criteria:
        "Describes WHAT the code does rather than how it was checked. Reasoning is legible but contains no verification signal.",
    },
    {
      band: "0-5",
      criteria:
        "Confident assertion with no verification at all, or an explanation so generic it would apply to any codebase.",
    },
  ],

  // TODO(ossama): replace with real excerpts from the 27 DevFest submissions,
  // then set placeholder: false. Placeholder anchors are NOT sent to the model.
  anchors: [
    {
      band: "17-20",
      score: 18,
      excerpt:
        "TODO(ossama): paste a high-band 'How I verified it' excerpt — specific checks, a named edge case, and something they did not trust.",
      why: "TODO(ossama): one line on what makes this genuine verification.",
      placeholder: true,
    },
    {
      band: "12-16",
      score: 14,
      excerpt:
        "TODO(ossama): paste a mid-band excerpt — testing claimed but unevidenced.",
      why: "TODO(ossama): one line on the gap between claim and evidence.",
      placeholder: true,
    },
    {
      band: "0-5",
      score: 4,
      excerpt:
        "TODO(ossama): paste a low-band excerpt — confident, generic, no evidence of checking.",
      why: "TODO(ossama): one line on why confidence without evidence scores low.",
      placeholder: true,
    },
  ],
};
