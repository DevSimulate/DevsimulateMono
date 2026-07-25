"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { ScoreReceipt } from "@/components/ui/ScoreReceipt";

const CANDIDATE_URL = "/onboarding/select";
const EMPLOYER_URL = "/employer/campaigns";

const STAGES = [
  { num: "01", title: "Get a real ticket", body: "An ambiguous ticket from a real company codebase — a symptom to chase, not a puzzle to solve." },
  { num: "02", title: "Fix it, then write it up", body: "Use any AI tool you like. We don't measure typing — we measure judgment. Open a PR and describe your fix." },
  { num: "03", title: "Three independent AI passes review it", body: "The diff, the write-up, and the reasoning are each scored separately, then reconciled." },
  { num: "04", title: "Answer two follow-up questions", body: "Fifteen minutes, no notice of what's coming. This tests whether you understand your own fix." },
  { num: "05", title: "Defend it out loud", body: "A spoken defence of your own change — the one part of the process an AI answer can't fake." },
];

const SCORING = [
  { label: "Diagnosis", pct: 40, desc: "Finding the real root cause" },
  { label: "Design", pct: 30, desc: "Trade-offs and judgment" },
  { label: "Communication", pct: 20, desc: "Explaining the why" },
  { label: "Execution", pct: 10, desc: "Does it actually work" },
];

const PRINCIPLES = [
  "A tooling failure never costs you points.",
  "Every deduction is evidence-linked — nothing is subtracted without a reason you can see.",
  "Your AI-tool declaration never changes your score.",
  "Flags are advisory. A human always makes the final call.",
  "Audio is never stored — only the transcript is kept.",
];

const HERO_RECEIPT = {
  prBaseScore: 82,
  finalScore: 76,
  lineItems: [
    { label: "Diagnosis", weight: 40, score: 34 },
    { label: "Design", weight: 30, score: 25 },
    { label: "Communication", weight: 20, score: 15 },
    { label: "Execution", weight: 10, score: 8 },
  ],
  deductions: [
    { label: "Verbal defence", amount: 6, note: "Follow-up answers were thinner than the PR itself." },
  ],
};

