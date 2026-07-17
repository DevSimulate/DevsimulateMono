"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const ONBOARDING_URL = "/onboarding/select";

const PRO_FEATURES = [
  "Every codebase — .NET, Node, Python, C++ and more",
  "Full written feedback on all four dimensions",
  "Spoken defense on every submission",
  "Score history and trend on your dashboard",
  "Public shareable profile",
  "New codebases as they launch",
];

// Small inline icons — no emoji, so it reads like a product not a deck.
const icons: Record<string, React.ReactElement> = {
  ticket: <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4zM12 6v12" />,
  wrench: <path d="M14.5 6.5a3.5 3.5 0 0 0-4.9 4.4l-5 5a1.5 1.5 0 0 0 2.1 2.1l5-5a3.5 3.5 0 0 0 4.4-4.9l-2 2-1.6-1.6z" />,
  shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4" />,
  bug: <path d="M9 8a3 3 0 0 1 6 0M6 12h12M8 8V6M16 8V6M7 12v3a5 5 0 0 0 10 0v-3M4 11h2M18 11h2M5 16l2-1M19 16l-2-1M12 17v4" />,
  target: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />,
  mic: <path d="M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 11v1a6 6 0 0 0 12 0v-1M12 19v2" />,
  building: <path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M14 20V10h4a2 2 0 0 1 2 2v8M7 8h2M7 12h2M7 16h2M17 14h.01M17 17h.01M3 20h18" />,
};

