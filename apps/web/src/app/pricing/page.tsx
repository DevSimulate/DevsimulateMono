"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

const INCLUDED = [
  "All NovaTech CRM tickets",
  "Claude AI scoring — Diagnosis, Design, Communication, Execution",
  "Full written feedback on every submission",
  "Score history on your dashboard",
  "Public shareable profile",
  "More codebases coming soon",
];

export default function PricingPage(): React.ReactElement {
  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-40 nav-glass px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={32} /></Link>
        <Link href="/dashboard" className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
          Dashboard
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-20">

        {/* Header */}
        <div className="text-center mb-12 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-bold"
            style={{ background: "#DCFCE7", color: "#16a34a" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
            Public Beta
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-4" style={{ color: "#1A1A1A" }}>
            Free during beta
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "#6B6B6B" }}>
            No credit card. No limits. Just sign up and start solving tickets.<br />
            We will introduce paid plans once beta ends.
          </p>
        </div>

        {/* Plan card */}
        <div className="card-glow rounded-3xl p-8 mb-8 fade-in-up" style={{ animationDelay: "100ms" }}>

          {/* Price */}
          <div className="flex items-end gap-3 mb-2">
            <span className="text-6xl font-black" style={{ color: "#1A1A1A" }}>$0</span>
            <div className="pb-2">
              <div className="text-sm font-bold" style={{ color: "#16a34a" }}>during beta</div>
              <div className="text-sm line-through" style={{ color: "#9CA3AF" }}>$9 / month after beta</div>
            </div>
          </div>

          <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>
            Everything included. Cancel anytime once billing starts.
          </p>

          {/* Features */}
          <ul className="space-y-3 mb-8">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm" style={{ color: "#3A3A3A" }}>
                <span className="font-black mt-0.5 shrink-0" style={{ color: "#5B5BD6" }}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          <Link href="/onboarding/select" className="btn-primary w-full text-center block text-base py-4">
            Start free — no credit card
          </Link>
        </div>

        {/* After beta note */}
        <div className="card rounded-2xl p-6 fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">💡</span>
            <div>
              <h3 className="font-black text-sm mb-1" style={{ color: "#1A1A1A" }}>What happens after beta?</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
                When we exit beta, the plan will be <strong style={{ color: "#1A1A1A" }}>$9 / month</strong>.
                Everyone who joins during beta will get a heads-up email before any charge.
                No surprises.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
