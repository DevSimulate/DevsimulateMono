/**
 * How much a weak spoken defence costs.
 *
 * The single largest automated swing in the product, so it lives in one place
 * and is tested directly — it used to be inline in the route with the test
 * mirroring the arithmetic, which is how the two quietly disagree.
 *
 * REBANDED after the first pilot. The old table was `<=3 -> -20`, `4..6 ->
 * -12/-8/-4`, and it was too blunt on two counts:
 *
 *  - The bottom was a cliff, not a slope: 0, 1, 2 and 3 all cost the same 20,
 *    so "said nothing" and "explained it adequately but without depth" were
 *    priced identically, and one point of grader judgement between a 3 and a 4
 *    swung 8 marks.
 *  - -20 out of 100 decides the hire on its own. One candidate went 69 -> 49,
 *    crossing from Yes to No, on a verdict that had misread his answer.
 *
 * Half of a competent cohort (written scores 63-75) took a deduction, four at
 * the maximum. When that many capable people "cannot defend their work", the
 * likelier explanation is grader calibration than mass bluffing — so the
 * penalty is now proportionate to how much doubt the defence actually raises.
 */

export interface VerbalVerdict {
  /** 0-10 from the judge. */
  score: number;
  /** False when the spoken answer contradicts the written work or the code. */
  consistent: boolean;
  /** True when no usable verdict came back at all — never penalised. */
  unscorable?: boolean;
}

/**
 * score -> penalty, for a consistent answer. Anything >= 7 costs nothing.
 *
 * Capped at 8 so a defence can move a candidate one verdict band at most,
 * never two. Under the old -20 a single verdict took someone from Yes (65+)
 * straight to No (<50) with no human in the loop — too much authority for a
 * judge we have watched misread an answer. At -8 the signal still shows up in
 * the score and the Gap column, but the decision stays with the reviewer.
 */
const LADDER: Record<number, number> = { 0: 8, 1: 8, 2: 8, 3: 8, 4: 5, 5: 3, 6: 1 };

export function verbalPenaltyFor(v: VerbalVerdict): number {
  // No verdict means no evidence. Charging for the judge's failure is the one
  // deduction we could never defend to a candidate.
  if (v.unscorable) return 0;

  // A contradiction is the strongest signal the defence produces — the spoken
  // answer disagrees with what they wrote or shipped — so it takes the top of
  // the band regardless of the numeric score.
  if (!v.consistent) return LADDER[0];

  const s = Math.max(0, Math.min(10, Math.round(v.score)));
  return LADDER[s] ?? 0;
}
