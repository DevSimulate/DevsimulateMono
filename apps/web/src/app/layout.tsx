import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen antialiased" style={{ background: "#F7F6F3", color: "#1A1A1A" }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
