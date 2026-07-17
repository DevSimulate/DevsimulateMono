"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const INCLUDED = [
  "All NovaTech CRM tickets — unlimited",
  "AI review across all four dimensions",
  "Full written feedback — Diagnosis, Design, Communication, Execution",
  "Score history on your dashboard",
  "Public shareable profile",
  "More codebases as they launch",
];

export default function PricingPage(): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    const token = getToken();
    if (!token) {
      window.location.href = "/onboarding/select";
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/billing/create-checkout-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>

      <nav className="sticky top-0 z-40 nav-glass px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={32} /></Link>
        <Link href="/dashboard" className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
          Dashboard
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-20">

        <div className="text-center mb-12 fade-in-up">
          <div className="section-label mb-1">Pricing</div>
          <h1 className="text-5xl font-black tracking-tight mb-4" style={{ color: "#1A1A1A" }}>
            Simple, honest pricing
          </h1>
          <p className="text-base" style={{ color: "#6B6B6B" }}>
            Free plan to try it. Pro when you're serious about levelling up.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 fade-in-up" style={{ animationDelay: "100ms" }}>

          {/* Free */}
          <div className="card rounded-2xl p-7 flex flex-col">
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#6B6B6B" }}>Free</div>
            <div className="text-5xl font-black mb-1" style={{ color: "#1A1A1A" }}>$0</div>
            <div className="text-sm mb-6" style={{ color: "#6B6B6B" }}>2 submissions / month</div>
            <ul className="space-y-2.5 mb-8 flex-1 text-sm" style={{ color: "#3A3A3A" }}>
              {["2 tickets per month", "Full AI-scored feedback", "Public profile page", "Score history"].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="font-black" style={{ color: "#0D9488" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/onboarding/select" className="btn-outline w-full text-center block">
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="card-glow rounded-2xl p-7 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 text-xs font-black px-3 py-1 rounded-bl-xl"
              style={{ background: "#5B5BD6", color: "#fff" }}>
              PRO
            </div>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#5B5BD6" }}>Pro</div>
            <div className="text-5xl font-black mb-1" style={{ color: "#1A1A1A" }}>$9</div>
            <div className="text-sm mb-6" style={{ color: "#6B6B6B" }}>per month · cancel anytime</div>
            <ul className="space-y-2.5 mb-8 flex-1 text-sm" style={{ color: "#3A3A3A" }}>
              {INCLUDED.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span className="font-black mt-0.5 shrink-0" style={{ color: "#5B5BD6" }}>✓</span> {f}
                </li>
              ))}
            </ul>

            {error && (
              <p className="text-xs mb-3 text-red-500">{error}</p>
            )}

            <button onClick={handleUpgrade} disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
              {loading ? "Redirecting to checkout…" : "Upgrade to Pro →"}
            </button>
          </div>

        </div>

        <p className="text-xs text-center mt-8" style={{ color: "#9CA3AF" }}>
          Payments are processed securely by Stripe. Cancel anytime from your dashboard.
        </p>

      </main>
    </div>
  );
}
