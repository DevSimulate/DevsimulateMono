import type { Config } from "tailwindcss";

// Colors reference the CSS variables in src/styles/tokens.css directly
// (not duplicated hex) so that file stays the single source of truth.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        surface: "var(--surface)",
        hairline: "var(--hairline)",
        muted: "var(--muted)",
        emerald: {
          DEFAULT: "var(--emerald)",
          weak: "var(--emerald-weak)",
        },
        amber: {
          DEFAULT: "var(--signal-amber)",
          weak: "var(--signal-amber-weak)",
        },
        red: {
          DEFAULT: "var(--signal-red)",
          weak: "var(--signal-red-weak)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "6px",
        lg: "6px",   // instruments have edges, not pillows — 6px is the ceiling
        xl: "6px",
        "2xl": "6px",
        full: "9999px", // pills/chips are the one deliberate exception
      },
      boxShadow: {
        // Hairline borders carry the weight; shadow is reserved for true
        // overlays (modals, popovers) floating above the page.
        overlay: "0 12px 32px rgba(16, 24, 43, 0.14)",
      },
      spacing: {
        18: "4.5rem",
      },
      transitionDuration: {
        DEFAULT: "180ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
