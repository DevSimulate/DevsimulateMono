import { DimensionCalibration } from "./types";

/**
 * Diagnosis (0-40) — the heaviest dimension. Did they find the REAL problem?
 *
 * Edit the bands and anchors here; the scoring worker picks them up with no
 * code change. See ./index.ts for how they reach the prompt.
 */
export const DIAGNOSIS: DimensionCalibration = {
  key: "scoreDiagnosis",
  label: "Diagnosis",
  max: 40,

  bands: [
    {
      band: "34-40",
      criteria:
        "Reproduced the failure, isolated the TRUE root cause (not the first plausible one), and verified the diagnosis before changing anything. Noticed what the ticket did not say — hidden assumptions, missing context, edge conditions.",
    },
    {
      band: "25-33",
      criteria:
        "Identified the correct root cause, but investigation is asserted rather than shown, or verification of the diagnosis is thin. Understands the mechanism; did not prove it.",
    },
    {
      band: "15-24",
      criteria:
        "Fixed the symptom rather than the cause, or landed on a partially correct cause. The change may work while leaving the underlying defect in place.",
    },
    {
      band: "0-14",
      criteria:
        "No evidence of investigation. Restates the ticket, or changes code until the visible symptom disappears with no account of why it occurred.",
    },
  ],

  // TODO(ossama): replace with real excerpts from the 27 DevFest submissions,
  // then set placeholder: false. Placeholder anchors are NOT sent to the model.
  anchors: [
    {
      band: "34-40",
      score: 36,
      excerpt:
        "TODO(ossama): paste a high-band Root cause + Investigation excerpt here — one where the candidate reproduced the bug, named the exact mechanism, and said how they confirmed it.",
      why: "TODO(ossama): one line on what pushed this into the top band.",
      placeholder: true,
    },
    {
      band: "25-33",
      score: 29,
      excerpt:
        "TODO(ossama): paste a mid-band excerpt — correct cause identified, but no evidence they confirmed it before fixing.",
      why: "TODO(ossama): one line on what held this back from the top band.",
      placeholder: true,
    },
    {
      band: "15-24",
      score: 19,
      excerpt:
        "TODO(ossama): paste a low-band excerpt — a symptom-level fix described confidently.",
      why: "TODO(ossama): one line on why this is symptom-level, not root cause.",
      placeholder: true,
    },
  ],
};
