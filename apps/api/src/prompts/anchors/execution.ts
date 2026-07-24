import { DimensionCalibration } from "./types";

/**
 * Execution (0-10) — a correctness GATE, not the main signal.
 *
 * Deliberately the smallest dimension. Do not let clean formatting, speed or
 * style earn points here; execution is commoditized, judgment is not. Cosmetic
 * hygiene is worth at most 1-2 points and must not bleed into other dimensions.
 */
export const EXECUTION: DimensionCalibration = {
  key: "scoreExecution",
  label: "Execution",
  max: 10,

  bands: [
    {
      band: "9-10",
      criteria:
        "The change runs and solves the stated task with no obvious defects. Nothing more is required for full marks — elegance earns nothing extra.",
    },
    {
      band: "6-8",
      criteria:
        "Solves the task but carries a minor defect, an unhandled edge condition, or leftover debris that a reviewer would ask to change.",
    },
    {
      band: "3-5",
      criteria:
        "Partially works: handles the happy path but breaks a normal case, or addresses only part of the stated task.",
    },
    {
      band: "0-2",
      criteria:
        "Does not run, does not address the task, or the diff contains no reviewable source change.",
    },
  ],

  // TODO(ossama): replace with real excerpts from the 27 DevFest submissions,
  // then set placeholder: false. Placeholder anchors are NOT sent to the model.
  anchors: [
    {
      band: "9-10",
      score: 10,
      excerpt:
        "TODO(ossama): paste a high-band diff summary — a minimal correct change that fully solves the ticket.",
      why: "TODO(ossama): one line — correct and complete, nothing more needed.",
      placeholder: true,
    },
    {
      band: "6-8",
      score: 7,
      excerpt:
        "TODO(ossama): paste a mid-band diff summary — correct fix with a minor unhandled edge.",
      why: "TODO(ossama): one line on the specific defect.",
      placeholder: true,
    },
    {
      band: "0-2",
      score: 1,
      excerpt:
        "TODO(ossama): paste a low-band diff summary — does not address the ticket, or no reviewable source change.",
      why: "TODO(ossama): one line on why this fails the correctness gate.",
      placeholder: true,
    },
  ],
};
