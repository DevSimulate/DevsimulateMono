"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/auth";
import { getMe, getSubmissions, getAssignment, getScoreHistory, ScoreHistoryPoint } from "@/lib/api";
import { User, Submission, TicketAssignment, ClaudeReview, Difficulty } from "@devsimulate/shared";
import clsx from "clsx";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Dot,
} from "recharts";

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  JUNIOR: "bg-[#CCFBF1] text-[#0D9488]",
  MID: "bg-[#FEF3C7] text-[#D97706]",
  SENIOR: "bg-[#FCE7F3] text-[#BE185D]",
};

function ScoreBar({ label, value, max }: { label: string; value: number | null; max: number }) {
  const pct = value !== null ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs shrink-0" style={{ color: "#6B6B6B" }}>{label}</div>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#E4E2DD" }}>
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-xs text-right font-bold shrink-0" style={{ color: "#1A1A1A" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

type AIUsageDeclaration =
  | "NO_AI_USED"
  | "AI_USED_FOR_PHRASING"
  | "AI_USED_FOR_UNDERSTANDING"
  | "AI_USED_FOR_ANSWER";

const AI_DECLARATION_OPTIONS: { value: AIUsageDeclaration; label: string; sub: string }[] = [
  { value: "NO_AI_USED",                label: "I wrote my answers myself",            sub: "No AI tools used" },
  { value: "AI_USED_FOR_PHRASING",      label: "AI helped me phrase my answers",       sub: "The ideas are mine, AI polished the wording" },
  { value: "AI_USED_FOR_UNDERSTANDING", label: "AI helped me understand the concepts", sub: "I used AI to learn, then answered in my own words" },
  { value: "AI_USED_FOR_ANSWER",        label: "AI wrote my answers",                  sub: "AI generated the answer text" },
];

interface FollowUp {
  id: string;
  question1: string;
  question2: string;
  answer1: string | null;
  answer2: string | null;
  scoreBonus: number | null;
  claudeFeedback: string | null;
  answeredAt: string | null;
}

function FollowUpSection({
  submissionId,
  preloadedFollowUp,
  onAnswered,
}: {
  submissionId: string;
  preloadedFollowUp: FollowUp | null;
  onAnswered: (scoreBonus: number, feedback: string) => void;
}) {
  const [followUp, setFollowUp] = useState<FollowUp | null>(preloadedFollowUp);
  const [loading, setLoading] = useState(false);
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [declaration, setDeclaration] = useState<AIUsageDeclaration | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timerActive, timeLeft]);

  async function handleLoad() {
    setLoading(true);
    const token = getToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    try {
      const r = await fetch(`${apiUrl}/submissions/${submissionId}/followup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { setLoading(false); return; }
      const data = await r.json();
      setFollowUp(data.data);
      if (!data.data.answeredAt) setTimerActive(true);
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!answer1.trim() || !answer2.trim() || !declaration) return;
    setSubmitting(true);
    const token = getToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    try {
      const r = await fetch(`${apiUrl}/submissions/${submissionId}/followup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answer1, answer2, aiDeclaration: declaration }),
      });
      const data = await r.json();
      setTimerActive(false);
      onAnswered(data.data.scoreBonus, data.data.feedback);
    } catch { /* silent */ }
    setSubmitting(false);
  }

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");

  if (!followUp) {
    return (
      <button
        onClick={handleLoad}
        disabled={loading}
        className="w-full rounded-xl border-2 border-dashed text-sm font-semibold py-3 transition-colors"
        style={{ borderColor: "#5B5BD6", color: "#5B5BD6", background: "#EBEBFF" }}
      >
        {loading ? "Loading questions…" : "⚡ Answer 2 questions to reveal your score"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: "#E4E2DD", background: "#F7F6F3" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#5B5BD6" }}>
          Follow-up Questions
        </span>
        {timerActive && (
          <span className={clsx("text-xs font-mono font-bold", timeLeft < 120 ? "text-red-500" : "text-[#D97706]")}>
            ⏱ {mins}:{secs}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {([
          { q: followUp.question1, val: answer1, set: setAnswer1, label: "Q1" },
          { q: followUp.question2, val: answer2, set: setAnswer2, label: "Q2" },
        ] as const).map(({ q, val, set, label }) => (
          <div key={label}>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#1A1A1A" }}>{label}: {q}</p>
            <textarea
              value={val}
              onChange={(e) => set(e.target.value)}
              placeholder="Your answer…"
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-xs focus:outline-none resize-none"
              style={{ borderColor: "#E4E2DD", background: "white", color: "#1A1A1A" }}
            />
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "#E4E2DD", background: "white" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6B6B6B" }}>
          How did you answer?
        </p>
        {AI_DECLARATION_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={clsx(
              "flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
              declaration === opt.value
                ? "border-[#5B5BD6] bg-[#EBEBFF]"
                : "border-[#E4E2DD] hover:border-[#C4C2DB]"
            )}
          >
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
        onClick={handleSubmit}
        disabled={submitting || !answer1.trim() || !answer2.trim() || !declaration || timeLeft === 0}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {submitting
          ? "Scoring…"
          : timeLeft === 0
          ? "Time expired"
          : !declaration
          ? "Select how you answered to continue"
          : "Submit answers → reveal score"}
      </button>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const review = submission.claudeReview as ClaudeReview | null;
  const isReviewed = submission.status === "REVIEWED";
  const preloadedFollowUp = (submission as any).followUp as FollowUp | null;
  const alreadyAnswered = !!(preloadedFollowUp?.answeredAt);

  const [scoreRevealed, setScoreRevealed] = useState(alreadyAnswered);
  const [finalScore, setFinalScore] = useState<number | null>(
    alreadyAnswered ? (submission.scoreTotal ?? null) : null
  );
  const [followUpFeedback, setFollowUpFeedback] = useState<string | null>(null);

  function handleAnswered(scoreBonus: number, feedback: string) {
    const base =
      (submission.scoreDiagnosis ?? 0) +
      (submission.scoreDesign ?? 0) +
      (submission.scoreCommunication ?? 0) +
      (submission.scoreExecution ?? 0);
    setFinalScore(Math.min(base + scoreBonus, 100));
    setFollowUpFeedback(feedback);
    setScoreRevealed(true);
  }

  const isResolved = isReviewed && scoreRevealed;

  return (
    <div className="card shine p-5">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="font-bold text-sm mb-1 truncate" style={{ color: "#1A1A1A" }}>
            {(submission as any).ticket?.title ?? "Unknown ticket"}
          </div>
          <a
            href={submission.prUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium hover:underline"
            style={{ color: "#5B5BD6" }}
          >
            View PR →
          </a>
        </div>

        <div className="shrink-0 text-right">
          {isResolved && finalScore !== null ? (
            <div>
              <div className="text-3xl font-black gradient-text leading-none">{finalScore}</div>
              <div className="text-xs" style={{ color: "#6B6B6B" }}>/100</div>
            </div>
          ) : isReviewed ? (
            <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: "#FEF3C7", color: "#D97706" }}>
              Score pending
            </span>
          ) : (
            <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: "#E4E2DD", color: "#6B6B6B" }}>
              Under review
            </span>
          )}
        </div>
      </div>

      {/* Resolved badge */}
      {isResolved && (
        <div className="mb-3">
          <span className="text-xs font-bold rounded-full px-3 py-0.5" style={{ background: "#CCFBF1", color: "#0D9488" }}>
            ✓ Resolved
          </span>
        </div>
      )}

      {/* Reviewed content */}
      {isReviewed && (
        <>
          {scoreRevealed && (
            <>
              <div className="space-y-2 mb-4">
                <ScoreBar label="Diagnosis (40)" value={submission.scoreDiagnosis} max={40} />
                <ScoreBar label="Design (30)" value={submission.scoreDesign} max={30} />
                <ScoreBar label="Comms (20)" value={submission.scoreCommunication} max={20} />
                <ScoreBar label="Execution (10)" value={submission.scoreExecution} max={10} />
              </div>

              {review && (
                <div className="rounded-xl p-4 mb-3" style={{ background: "#F7F6F3", border: "1px solid #E4E2DD" }}>
                  <p className="text-sm italic leading-relaxed mb-3" style={{ color: "#6B6B6B" }}>
                    &ldquo;{review.summary}&rdquo;
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg p-3" style={{ background: "#CCFBF1", border: "1px solid #A7F3D0" }}>
                      <div className="font-bold mb-1" style={{ color: "#0D9488" }}>Top strength</div>
                      <div style={{ color: "#1A1A1A" }}>{review.topStrength}</div>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                      <div className="font-bold mb-1" style={{ color: "#D97706" }}>Top improvement</div>
                      <div style={{ color: "#1A1A1A" }}>{review.topImprovement}</div>
                    </div>
                  </div>
                </div>
              )}

              {(followUpFeedback ?? preloadedFollowUp?.claudeFeedback) && (
                <div className="rounded-lg px-4 py-3 text-xs leading-relaxed" style={{ background: "#EBEBFF", border: "1px solid #C4C2DB" }}>
                  <span className="font-bold" style={{ color: "#5B5BD6" }}>Assessment feedback: </span>
                  <span style={{ color: "#1A1A1A" }}>
                    {followUpFeedback ?? preloadedFollowUp?.claudeFeedback}
                  </span>
                </div>
              )}
            </>
          )}

          {!scoreRevealed && !alreadyAnswered && (
            <FollowUpSection
              submissionId={submission.id}
              preloadedFollowUp={preloadedFollowUp}
              onAnswered={handleAnswered}
            />
          )}
        </>
      )}
    </div>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ScoreHistoryPoint & { label: string } }>;
}

function ScoreTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border p-3 text-xs shadow-lg" style={{ background: "white", borderColor: "#E4E2DD" }}>
      <div className="font-bold mb-1" style={{ color: "#1A1A1A" }}>{d.ticketTitle}</div>
      <div className="mb-2" style={{ color: "#6B6B6B" }}>{d.label}</div>
      <div className="space-y-1">
        {[
          { label: "Total", val: `${d.scoreTotal}/100`, bold: true },
          { label: "Diagnosis", val: `${d.scoreDiagnosis}/40` },
          { label: "Design", val: `${d.scoreDesign}/30` },
          { label: "Comms", val: `${d.scoreCommunication}/20` },
          { label: "Execution", val: `${d.scoreExecution}/10` },
        ].map(({ label, val, bold }) => (
          <div key={label} className="flex justify-between gap-4">
            <span style={{ color: "#6B6B6B" }}>{label}</span>
            <span className={bold ? "font-bold gradient-text" : ""} style={bold ? {} : { color: "#1A1A1A" }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressChart({ history }: { history: ScoreHistoryPoint[] }) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed p-10 text-center text-sm"
        style={{ borderColor: "#E4E2DD", color: "#6B6B6B" }}>
        No submissions yet — complete your first ticket to see progress.
      </div>
    );
  }

  const data = history.map((h) => ({
    ...h,
    label: format(new Date(h.submittedAt), "MMM dd"),
    scoreTotal: h.scoreTotal ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E4E2DD" />
        <XAxis dataKey="label" tick={{ fill: "#6B6B6B", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: "#6B6B6B", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ScoreTooltip />} cursor={{ stroke: "#E4E2DD" }} />
        <Line
          type="monotone"
          dataKey="scoreTotal"
          stroke="#5B5BD6"
          strokeWidth={2.5}
          dot={<Dot r={4} fill="#5B5BD6" stroke="white" strokeWidth={2} />}
          activeDot={{ r: 6, fill: "#5B5BD6", stroke: "white", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignment, setAssignment] = useState<TicketAssignment | null>(null);
  const [history, setHistory] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/"); return; }

    Promise.all([getMe(token), getSubmissions(token), getAssignment(token), getScoreHistory(token)])
      .then(([me, subs, assign, hist]) => {
        setUser(me);
        setSubmissions(subs);
        setAssignment(assign);
        setHistory(hist);
      })
      .catch(() => { clearToken(); router.push("/"); })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center text-sm" style={{ color: "#6B6B6B" }}>
        Loading…
      </div>
    );
  }

  if (!user) return <></>;

  const reviewed = submissions.filter((s) => s.status === "REVIEWED");
  const avgScore =
    reviewed.length > 0
      ? Math.round(reviewed.reduce((sum, s) => sum + (s.scoreTotal ?? 0), 0) / reviewed.length)
      : null;

  const stats = [
    { label: "Skill Score",    value: user.skillScore,                               unit: "pts" },
    { label: "Tickets solved", value: reviewed.length,                               unit: "" },
    { label: "Avg score",      value: avgScore !== null ? avgScore : "—",            unit: avgScore !== null ? "/100" : "" },
    { label: "Plan",           value: user.subscriptionTier,                         unit: "" },
  ];

  return (
    <div className="min-h-screen bg-grid">

      {/* ── Header ── */}
      <header className="nav-glass sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="font-black text-lg tracking-tight" style={{ color: "#1A1A1A" }}>DevSimulate</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/tickets" className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
            Browse Tickets
          </Link>
          <Link href={`/profile/${user.githubUsername}`} className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
            @{user.githubUsername}
          </Link>
          <button onClick={handleLogout} className="btn-outline text-xs py-1.5 px-4">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {stats.map(({ label, value, unit }) => (
            <div key={label} className="card shine p-5">
              <div className="text-2xl font-black" style={{ color: "#1A1A1A" }}>
                {value}
                {unit && <span className="text-sm font-normal" style={{ color: "#6B6B6B" }}>{unit}</span>}
              </div>
              <div className="text-xs mt-1" style={{ color: "#6B6B6B" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Current Ticket ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="section-label">Current Ticket</div>
            <Link href="/tickets" className="text-xs font-semibold" style={{ color: "#5B5BD6" }}>
              Browse all →
            </Link>
          </div>

          {assignment && (assignment as any).ticket ? (
            <div className="card-glow p-6">
              <div className="flex items-start gap-3 mb-3">
                <Link
                  href={`/tickets/${(assignment as any).ticket.id}`}
                  className="font-bold text-base flex-1 transition-colors"
                  style={{ color: "#1A1A1A" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#5B5BD6")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#1A1A1A")}
                >
                  {(assignment as any).ticket.title}
                </Link>
                <span className={clsx(
                  "text-xs font-bold rounded-full px-3 py-1 shrink-0",
                  DIFFICULTY_COLOR[(assignment as any).ticket.difficulty as Difficulty]
                )}>
                  {(assignment as any).ticket.difficulty}
                </span>
              </div>

              <p className="text-sm leading-relaxed mb-4" style={{ color: "#6B6B6B" }}>
                {(assignment as any).ticket.description}
              </p>

              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#6B6B6B" }}>
                Files to investigate
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {(assignment as any).ticket.filesInvolved.map((f: string) => (
                  <code key={f} className="text-xs rounded-lg px-2.5 py-1 font-mono"
                    style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
                    {f}
                  </code>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs" style={{ color: "#6B6B6B" }}>
                <span>Branch: <code className="font-mono" style={{ color: "#1A1A1A" }}>{assignment.branchName}</code></span>
                <span>·</span>
                <span>Est. {(assignment as any).ticket.expectedMinutes} min</span>
              </div>
            </div>
          ) : (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <div className="font-bold text-base mb-1" style={{ color: "#1A1A1A" }}>All caught up!</div>
              <div className="text-sm mb-5" style={{ color: "#6B6B6B" }}>
                You have no active tickets. Pick a new one to keep building.
              </div>
              <Link href="/tickets" className="btn-primary text-sm">Browse tickets →</Link>
            </div>
          )}
        </section>

        {/* ── Progress Chart ── */}
        <section className="mb-10">
          <div className="section-label">Your Progress</div>
          <div className="card p-5">
            <ProgressChart history={history} />
            {history.length === 1 && (
              <p className="text-center text-xs mt-2" style={{ color: "#6B6B6B" }}>
                Complete more tickets to see your trend
              </p>
            )}
          </div>
        </section>

        {/* ── Submission History ── */}
        <section>
          <div className="section-label">Submission History</div>

          {submissions.length === 0 ? (
            <div className="card p-10 text-center text-sm" style={{ color: "#6B6B6B" }}>
              No submissions yet. Install the VS Code extension to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <SubmissionCard key={sub.id} submission={sub} />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
