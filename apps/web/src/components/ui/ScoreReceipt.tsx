"use client";

import { cn } from "@/lib/cn";
import { TierBadge, tierForScore } from "./Badge";

export interface ScoreReceiptLineItem {
  label: string;
  weight: number;
  score: number;
}

export interface ScoreReceiptDeduction {
  label: string;
  amount: number;
  note?: string;
}

export interface ScoreReceiptData {
  prBaseScore: number;
  lineItems: ScoreReceiptLineItem[];
  deductions: ScoreReceiptDeduction[];
  finalScore: number;
}

export type ScoreReceiptVariant = "full" | "compact" | "public";

export interface ScoreReceiptProps {
  data: ScoreReceiptData;
  variant?: ScoreReceiptVariant;
  /** Plays the row-by-row print-in animation once. Off by default for "compact" (table rows shouldn't stagger-animate on every scroll). */
  animate?: boolean;
  className?: string;
}

/**
 * The signature element of the product: every score renders as this
 * itemised, mono-typed receipt — base score, each deduction as its own
 * signed row with its reason, final score in large display type. This is
 * what "every point is traceable" looks like, not just what it says.
 *
 * One component, three variants:
 *   full    — result pages. Full itemisation + print-in animation.
 *   compact — tables/rows. One condensed line: base → gap → final.
 *   public  — certificate/verification page. Tier only; raw dimension
 *             numbers are never shown to a third party, only to the
 *             candidate and the hiring employer.
 */
export function ScoreReceipt({ data, variant = "full", animate, className }: ScoreReceiptProps): React.ReactElement {
  if (variant === "compact") return <CompactReceipt data={data} className={className} />;
  if (variant === "public") return <PublicReceipt data={data} className={className} />;
  return <FullReceipt data={data} animate={animate ?? true} className={className} />;
}

function FullReceipt({
  data,
  animate,
  className,
}: {
  data: ScoreReceiptData;
  animate: boolean;
  className?: string;
}): React.ReactElement {
  const rows = [
    ...data.lineItems.map((l, i) => ({ kind: "dimension" as const, ...l, order: i })),
    ...data.deductions.map((d, i) => ({ kind: "deduction" as const, ...d, order: data.lineItems.length + i })),
  ];

  return (
    <div className={cn("font-mono text-sm bg-surface border border-hairline rounded p-5", className)}>
      <div
        className={cn("flex justify-between text-ink font-semibold", animate && "receipt-row")}
        style={animate ? { animationDelay: "0ms" } : undefined}
      >
        <span>PR REVIEW (base)</span>
        <span>{data.prBaseScore}</span>
      </div>

      <div className="mt-2 flex flex-col">
        {rows.map((row, i) => {
          const delay = `${(i + 1) * 60}ms`;
          if (row.kind === "dimension") {
            const isLast = row.order === data.lineItems.length - 1;
            return (
              <div
                key={`dim-${row.label}`}
                className={cn("flex justify-between text-muted pl-2", animate && "receipt-row")}
                style={animate ? { animationDelay: delay } : undefined}
              >
                <span>{isLast ? "└─ " : "├─ "}{row.label}</span>
                <span>
                  {row.score}/{row.weight}
                </span>
              </div>
            );
          }
          return (
            <div key={`ded-${row.label}`} className={cn(animate && "receipt-row")} style={animate ? { animationDelay: delay } : undefined}>
              <div className="flex justify-between text-red">
                <span>{row.label}</span>
                <span>−{row.amount}</span>
              </div>
              {row.note && <p className="font-sans text-xs text-muted mt-0.5 mb-1 normal-case leading-relaxed">{row.note}</p>}
            </div>
          );
        })}
      </div>

      <div className="my-3 border-t border-hairline" />

      <div
        className={cn("flex justify-between items-baseline", animate && "receipt-row")}
        style={animate ? { animationDelay: `${(rows.length + 1) * 60}ms` } : undefined}
      >
        <span className="font-display font-bold text-base tracking-wide">FINAL</span>
        <span className="font-display font-bold text-3xl text-ink">{data.finalScore}</span>
      </div>
    </div>
  );
}

function CompactReceipt({ data, className }: { data: ScoreReceiptData; className?: string }): React.ReactElement {
  const gap = data.prBaseScore - data.finalScore;
  return (
    <div className={cn("font-mono text-sm flex items-center gap-2", className)}>
      <span className="text-muted">{data.prBaseScore}</span>
      {gap > 0 && (
        <>
          <span className="text-muted">→</span>
          <span
            className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
            style={{ background: "var(--signal-amber-weak)", color: "var(--signal-amber)" }}
            title="Gap between PR review and final score — strong code, weaker defence. Review the evidence tabs."
          >
            −{gap}
          </span>
        </>
      )}
      <span className="text-muted">→</span>
      <span className="font-display font-bold text-ink text-base">{data.finalScore}</span>
    </div>
  );
}

function PublicReceipt({ data, className }: { data: ScoreReceiptData; className?: string }): React.ReactElement {
  const tier = tierForScore(data.finalScore);
  return (
    <div className={cn("bg-surface border border-hairline rounded p-5 text-center", className)}>
      <TierBadge tier={tier} className="mb-3" />
      {data.deductions.length > 0 && (
        <div className="font-mono text-xs text-muted mt-2">
          <p className="uppercase tracking-wide mb-1.5">Verification notes</p>
          <ul className="flex flex-col gap-1">
            {data.deductions.map((d) => (
              <li key={d.label}>{d.label}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="font-sans text-xs text-muted mt-3 normal-case">Full itemised breakdown available to the candidate.</p>
    </div>
  );
}
