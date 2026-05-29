"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

const ONBOARDING_URL = "/onboarding/select";

const STEPS = [
  {
    num: "01",
    emoji: "🎯",
    title: "Get a real ticket",
    body: "Ambiguous engineering tickets from realistic fake codebases. No toy problems — actual production complexity.",
    color: "#EBEBFF",
  },
  {
    num: "02",
    emoji: "🔧",
    title: "Solve it your way",
    body: "Use any tool — Claude, Copilot, ChatGPT. We score your thinking, not whether you used AI.",
    color: "#CCFBF1",
  },
  {
    num: "03",
    emoji: "🤖",
    title: "Claude scores your PR",
    body: "Open a PR with your reasoning. Claude evaluates root cause, design, communication, and execution.",
    color: "#FEF3C7",
  },
];

const FEATURES = [
  {
    emoji: "🐛",
    title: "Real codebases, real bugs",
    body: "Not algorithm puzzles. Actual .NET, Node and Python services with race conditions, fire-and-forget anti-patterns, and conflicting business rules.",
    tag: "Authentic",
    tagColor: "#EBEBFF",
    tagText: "#5B5BD6",
  },
  {
    emoji: "🧠",
    title: "Diagnosis is 40% of your score",
    body: "Finding WHY a bug exists is 10× harder than fixing it. We reward engineers who go deep on root cause analysis.",
    tag: "Thinking-first",
    tagColor: "#CCFBF1",
    tagText: "#0D9488",
  },
  {
    emoji: "📊",
    title: "Track 4 dimensions over time",
    body: "Diagnosis, Design, Communication, Execution. See your chart evolve as you complete tickets and spot your weakest area.",
    tag: "Analytics",
    tagColor: "#FEF3C7",
    tagText: "#D97706",
  },
  {
    emoji: "🏢",
    title: "Built for teams and hiring",
    body: "Employers run assessments, rank candidates by score, and track training across the org — all from one dashboard.",
    tag: "Employer",
    tagColor: "#FCE7F3",
    tagText: "#BE185D",
  },
];

const SCORES = [
  { label: "Diagnosis", pct: 40, desc: "Root cause analysis", bg: "#EBEBFF", color: "#5B5BD6" },
  { label: "Design", pct: 30, desc: "Solution trade-offs", bg: "#CCFBF1", color: "#0D9488" },
  { label: "Communication", pct: 20, desc: "PR clarity & reasoning", bg: "#FEF3C7", color: "#D97706" },
  { label: "Execution", pct: 10, desc: "Does it actually work?", bg: "#FCE7F3", color: "#BE185D" },
];

