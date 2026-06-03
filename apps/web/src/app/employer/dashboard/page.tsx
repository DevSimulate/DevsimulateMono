"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Megaphone, Users, BarChart2, CheckCircle2, Plus, ChevronRight, ExternalLink } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const VERDICT: Record<string, { label: string; bg: string; color: string }> = {
  STRONG_YES: { label: "Strong Yes", bg: "#052e16", color: "#4ade80" },
  YES:        { label: "Yes",        bg: "#0d2818", color: "#34d399" },
  MAYBE:      { label: "Maybe",      bg: "#422006", color: "#fbbf24" },
  NO:         { label: "No",         bg: "#450a0a", color: "#f87171" },
};
const BAND: Record<string, string> = { HIGH: "#4ade80", MEDIUM: "#fbbf24", LOW: "#f87171" };
const STATUS: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "#052e16", color: "#4ade80" },
  CLOSED: { bg: "#1a1a1a", color: "#888" },
  DRAFT:  { bg: "#1e1b4b", color: "#818cf8" },
};

interface Summary {
  stats: { activeCampaigns: number; totalAssessed: number; totalShortlisted: number; avgScore: number };
  campaigns: Array<{ id: string; roleName: string; companyName: string; codebase: string; status: string; count: number; limit: number }>;
  recent: Array<{ id: string; githubUsername: string; roleName: string; score: number; verdict: string; band: string; submittedAt: string }>;
}

function StatCard({ icon: Icon, label, value, unit, accent }: { icon: React.ElementType; label: string; value: number | string; unit?: string; accent: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: accent + "22" }}>
        <Icon size={17} style={{ color: accent }} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-white">{value}</span>
        {unit && <span className="text-sm" style={{ color: "#555" }}>{unit}</span>}
      </div>
      <div className="text-sm font-semibold mt-1" style={{ color: "#888" }}>{label}</div>
    </div>
  );
}

export default function EmployerDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/dashboard-summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div>
          <h1 className="text-lg font-black text-white">Dashboard</h1>
          <p className="text-xs" style={{ color: "#555" }}>Your hiring at a glance</p>
        </div>
        <Link href="/employer/campaigns/new" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
          <Plus size={15} /> New Campaign
        </Link>
      </header>

      <main className="flex-1 px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {loading ? [1,2,3,4].map(i => <div key={i} className="rounded-xl h-28 animate-pulse" style={{ background: "#111", border: "1px solid #222" }} />) : (
            <>
              <StatCard icon={Megaphone} label="Active Campaigns" value={s?.activeCampaigns ?? 0} accent="#6366f1" />
              <StatCard icon={Users} label="Candidates Assessed" value={s?.totalAssessed ?? 0} accent="#22c55e" />
              <StatCard icon={CheckCircle2} label="Shortlisted" value={s?.totalShortlisted ?? 0} accent="#0ea5e9" />
              <StatCard icon={BarChart2} label="Avg Score" value={s?.avgScore ?? 0} unit="/100" accent="#f59e0b" />
            </>
          )}
        </div>

        <div className="flex gap-5">
          {/* Recent candidates */}
          <div className="flex-[60]">
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222" }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ background: "#111", borderBottom: "1px solid #222" }}>
                <span className="text-sm font-bold text-white">Recent Candidates</span>
                <Link href="/employer/candidates" className="flex items-center gap-1 text-xs font-medium" style={{ color: "#6366f1" }}>View all <ChevronRight size={13} /></Link>
              </div>
              <table className="w-full text-sm" style={{ background: "#0d0d0d" }}>
                <thead><tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                  {["Candidate", "Role", "Score", "Authenticity", "Verdict"].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#444" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {loading ? null : (data?.recent ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-xs" style={{ color: "#555" }}>No scored candidates yet. Share a campaign link to start.</td></tr>
                  ) : data!.recent.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #161616" }}>
                      <td className="px-4 py-3 text-xs font-semibold text-white">{c.githubUsername}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#888" }}>{c.roleName}</td>
                      <td className="px-4 py-3 text-sm font-black" style={{ color: c.score >= 80 ? "#4ade80" : c.score >= 60 ? "#fbbf24" : "#f87171" }}>{c.score}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-xs"><span className="w-1.5 h-1.5 rounded-full" style={{ background: BAND[c.band] }} /><span style={{ color: BAND[c.band] }}>{c.band[0] + c.band.slice(1).toLowerCase()}</span></span></td>
                      <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: VERDICT[c.verdict].bg, color: VERDICT[c.verdict].color }}>{VERDICT[c.verdict].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Campaigns */}
          <div className="flex-[40]">
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222" }}>
              <div className="flex items-center justify-between px-4 py-3.5" style={{ background: "#111", borderBottom: "1px solid #1e1e1e" }}>
                <span className="text-sm font-bold text-white">Campaigns</span>
                <Link href="/employer/campaigns" className="text-xs font-medium" style={{ color: "#6366f1" }}>Manage</Link>
              </div>
              <div style={{ background: "#0d0d0d" }}>
                {loading ? null : (data?.campaigns ?? []).length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs" style={{ color: "#555" }}>
                    No campaigns yet.<br /><Link href="/employer/campaigns/new" className="font-semibold" style={{ color: "#6366f1" }}>Create one →</Link>
                  </div>
                ) : data!.campaigns.map((c, i) => (
                  <Link key={c.id} href={`/employer/campaigns/${c.id}/results`} className="block px-4 py-3 transition-colors" style={{ borderBottom: i < data!.campaigns.length - 1 ? "1px solid #161616" : "none" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#111"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white truncate">{c.roleName}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: STATUS[c.status]?.bg, color: STATUS[c.status]?.color }}>{c.status[0] + c.status.slice(1).toLowerCase()}</span>
                    </div>
                    <div className="text-xs" style={{ color: "#555" }}>{c.codebase} · {c.count}/{c.limit} candidates</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
