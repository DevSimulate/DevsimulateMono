"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Search } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const VERDICT: Record<string, { label: string; bg: string; color: string }> = {
  STRONG_YES: { label: "Strong Yes", bg: "#ecfdf3", color: "#067647" },
  YES:        { label: "Yes",        bg: "#ecfdf3", color: "#067647" },
  MAYBE:      { label: "Maybe",      bg: "#fff8ec", color: "#b54708" },
  NO:         { label: "No",         bg: "#fef3f2", color: "#b42318" },
};
const BAND: Record<string, string> = { HIGH: "#067647", MEDIUM: "#b54708", LOW: "#b42318" };

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
    <div className="flex flex-col min-h-screen" style={{ color: "#131722" }}>
      <header className="px-8 py-4 flex items-center justify-between" style={{ background: "#f5f6f8", borderBottom: "1px solid #eef1f5" }}>
        <div>
          <h1 className="text-lg font-black text-[#131722]">Candidates</h1>
          <p className="text-xs" style={{ color: "#8a93a3" }}>Everyone who's been assessed, across all campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#ffffff", border: "1px solid #222" }}>
            <Search size={14} style={{ color: "#8a93a3" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or role" className="bg-transparent text-sm outline-none w-44" style={{ color: "#131722" }} />
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "#5a6472" }}>
            Min score
            <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(parseInt(e.target.value))} style={{ accentColor: "#4338ca" }} />
            <span className="w-6 font-bold text-[#131722]">{minScore}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-8 py-6">
        {loading ? <div className="text-center py-20 text-sm" style={{ color: "#8a93a3" }}>Loading…</div> :
          filtered.length === 0 ? <div className="text-center py-20 text-sm" style={{ color: "#8a93a3" }}>No candidates match.</div> : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222" }}>
            <table className="w-full text-sm" style={{ background: "#f2f4f7" }}>
              <thead><tr style={{ background: "#ffffff", borderBottom: "1px solid #eef1f5" }}>
                {["Candidate", "Campaign", "Score", "Authenticity", "Verdict", "Status", ""].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#9aa3b2" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #eef1f5", borderLeft: c.flagged ? "3px solid #b42318" : "3px solid transparent" }}>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-[#131722]">{c.githubUsername}</div>
                      <div className="text-xs" style={{ color: "#8a93a3" }}>{c.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#5a6472" }}>{c.roleName}</td>
                    <td className="px-4 py-3 text-sm font-black" style={{ color: c.score >= 80 ? "#067647" : c.score >= 60 ? "#b54708" : "#b42318" }}>{c.score}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: BAND[c.authBand] }} />
                        <span style={{ color: BAND[c.authBand] }}>{c.authBand[0] + c.authBand.slice(1).toLowerCase()}</span>
                        {c.flagged && <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "#fef3f2", color: "#b42318" }}>Review</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: VERDICT[c.verdict].bg, color: VERDICT[c.verdict].color }}>{VERDICT[c.verdict].label}</span></td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#5a6472" }}>{c.status[0] + c.status.slice(1).toLowerCase()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/employer/campaigns/${c.campaignId}/candidates/${c.id}`} className="text-xs font-semibold" style={{ color: "#4338ca" }}>View</Link>
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