function Ic({ name, size = 22 }: { name: string; size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

const STEPS = [
  { num: "01", icon: "ticket", title: "Get a real ticket",
    body: "An ambiguous ticket from a real company codebase — a symptom to chase, not a puzzle to solve. Production complexity, not algorithms." },
  { num: "02", icon: "wrench", title: "Fix it your way",
    body: "Use any AI tool you like. We don't measure typing — we measure judgment. Find the root cause, ship the fix, open a PR." },
  { num: "03", icon: "shield", title: "Prove the work is yours",
    body: "Hidden tests check the code holds up, and you defend your fix out loud. Anyone can paste an answer — few can defend one." },
];

const FEATURES = [
  { icon: "bug", title: "Real codebases, real bugs",
    body: "Not algorithm puzzles. Actual .NET, Node, Python and C++ services with race conditions, silent failures, and conflicting business rules.",
    tag: "Authentic", tagColor: "#EBEBFF", tagText: "#5B5BD6" },
  { icon: "target", title: "Diagnosis is 40% of the score",
    body: "Finding why a bug exists is far harder than fixing it. The scoring rewards engineers who go deep on root cause, not quick patches.",
    tag: "Thinking-first", tagColor: "#CCFBF1", tagText: "#0D9488" },
  { icon: "mic", title: "Defend your fix out loud",
    body: "Every submission ends with a spoken defense of your own change. It's the one thing an AI answer can't fake — and the reason the result is trustworthy.",
    tag: "Verified", tagColor: "#FEF3C7", tagText: "#B45309" },
  { icon: "building", title: "Built for hiring & events",
    body: "Employers rank candidates on proof, not résumés. Run a private assessment or a public DevFest with live leaderboards and certificates.",
    tag: "For teams", tagColor: "#FCE7F3", tagText: "#BE185D" },
];

const SCORES = [
  { label: "Diagnosis", pct: 40, desc: "Finding the real root cause", bg: "#EBEBFF", color: "#5B5BD6" },
  { label: "Design", pct: 30, desc: "Trade-offs & judgment", bg: "#CCFBF1", color: "#0D9488" },
  { label: "Communication", pct: 20, desc: "Explaining the why", bg: "#FEF3C7", color: "#B45309" },
  { label: "Execution", pct: 10, desc: "Does it actually work?", bg: "#FCE7F3", color: "#BE185D" },
];

export default function LandingPage(): React.ReactElement {
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  async function handleUpgrade() {
    const token = getToken();
    if (!token) { window.location.href = ONBOARDING_URL; return; }
    setUpgradeLoading(true);
    setUpgradeError(null);
    try {
      const res = await fetch(`${API_URL}/billing/create-checkout-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout");
      window.location.href = data.url!;
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : "Something went wrong");
      setUpgradeLoading(false);
    }
  }

  return (
    <main className="bg-grid min-h-screen overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 nav-glass px-6 py-3.5 flex items-center justify-between mx-auto w-full" style={{ maxWidth: "100%" }}>
        <Logo variant="horizontal" size={32} />
        <div className="hidden md:flex items-center gap-8">
          {[["How it works", "#how-it-works"], ["Scoring", "#scoring"], ["Pricing", "#pricing"], ["Leaderboard", "/leaderboard"]].map(([label, href]) => (
            <a key={label} href={href} className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
              onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}
            >{label}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/employer/campaigns" className="text-sm font-medium hidden sm:block transition-colors" style={{ color: "#6B6B6B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}
          >For Employers</Link>
          <Link href="/dashboard" className="text-sm font-medium hidden sm:block transition-colors" style={{ color: "#6B6B6B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}
          >Dashboard</Link>
          <Link href={ONBOARDING_URL} className="btn-primary text-sm">Start free →</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative px-6 pt-20 pb-16 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[420px] rounded-full opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(91,91,214,0.16) 0%, transparent 70%)" }} />

        <div className="fade-in-up section-label">Technical assessment, verified</div>

        <h1 className="fade-in-up delay-100 text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] mb-5 max-w-3xl" style={{ color: "#1A1A1A" }}>
          Prove you can{" "}
          <span className="gradient-text">debug anything.</span>
        </h1>

        <p className="fade-in-up delay-200 text-lg text-[#6B6B6B] max-w-xl mb-8 leading-relaxed">
          Solve real engineering tickets from real company codebases. Use any AI tool you like —
          then <strong style={{ color: "#1A1A1A", fontWeight: 600 }}>defend your fix out loud</strong>.
          The score measures your thinking, so it&apos;s one hiring teams can trust.
        </p>

        <div className="fade-in-up delay-300 flex flex-col sm:flex-row gap-3 mb-16">
          <Link href={ONBOARDING_URL} className="btn-primary">Start for free — no credit card</Link>
          <a href="#how-it-works" className="btn-outline">See how it works ↓</a>
        </div>

        {/* Product-style score card */}
        <div className="fade-in-up delay-400 score-float w-full max-w-sm mx-auto">
          <div className="card rounded-2xl p-5 text-left" style={{ transform: "rotate(-1.5deg)" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "#6B6B6B" }}>NOVA-47 · NovaTech CRM</div>
                <div className="font-bold text-sm" style={{ color: "#1A1A1A" }}>Intermittent Order Fulfillment Failure</div>
              </div>
              <div className="text-right ml-4 shrink-0">
                <div className="text-4xl font-black gradient-text leading-none">82</div>
                <div className="text-xs" style={{ color: "#6B6B6B" }}>/100</div>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              {[
                { label: "Diagnosis", val: 34, max: 40 },
                { label: "Design", val: 25, max: 30 },
                { label: "Communication", val: 15, max: 20 },
                { label: "Execution", val: 8, max: 10 },
              ].map(({ label, val, max }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "#6B6B6B" }}>{label}</span>
                    <span className="font-semibold" style={{ color: "#1A1A1A" }}>{val}/{max}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "#E4E2DD" }}>
                    <div className="score-bar-fill" style={{ width: `${(val / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "#ECFDF3", color: "#067647" }}>
              <span style={{ display: "grid" }}><Ic name="mic" size={15} /></span>
              <span className="text-xs font-semibold">Defended out loud · 9/10</span>
            </div>
          </div>
        </div>

        <div className="fade-in-up delay-500 mt-14 flex flex-wrap justify-center gap-10">
          {[
            { val: "4 dimensions", label: "scored per submission" },
            { val: "Spoken", label: "defense on every fix" },
            { val: "100 pts", label: "max possible score" },
          ].map(({ val, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-black" style={{ color: "#1A1A1A" }}>{val}</div>
              <div className="text-xs mt-0.5" style={{ color: "#6B6B6B" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6" style={{ background: "#EEECEA" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="section-label">How it works</div>
            <h2 className="text-4xl font-black" style={{ color: "#1A1A1A" }}>Three steps, no toy problems</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map(({ num, icon, title, body }) => (
              <div key={num} className="card p-7 relative overflow-hidden">
                <div className="absolute top-4 right-5 text-3xl font-black opacity-10" style={{ color: "#5B5BD6" }}>{num}</div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
                  <Ic name={icon} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "#1A1A1A" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6" style={{ background: "#F7F6F3" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="section-label" style={{ background: "#CCFBF1", color: "#0D9488" }}>Why DevSimulate</div>
            <h2 className="text-4xl font-black" style={{ color: "#1A1A1A" }}>AI can pass your test. It can&apos;t defend the answer.</h2>
            <p className="mt-3 max-w-xl mx-auto" style={{ color: "#6B6B6B" }}>
              Take-homes and LeetCode are gameable now. We measure understanding you can&apos;t fake.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map(({ icon, title, body, tag, tagColor, tagText }) => (
              <div key={title} className="card p-7">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: tagColor, color: tagText }}>
                    <Ic name={icon} />
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0" style={{ background: tagColor, color: tagText }}>{tag}</span>
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "#1A1A1A" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scoring ── */}
      <section id="scoring" className="py-24 px-6" style={{ background: "#EEECEA" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <div className="section-label">The scoring model</div>
            <h2 className="text-4xl font-black" style={{ color: "#1A1A1A" }}>Execution is only 10%</h2>
            <p className="mt-3 max-w-xl mx-auto" style={{ color: "#6B6B6B" }}>
              Shipping code that works is table stakes. Understanding <em>why</em> the bug exists is what separates senior engineers.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SCORES.map(({ label, pct, desc, bg, color }) => (
              <div key={label} className="card p-6 text-center group">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-105" style={{ background: bg }}>
                  <span className="text-2xl font-black" style={{ color }}>{pct}%</span>
                </div>
                <div className="font-bold mb-1" style={{ color: "#1A1A1A" }}>{label}</div>
                <div className="text-xs" style={{ color: "#6B6B6B" }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6" style={{ background: "#F7F6F3" }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="section-label">Pricing</div>
            <h2 className="text-4xl font-black" style={{ color: "#1A1A1A" }}>Simple, honest pricing</h2>
            <p className="mt-3 text-base" style={{ color: "#6B6B6B" }}>Free to try it. Pro when you&apos;re serious about levelling up.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="card rounded-2xl p-7 flex flex-col">
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#6B6B6B" }}>Free</div>
              <div className="text-5xl font-black mb-1" style={{ color: "#1A1A1A" }}>$0</div>
              <div className="text-sm mb-6" style={{ color: "#6B6B6B" }}>2 submissions / month</div>
              <ul className="space-y-2.5 mb-8 flex-1 text-sm" style={{ color: "#3A3A3A" }}>
                {["2 tickets per month", "Full scored feedback", "Spoken defense", "Public profile page"].map(f => (
                  <li key={f} className="flex items-center gap-2"><span className="font-black" style={{ color: "#0D9488" }}>✓</span> {f}</li>
                ))}
              </ul>
              <Link href={ONBOARDING_URL} className="btn-outline w-full text-center block">Get started free</Link>
            </div>
            <div className="card-glow rounded-2xl p-7 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 text-xs font-black px-3 py-1 rounded-bl-xl" style={{ background: "#5B5BD6", color: "#fff" }}>PRO</div>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#5B5BD6" }}>Pro</div>
              <div className="text-5xl font-black mb-1" style={{ color: "#1A1A1A" }}>$9</div>
              <div className="text-sm mb-6" style={{ color: "#6B6B6B" }}>per month · cancel anytime</div>
              <ul className="space-y-2.5 mb-8 flex-1 text-sm" style={{ color: "#3A3A3A" }}>
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2"><span className="font-black mt-0.5 shrink-0" style={{ color: "#5B5BD6" }}>✓</span> {f}</li>
                ))}
              </ul>
              {upgradeError && <p className="text-xs mb-3 text-red-500">{upgradeError}</p>}
              <button onClick={handleUpgrade} disabled={upgradeLoading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
                {upgradeLoading ? "Redirecting to checkout…" : "Upgrade to Pro →"}
              </button>
            </div>
          </div>
          <p className="text-xs text-center mt-6" style={{ color: "#9CA3AF" }}>Payments processed securely by Stripe. Cancel anytime.</p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6" style={{ background: "#EEECEA" }}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="card-glow rounded-3xl p-14 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-40"
              style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(91,91,214,0.12), transparent 70%)" }} />
            <div className="relative z-10">
              <div className="flex justify-center mb-5"><Logo variant="icon" size={64} /></div>
              <h2 className="text-4xl font-black mb-4" style={{ color: "#1A1A1A" }}>
                Ready to find out{" "}
                <span className="gradient-text">how good you really are?</span>
              </h2>
              <p className="mb-8 text-lg" style={{ color: "#6B6B6B" }}>
                Your first ticket is free. No credit card — just your GitHub account and your best thinking.
              </p>
              <Link href={ONBOARDING_URL} className="btn-primary text-base px-10 py-4">Get started — it&apos;s free</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t" style={{ borderColor: "#E4E2DD", background: "#F7F6F3" }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="horizontal" size={28} />
          <p className="text-sm" style={{ color: "#9CA3AF" }}>© 2026 DevSimulate. Real tickets. Real defense.</p>
          <div className="flex gap-6 text-sm" style={{ color: "#9CA3AF" }}>
            <Link href="/pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link>
            <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <Link href="/employer/campaigns" className="hover:text-indigo-600 transition-colors">For Employers</Link>
            <a href="mailto:ossama@devsimulate.com" className="hover:text-indigo-600 transition-colors">ossama@devsimulate.com</a>
          </div>
        </div>
      </footer>

    </main>
  );
}
