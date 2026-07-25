"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/Table";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const INK = "#10182B", MUTED = "#5E6673", HAIRLINE = "#D8DAD3", PAPER = "#FBFBF8", SURFACE = "#FFFFFF";
const EMERALD = "#0B7A5E", AMBER = "#B7791F", RED = "#B3372F";

type VerdictTone = "good" | "warn" | "bad";
const VERDICT: Record<string, { label: string; tone: VerdictTone }> = {
  STRONG_YES: { label: "Strong yes", tone: "good" },
  YES:        { label: "Yes",        tone: "good" },
  MAYBE:      { label: "Maybe",      tone: "warn" },
  NO:         { label: "No",         tone: "bad" },
};
const BAND: Record<string, string> = { HIGH: EMERALD, MEDIUM: AMBER, LOW: RED };

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
    <div className="flex flex-col min-h-screen" style={{ color: INK, background: PAPER }}>
      <header className="px-8 py-4 flex items-center justify-between" style={{ background: SURFACE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <div>
          <h1 className="font-display text-lg font-bold" style={{ color: INK }}>Candidates</h1>
          <p className="text-xs" style={{ color: MUTED }}>Everyone who&apos;s been assessed, across all campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded px-3 py-2" style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}>
            <Search size={14} style={{ color: MUTED }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or role" className="bg-transparent text-sm outline-none w-44" style={{ color: INK }} />
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
            Min score
            <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(parseInt(e.target.value))} style={{ accentColor: EMERALD }} />
            <span className="w-6 font-mono font-bold" style={{ color: INK }}>{minScore}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-8 py-6">
        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: MUTED }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No candidates yet" description="Candidates appear here once they've been assessed in any of your campaigns." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                {["Candidate", "Campaign", "Score", "Authenticity", "Verdict", "Status", ""].map((h) => <Th key={h}>{h}</Th>)}
              </Tr>
            </Thead>
            <tbody>
              {filtered.map((c) => (
                <Tr key={c.id} style={{ borderLeft: `3px solid ${c.flagged ? AMBER : "transparent"}` }}>
                  <Td>
                    <div className="text-xs font-semibold" style={{ color: INK }}>{c.githubUsername}</div>
                    <div className="text-xs" style={{ color: MUTED }}>{c.email ?? "—"}</div>
                  </Td>
                  <Td className="text-xs" style={{ color: MUTED }}>{c.roleName}</Td>
                  <Td numeric className="text-sm font-bold" style={{ color: c.score >= 80 ? EMERALD : c.score >= 60 ? AMBER : RED }}>{c.score}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: BAND[c.authBand] }} />
                      <span style={{ color: BAND[c.authBand] }}>{c.authBand[0] + c.authBand.slice(1).toLowerCase()}</span>
                      {c.flagged && <Badge tone="warn" className="ml-1">Advisory flag</Badge>}
                    </span>
                  </Td>
                  <Td><Badge tone={VERDICT[c.verdict].tone}>{VERDICT[c.verdict].label}</Badge></Td>
                  <Td className="text-xs" style={{ color: MUTED }}>{c.status[0] + c.status.slice(1).toLowerCase()}</Td>
                  <Td>
                    <Link href={`/employer/campaigns/${c.campaignId}/candidates/${c.id}`} className="text-xs font-semibold" style={{ color: EMERALD }}>View</Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </main>
    </div>
  );
}