export default function LandingPage(): React.ReactElement {
  return (
    <main className="bg-paper min-h-screen overflow-x-hidden text-ink">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-surface border-b border-hairline px-6 py-3.5 flex items-center justify-between">
        <Logo variant="horizontal" size={30} />
        <div className="hidden md:flex items-center gap-8">
          {[["How it works", "#how-it-works"], ["Scoring", "#scoring"], ["Leaderboard", "/leaderboard"]].map(([label, href]) => (
            <a key={label} href={href} className="text-sm font-medium text-muted hover:text-ink transition-colors duration-150">{label}</a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Link href={EMPLOYER_URL} className="text-sm font-medium text-muted hover:text-ink hidden sm:block transition-colors duration-150">For employers</Link>
          <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink hidden sm:block transition-colors duration-150">Dashboard</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 pt-20 pb-24 max-w-5xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <div className="inline-block text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border border-hairline text-muted mb-5">
            Technical assessment, verified
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.1] mb-5">
            An assessment an AI can pass — but can&apos;t defend.
          </h1>
          <p className="text-base text-muted max-w-md mb-8 leading-relaxed">
            Candidates solve a real engineering ticket, in any AI tool they like, then defend their fix out loud.
            Every point on the score traces back to evidence you can read or listen to yourself.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={EMPLOYER_URL}><Button variant="primary" size="lg" className="w-full sm:w-auto">Run an assessment</Button></Link>
            <Link href={CANDIDATE_URL}><Button variant="secondary" size="lg" className="w-full sm:w-auto">I&apos;m a candidate</Button></Link>
          </div>
        </div>

        <div className="lg:justify-self-end w-full max-w-sm">
          <div className="text-xs text-muted font-mono mb-2">NOVA-47 · NovaTech CRM</div>
          <ScoreReceipt variant="full" animate data={HERO_RECEIPT} />
        </div>
      </section>

      {/* ── Five stages ── */}
      <section id="how-it-works" className="py-24 px-6 border-t border-hairline">
        <div className="max-w-4xl mx-auto">
          <div className="mb-14">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">How it works</div>
            <h2 className="font-display text-3xl font-bold">Five stages, including the one that can&apos;t be faked</h2>
          </div>
          <div className="flex flex-col">
            {STAGES.map(({ num, title, body }, i) => (
              <div key={num} className={`flex gap-6 py-6 ${i < STAGES.length - 1 ? "border-b border-hairline" : ""}`}>
                <div className="font-mono text-sm text-muted w-8 shrink-0 pt-0.5">{num}</div>
                <div>
                  <h3 className="font-semibold text-base mb-1">{title}</h3>
                  <p className="text-sm text-muted leading-relaxed max-w-xl">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scoring ── */}
      <section id="scoring" className="py-24 px-6 border-t border-hairline bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="mb-14">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">The scoring model</div>
            <h2 className="font-display text-3xl font-bold">Execution is only 10%</h2>
            <p className="mt-3 max-w-xl text-sm text-muted leading-relaxed">
              Shipping code that works is table stakes. Understanding why the bug existed is what the score actually weighs.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline rounded border border-hairline overflow-hidden">
            {SCORING.map(({ label, pct, desc }) => (
              <div key={label} className="bg-surface p-6">
                <div className="font-mono text-3xl font-bold mb-1">{pct}%</div>
                <div className="font-semibold text-sm mb-1">{label}</div>
                <div className="text-xs text-muted">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What employers see ── */}
      <section className="py-24 px-6 border-t border-hairline">
        <div className="max-w-4xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">What employers see</div>
            <h2 className="font-display text-3xl font-bold mb-4">Strong code and weak defence look different — on purpose.</h2>
            <p className="text-sm text-muted leading-relaxed mb-4">
              When the PR review score and the final score diverge, that gap is surfaced as its own signal — not
              buried in the total. A wide gap usually means the code was solid but the candidate couldn&apos;t
              explain it under follow-up. The transcript is one click away.
            </p>
            <p className="text-sm text-muted leading-relaxed">
              Every flag is labelled advisory. Nothing is auto-rejected — the final decision rests with the
              hiring team, with the evidence attached.
            </p>
          </div>
          <div className="rounded border border-hairline bg-surface p-5 font-mono text-sm">
            <div className="flex justify-between text-xs text-muted uppercase tracking-wide mb-3">
              <span>Candidate</span><span>PR → Final</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-hairline">
              <span className="text-ink">@octocat</span>
              <span className="flex items-center gap-2">
                <span className="text-muted">82</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--signal-amber-weak)", color: "var(--signal-amber)" }}
                  title="strong code, weak defence — review the transcript"
                >
                  −6
                </span>
                <span className="text-muted">→</span>
                <span className="font-display font-bold text-ink text-base">76</span>
              </span>
            </div>
            <p className="font-sans text-xs text-muted mt-2 normal-case leading-relaxed">
              Amber gap chip · &ldquo;strong code, weak defence — review the transcript&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* ── Fairness principles ── */}
      <section className="py-24 px-6 border-t border-hairline bg-surface">
        <div className="max-w-2xl mx-auto">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2 text-center">Fairness, in plain terms</div>
          <h2 className="font-display text-3xl font-bold mb-10 text-center">What we promise every candidate</h2>
          <ul className="flex flex-col gap-4">
            {PRINCIPLES.map((p) => (
              <li key={p} className="flex gap-3 items-start text-sm leading-relaxed">
                <span className="text-emerald mt-1 shrink-0">—</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6 border-t border-hairline">
        <div className="max-w-xl mx-auto text-center">
          <div className="flex justify-center mb-6"><Logo variant="icon" size={48} /></div>
          <h2 className="font-display text-3xl font-bold mb-4">Ready to see how it holds up?</h2>
          <p className="text-sm text-muted mb-8 leading-relaxed">
            Run an assessment for your next hire, or take one yourself and find out where you stand.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={EMPLOYER_URL}><Button variant="primary" size="lg" className="w-full sm:w-auto">Run an assessment</Button></Link>
            <Link href={CANDIDATE_URL}><Button variant="secondary" size="lg" className="w-full sm:w-auto">I&apos;m a candidate</Button></Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t border-hairline bg-surface">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="horizontal" size={26} />
          <p className="text-sm text-muted">© 2026 DevSimulate. Real tickets. Real defense.</p>
          <div className="flex gap-6 text-sm text-muted">
            <Link href="/dashboard" className="hover:text-ink transition-colors duration-150">Dashboard</Link>
            <Link href={EMPLOYER_URL} className="hover:text-ink transition-colors duration-150">For employers</Link>
            <a href="mailto:ossama@devsimulate.com" className="hover:text-ink transition-colors duration-150">ossama@devsimulate.com</a>
          </div>
        </div>
      </footer>

    </main>
  );
}
