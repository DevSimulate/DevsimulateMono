import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "good" | "warn" | "bad";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-paper text-muted border-hairline",
  good: "bg-emerald-weak text-emerald border-[rgba(11,122,94,0.25)]",
  warn: "bg-amber-weak text-amber border-[rgba(183,121,31,0.25)]",
  bad: "bg-red-weak text-red border-[rgba(179,55,47,0.25)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export type Tier = "EXCEPTIONAL" | "STRONG" | "SOLID" | "DEVELOPING" | "NEEDS_WORK";

const TIER_LABEL: Record<Tier, string> = {
  EXCEPTIONAL: "Exceptional",
  STRONG: "Strong",
  SOLID: "Solid",
  DEVELOPING: "Developing",
  NEEDS_WORK: "Needs work",
};
const TIER_TONE: Record<Tier, BadgeTone> = {
  EXCEPTIONAL: "good",
  STRONG: "good",
  SOLID: "neutral",
  DEVELOPING: "warn",
  NEEDS_WORK: "bad",
};

/** Maps a final score (0-100) to a tier badge. Thresholds match the platform's own banding. */
export function tierForScore(score: number): Tier {
  if (score >= 85) return "EXCEPTIONAL";
  if (score >= 70) return "STRONG";
  if (score >= 55) return "SOLID";
  if (score >= 40) return "DEVELOPING";
  return "NEEDS_WORK";
}

export function TierBadge({ tier, className }: { tier: Tier; className?: string }): React.ReactElement {
  return (
    <Badge tone={TIER_TONE[tier]} className={className}>
      {TIER_LABEL[tier]}
    </Badge>
  );
}
