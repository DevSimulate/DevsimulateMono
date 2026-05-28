"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import clsx from "clsx";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Ticket {
  id: string;
  title: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  description: string;
  filesInvolved: string[];
  expectedMinutes: number;
}

interface FollowUp {
  id: string;
  question1: string;
  question2: string;
}

interface ReviewResult {
  scoreTotal: number;
  scoreDiagnosis: number;
  scoreDesign: number;
  scoreCommunication: number;
  scoreExecution: number;
  claudeReview: {
    summary: string;
    topStrength: string;
    topImprovement: string;
  } | null;
  followUpFeedback: string | null;
  scoreBonus: number;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  JUNIOR: "bg-[#CCFBF1] text-[#0D9488]",
  MID: "bg-[#FEF3C7] text-[#D97706]",
  SENIOR: "bg-[#FCE7F3] text-[#BE185D]",
};

type AIDeclaration =
  | "NO_AI_USED"
  | "AI_USED_FOR_PHRASING"
  | "AI_USED_FOR_UNDERSTANDING"
  | "AI_USED_FOR_ANSWER";

const AI_OPTIONS: { value: AIDeclaration; label: string; sub: string }[] = [
  { value: "NO_AI_USED",                label: "I wrote my answers myself",            sub: "No AI tools used" },
  { value: "AI_USED_FOR_PHRASING",      label: "AI helped me phrase my answers",       sub: "Ideas are mine, AI polished the wording" },
  { value: "AI_USED_FOR_UNDERSTANDING", label: "AI helped me understand the concepts", sub: "Used AI to learn, answered in my own words" },
  { value: "AI_USED_FOR_ANSWER",        label: "AI wrote my answers",                  sub: "AI generated the answer text" },
];

type Stage = "loading" | "describe" | "analysing" | "questions" | "scoring" | "score";

const STAGE_LABELS = ["Describe", "Analysing", "Questions", "Score"];
const STAGE_ORDER: Stage[] = ["describe", "analysing", "questions", "scoring", "score"];

