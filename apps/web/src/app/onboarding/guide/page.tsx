"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import Logo from "@/components/Logo";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") +
    "/auth/callback"
  )}`;

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS: {
  num: string;
  icon: string;
  color: string;
  title: string;
  lines: string[];
  note: string | null;
  highlight?: boolean;
  done?: boolean;
}[] = [
  {
    num: "01",
    icon: "🌐",
    color: "#EBEBFF",
    title: "Go to DevSimulate and click Start Free",
    lines: [
      "Visit devsimulate.com in your browser.",
      'Click the "Start free" button in the top navigation.',
      "You land on the codebase selection page.",
    ],
    note: null,
    done: true,
  },
  {
    num: "02",
    icon: "🗂️",
    color: "#CCFBF1",
    title: "Select your codebase",
    lines: [
      "Choose the stack you want to practice — .NET, Python, Node.js, React, DevOps, and more.",
      "Click the codebase card that matches your target role.",
      "You land on the ticket list for that codebase.",
    ],
    note: null,
    done: true,
  },
  {
    num: "03",
    icon: "🐙",
    color: "#FEF3C7",
    title: "Sign in with GitHub",
    lines: [
      'Click "Sign in with GitHub" at the bottom of this page.',
      "GitHub asks you to authorize DevSimulate — click Authorize.",
      "Takes about 5 seconds. We only read your public profile and email.",
      "After login you land on the Tickets page.",
    ],
    note: "We never get write access to your code. The only permission is read:user.",
  },
  {
    num: "04",
    icon: "🎫",
    color: "#FCE7F3",
    title: "Browse tickets and assign yourself one",
    lines: [
      "The Tickets page shows all available NovaTech CRM bugs.",
      "Each card shows: difficulty (JUNIOR, MID, or SENIOR), the bug title, files involved, and expected time.",
      "Pick a ticket that fits your level and click Assign to me.",
      "The ticket is now locked to your account and a branch name is generated automatically.",
    ],
    note: "Start with a JUNIOR or MID ticket on your first attempt. SENIOR tickets assume deep familiarity with the codebase.",
  },
  {
    num: "05",
    icon: "🧩",
    color: "#EBEBFF",
    title: "Install DevSimulate in VS Code",
    lines: [
      "Open VS Code.",
      "Press Ctrl+Shift+X on Windows/Linux or Cmd+Shift+X on Mac to open the Extensions panel.",
      'Search "DevSimulate" in the search box.',
      "Click Install on the DevSimulate extension.",
      "After install a lightning bolt icon appears in the VS Code left sidebar.",
    ],
    note: null,
  },
  {
    num: "06",
    icon: "🔑",
    color: "#CCFBF1",
    title: "Login from VS Code and see your ticket",
    lines: [
      "Click the DevSimulate lightning bolt icon in the VS Code sidebar.",
      'Click "Login with GitHub" inside the sidebar panel.',
      "A browser tab opens — authorize and copy the code shown back into VS Code when prompted.",
      "Once authenticated your assigned ticket appears in the sidebar.",
    ],
    note: null,
  },
  {
    num: "07",
    icon: "📦",
    color: "#FEF3C7",
    title: "Clone the codebase — extension sets up the repo",
    lines: [
      'Click "Clone Codebase" next to your ticket in the VS Code sidebar.',
      "A folder picker opens — choose where you want to clone the repo.",
      "The extension automatically clones the repo and creates your branch.",
      "VS Code reopens with the cloned folder. Your branch is already checked out — ready to code.",
    ],
    note: null,
  },
  {
    num: "08",
    icon: "🔧",
    color: "#FCE7F3",
    title: "Read the ticket, find the root cause, fix it",
    lines: [
      "Open the ticket description in the sidebar. Read it carefully. More than once.",
      "Explore the files listed in the ticket. Understand what the code is supposed to do.",
      "Find the root cause — not just where the error shows up, but WHY it happens.",
      "Write your fix. Test it if you can.",
      "Push your branch: git push origin your-branch-name.",
      "Go to GitHub, open your repo, and click Compare & pull request to open a PR.",
    ],
    note: "40% of your score is Diagnosis — did you understand WHY the bug exists? Fixing the symptom without understanding the cause scores low.",
    highlight: true,
  },
  {
    num: "09",
    icon: "🚀",
    color: "#EBEBFF",
    title: "Copy your PR URL and submit via VS Code",
    lines: [
      "Go to GitHub, open your repository, and navigate to your open Pull Request.",
      "Copy the PR URL from the browser address bar (e.g. https://github.com/you/novatech-crm/pull/1).",
      "Back in VS Code press Ctrl+Shift+P or Cmd+Shift+P to open the command palette.",
      'Type "DevSimulate: Submit PR" and press Enter.',
      "Paste your PR URL when prompted and press Enter.",
      "Your browser opens with the DevSimulate submission form.",
    ],
    note: null,
  },
  {
    num: "10",
    icon: "📝",
    color: "#CCFBF1",
    title: "Describe your fix and hit Submit",
    lines: [
      "In the browser form you see your PR details and a description text area.",
      "Write 3 to 5 sentences about: what the root cause was, why the bug happened, and why your fix is correct.",
      "This description is 20% of your score — do not leave it blank.",
      "Click Submit for Review.",
    ],
    note: "Treat this like a Slack message to a senior engineer. Clear, direct, specific — not a summary of what you changed.",
  },
  {
    num: "11",
    icon: "🤖",
    color: "#FEF3C7",
    title: "Claude reviews your PR and scores it in ~60 seconds",
    lines: [
      "Claude reads your PR diff and your description and scores against the ticket rubric.",
      "After ~60 seconds your score appears with 4 dimensions: Diagnosis (40 pts), Design (30 pts), Communication (20 pts), Execution (10 pts).",
      "Two follow-up questions appear about your specific code changes — answer them honestly.",
      "Strong answers add up to 20 bonus points.",
      "Everything is saved to your Dashboard: score history, Claude feedback, and follow-up Q&A.",
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

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

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

      {/* Nav */}
      <nav className="sticky top-0 z-40 nav-glass px-6 py-3.5 flex items-center justify-between">
        <Link href={ticketsHref}
          className="text-sm font-medium transition-colors"
          style={{ color: "#6B6B6B" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
          ← Back to tickets
        </Link>
        <Logo variant="horizontal" size={32} />
        <div className="w-16" />
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="text-center mb-12 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-bold"
            style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            How DevSimulate works
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4" style={{ color: "#1A1A1A" }}>
            Complete walkthrough —<br />
            <span className="gradient-text">start to scored PR</span>
          </h1>
          <p className="text-base max-w-md mx-auto leading-relaxed" style={{ color: "#6B6B6B" }}>
            11 steps, nothing skipped. Follow this exactly on your first run.
          </p>
        </div>

        {/* Progress strip */}
        <div className="flex items-center gap-1 mb-10 px-1">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 h-1 rounded-full"
              style={{ background: s.done ? "#22c55e" : "#E4E2DD" }} />
          ))}
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <div key={step.num}
              className="card fade-in-up rounded-2xl overflow-hidden"
              style={{ animationDelay: `${i * 50}ms` }}>

              <div className="flex items-start gap-4 p-5 sm:p-6">

                {/* Icon */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                    style={{
                      background: step.done ? "#DCFCE7" : step.color,
                      border: step.done ? "2px solid #22c55e" : "none",
                      fontSize: step.done ? "18px" : "22px",
                    }}>
                    {step.done ? "✓" : step.icon}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-0.5 mt-2 rounded-full"
                      style={{ height: "18px", background: "#E4E2DD" }} />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-1">
                  {/* Step num + done badge */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-black tracking-widest" style={{ color: "#9CA3AF" }}>
                      STEP {step.num}
                    </span>
                    {step.done && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "#DCFCE7", color: "#16a34a" }}>
                        Done ✓
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-black text-base mb-3" style={{ color: "#1A1A1A" }}>
                    {step.title}
                  </h3>

                  {/* Action lines */}
                  <ol className="space-y-2">
                    {step.lines.map((line, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm leading-relaxed"
                        style={{ color: "#3A3A3A" }}>
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                          style={{ background: step.color, color: "#1A1A1A", minWidth: "20px" }}>
                          {j + 1}
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ol>

                  {/* Note */}
                  {step.note && (
                    <div className="mt-3 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
                      style={{
                        background: step.highlight ? "#FFF7ED" : "#F7F6F3",
                        borderLeft: `3px solid ${step.highlight ? "#F97316" : "#5B5BD6"}`,
                        color: step.highlight ? "#9A3412" : "#4B4B4B",
                      }}>
                      <span className="font-bold"
                        style={{ color: step.highlight ? "#EA580C" : "#5B5BD6" }}>
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

        {/* Honest expectation */}
        <div className="card rounded-2xl p-7 mt-8 mb-10 fade-in-up"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A", animationDelay: "600ms" }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">☕</span>
            <div>
              <h3 className="font-black text-base mb-2" style={{ color: "#92400E" }}>
                One honest thing before you start
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#78350F" }}>
                Your first ticket will take <strong>2–4 hours</strong>, not 45 minutes.
                The bug descriptions are intentionally vague — that is realistic.
                A score of <strong>65–75 on your first attempt is solid</strong>.
                Claude is strict on Diagnosis because root cause analysis is the skill that actually matters in production.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center fade-in-up" style={{ animationDelay: "650ms" }}>
          <p className="text-sm font-medium mb-4" style={{ color: "#6B6B6B" }}>
            Steps 1 and 2 are done. Pick up from Step 3 below.
          </p>
          <button onClick={handleGetStarted} className="btn-primary text-base px-10 py-4">
            {authed
              ? "Browse Tickets →"
              : "Sign in with GitHub — it’s free →"}
          </button>
          {authed === false && (
            <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
              We only request read access to your public GitHub profile.
            </p>
          )}
          {authed === true && (
            <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
              You are already signed in. Jump straight to tickets.
            </p>
          )}
          <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
            Free plan · 2 tickets/month · No credit card
          </p>
        </div>

      </div>
    </main>
  );
}

// ─── Export with Suspense for useSearchParams ─────────────────────────────────

export default function GuidePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "#F7F6F3", color: "#6B6B6B" }}>
        Loading...
      </div>
    }>
      <GuideContent />
    </Suspense>
  );
}
