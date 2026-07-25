"use client";

import { cn } from "@/lib/cn";

export interface StageTrackerProps {
  labels: string[];
  currentIndex: number;
  /** Formatted mono string, e.g. "12:04". Omit when no timer is active for the current stage. */
  timeRemaining?: string;
  /** true in the final ~2 minutes — turns the timer amber, never red/flashing. */
  timeUrgent?: boolean;
}

/**
 * Persistent slim top rail — always shows where the candidate is, what's
 * next, and how long is left. Never surprises them. Timers are mono, calm
 * until the final stretch (amber), never a red flash.
 */
export function StageTracker({ labels, currentIndex, timeRemaining, timeUrgent }: StageTrackerProps): React.ReactElement {
  return (
    <div className="border-b border-hairline bg-surface px-4 py-2.5 sm:px-6">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <ol className="flex items-center flex-1 min-w-0">
          {labels.map((label, i) => (
            <li key={label} className="flex items-center flex-1 last:flex-none min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold shrink-0",
                    i < currentIndex ? "bg-emerald text-white" : i === currentIndex ? "bg-ink text-white" : "bg-paper text-muted border border-hairline"
                  )}
                >
                  {i < currentIndex ? "✓" : i + 1}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block whitespace-nowrap",
                    i === currentIndex ? "text-ink" : i < currentIndex ? "text-muted" : "text-muted/70"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < labels.length - 1 && (
                <div className={cn("flex-1 h-px mx-2", i < currentIndex ? "bg-emerald" : "bg-hairline")} />
              )}
            </li>
          ))}
        </ol>
        {timeRemaining && (
          <span className={cn("font-mono text-sm font-semibold tabular-nums shrink-0", timeUrgent ? "text-amber" : "text-muted")}>
            {timeRemaining}
          </span>
        )}
      </div>
    </div>
  );
}
