"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { getToken } from "@/lib/auth";
import { FREE_MONTHLY_ASSESSMENTS } from "@/lib/limits";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email,public_repo` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") +
    "/auth/callback"
  )}`;

// ─── Steps — reflects the streamlined flow (extension handles fork/clone/branch/push/PR) ──
const STEPS: {
  num: string; title: string; lines: string[]; note: string | null; highlight?: boolean; done?: boolean;
}[] = [
  {
    num: "01", done: true,
    title: "Choose your codebase",
    lines: [
      "On devsimulate.com, pick the stack you want — .NET, Node, Python, C++, React and more.",
      "Click the codebase card that matches your target role.",
    ],
    note: null,
  },
  {
    num: "02",
    title: "Sign in with GitHub",
    lines: [
      "Click Sign in with GitHub and approve — it takes a few seconds.",
      "Your work lives on your own fork; we only read your public profile and email.",
    ],
    note: null,
  },
  {
    num: "03",
    title: "Pick a ticket",
    lines: [
      "Browse the tickets for your codebase — each shows difficulty, the bug, and expected time.",
      "Click Assign to me. The ticket locks to your account and your branch is created automatically.",
    ],
    note: "New here? Start with a Junior or Mid ticket.",
  },
  {
    num: "04",
    title: "Install the DevSimulate extension",
    lines: [
      "Open VS Code and press Ctrl+Shift+X (Cmd+Shift+X on Mac) for Extensions.",
      "Search DevSimulate and click Install.",
    ],
    note: null,
  },
  {
    num: "05",
    title: "Connect VS Code",
    lines: [
      "Click the DevSimulate icon in the VS Code sidebar.",
      "Connect with your web session — your assigned ticket appears right there.",
    ],
    note: null,
  },
  {
    num: "06",
    title: "Open in VS Code — one click sets everything up",
    lines: [
      "Click Open in VS Code next to your ticket.",
      "The extension forks the repo, downloads it, and checks out your branch for you.",
      "No git commands, no manual setup — it opens ready to code.",
    ],
    note: "Let the extension do the setup. Cloning by hand can leave your work unlinked from the ticket.",
  },
  {
    num: "07", highlight: true,
    title: "Find the root cause, then fix it",
    lines: [
      "Read the ticket twice — it describes a symptom, not the bug.",
      "Explore the code and work out WHY it breaks, not just where.",
      "Make a minimal fix. Use any AI tool you like — you're scored on judgment, not typing.",
    ],
    note: "Diagnosis is 40% of your score. A fix that patches the symptom without understanding the cause scores low.",
  },
  {
    num: "08",
    title: "Push & Create PR — one button",
    lines: [
      "Click Push & Create PR in the extension. It pushes your branch and opens the pull request for you.",
      "In the description, write what was broken, why it broke, and what you changed.",
    ],
    note: "The description is 20% of your score. Write it like a message to a senior engineer — clear and specific.",
  },
  {
    num: "09",
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
    <main className="min-h-screen bg-paper text-ink">
      <nav className="sticky top-0 z-40 bg-surface border-b border-hairline px-6 py-3.5 flex items-center justify-between">
        <Link href={ticketsHref} className="text-sm font-medium text-muted hover:text-ink transition-colors duration-150">← Back to tickets</Link>
        <Logo variant="horizontal" size={30} />
        <div className="w-16" />
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-14">
        <div className="text-center mb-12">
          <Badge tone="neutral" className="mb-4">How DevSimulate works</Badge>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
            From ticket to scored fix
          </h1>
          <p className="text-base text-muted max-w-md mx-auto leading-relaxed">
            Nine simple steps. The extension handles the git setup — you focus on the fix.
          </p>
        </div>

        <div className="flex items-center gap-1 mb-10 px-1">
          {STEPS.map((s) => (
            <div key={s.num} className={`flex-1 h-1 rounded-full ${s.done ? "bg-emerald" : "bg-hairline"}`} />
          ))}
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <Card key={step.num} className="overflow-hidden">
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <div className="shrink-0 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded flex items-center justify-center font-mono text-xs font-bold ${step.done ? "bg-emerald-weak text-emerald border border-[rgba(11,122,94,0.25)]" : "bg-paper text-muted border border-hairline"}`}>
                    {step.num}
                  </div>
                  {i < STEPS.length - 1 && <div className="w-px mt-2 bg-hairline" style={{ height: "18px" }} />}
                </div>

                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted">Step {step.num}</span>
                    {step.done && <Badge tone="good">Done</Badge>}
                  </div>
                  <h3 className="font-semibold text-base mb-3">{step.title}</h3>
                  <ol className="space-y-2">
                    {step.lines.map((line, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 bg-paper text-muted border border-hairline" style={{ minWidth: "20px" }}>
                          {j + 1}
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ol>
                  {step.note && (
                    <div className={`mt-3 rounded px-3.5 py-2.5 text-xs leading-relaxed border-l-2 ${step.highlight ? "border-amber bg-amber-weak text-amber" : "border-hairline bg-paper text-muted"}`}>
                      <span className="font-semibold">{step.highlight ? "Important: " : "Note: "}</span>
                      {step.note}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-7 mt-8 mb-10" style={{ background: "var(--signal-amber-weak)", borderColor: "rgba(183,121,31,0.25)" }}>
          <h3 className="font-semibold text-base mb-2 text-ink">One honest thing before you start</h3>
          <p className="text-sm leading-relaxed text-ink">
            Your first ticket takes <strong>a couple of hours</strong>, not 45 minutes — the descriptions are
            intentionally vague, because that&apos;s realistic. A score of <strong>65–75 on your first attempt is solid</strong>.
            The scoring is strict on Diagnosis, because finding the real root cause is the skill that actually matters in production.
          </p>
        </Card>

        <div className="text-center">
          <Button variant="primary" size="lg" onClick={handleGetStarted} className="px-10">
            {authed ? "Browse tickets →" : "Sign in with GitHub — it's free →"}
          </Button>
          {authed === false && <p className="text-xs mt-3 text-muted">We only request read access to your public GitHub profile.</p>}
          {authed === true && <p className="text-xs mt-3 text-muted">You&apos;re already signed in — jump straight to tickets.</p>}
          <p className="text-xs mt-3 text-muted">{FREE_MONTHLY_ASSESSMENTS} assessments/month · No credit card</p>
        </div>
      </div>
    </main>
  );
}

export default function GuidePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-paper text-muted text-sm">Loading…</div>}>
      <GuideContent />
    </Suspense>
  );
}
