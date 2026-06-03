"use client";

import { useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Check, Zap, ArrowRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Plan {
  id: string;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  cta: string;
  plan?: "starter" | "growth";
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "payg",
    name: "Pay as you go",
    price: "$5",
    cadence: "/ assessment",
    tagline: "No commitment. Pay only for candidates you assess.",
    features: [
      "Real codebase tickets across every stack",
      "AI scoring + integrity checks",
      "Full results dashboard",
      "No monthly fee",
    ],
    cta: "Start Free",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$99",
    cadence: "/ month",
    tagline: "For small teams hiring a few roles at a time.",
    features: [
      "30 assessments / month included",
      "$3.50 per extra assessment",
      "Campaign links + shortlist & invite",
      "Team seats included",
    ],
    cta: "Choose Starter",
    plan: "starter",
    highlight: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$249",
    cadence: "/ month",
    tagline: "For teams hiring at volume across stacks.",
    features: [
      "150 assessments / month included",
      "$2.50 per extra assessment",
      "Unlimited campaigns + DevFest contests",
      "Priority support",
    ],
    cta: "Choose Growth",
    plan: "growth",
  },
];

export default function EmployerPricingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(p: Plan) {
    setError(null);
    if (!p.plan) {
      // Pay-as-you-go → just start using campaigns
      window.location.href = "/employer/campaigns/new";
      return;
    }
    setBusy(p.id);
    const token = getToken();
    try {
      const r = await fetch(`${API}/billing/employer-checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: p.plan }),
      });
      const j = await r.json();
      if (j.url) { window.location.href = j.url; return; }
      throw new Error(j.error ?? "Couldn't start checkout");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="px-8 py-4" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <h1 className="text-lg font-black text-white">Plans & Billing</h1>
        <p className="text-xs" style={{ color: "#555" }}>Assess candidates on real codebases — pay for what you use</p>
      </header>

      <main className="flex-1 px-8 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
            style={{ background: "#1e1b4b", color: "#818cf8" }}>
            <Zap size={13} /> Half the price of HackerRank · No per-seat fees
          </div>
          <h2 className="text-3xl font-black text-white">Pay for results, not seats</h2>
          <p className="text-sm mt-2" style={{ color: "#888" }}>
            $5 to know if a candidate can fix a real bug — vs. hours of engineer time on a take-home.
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-6 rounded-lg px-4 py-3 text-sm text-center"
            style={{ background: "#1c0000", border: "1px solid #7f1d1d", color: "#f87171" }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-5 max-w-4xl mx-auto">
          {PLANS.map((p) => (
            <div key={p.id} className="rounded-2xl p-6 flex flex-col relative"
              style={{
                background: p.highlight ? "#111827" : "#111111",
                border: `1px solid ${p.highlight ? "#6366f1" : "#222222"}`,
              }}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full text-white"
                  style={{ background: "#6366f1" }}>Most Popular</div>
              )}
              <div className="text-sm font-bold text-white mb-1">{p.name}</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-black text-white">{p.price}</span>
                <span className="text-sm" style={{ color: "#555" }}>{p.cadence}</span>
              </div>
              <div className="text-xs mb-5 leading-relaxed" style={{ color: "#888" }}>{p.tagline}</div>

              <div className="space-y-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs" style={{ color: "#ccc" }}>
                    <Check size={14} style={{ color: "#4ade80" }} className="mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => choose(p)} disabled={busy === p.id}
                className="w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: p.highlight ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "#1a1a1a",
                  color: p.highlight ? "#fff" : "#e5e7eb",
                  border: p.highlight ? "none" : "1px solid #2a2a2a",
                }}>
                {busy === p.id ? "Starting…" : <>{p.cta} <ArrowRight size={14} /></>}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-xs" style={{ color: "#555" }}>
            Running a bootcamp or need 500+ assessments?{" "}
            <a href="mailto:ossama@devsimulate.com" style={{ color: "#818cf8" }}>Talk to us about volume pricing</a>
          </p>
        </div>
      </main>
    </div>
  );
}
