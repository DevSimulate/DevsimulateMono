import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/ui/Toast";
import "../styles/tokens.css";
import "./globals.css";

// Precision Instrument type system:
//   Display (Space Grotesk) — page titles, scores, candidate names
//   Body    (Inter)         — narrative: write-ups, feedback prose, UI chrome
//   Mono    (IBM Plex Mono) — anything machine-generated: scores, timers,
//     timestamps, branch names, diff stats. Wherever the SYSTEM speaks, it
//     speaks in mono; wherever a HUMAN speaks, it's Inter. See globals.css
//     for the enforced base rule.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevSimulate — Real tickets. AI scoring. Level up.",
  description:
    "The developer training platform where you solve real-world engineering tickets from fake company codebases and get scored on your thinking — and defended out loud.",
  openGraph: {
    title: "DevSimulate",
    description: "Solve real tickets. Get scored by AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
