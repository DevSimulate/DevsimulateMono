"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://devsimulate-mono-web.vercel.app") +
    "/auth/callback"
  )}`;

// ─── Step data ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    icon: "🧩",
    color: "#EBEBFF",
    title: "Install the VS Code extension",
    what: "Open VS Code → Extensions panel (Ctrl+Shift+X or ⌘⇧X) → search \"DevSimulate\" → Install → click the DevSimulate icon in the sidebar → hit \"Login with GitHub\".",
    detail: "The extension handles everything: cloning the repo, creating your branch, and detecting your open PR when you submit.",
    time: "~2 min",
    tip: null,
  },
  {
    num: "02",
    icon: "🎯",
    color: "#CCFBF1",
    title: "Claim your first ticket",
    what: "In the DevSimulate sidebar click \"Browse Tickets\", pick one that fits your level, then click \"Start Ticket\". Choose a folder — the extension clones NovaTech CRM and checks out your branch automatically.",
    detail: "Your branch name is saved. The extension will use it later to auto-find your PR on GitHub — no copy-pasting URLs.",
    time: "~3 min",
    tip: "Start with a MID ticket. JUNIOR tickets are too guided; you want enough ambiguity to practice real diagnosis.",
  },
  {
    num: "03",
    icon: "🔧",
    color: "#FEF3C7",
    title: "Fix the bug — then open a PR",
    what: "Read the ticket description carefully. Explore the codebase. Find the root cause (not just the symptom). Fix it. Push your branch. Open a Pull Request on GitHub with a short description explaining what you found and why you fixed it the way you did.",
    detail: "40% of your score is Diagnosis — did you understand WHY the bug exists? Your PR description is where you prove it. Don't just describe what you changed; explain the reasoning.",
    time: "30 min – 2 hrs",
    tip: "The PR description is half your score. Write it like you're explaining the bug to a colleague in Slack — clear, direct, specific.",
  },
  {
    num: "04",
    icon: "🤖",
    color: "#FCE7F3",
    title: "Submit → get scored in ~60 seconds",
    what: "In VS Code, open the command palette (Ctrl+Shift+P or ⌘⇧P) → run \"DevSimulate: Submit PR\". The extension auto-detects your open PR. Your browser opens — write a sentence or two about your approach, click Submit.",
    detail: "Claude reviews your PR diff against the ticket rubric and scores Diagnosis, Design, Communication, and Execution. Then two follow-up questions appear — answer them to earn up to 20 bonus points.",
    time: "~10 min",
    tip: "The follow-up questions reference your specific code changes. They can't be answered by AI without reading what you actually wrote.",
  },
];

// ─── Inner component (needs useSearchParams) ──────────────────────────────────

function GuideContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const codebase = searchParams.get("codebase") ?? "novatech";
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  function handleGetStarted() {
    if (getToken()) {
      router.push("/tickets");
    } else {
      localStorage.setItem("ds_submit_return", "/tickets");
      window.location.href = GITHUB_AUTH_URL;
    }
  }

  return (
    <main className="bg-grid min-h-screen" style={{ background: "#F7F6F3" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-40 nav-glass px-6 py-3.5 flex items-center justify-between">
        <Link href="/onboarding/select" className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "#6B6B6B" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
          ← Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="font-black text-lg tracking-tight" style={{ color: "#1A1A1A" }}>DevSimulate</span>
        </div>
        <div className="w-16" />
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="text-center mb-14 fade-in-up">
          {codebase === "novatech" && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-bold"
              style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              NovaTech CRM · .NET 8
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4" style={{ color: "#1A1A1A" }}>
            You&apos;re 4 steps from your<br />
            <span className="gradient-text">first real ticket</span>
          </h1>
          <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: "#6B6B6B" }}>
            This is the full loop — from extension install to scored PR. It takes about 10 minutes to set up. The ticket itself is up to you.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-5 mb-14">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className="card fade-in-up rounded-2xl overflow-hidden"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start gap-4 p-6">
                {/* Icon circle */}
                <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: step.color }}>
                  {step.icon}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Step number + time */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black tracking-widest" style={{ color: "#9CA3AF" }}>
                      STEP {step.num}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: step.color, color: "#6B6B6B" }}>
                      {step.time}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-black text-lg mb-2" style={{ color: "#1A1A1A" }}>
                    {step.title}
                  </h3>

                  {/* What to do */}
                  <p className="text-sm leading-relaxed mb-3" style={{ color: "#3A3A3A" }}>
                    {step.what}
                  </p>

                  {/* Why it matters — subtle */}
                  <p className="text-xs leading-relaxed mb-3" style={{ color: "#6B6B6B" }}>
                    {step.detail}
                  </p>

                  {/* Tip */}
                  {step.tip && (
                    <div className="rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
                      style={{ background: "#F7F6F3", borderLeft: "3px solid #5B5BD6", color: "#4B4B4B" }}>
                      <span className="font-bold" style={{ color: "#5B5BD6" }}>Tip: </span>
                      {step.tip}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Honest expectation */}
        <div className="card rounded-2xl p-7 mb-10 fade-in-up"
          style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            animationDelay: "360ms",
          }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">☕</span>
            <div>
              <h3 className="font-black text-base mb-2" style={{ color: "#92400E" }}>
                One honest thing to know before you start
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#78350F" }}>
                Your first ticket will probably take <strong>2–4 hours</strong>, not 45 minutes. The description will feel vague — that&apos;s intentional. Real bugs don&apos;t come with a step-by-step guide. You&apos;ll read a lot more code than you write, and that&apos;s the whole point. A score of <strong>65–75 on your first attempt is good</strong>. Claude is strict on Diagnosis because identifying the root cause is what separates senior engineers from everyone else.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center fade-in-up" style={{ animationDelay: "440ms" }}>
          <button
            onClick={handleGetStarted}
            className="btn-primary text-base px-10 py-4"
          >
            {authed === null
              ? "Get My First Ticket →"
              : authed
              ? "Browse Tickets →"
              : "Sign in with GitHub — it's free →"}
          </button>
          {authed === false && (
            <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
              Takes 5 seconds. We only request read access to your public profile.
            </p>
          )}
          <p className="text-xs mt-4" style={{ color: "#9CA3AF" }}>
            Free plan · 2 tickets/month · No credit card
          </p>
        </div>

      </div>

      {/* Footer */}
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: "#9CA3AF" }}>
          Questions?{" "}
          <a href="mailto:support@devsimulate.io" className="underline hover:text-gray-600 transition-colors">
            support@devsimulate.io
          </a>
        </p>
      </div>

    </main>
  );
}

// ─── Page export (Suspense wrapper for useSearchParams) ───────────────────────

export default function GuidePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F6F3", color: "#6B6B6B" }}>
        Loading…
      </div>
    }>
      <GuideContent />
    </Suspense>
  );
}
