"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell, Plus, TrendingUp, Users, ClipboardCheck,
  AlertTriangle, BarChart2, Bot, BookOpen, MessageSquare, UserCheck,
  ExternalLink, ChevronRight, Flag, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── Types ────────────────────────────────────────────────────────────────────

type AIDeclaration =
  | "NO_AI_USED"
  | "AI_USED_FOR_PHRASING"
  | "AI_USED_FOR_UNDERSTANDING"
  | "AI_USED_FOR_ANSWER";

type Difficulty = "JUNIOR" | "MID" | "SENIOR";

interface Candidate {
  id: string;
  name: string;
  email: string;
  initials: string;
  githubUsername: string;
  ticket: { code: string; title: string; difficulty: Difficulty };
  score: number;
  authenticityScore: number;
  aiDeclaration: AIDeclaration;
  declarationMismatch: boolean;
  flagged: boolean;
  submittedAt: string;
  employerSummary: string;
  timeMinutes: number;
}

interface DashboardStats {
  totalCandidates: number;
  averageScore: number;
  integrityFlags: number;
  completionRate: number;
}

interface DashboardData {
  stats: DashboardStats;
  candidates: Candidate[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const DIFFICULTY_STYLE: Record<Difficulty, { bg: string; color: string }> = {
  JUNIOR: { bg: "#052e16", color: "#4ade80" },
  MID:    { bg: "#451a03", color: "#fbbf24" },
  SENIOR: { bg: "#450a0a", color: "#f87171" },
};

const AI_DECL_META: Record<AIDeclaration, { label: string; icon: React.ElementType }> = {
  NO_AI_USED:                { label: "None",     icon: UserCheck },
  AI_USED_FOR_PHRASING:      { label: "Phrasing", icon: MessageSquare },
  AI_USED_FOR_UNDERSTANDING: { label: "Learning", icon: BookOpen },
  AI_USED_FOR_ANSWER:        { label: "Full AI",  icon: Bot },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreCircle({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color =
    score >= 80 ? "#22c55e" :
    score >= 60 ? "#f59e0b" :
    score >= 40 ? "#f97316" : "#ef4444";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#222222" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black text-white">{score}</span>
      </div>
    </div>
  );
}

function AuthenticityBadge({ score, mismatch }: { score: number; mismatch: boolean }) {
  const label = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
  const styles = {
    High:   { bg: "#052e16", color: "#4ade80", border: "#166534" },
    Medium: { bg: "#422006", color: "#fbbf24", border: "#92400e" },
    Low:    { bg: "#450a0a", color: "#f87171", border: "#991b1b" },
  }[label];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap"
        style={{ background: styles.bg, color: styles.color, border: `1px solid ${styles.border}` }}>
        {label} · {score}
      </span>
      {mismatch && (
        <span title="Declaration mismatch" style={{ color: "#f59e0b" }}>
          <AlertTriangle size={12} />
        </span>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, unit, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  unit?: string;
  accent?: string;
}) {
  const ac = accent ?? "#6366f1";
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "#111111", border: "1px solid #222222" }}>
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: ac + "22" }}>
          <Icon size={17} style={{ color: ac }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">{value}</span>
          {unit && <span className="text-sm font-medium" style={{ color: "#555555" }}>{unit}</span>}
        </div>
        <div className="text-sm font-semibold mt-1" style={{ color: "#888888" }}>{label}</div>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3 animate-pulse"
      style={{ background: "#111111", border: "1px solid #222222" }}>
      <div className="w-9 h-9 rounded-lg" style={{ background: "#1a1a1a" }} />
      <div>
        <div className="w-16 h-8 rounded" style={{ background: "#1a1a1a" }} />
        <div className="w-24 h-3 rounded mt-2" style={{ background: "#1a1a1a" }} />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <tr key={i} className="animate-pulse" style={{ borderBottom: "1px solid #161616" }}>
          {[1, 2, 3, 4, 5, 6, 7].map(j => (
            <td key={j} className="px-4 py-4">
              <div className="h-3 rounded" style={{ background: "#1a1a1a", width: j === 1 ? "80%" : "60%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmployerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/employer/dashboard/stats`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json() as DashboardData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const candidates = data?.candidates ?? [];
  const stats      = data?.stats;

  const topPerformers = candidates.filter(c => !c.flagged).sort((a, b) => b.score - a.score).slice(0, 4);
  const flagged       = candidates.filter(c => c.flagged);

  const scoreDistribution = (() => {
    if (!candidates.length) return [
      { range: "81–100", count: 0, color: "#22c55e" },
      { range: "61–80",  count: 0, color: "#f59e0b" },
      { range: "41–60",  count: 0, color: "#f97316" },
      { range: "0–40",   count: 0, color: "#ef4444" },
    ];
    return [
      { range: "81–100", count: candidates.filter(c => c.score > 80).length,              color: "#22c55e" },
      { range: "61–80",  count: candidates.filter(c => c.score > 60 && c.score <= 80).length, color: "#f59e0b" },
      { range: "41–60",  count: candidates.filter(c => c.score > 40 && c.score <= 60).length, color: "#f97316" },
      { range: "0–40",   count: candidates.filter(c => c.score <= 40).length,             color: "#ef4444" },
    ];
  })();

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
        style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div>
          <h1 className="text-lg font-black text-white">Dashboard</h1>
          <p className="text-xs" style={{ color: "#555555" }}>TechCorp Inc. · NOVA-47 Demo</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "#111111", border: "1px solid #222222" }}
            title="Refresh">
            <RefreshCw size={15} style={{ color: "#888888" }}
              className={loading ? "animate-spin" : ""} />
          </button>
          <button className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "#111111", border: "1px solid #222222" }}>
            <Bell size={16} style={{ color: "#888888" }} />
            {flagged.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: "#ef4444", color: "white" }}>{flagged.length}</span>
            )}
          </button>
          <Link href="/employer/assessments"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
            <Plus size={15} /> New Assessment
          </Link>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
            style={{ background: "#1e1b4b", color: "#818cf8", border: "2px solid #312e81" }}>
            T
          </div>
        </div>
      </header>

      <main className="flex-1 px-8 py-6 space-y-6">

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: "#1c0000", border: "1px solid #7f1d1d" }}>
            <AlertTriangle size={15} color="#f87171" />
            <span className="text-sm" style={{ color: "#f87171" }}>{error}</span>
            <button onClick={load} className="ml-auto text-xs font-semibold px-3 py-1 rounded-lg"
              style={{ background: "#450a0a", color: "#f87171" }}>Retry</button>
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-4">
          {loading ? (
            <>{[1,2,3,4].map(i => <StatSkeleton key={i} />)}</>
          ) : (
            <>
              <StatCard icon={ClipboardCheck} label="Total Assessments"  value={stats?.totalCandidates ?? 0} />
              <StatCard icon={Users}          label="Candidates Assessed" value={stats?.totalCandidates ?? 0} accent="#22c55e" />
              <StatCard icon={BarChart2}      label="Average Score"       value={stats?.averageScore ?? 0} unit="/100" accent="#f59e0b" />
              <StatCard icon={Flag}           label="Integrity Flags"     value={stats?.integrityFlags ?? 0} accent="#ef4444" />
            </>
          )}
        </div>

        {/* ── Main content ── */}
        <div className="flex gap-5">

          {/* ── Candidates table 65% ── */}
          <div className="flex-[65]">
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222222" }}>
              <div className="flex items-center justify-between px-5 py-4"
                style={{ background: "#111111", borderBottom: "1px solid #222222" }}>
                <span className="text-sm font-bold text-white">Recent Candidate Results</span>
                <Link href="/employer/candidates"
                  className="flex items-center gap-1 text-xs font-medium transition-colors"
                  style={{ color: "#6366f1" }}>
                  View all <ChevronRight size={13} />
                </Link>
              </div>

              <table className="w-full text-sm" style={{ background: "#0d0d0d" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {["Candidate", "Ticket", "Score", "Authenticity", "AI Usage", "When", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest"
                        style={{ color: "#444444" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? <TableSkeleton />
                    : candidates.map(c => {
                        const aiMeta = AI_DECL_META[c.aiDeclaration] ?? AI_DECL_META.NO_AI_USED;
                        const AiIcon = aiMeta.icon;
                        const diffStyle = DIFFICULTY_STYLE[c.ticket.difficulty] ?? DIFFICULTY_STYLE.MID;
                        return (
                          <tr key={c.id}
                            className="transition-colors cursor-pointer"
                            style={{
                              borderBottom: "1px solid #161616",
                              borderLeft: c.flagged ? "3px solid #ef4444" : "3px solid transparent",
                            }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#111111"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                            onClick={() => setSelectedCandidate(selectedCandidate?.id === c.id ? null : c)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                  style={{ background: "#1e1b4b", color: "#818cf8" }}>
                                  {c.initials}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                    {c.name}
                                    {c.flagged && <Flag size={10} style={{ color: "#ef4444" }} />}
                                  </div>
                                  <div className="text-xs" style={{ color: "#555555" }}>{c.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span className="text-xs font-bold rounded px-2 py-0.5"
                                style={{ background: diffStyle.bg, color: diffStyle.color }}>
                                {c.ticket.code}
                              </span>
                              <div className="text-xs mt-1 max-w-[140px] truncate" style={{ color: "#666666" }}>
                                {c.ticket.title}
                              </div>
                            </td>

                            <td className="px-4 py-3"><ScoreCircle score={c.score} /></td>

                            <td className="px-4 py-3">
                              <AuthenticityBadge score={c.authenticityScore} mismatch={c.declarationMismatch} />
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-xs" style={{ color: "#888888" }}>
                                <AiIcon size={13} />
                                {aiMeta.label}
                                {c.declarationMismatch && (
                                  <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: "#451a03", color: "#f59e0b" }}>*</span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-xs" style={{ color: "#555555" }}>
                              {timeAgo(c.submittedAt)}
                            </td>

                            <td className="px-4 py-3">
                              <Link
                                href={`/employer/candidates/${c.id}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs font-semibold transition-colors whitespace-nowrap"
                                style={{ color: "#6366f1" }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#818cf8"}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#6366f1"}
                              >
                                View <ExternalLink size={11} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>

            {/* Expanded employer summary */}
            {selectedCandidate && (
              <div className="mt-3 rounded-xl p-4" style={{ background: "#111111", border: "1px solid #222222" }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-bold text-white">{selectedCandidate.name}</span>
                      {selectedCandidate.flagged && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "#450a0a", color: "#f87171", border: "1px solid #991b1b" }}>
                          Integrity flag
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#888888" }}>
                      <span className="font-semibold" style={{ color: "#6366f1" }}>AI Assessment: </span>
                      {selectedCandidate.employerSummary || "No summary available."}
                    </p>
                  </div>
                  <Link href={`/employer/candidates/${selectedCandidate.id}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors text-white"
                    style={{ background: "#6366f1" }}>
                    Full Report →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── Right column 35% ── */}
          <div className="flex-[35] space-y-4">

            {/* Top Performers */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222222" }}>
              <div className="px-4 py-3.5 flex items-center justify-between"
                style={{ background: "#111111", borderBottom: "1px solid #1e1e1e" }}>
                <span className="text-sm font-bold text-white">Top Performers</span>
                <span className="text-xs" style={{ color: "#555555" }}>NOVA-47</span>
              </div>
              <div style={{ background: "#0d0d0d" }}>
                {loading
                  ? [1,2,3].map(i => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse"
                        style={{ borderBottom: "1px solid #161616" }}>
                        <div className="w-5 h-3 rounded" style={{ background: "#1a1a1a" }} />
                        <div className="w-7 h-7 rounded-full shrink-0" style={{ background: "#1a1a1a" }} />
                        <div className="flex-1 h-3 rounded" style={{ background: "#1a1a1a" }} />
                        <div className="w-6 h-4 rounded" style={{ background: "#1a1a1a" }} />
                      </div>
                    ))
                  : topPerformers.map((c, i) => (
                      <Link key={c.id} href={`/employer/candidates/${c.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors"
                        style={{ borderBottom: i < topPerformers.length - 1 ? "1px solid #161616" : "none" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#111111"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                        <div className="text-xs font-black w-5 text-center"
                          style={{ color: i === 0 ? "#f59e0b" : "#333333" }}>{i + 1}</div>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: "#1e1b4b", color: "#818cf8" }}>{c.initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{c.name}</div>
                          <div className="text-xs truncate" style={{ color: "#555555" }}>{c.ticket.code}</div>
                        </div>
                        <span className="text-sm font-black shrink-0"
                          style={{ color: c.score >= 80 ? "#4ade80" : c.score >= 60 ? "#fbbf24" : "#f87171" }}>
                          {c.score}
                        </span>
                      </Link>
                    ))
                }
                {!loading && topPerformers.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs" style={{ color: "#555555" }}>No results yet</div>
                )}
              </div>
            </div>

            {/* Integrity Alerts */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #3f1010" }}>
              <div className="px-4 py-3.5 flex items-center gap-2"
                style={{ background: "#1a0a0a", borderBottom: "1px solid #3f1010" }}>
                <AlertTriangle size={14} style={{ color: "#ef4444" }} />
                <span className="text-sm font-bold" style={{ color: "#f87171" }}>Integrity Alerts</span>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#450a0a", color: "#f87171" }}>
                  {loading ? "—" : flagged.length}
                </span>
              </div>
              <div style={{ background: "#0d0d0d" }}>
                {loading
                  ? (
                    <div className="px-4 py-3 animate-pulse">
                      <div className="h-3 rounded w-3/4 mb-2" style={{ background: "#1a1a1a" }} />
                      <div className="h-3 rounded w-1/2" style={{ background: "#1a1a1a" }} />
                    </div>
                  )
                  : flagged.length === 0
                  ? (
                    <div className="px-4 py-6 text-center text-xs" style={{ color: "#555555" }}>
                      No integrity alerts
                    </div>
                  )
                  : flagged.map((c, i) => (
                      <div key={c.id} className="px-4 py-3 transition-colors"
                        style={{ borderBottom: i < flagged.length - 1 ? "1px solid #1a1010" : "none" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#130a0a"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-white mb-0.5">{c.name}</div>
                            <div className="text-xs" style={{ color: "#666666" }}>
                              {c.declarationMismatch ? "Declaration mismatch detected" : "Low authenticity score"} · Auth {c.authenticityScore}/100
                            </div>
                          </div>
                          <Link href={`/employer/candidates/${c.id}`}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap transition-colors"
                            style={{ background: "#450a0a", color: "#f87171", border: "1px solid #991b1b" }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#6b1010"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#450a0a"}>
                            Review
                          </Link>
                        </div>
                      </div>
                    ))
                }
              </div>
            </div>

            {/* Score Distribution */}
            <div className="rounded-xl p-4" style={{ background: "#111111", border: "1px solid #222222" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-white">Score Distribution</span>
                <span className="text-xs" style={{ color: "#555555" }}>
                  {loading ? "—" : `${candidates.length} candidates`}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={scoreDistribution} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fill: "#444444", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="range" tick={{ fill: "#888888", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    cursor={{ fill: "#1a1a1a" }}
                    contentStyle={{ background: "#111111", border: "1px solid #222222", borderRadius: 8, fontSize: 12, color: "white" }}
                    formatter={(v) => [`${v} candidates`, ""]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {scoreDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-3">
                {scoreDistribution.map(({ range, count, color }) => (
                  <div key={range} className="text-center">
                    <div className="text-sm font-bold" style={{ color }}>{count}</div>
                    <div className="text-xs" style={{ color: "#444444" }}>{range}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
