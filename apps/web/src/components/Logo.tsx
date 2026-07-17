"use client";

/**
 * DevSimulate logo component.
 *
 * The mark is a terminal prompt `>_`: the chevron leans forward to read as
 * "run / simulate", and the teal block is the live cursor.
 *
 * Variants:
 *  - "icon"       → square mark only (good for favicons, avatars)
 *  - "horizontal" → icon + wordmark side by side (nav, headers)
 *  - "stacked"    → icon above wordmark (splash screens, marketing)
 */

interface LogoProps {
  variant?: "icon" | "horizontal" | "stacked";
  size?: number;
  /** Override icon bg — defaults to indigo-to-teal gradient */
  solidColor?: string;
  /** Wordmark text colour — defaults to #1A1A1A (use "#FFFFFF" on dark navs) */
  textColor?: string;
}

export function BoltIcon({ size = 40, solidColor }: { size?: number; solidColor?: string }) {
  const id = `logo-grad-${size}`;
  // On a solid single-colour tile the cursor goes white (mono); on the gradient
  // it keeps the teal brand accent.
  const cursor = solidColor ? "#FFFFFF" : "#2DD4BF";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DevSimulate icon"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={solidColor ?? "#6366F1"} />
          <stop offset="100%" stopColor={solidColor ?? "#8B5CF6"} />
        </linearGradient>
      </defs>

      {/* Rounded-square tile */}
      <rect width="40" height="40" rx="10" fill={solidColor ? solidColor : `url(#${id})`} />

      {/* Terminal prompt: forward-leaning chevron (run / simulate) + live cursor */}
      <polyline
        points="15,12.5 25.5,20 15,27.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="15" y="30.4" width="11" height="3.4" rx="1.7" fill={cursor} />
    </svg>
  );
}

export default function Logo({ variant = "horizontal", size = 36, solidColor, textColor = "#1A1A1A" }: LogoProps) {
  if (variant === "icon") {
    return <BoltIcon size={size} />;
  }

  if (variant === "stacked") {
    return (
      <div className="flex flex-col items-center gap-2">
        <BoltIcon size={size} solidColor={solidColor} />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 900,
            fontSize: `${Math.round(size * 0.55)}px`,
            letterSpacing: "-0.03em",
            color: textColor,
            lineHeight: 1,
          }}
        >
          DevSimulate
        </span>
      </div>
    );
  }

  // horizontal (default)
  const wordmarkSize = Math.round(size * 0.5);
  return (
    <div className="flex items-center gap-2.5">
      <BoltIcon size={size} solidColor={solidColor} />
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 900,
          fontSize: `${wordmarkSize}px`,
          letterSpacing: "-0.03em",
          color: textColor,
          lineHeight: 1,
        }}
      >
        DevSimulate
      </span>
    </div>
  );
}
