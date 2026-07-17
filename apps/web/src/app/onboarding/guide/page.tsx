"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import Logo from "@/components/Logo";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email,public_repo` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") +
    "/auth/callback"
  )}`;

// ─── Inline icons (no emoji, so it reads like a product) ──────────────────────
const ICONS: Record<string, React.ReactElement> = {
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  github: <path d="M9 19c-4 1.4-4-2.2-6-2.6M15 21v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.7 4.7 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.3s-1 -.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6 1.9 5 2.2 5 2.2a4.3 4.3 0 0 0-.1 3.3A4.7 4.7 0 0 0 3.5 8.7c0 4.7 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21" />,
  ticket: <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4zM12 6v12" />,
  puzzle: <path d="M14 4a2 2 0 1 0-4 0H6a1 1 0 0 0-1 1v4a2 2 0 1 1 0 4v4a1 1 0 0 0 1 1h4a2 2 0 1 0 4 0h4a1 1 0 0 0 1-1v-4a2 2 0 1 1 0-4V5a1 1 0 0 0-1-1z" />,
  plug: <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />,
  rocket: <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 11a12 12 0 0 1 8-8c1 0 2 0 3 1s1 2 1 3a12 12 0 0 1-8 8l-2 1-3-3zM14 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />,
  wrench: <path d="M14.5 6.5a3.5 3.5 0 0 0-4.9 4.4l-5 5a1.5 1.5 0 0 0 2.1 2.1l5-5a3.5 3.5 0 0 0 4.4-4.9l-2 2-1.6-1.6z" />,
  pr: <path d="M6 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 8v12M18 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 16V9a3 3 0 0 0-3-3h-3M13 9l-2-3 2-3" />,
  mic: <path d="M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 11v1a6 6 0 0 0 12 0v-1M12 19v2" />,
};

function Ic({ name, size = 20 }: { name: string; size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// ─── Steps — reflects the streamlined flow (extension handles fork/clone/branch/push/PR) ──
const STEPS: {
  num: string; icon: string; color: string; title: string;
  lines: string[]; note: string | null; highlight?: boolean; done?: boolean;
}[] = [
  {
    num: "01", icon: "grid", color: "#EBEBFF", done: true,
    title: "Choose your codebase",
    lines: [
      "On devsimulate.com, pick the stack you want — .NET, Node, Python, C++, React and more.",
      "Click the codebase card that matches your target role.",
    ],
    note: null,
  },
  {
    num: "02", icon: "github", color: "#CCFBF1",
    title: "Sign in with GitHub",
    lines: [
      "Click Sign in with GitHub and approve — it takes a few seconds.",
      "Your work lives on your own fork; we only read your public profile and email.",
    ],
    note: null,
  },
  {
    num: "03", icon: "ticket", color: "#FEF3C7",
    title: "Pick a ticket",
    lines: [
      "Browse the tickets for your codebase — each shows difficulty, the bug, and expected time.",
      "Click Assign to me. The ticket locks to your account and your branch is created automatically.",
    ],
    note: "New here? Start with a Junior or Mid ticket.",
  },
  {
    num: "04", icon: "puzzle", color: "#FCE7F3",
    title: "Install the DevSimulate extension",
    lines: [
      "Open VS Code and press Ctrl+Shift+X (Cmd+Shift+X on Mac) for Extensions.",
      "Search DevSimulate and click Install.",
    ],
    note: null,
  },
  {
    num: "05", icon: "plug", color: "#EBEBFF",
    title: "Connect VS Code",
    lines: [
      "Click the DevSimulate icon in the VS Code sidebar.",
      "Connect with your web session — your assigned ticket appears right there.",
    ],
    note: null,
  },
  {
    num: "06", icon: "rocket", color: "#CCFBF1",
    title: "Open in VS Code — one click sets everything up",
    lines: [
      "Click Open in VS Code next to your ticket.",
      "The extension forks the repo, downloads it, and checks out your branch for you.",
      "No git commands, no manual setup — it opens ready to code.",
    ],
    note: "Let the extension do the setup. Cloning by hand can leave your work unlinked from the ticket.",
  },
  {
    num: "07", icon: "wrench", color: "#FEF3C7", highlight: true,
    title: "Find the root cause, then fix it",
    lines: [
      "Read the ticket twice — it describes a symptom, not the bug.",
      "Explore the code and work out WHY it breaks, not just where.",
      "Make a minimal fix. Use any AI tool you like — you're scored on judgment, not typing.",
    ],
    note: "Diagnosis is 40% of your score. A fix that patches the symptom without understanding the cause scores low.",
  },
  {
    num: "08", icon: "pr", color: "#FCE7F3",
    title: "Push & Create PR — one button",
    lines: [
      "Click Push & Create PR in the extension. It pushes your branch and opens the pull request for you.",
      "In the description, write what was broken, why it broke, and what you changed.",
    ],
    note: "The description is 20% of your score. Write it like a message to a senior engineer — clear and specific.",
  },
  {
    num: "09", icon: "mic", color: "#EBEBFF",
    title: "Submit, then defend your fix",
    lines: [
      "Submit for review. Your score across four dimensions comes back in about a minute.",
      "Answer two quick questions about your change, then record a short spoken defense.",
      "This proves the fix is yours — anyone can paste an answer, few can defend one.",
      "Everything saves to your Dashboard: score history, feedback, and your answers.",
    ],
    note: null,
  },
];

// ─── Inner component ──────────────────────────────────────────────────────────
function GuideContent() {
  const searchParams = useSearchParams();
  const codebaseId = searchParams.get("codebaseId") ?? undefined;
  const [authed, setAuthed] = useState<boolean | null>(null);

  const ticketsHref = codebaseId ? `/tickets?codebaseId=${codebaseId}` : "/tickets";

  useEffect(() => { setAuthed(!!getToken()); }, []);

  function handleGetStarted() {
    localStorage.setItem("ds_guide_seen", "true");
    if (getToken()) {
      window.location.href = ticketsHref;
    } else {
      localStorage.setItem("ds_submit_return", ticketsHref);
      window.location.href = GITHUB_AUTH_URL;
    }
  }

  return (
    <main className="bg-grid min-h-screen" style={{ background: "#F7F6F3" }}>
      <nav className="sticky top-0 z-40 nav-glass px-6 py-3.5 flex items-center justify-between">
        <Link href={ticketsHref} className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
          ← Back to tickets
        </Link>
        <Logo variant="horizontal" size={32} />
        <div className="w-16" />
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-14">
        <div className="text-center mb-12 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-bold"
            style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            How DevSimulate works
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4" style={{ color: "#1A1A1A" }}>
            From ticket to{" "}
            <span className="gradient-text">scored fix</span>
          </h1>
          <p className="text-base max-w-md mx-auto leading-relaxed" style={{ color: "#6B6B6B" }}>
            Nine simple steps. The extension handles the git setup — you focus on the fix.
          </p>
        </div>

        <div className="flex items-center gap-1 mb-10 px-1">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 h-1 rounded-full" style={{ background: s.done ? "#22c55e" : "#E4E2DD" }} />
          ))}
        </div>

        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <div key={step.num} className="card fade-in-up rounded-2xl overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: step.done ? "#DCFCE7" : step.color,
                      border: step.done ? "2px solid #22c55e" : "none",
                      color: step.done ? "#16a34a" : "#5B5BD6",
                    }}>
                    {step.done ? <Ic name="grid" size={18} /> : <Ic name={step.icon} />}
                  </div>
                  {i < STEPS.length - 1 && <div className="w-0.5 mt-2 rounded-full" style={{ height: "18px", background: "#E4E2DD" }} />}
                </div>

                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-black tracking-widest" style={{ color: "#9CA3AF" }}>STEP {step.num}</span>
                    {step.done && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#DCFCE7", color: "#16a34a" }}>Done ✓</span>
                    )}
                  </div>
                  <h3 className="font-black text-base mb-3" style={{ color: "#1A1A1A" }}>{step.title}</h3>
                  <ol className="space-y-2">
                    {step.lines.map((line, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: "#3A3A3A" }}>
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                          style={{ background: step.color, color: "#1A1A1A", minWidth: "20px" }}>{j + 1}</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ol>
                  {step.note && (
                    <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
                      style={{
                        background: step.highlight ? "#FFF7ED" : "#F7F6F3",
                        borderLeft: `3px solid ${step.highlight ? "#F97316" : "#5B5BD6"}`,
                        color: step.highlight ? "#9A3412" : "#4B4B4B",
                      }}>
                      <span className="font-bold" style={{ color: step.highlight ? "#EA580C" : "#5B5BD6" }}>
                        {step.highlight ? "Important: " : "Note: "}
                      </span>
                      {step.note}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card rounded-2xl p-7 mt-8 mb-10 fade-in-up" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", animationDelay: "500ms" }}>
          <h3 className="font-black text-base mb-2" style={{ color: "#92400E" }}>One honest thing before you start</h3>
          <p className="text-sm leading-relaxed" style={{ color: "#78350F" }}>
            Your first ticket takes <strong>a couple of hours</strong>, not 45 minutes — the descriptions are
            intentionally vague, because that&apos;s realistic. A score of <strong>65–75 on your first attempt is solid</strong>.
            The scoring is strict on Diagnosis, because finding the real root cause is the skill that actually matters in production.
          </p>
        </div>

        <div className="text-center fade-in-up" style={{ animationDelay: "550ms" }}>
          <button onClick={handleGetStarted} className="btn-primary text-base px-10 py-4">
            {authed ? "Browse Tickets →" : "Sign in with GitHub — it's free →"}
          </button>
          {authed === false && <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>We only request read access to your public GitHub profile.</p>}
          {authed === true && <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>You&apos;re already signed in — jump straight to tickets.</p>}
          <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>Free plan · 2 tickets/month · No credit card</p>
        </div>
      </div>
    </main>
  );
}

export default function GuidePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F6F3", color: "#6B6B6B" }}>
        Loading...
      </div>
    }>
      <GuideContent />
    </Suspense>
  );
}
