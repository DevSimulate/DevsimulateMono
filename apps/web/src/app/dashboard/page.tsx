"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/auth";
import Logo from "@/components/Logo";
import { getMe, getSubmissions, getAssignments, getScoreHistory, ScoreHistoryPoint } from "@/lib/api";
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

interface CertSummary {
  id:           string;
  campaignName: string;
  companyName:  string;
  brandName:    string;
  logoUrl:      string | null;
  primaryColor: string;
  score:        number;
  rank:         number | null;
  issuedAt:     string;
}

interface FollowUp {
  claudeFeedback: string | null;
  answeredAt: string | null;
  scoreBonus: number | null;
  verbalScore: number | null;
  verbalNote: string | null;
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const review = submission.claudeReview as ClaudeReview | null;
  const isReviewed = submission.status === "REVIEWED";
  const followUp = (submission as any).followUp as FollowUp | null;

  return (
    <div className="card shine p-5">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="font-bold text-sm mb-1 truncate" style={{ color: "#1A1A1A" }}>
            {(submission as any).ticket?.title ?? "Unknown ticket"}
          </div>
          <a href={submission.prUrl} target="_blank" rel="noreferrer"
            className="text-xs font-medium hover:underline" style={{ color: "#5B5BD6" }}>
            View PR →
          </a>
        </div>

        <div className="shrink-0 text-right">
          {isReviewed && submission.scoreTotal !== null ? (
            <div>
              <div className="text-3xl font-black gradient-text leading-none">{submission.scoreTotal}</div>
              <div className="text-xs" style={{ color: "#6B6B6B" }}>/100</div>
            </div>
          ) : isReviewed ? (
            <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: "#FEF3C7", color: "#D97706" }}>
              Pending score
            </span>
          ) : (
            <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: "#E4E2DD", color: "#6B6B6B" }}>
              Under review
            </span>
          )}
        </div>
      </div>

      {/* Reviewed content */}
      {isReviewed && (
        <>
          <div className="mb-3">
            <span className="text-xs font-bold rounded-full px-3 py-0.5" style={{ background: "#CCFBF1", color: "#0D9488" }}>
              ✓ Resolved
            </span>
          </div>

          <div className="space-y-2 mb-4">
            <ScoreBar label="Diagnosis (40)" value={submission.scoreDiagnosis} max={40} />
            <ScoreBar label="Design (30)"    value={submission.scoreDesign}    max={30} />
            <ScoreBar label="Comms (20)"     value={submission.scoreCommunication} max={20} />
            <ScoreBar label="Execution (10)" value={submission.scoreExecution} max={10} />
          </div>

          {(() => {
            const g = (submission as { graderResult?: { result?: string } }).graderResult;
            const m: Record<string, { bg: string; fg: string; text: string }> = {
              pass:         { bg: "#CCFBF1", fg: "#0D9488", text: "✓ Verified correct under load — automated test passed" },
              fail:         { bg: "#FEE2E2", fg: "#DC2626", text: "🚩 Failed automated correctness test — Execution capped to 0" },
              inconclusive: { bg: "#FEF3C7", fg: "#D97706", text: "⚠ Automated test couldn't run (build issue) — flagged for review, score not penalised" },
            };
            const c = g?.result ? m[g.result] : undefined;
            return c ? (
              <div className="mb-3 text-xs font-semibold rounded-lg px-3 py-2" style={{ background: c.bg, color: c.fg }}>
                {c.text}
              </div>
            ) : null;
          })()}

          {/* Reconcile the breakdown (PR review) with the final score after deductions */}
          {(() => {
            const prBase = (submission.scoreDiagnosis ?? 0) + (submission.scoreDesign ?? 0) +
                           (submission.scoreCommunication ?? 0) + (submission.scoreExecution ?? 0);
            const gap = prBase - (submission.scoreTotal ?? 0);
            if (gap <= 0) return null;
            const vScore = followUp?.verbalScore;
            const reason = vScore != null
              ? (vScore <= 3 ? " — spoken explanation couldn't be defended aloud" : " — weak spoken explanation")
              : "";
            return (
              <div className="mb-3 text-xs rounded-lg px-3 py-2" style={{ background: "#FEF3C7", color: "#92400E" }}>
                <span className="font-bold">PR review {prBase} → final {submission.scoreTotal} (−{gap})</span>{reason}.
              </div>
            );
          })()}

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

          {followUp?.claudeFeedback && (
            <div className="rounded-lg px-4 py-3 text-xs leading-relaxed" style={{ background: "#EBEBFF", border: "1px solid #C4C2DB" }}>
              <span className="font-bold" style={{ color: "#5B5BD6" }}>Assessment: </span>
              <span style={{ color: "#1A1A1A" }}>{followUp.claudeFeedback}</span>
            </div>
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
  const [user,        setUser]        = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignments, setAssignments] = useState<TicketAssignment[]>([]);
  const [history,     setHistory]     = useState<ScoreHistoryPoint[]>([]);
  const [certs,       setCerts]       = useState<CertSummary[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [ticketsHref, setTicketsHref] = useState("/tickets");

  useEffect(() => {
    const saved = localStorage.getItem("ds_selected_stack");
    if (saved) setTicketsHref(`/tickets?stack=${saved}`);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/login"); return; }

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    const certsPromise = fetch(`${API_URL}/certificates/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => j.data ?? []).catch(() => []);

    Promise.all([getMe(token), getSubmissions(token), getAssignments(token), getScoreHistory(token), certsPromise])
      .then(([me, subs, assigns, hist, certList]) => {
        setUser(me);
        setSubmissions(subs);
        setAssignments(assigns);
        setHistory(hist);
        setCerts(certList);
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
  const visibleSubmissions = submissions.filter((s) => s.status === "REVIEWED" || s.status === "PENDING");
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
        <Link href="/"><Logo variant="horizontal" size={32} /></Link>
        <div className="flex items-center gap-5">
          <Link href={ticketsHref} className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
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

        {/* ── Active Tickets ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="section-label">
              Active Tickets
              {assignments.length > 0 && (
                <span className="ml-2 text-xs font-bold rounded-full px-2 py-0.5"
                  style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
                  {assignments.length}
                </span>
              )}
            </div>
            <Link href={ticketsHref} className="text-xs font-semibold" style={{ color: "#5B5BD6" }}>
              Browse all →
            </Link>
          </div>

          {assignments.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <div className="font-bold text-base mb-1" style={{ color: "#1A1A1A" }}>All caught up!</div>
              <div className="text-sm mb-5" style={{ color: "#6B6B6B" }}>
                You have no active tickets. Pick a new one to keep building.
              </div>
              <Link href={ticketsHref} className="btn-primary text-sm">Browse tickets →</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((a) => {
                const ticket = (a as any).ticket;
                if (!ticket) return null;
                return (
                  <div key={a.id} className="card-glow p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="font-bold text-base flex-1 transition-colors"
                        style={{ color: "#1A1A1A" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#5B5BD6")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#1A1A1A")}
                      >
                        {ticket.title}
                      </Link>
                      <span className={clsx(
                        "text-xs font-bold rounded-full px-3 py-1 shrink-0",
                        DIFFICULTY_COLOR[ticket.difficulty as Difficulty]
                      )}>
                        {ticket.difficulty}
                      </span>
                    </div>

                    {ticket.codebase && (
                      <div className="text-xs font-semibold mb-2" style={{ color: "#5B5BD6" }}>
                        {ticket.codebase.name} — <span style={{ color: "#6B6B6B", fontWeight: 400 }}>{ticket.codebase.description}</span>
                      </div>
                    )}

                    <p className="text-sm leading-relaxed mb-4" style={{ color: "#6B6B6B" }}>
                      {ticket.description}
                    </p>

                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#6B6B6B" }}>
                      Files to investigate
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {ticket.filesInvolved.map((f: string) => (
                        <code key={f} className="text-xs rounded-lg px-2.5 py-1 font-mono"
                          style={{ background: "#EBEBFF", color: "#5B5BD6" }}>
                          {f}
                        </code>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs" style={{ color: "#6B6B6B" }}>
                        {ticket.stack !== "SYSTEM_DESIGN" && (
                          <>
                            <span>Branch: <code className="font-mono" style={{ color: "#1A1A1A" }}>{a.branchName}</code></span>
                            <span>·</span>
                          </>
                        )}
                        <span>Est. {ticket.expectedMinutes} min</span>
                      </div>
                      {ticket.stack === "SYSTEM_DESIGN" ? (
                        <Link
                          href={`/submit?ticketId=${ticket.id}`}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors"
                          style={{ background: "#5B5BD6", color: "white" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#4747C2")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#5B5BD6")}
                        >
                          Write System Design
                        </Link>
                      ) : (
                        <a
                          href={`vscode://devsimulate-app.devsimulate/clone?assignmentId=${a.id}`}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors"
                          style={{ background: "#5B5BD6", color: "white" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#4747C2")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#5B5BD6")}
                        >
                          ⚡ Open in VS Code
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
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

        {/* ── Certificates ── */}
        {certs.length > 0 && (
          <section className="mb-10">
            <div className="section-label">My Certificates</div>
            <div className="space-y-3">
              {certs.map((cert) => (
                <div key={cert.id} className="card p-4 flex items-center gap-4">
                  {cert.logoUrl ? (
                    <img src={cert.logoUrl} alt={cert.brandName} className="h-10 w-10 rounded-lg object-contain shrink-0"
                      style={{ background: "#f3f4f6", padding: "4px" }} />
                  ) : (
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: cert.primaryColor + "22", color: cert.primaryColor }}>
                      {cert.brandName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: "#1A1A1A" }}>
                      {cert.brandName || cert.companyName} — {cert.campaignName}
                    </div>
                    <div className="text-xs" style={{ color: "#6B6B6B" }}>
                      Score: <span className="font-bold" style={{ color: cert.primaryColor }}>{cert.score}</span>
                      {cert.rank ? ` · Rank #${cert.rank}` : ""}
                      {" · "}{format(new Date(cert.issuedAt), "MMM yyyy")}
                    </div>
                  </div>
                  <a
                    href={`/certificate/${cert.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      flexShrink: 0, padding: "8px 16px", borderRadius: "8px",
                      fontSize: "12px", fontWeight: 700, textDecoration: "none",
                      background: cert.primaryColor || "#5B5BD6", color: "white",
                      whiteSpace: "nowrap",
                    }}
                  >
                    🏅 View Certificate
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Submission History ── */}
        <section>
          <div className="section-label">Submission History</div>

          {visibleSubmissions.length === 0 ? (
            <div className="card p-10 text-center text-sm" style={{ color: "#6B6B6B" }}>
              No submissions yet. Install the VS Code extension to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {visibleSubmissions.map((sub) => (
                <SubmissionCard key={sub.id} submission={sub} />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
