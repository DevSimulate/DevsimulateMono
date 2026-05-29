"use client";

/**
 * DevSimulate logo component.
 *
 * Variants:
 *  - "icon"       → square bolt-in-box only (good for favicons, avatars)
 *  - "horizontal" → icon + wordmark side by side (nav, headers)
 *  - "stacked"    → icon above wordmark (splash screens, marketing)
 *
 * The bolt icon is a standalone SVG so it can be exported as a file too.
 */

interface LogoProps {
  variant?: "icon" | "horizontal" | "stacked";
  size?: number;
  /** Override icon bg — defaults to indigo-to-teal gradient */
  solidColor?: string;
}

export function BoltIcon({ size = 40, solidColor }: { size?: number; solidColor?: string }) {
  const id = `logo-grad-${size}`;
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
          <stop offset="0%" stopColor={solidColor ?? "#5B5BD6"} />
          <stop offset="100%" stopColor={solidColor ?? "#0D9488"} />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect width="40" height="40" rx="10" fill={solidColor ? solidColor : `url(#${id})`} />

      {/* Lightning bolt — white, geometric */}
      <path
        d="M 23 5 L 11 23 L 20 23 L 16 35 L 30 17 L 21 17 Z"
        fill="white"
        fillRule="evenodd"
      />
    </svg>
  );
}

export default function Logo({ variant = "horizontal", size = 36 }: LogoProps) {
  if (variant === "icon") {
    return <BoltIcon size={size} />;
  }

  if (variant === "stacked") {
    return (
      <div className="flex flex-col items-center gap-2">
        <BoltIcon size={size} />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 900,
            fontSize: `${Math.round(size * 0.55)}px`,
            letterSpacing: "-0.03em",
            color: "#1A1A1A",
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
      <BoltIcon size={size} />
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 900,
          fontSize: `${wordmarkSize}px`,
          letterSpacing: "-0.03em",
          color: "#1A1A1A",
          lineHeight: 1,
        }}
      >
        DevSimulate
      </span>
    </div>
  );
}