export default function LandingPage(): React.ReactElement {
  return (
    <main className="bg-grid min-h-screen overflow-x-hidden">

      {/* ── Beta banner ── */}
      <div className="w-full py-2 px-4 text-center text-xs font-bold" style={{ background: "#5B5BD6", color: "#FFFFFF" }}>
        🚀 DevSimulate is in public beta — free for everyone right now &nbsp;·&nbsp;{" "}
        <Link href="/pricing" className="underline underline-offset-2 opacity-90 hover:opacity-100">See pricing</Link>
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 nav-glass px-6 py-3.5 flex items-center justify-between max-w-7xl mx-auto w-full" style={{ maxWidth: "100%" }}>
        <Logo variant="horizontal" size={32} />
        <div className="hidden md:flex items-center gap-8">
          {[["How it works", "#how-it-works"], ["Scoring", "#scoring"], ["Pricing", "#pricing"]].map(([label, href]) => (
            <a key={label} href={href} className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
              onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm font-medium hidden sm:block transition-colors"
            style={{ color: "#6B6B6B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}
          >
            Dashboard
          </Link>
          <Link href={ONBOARDING_URL} className="btn-primary text-sm">
            Start free →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative px-6 pt-20 pb-16 flex flex-col items-center text-center overflow-hidden">
        {/* Soft bg blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(91,91,214,0.15) 0%, transparent 70%)" }} />

        {/* Badge */}
        <div className="fade-in-up section-label">
          <span>✦</span> AI-Powered Developer Training
        </div>

        {/* Headline */}
        <h1 className="fade-in-up delay-100 text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] mb-5 max-w-3xl" style={{ color: "#1A1A1A" }}>
          Prove you can{" "}
          <span className="gradient-text">debug anything.</span>
        </h1>

        <p className="fade-in-up delay-200 text-lg text-[#6B6B6B] max-w-xl mb-8 leading-relaxed">
          Solve real engineering tickets from fake company codebases.
          Get scored by Claude AI on your <strong style={{ color: "#1A1A1A", fontWeight: 600 }}>thinking</strong> — not just whether the tests pass.
        </p>

        {/* CTAs */}
        <div className="fade-in-up delay-300 flex flex-col sm:flex-row gap-3 mb-16">
          <Link href={ONBOARDING_URL} className="btn-primary">
            Start for free — no credit card
          </Link>
          <a href="#how-it-works" className="btn-outline">
            See how it works ↓
          </a>
        </div>

        {/* Floating score card */}
        <div className="fade-in-up delay-400 score-float w-full max-w-sm mx-auto">
          <div className="card rounded-2xl p-5 text-left" style={{ transform: "rotate(-1.5deg)" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: "#6B6B6B" }}>NOVA-47 · NovaTech CRM</div>
                <div className="font-bold text-sm" style={{ color: "#1A1A1A" }}>Intermittent Order Fulfillment Failure</div>
              </div>
              <div className="text-right ml-4 shrink-0">
                <div className="text-4xl font-black gradient-text leading-none">76</div>
                <div className="text-xs" style={{ color: "#6B6B6B" }}>/100</div>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              {[
                { label: "Diagnosis", val: 28, max: 40 },
                { label: "Design", val: 28, max: 30 },
                { label: "Communication", val: 10, max: 20 },
                { label: "Execution", val: 10, max: 10 },
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

            <div className="rounded-xl p-3 text-xs leading-relaxed italic" style={{ background: "#F7F6F3", color: "#6B6B6B" }}>
              &ldquo;Correct fix: replaced the discarded Task with await + conditional fulfillment, directly closing the race condition.&rdquo;
              <div className="mt-1 font-semibold not-italic" style={{ color: "#5B5BD6" }}>— Claude Sonnet 4.6</div>
            </div>
          </div>
        </div>

        {/* Social proof bar */}
        <div className="fade-in-up delay-500 mt-14 flex flex-wrap justify-center gap-10">
          {[
            { val: "4 dimensions", label: "scored per PR" },
            { val: "< 60s", label: "AI review time" },
            { val: "100pts", label: "max possible score" },
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
            <h2 className="text-4xl font-black" style={{ color: "#1A1A1A" }}>From ticket to score in 3 steps</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map(({ num, emoji, title, body, color }) => (
              <div key={num} className="card shine p-7 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-3xl font-black opacity-10" style={{ color: "#5B5BD6" }}>{num}</div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ background: color }}>
                  {emoji}
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
            <h2 className="text-4xl font-black" style={{ color: "#1A1A1A" }}>Not another coding quiz</h2>
            <p className="mt-3 max-w-xl mx-auto" style={{ color: "#6B6B6B" }}>
              Real engineering is messy, ambiguous, and full of hidden context. We simulate that.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map(({ emoji, title, body, tag, tagColor, tagText }) => (
              <div key={title} className="card shine p-7">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="text-3xl">{emoji}</div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0" style={{ background: tagColor, color: tagText }}>
                    {tag}
                  </span>
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
            <div className="section-label">The Scoring Model</div>
            <h2 className="text-4xl font-black" style={{ color: "#1A1A1A" }}>Execution is only 10%</h2>
            <p className="mt-3 max-w-xl mx-auto" style={{ color: "#6B6B6B" }}>
              Shipping code that works is table stakes. Understanding <em>why</em> the bug exists separates senior engineers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SCORES.map(({ label, pct, desc, bg, color }) => (
              <div key={label} className="card shine p-6 text-center group">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-105"
                  style={{ background: bg }}>
                  <span className="text-3xl font-black" style={{ color }}>{pct}%</span>
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
            <h2 className="text-4xl font-black" style={{ color: "#1A1A1A" }}>Free during beta</h2>
            <p className="mt-3 text-base" style={{ color: "#6B6B6B" }}>
              No credit card. No limits. Enjoy it while it lasts.
            </p>
          </div>

          <div className="card-glow rounded-3xl p-8">
            <div className="flex items-end gap-3 mb-6">
              <span className="text-6xl font-black" style={{ color: "#1A1A1A" }}>$0</span>
              <div className="pb-2">
                <div className="text-sm font-bold" style={{ color: "#16a34a" }}>during beta</div>
                <div className="text-sm line-through" style={{ color: "#9CA3AF" }}>$9 / month after beta</div>
              </div>
            </div>

            <ul className="space-y-2.5 mb-8 text-sm" style={{ color: "#3A3A3A" }}>
              {[
                "All NovaTech CRM tickets",
                "Claude AI scoring on every PR",
                "Full written feedback — Diagnosis, Design, Communication, Execution",
                "Score history on your dashboard",
                "Public shareable profile",
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="font-black" style={{ color: "#5B5BD6" }}>✓</span> {f}
                </li>
              ))}
            </ul>

            <Link href={ONBOARDING_URL} className="btn-primary w-full text-center block text-base py-4">
              Start free — no credit card
            </Link>

            <p className="text-xs text-center mt-4" style={{ color: "#9CA3AF" }}>
              We will email you before any charge. No surprises.
            </p>
          </div>
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
                Your first ticket is free. No credit card. Just your GitHub account and your best thinking.
              </p>
              <Link href={ONBOARDING_URL} className="btn-primary text-base px-10 py-4">
                Get started — it&apos;s free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t" style={{ borderColor: "#E4E2DD", background: "#F7F6F3" }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="horizontal" size={28} />
          <p className="text-sm" style={{ color: "#9CA3AF" }}>© 2026 DevSimulate. Scored by Claude AI.</p>
          <div className="flex gap-6 text-sm" style={{ color: "#9CA3AF" }}>
            <Link href="/pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link>
            <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <a href="mailto:ossama@devsimulate.com" className="hover:text-indigo-600 transition-colors">
              ossama@devsimulate.com
            </a>
          </div>
        </div>
      </footer>

    </main>
  );
}
