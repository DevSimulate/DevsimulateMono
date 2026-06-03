"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Search } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const VERDICT: Record<string, { label: string; bg: string; color: string }> = {
  STRONG_YES: { label: "Strong Yes", bg: "#052e16", color: "#4ade80" },
  YES:        { label: "Yes",        bg: "#0d2818", color: "#34d399" },
  MAYBE:      { label: "Maybe",      bg: "#422006", color: "#fbbf24" },
  NO:         { label: "No",         bg: "#450a0a", color: "#f87171" },
};
const BAND: Record<string, string> = { HIGH: "#4ade80", MEDIUM: "#fbbf24", LOW: "#f87171" };

interface Candidate {
  id: string; campaignId: string; roleName: string; githubUsername: string; email: string | null;
  status: string; score: number; authBand: string; flagged: boolean; verdict: string; submittedAt: string;
}

export default function CandidatesPage() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/candidates`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setRows(j.data ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((c) =>
    c.score >= minScore &&
    (q === "" || c.githubUsername.toLowerCase().includes(q.toLowerCase()) || c.roleName.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="px-8 py-4 flex items-center justify-between" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div>
          <h1 className="text-lg font-black text-white">Candidates</h1>
          <p className="text-xs" style={{ color: "#555" }}>Everyone who's been assessed, across all campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#111", border: "1px solid #222" }}>
            <Search size={14} style={{ color: "#555" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or role" className="bg-transparent text-sm outline-none w-44" style={{ color: "#e5e7eb" }} />
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "#888" }}>
            Min score
            <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(parseInt(e.target.value))} style={{ accentColor: "#6366f1" }} />
            <span className="w-6 font-bold text-white">{minScore}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-8 py-6">
        {loading ? <div className="text-center py-20 text-sm" style={{ color: "#555" }}>Loading…</div> :
          filtered.length === 0 ? <div className="text-center py-20 text-sm" style={{ color: "#555" }}>No candidates match.</div> : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222" }}>
            <table className="w-full text-sm" style={{ background: "#0d0d0d" }}>
              <thead><tr style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}>
                {["Candidate", "Campaign", "Score", "Authenticity", "Verdict", "Status", ""].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#444" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #161616", borderLeft: c.flagged ? "3px solid #f87171" : "3px solid transparent" }}>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-white">{c.githubUsername}</div>
                      <div className="text-xs" style={{ color: "#555" }}>{c.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#888" }}>{c.roleName}</td>
                    <td className="px-4 py-3 text-sm font-black" style={{ color: c.score >= 80 ? "#4ade80" : c.score >= 60 ? "#fbbf24" : "#f87171" }}>{c.score}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: BAND[c.authBand] }} />
                        <span style={{ color: BAND[c.authBand] }}>{c.authBand[0] + c.authBand.slice(1).toLowerCase()}</span>
                        {c.flagged && <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "#450a0a", color: "#f87171" }}>Review</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: VERDICT[c.verdict].bg, color: VERDICT[c.verdict].color }}>{VERDICT[c.verdict].label}</span></td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#888" }}>{c.status[0] + c.status.slice(1).toLowerCase()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/employer/campaigns/${c.campaignId}/candidates/${c.id}`} className="text-xs font-semibold" style={{ color: "#6366f1" }}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
