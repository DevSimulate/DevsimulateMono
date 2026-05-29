"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import axios from "axios";
import { getToken } from "@/lib/auth";

const FREE_FEATURES = [
  { text: "2 tickets to try", included: true },
  { text: "Claude AI review", included: true },
  { text: "Basic skill score", included: true },
  { text: "Public profile", included: true },
  { text: "Unlimited tickets", included: false },
  { text: "Score history", included: false },
  { text: "Priority support", included: false },
];

const PRO_FEATURES = [
  { text: "Unlimited tickets", included: true },
  { text: "Claude AI review on every PR", included: true },
  { text: "Full skill score tracking", included: true },
  { text: "Score history chart", included: true },
  { text: "Shareable verified profile", included: true },
  { text: "All 4 codebases (.NET, Node, Angular, React)", included: true },
  { text: "Priority support", included: true },
];

export default function PricingPage(): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(): Promise<void> {
    const token = getToken();
    if (!token) {
      window.location.href = "/";
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
      const res = await axios.post<{ url: string }>(
        `${apiUrl}/billing/create-checkout-session`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = res.data.url;
    } catch {
      setError("Failed to start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={32} textColor="#FFFFFF" /></Link>
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">
          Dashboard
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-3">Simple pricing</h1>
          <p className="text-slate-400 text-lg">Try free. Upgrade when you're ready to go deep.</p>
        </div>

        {error && (
          <div className="mb-8 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* FREE */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 flex flex-col">
            <div className="mb-6">
              <div className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2">Free</div>
              <div className="text-5xl font-black text-white">$0
                <span className="text-lg font-normal text-slate-500">/month</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map(({ text, included }) => (
                <li key={text} className="flex items-center gap-3 text-sm">
                  <span className={included ? "text-emerald-400" : "text-slate-700"}>
                    {included ? "✓" : "✗"}
                  </span>
                  <span className={included ? "text-slate-300" : "text-slate-600"}>{text}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard"
              className="block text-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5 py-3 text-sm transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* PRO */}
          <div className="rounded-2xl border border-cyan-500/40 bg-slate-900 p-8 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-cyan-500 text-slate-950 text-xs font-black px-3 py-1 rounded-bl-lg">
              MOST POPULAR
            </div>

            <div className="mb-6">
              <div className="text-sm font-semibold uppercase tracking-widest text-cyan-500 mb-2">Pro</div>
              <div className="text-5xl font-black text-white">$29
                <span className="text-lg font-normal text-slate-500">/month</span>
              </div>
              <div className="text-sm text-slate-500 mt-1">or $199/year — save 43%</div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map(({ text, included }) => (
                <li key={text} className="flex items-center gap-3 text-sm">
                  <span className={included ? "text-cyan-400" : "text-slate-700"}>
                    {included ? "✓" : "✗"}
                  </span>
                  <span className={included ? "text-slate-200" : "text-slate-600"}>{text}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold px-5 py-3 text-sm transition-colors"
            >
              {loading ? "Redirecting to checkout…" : "Upgrade to Pro"}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
