"use client";

import { cn } from "@/lib/cn";

export interface NarrativeStep {
  label: string;
  /** Seconds elapsed before this step is considered done — heuristic pacing of the real pipeline, not a fabricated one. */
  doneAfter: number;
}

/**
 * Replaces a bare spinner with a live progress narrative in mono — reads
 * like an instrument working, not a black box. Steps reflect the ACTUAL
 * pipeline (diff fetch → 3 independent scoring passes → question
 * generation) with heuristic timing, since the SSE signal itself is only
 * binary (reviewed/failed) — this is honest pacing of real steps, not
 * invented ones.
 */
export function ProgressNarrative({ steps, elapsedSeconds }: { steps: NarrativeStep[]; elapsedSeconds: number }): React.ReactElement {
  return (
    <div className="font-mono text-sm text-left flex flex-col gap-2 max-w-xs mx-auto">
      {steps.map((step, i) => {
        const done = elapsedSeconds >= step.doneAfter;
        const isCurrent = !done && (i === 0 || elapsedSeconds >= steps[i - 1].doneAfter);
        return (
          <div key={step.label} className={cn("flex items-center gap-2", done ? "text-emerald" : isCurrent ? "text-ink" : "text-muted/50")}>
            <span className="w-4 shrink-0 text-center">{done ? "✓" : isCurrent ? "⋯" : "·"}</span>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