function ScoreBar({ label, value, max }: { label: string; value: number | null; max: number }) {
  const pct = value !== null ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-xs shrink-0" style={{ color: "#6B6B6B" }}>{label}</div>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#E4E2DD" }}>
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-xs text-right font-bold shrink-0" style={{ color: "#1A1A1A" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function SubmitPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const ticketId   = params.get("ticketId")   ?? "";
  const prUrl      = params.get("prUrl")      ?? "";
  const branchName = params.get("branchName") ?? "";

  const [stage,        setStage]        = useState<Stage>("loading");
  const [ticket,       setTicket]       = useState<Ticket | null>(null);
  const [description,  setDescription]  = useState("");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [followUp,     setFollowUp]     = useState<FollowUp | null>(null);
  const [answer1,      setAnswer1]      = useState("");
  const [answer2,      setAnswer2]      = useState("");
  const [declaration,  setDeclaration]  = useState<AIDeclaration | null>(null);
  const [result,       setResult]       = useState<ReviewResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [timeLeft,     setTimeLeft]     = useState(600);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auth check + ticket fetch
  useEffect(() => {
    const token = getToken();
    if (!token) {
      if (typeof window !== "undefined") {
        localStorage.setItem("ds_submit_return", window.location.href);
      }
      router.push("/");
      return;
    }

    if (!ticketId || !prUrl) {
      setError("Missing ticket information. Please re-submit from the VS Code extension.");
      setStage("describe");
      return;
    }

    fetch(`${API_URL}/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setTicket(data.data);
        setStage("describe");
      })
      .catch(() => setStage("describe"));
  }, [ticketId, prUrl, router]);

  // 10-minute countdown for questions stage
  useEffect(() => {
    if (stage === "questions") {
      setTimeLeft(600);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  async function handleDescriptionSubmit() {
    const token = getToken();
    if (!token) return;
    setError(null);
    setStage("analysing");

    try {
      const r = await fetch(`${API_URL}/submissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, prUrl, prDescription: description, branchName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Submission failed");

      const sid: string = data.data.id;
      setSubmissionId(sid);
      await pollForReview(sid, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed — please try again.");
      setStage("describe");
    }
  }

  async function pollForReview(sid: string, token: string) {
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      try {
        const r = await fetch(`${API_URL}/submissions/${sid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (data.data?.status === "REVIEWED") {
          const qr = await fetch(`${API_URL}/submissions/${sid}/followup`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (qr.ok) {
            const qdata = await qr.json();
            setFollowUp(qdata.data);
            setStage("questions");
            return;
          }
        }
      } catch { /* keep polling */ }
    }
    setError("Review is taking longer than expected. Check your dashboard or try again.");
    setStage("describe");
  }

  async function handleAnswersSubmit() {
    if (!answer1.trim() || !answer2.trim() || !declaration || !submissionId) return;
    const token = getToken();
    if (!token) return;
    setStage("scoring");

    try {
      const r = await fetch(`${API_URL}/submissions/${submissionId}/followup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answer1, answer2, aiDeclaration: declaration }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Scoring failed");

      const sr = await fetch(`${API_URL}/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sdata = await sr.json();
      const sub = sdata.data;

      setResult({
        scoreTotal:          sub.scoreTotal          ?? 0,
        scoreDiagnosis:      sub.scoreDiagnosis      ?? 0,
        scoreDesign:         sub.scoreDesign         ?? 0,
        scoreCommunication:  sub.scoreCommunication  ?? 0,
        scoreExecution:      sub.scoreExecution      ?? 0,
        claudeReview:        sub.claudeReview        ?? null,
        followUpFeedback:    data.data.feedback      ?? null,
        scoreBonus:          data.data.scoreBonus    ?? 0,
      });
      setStage("score");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed — please try again.");
      setStage("questions");
    }
  }

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");

  const stageIndex = STAGE_ORDER.indexOf(stage);

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center text-sm" style={{ color: "#6B6B6B" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">

      {/* Header */}
      <header className="nav-glass sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="font-black text-lg tracking-tight" style={{ color: "#1A1A1A" }}>DevSimulate</span>
        </Link>
        <Link href="/dashboard" className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6B6B6B")}>
          Dashboard →
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8">
          {STAGE_LABELS.map((label, i) => {
            const normalised = stage === "scoring" ? 3 : stageIndex;
            const done   = i < normalised;
            const active = i === normalised || (stage === "score" && i === 3);
            return (
              <div key={label} className="flex items-center gap-1 flex-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={clsx(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    done   ? "bg-[#0D9488] text-white" :
                    active ? "bg-[#5B5BD6] text-white" :
                             "bg-[#E4E2DD] text-[#6B6B6B]"
                  )}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={clsx(
                    "text-xs font-medium hidden sm:block",
                    active || done ? "text-[#1A1A1A]" : "text-[#6B6B6B]"
                  )}>
                    {label}
                  </span>
                </div>
                {i < STAGE_LABELS.length - 1 && (
                  <div className="flex-1 h-px mx-2" style={{ background: done ? "#0D9488" : "#E4E2DD" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Ticket info bar */}
        {ticket && stage !== "score" && (
          <div className="card p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate mb-0.5" style={{ color: "#1A1A1A" }}>
                  {ticket.title}
                </div>
                <a href={prUrl} target="_blank" rel="noreferrer"
                  className="text-xs font-mono truncate block hover:underline" style={{ color: "#5B5BD6" }}>
                  {prUrl}
                </a>
              </div>
              <span className={clsx("text-xs font-bold rounded-full px-3 py-1 shrink-0", DIFFICULTY_COLOR[ticket.difficulty])}>
                {ticket.difficulty}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 px-4 py-3 mb-6 text-sm"
            style={{ background: "#FFF5F5", color: "#DC2626" }}>
            {error}
          </div>
        )}

        {/* ── Stage 1: Describe ── */}
        {stage === "describe" && (
          <div className="card p-6 fade-in-up">
            <div className="section-label mb-1">Your Approach</div>
            <p className="text-sm mb-5" style={{ color: "#6B6B6B" }}>
              Explain your fix. What was the root cause? How did you find it? Why did you choose this solution?
              This is what Claude will score — be specific.
            </p>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={[
                "## What was the root cause?",
                "",
                "## How did you investigate?",
                "",
                "## Why did you choose this solution?",
                "",
                "## How do you know it works?",
              ].join("\n")}
              rows={12}
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none resize-none mb-3 font-mono"
              style={{ borderColor: "#E4E2DD", background: "#F7F6F3", color: "#1A1A1A", lineHeight: 1.7 }}
            />

            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-medium" style={{ color: description.length < 100 ? "#D97706" : "#0D9488" }}>
                {description.length} chars
                {description.length < 100 ? ` — write at least ${100 - description.length} more` : " — ready to submit"}
              </span>
              <span className="text-xs" style={{ color: "#6B6B6B" }}>
                Est. {ticket?.expectedMinutes ?? "—"} min ticket
              </span>
            </div>

            <button
              onClick={handleDescriptionSubmit}
              disabled={description.trim().length < 100}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              Submit for Review →
            </button>
          </div>
        )}

        {/* ── Stage 2: Analysing ── */}
        {stage === "analysing" && (
          <div className="card p-10 text-center fade-in-up">
            <div className="inline-block w-12 h-12 rounded-full border-4 border-[#5B5BD6] border-t-transparent animate-spin mb-5" />
            <div className="font-bold text-base mb-2" style={{ color: "#1A1A1A" }}>Analysing your PR…</div>
            <div className="text-sm mb-8" style={{ color: "#6B6B6B" }}>
              Claude is reading your diff.<br />Follow-up questions will appear here in ~20 seconds.
            </div>
            <div className="rounded-xl p-5 text-left space-y-3" style={{ background: "#F7F6F3", border: "1px solid #E4E2DD" }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#6B6B6B" }}>
                What to expect
              </div>
              {[
                "2 questions specific to your actual code changes",
                "They test whether you understood the root cause, not just the fix",
                "You'll have 10 minutes to answer both",
                "Your score combines the PR review + your answers",
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-2 text-xs" style={{ color: "#6B6B6B" }}>
                  <span className="shrink-0 mt-0.5" style={{ color: "#5B5BD6" }}>→</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stage 3: Questions ── */}
        {stage === "questions" && followUp && (
          <div className="card p-6 fade-in-up">
            <div className="flex items-center justify-between mb-5">
              <div className="section-label">Follow-up Questions</div>
              <span className={clsx(
                "text-sm font-mono font-bold tabular-nums",
                timeLeft < 120 ? "text-red-500" :
                timeLeft < 300 ? "text-[#D97706]" :
                                 "text-[#6B6B6B]"
              )}>
                ⏱ {mins}:{secs}
              </span>
            </div>

            <div className="space-y-6 mb-6">
              {([
                { q: followUp.question1, val: answer1, set: setAnswer1, label: "Q1" },
                { q: followUp.question2, val: answer2, set: setAnswer2, label: "Q2" },
              ] as const).map(({ q, val, set, label }) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
                      style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
                      {label[1]}
                    </span>
                    <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{q}</p>
                  </div>
                  <textarea
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder="Your answer…"
                    rows={4}
                    disabled={timeLeft === 0}
                    className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none resize-none disabled:opacity-50"
                    style={{ borderColor: "#E4E2DD", background: "#F7F6F3", color: "#1A1A1A" }}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-4 mb-5 space-y-2" style={{ borderColor: "#E4E2DD", background: "white" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#6B6B6B" }}>
                How did you answer these questions?
              </p>
              {AI_OPTIONS.map((opt) => (
                <label key={opt.value} className={clsx(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  declaration === opt.value
                    ? "border-[#5B5BD6] bg-[#EBEBFF]"
                    : "border-[#E4E2DD] hover:border-[#C4C2DB]"
                )}>
                  <input
                    type="radio"
                    name="aiDeclaration"
                    value={opt.value}
                    checked={declaration === opt.value}
                    onChange={() => setDeclaration(opt.value)}
                    className="mt-0.5 shrink-0"
                    style={{ accentColor: "#5B5BD6" }}
                  />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{opt.label}</div>
                    <div className="text-xs" style={{ color: "#6B6B6B" }}>{opt.sub}</div>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={handleAnswersSubmit}
              disabled={!answer1.trim() || !answer2.trim() || !declaration || timeLeft === 0}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {timeLeft === 0
                ? "Time expired"
                : !declaration
                ? "Select how you answered to continue"
                : "Get My Score →"}
            </button>
          </div>
        )}

        {/* ── Stage 4: Scoring ── */}
        {stage === "scoring" && (
          <div className="card p-10 text-center fade-in-up">
            <div className="inline-block w-12 h-12 rounded-full border-4 border-[#0D9488] border-t-transparent animate-spin mb-5" />
            <div className="font-bold text-base mb-2" style={{ color: "#1A1A1A" }}>Calculating your score…</div>
            <div className="text-sm" style={{ color: "#6B6B6B" }}>
              Combining your PR review with your answers. Almost done.
            </div>
          </div>
        )}

        {/* ── Stage 5: Score ── */}
        {stage === "score" && result && (
          <div className="space-y-5 fade-in-up">

            {ticket && (
              <div className="text-center mb-2">
                <div className="text-sm font-semibold" style={{ color: "#6B6B6B" }}>{ticket.title}</div>
              </div>
            )}

            {/* Big score */}
            <div className="card shine p-8 text-center">
              <div className="text-6xl font-black gradient-text leading-none mb-1">
                {result.scoreTotal}
              </div>
              <div className="text-sm font-semibold mb-3" style={{ color: "#6B6B6B" }}>/100</div>
              {result.scoreBonus > 0 && (
                <div className="inline-block text-xs font-bold rounded-full px-4 py-1"
                  style={{ background: "#CCFBF1", color: "#0D9488" }}>
                  +{result.scoreBonus} pts from follow-up answers
                </div>
              )}
            </div>

            {/* Score bars */}
            <div className="card p-6">
              <div className="section-label mb-4">Score Breakdown</div>
              <div className="space-y-3">
                <ScoreBar label="Diagnosis (40)"     value={result.scoreDiagnosis}     max={40} />
                <ScoreBar label="Design (30)"        value={result.scoreDesign}        max={30} />
                <ScoreBar label="Communication (20)" value={result.scoreCommunication} max={20} />
                <ScoreBar label="Execution (10)"     value={result.scoreExecution}     max={10} />
              </div>
            </div>

            {/* Claude feedback */}
            {result.claudeReview && (
              <div className="card p-6">
                <div className="section-label mb-4">Claude&rsquo;s Feedback</div>
                <p className="text-sm italic leading-relaxed mb-5" style={{ color: "#6B6B6B" }}>
                  &ldquo;{result.claudeReview.summary}&rdquo;
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl p-4" style={{ background: "#CCFBF1", border: "1px solid #A7F3D0" }}>
                    <div className="text-xs font-bold mb-2" style={{ color: "#0D9488" }}>Top strength</div>
                    <div className="text-sm" style={{ color: "#1A1A1A" }}>{result.claudeReview.topStrength}</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                    <div className="text-xs font-bold mb-2" style={{ color: "#D97706" }}>Top improvement</div>
                    <div className="text-sm" style={{ color: "#1A1A1A" }}>{result.claudeReview.topImprovement}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Follow-up feedback */}
            {result.followUpFeedback && (
              <div className="rounded-xl px-5 py-4 text-sm leading-relaxed"
                style={{ background: "#EBEBFF", border: "1px solid #C4C2DB" }}>
                <span className="font-bold" style={{ color: "#5B5BD6" }}>Assessment: </span>
                <span style={{ color: "#1A1A1A" }}>{result.followUpFeedback}</span>
              </div>
            )}

            <Link href="/dashboard" className="btn-primary w-full text-center block">
              Back to Dashboard →
            </Link>

          </div>
        )}

      </main>
    </div>
  );
}

export default function SubmitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-grid flex items-center justify-center text-sm" style={{ color: "#6B6B6B" }}>
        Loading…
      </div>
    }>
      <SubmitPageInner />
    </Suspense>
  );
}
