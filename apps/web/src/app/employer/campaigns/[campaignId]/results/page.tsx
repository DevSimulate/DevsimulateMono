"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  ArrowLeft, Download, Mail, Check, X, ExternalLink, Star, CheckCircle2, Award,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type AIDeclaration = "NO_AI_USED" | "AI_USED_FOR_PHRASING" | "AI_USED_FOR_UNDERSTANDING" | "AI_USED_FOR_ANSWER";

const AI_BADGE: Record<AIDeclaration, { label: string; bg: string; color: string }> = {
  NO_AI_USED:                { label: "No AI",      bg: "#052e16", color: "#4ade80" },
  AI_USED_FOR_PHRASING:      { label: "Phrasing",   bg: "#422006", color: "#fbbf24" },
  AI_USED_FOR_UNDERSTANDING: { label: "Learning",   bg: "#431407", color: "#fb923c" },
  AI_USED_FOR_ANSWER:        { label: "Full AI",    bg: "#450a0a", color: "#f87171" },
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  NEW:         { bg: "#1e1b4b", color: "#818cf8" },
  REVIEWED:    { bg: "#1a1a1a", color: "#aaaaaa" },
  SHORTLISTED: { bg: "#052e16", color: "#4ade80" },
  REJECTED:    { bg: "#450a0a", color: "#f87171" },
};

type Verdict = "STRONG_YES" | "YES" | "MAYBE" | "NO";
type AuthBand = "HIGH" | "MEDIUM" | "LOW";

const VERDICT_META: Record<Verdict, { label: string; bg: string; color: string }> = {
  STRONG_YES: { label: "Strong Yes", bg: "#052e16", color: "#4ade80" },
  YES:        { label: "Yes",        bg: "#0d2818", color: "#34d399" },
  MAYBE:      { label: "Maybe",      bg: "#422006", color: "#fbbf24" },
  NO:         { label: "No",         bg: "#450a0a", color: "#f87171" },
};

const AUTH_META: Record<AuthBand, { label: string; color: string }> = {
  HIGH:   { label: "High",   color: "#4ade80" },
  MEDIUM: { label: "Medium", color: "#fbbf24" },
  LOW:    { label: "Low",    color: "#f87171" },
};

interface Candidate {
  id: string;
  rank: number;
  recommended: boolean;
  status: string;
  authScore: number;
  authBand: AuthBand;
  flagged: boolean;
  verdict: Verdict;
  user: { id: string; githubUsername: string; email: string | null };
  submission: {
    prUrl: string | null;
    scoreTotal: number | null;
    scoreDiagnosis: number | null;
    scoreDesign: number | null;
    scoreCommunication: number | null;
    scoreExecution: number | null;
    verbalPenalty: number | null;
    followUp: { aiDeclaration: AIDeclaration | null } | null;
  } | null;
}

interface Campaign {
  id: string;
  roleName: string;
  companyName: string;
  bookingLink: string | null;
}

export default function ResultsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showInvite,    setShowInvite]    = useState(false);
  const [inviteResult,  setInviteResult]  = useState<string | null>(null);
  const [certIssuing,   setCertIssuing]   = useState(false);
  const [certResult,    setCertResult]    = useState<string | null>(null);

  // Filters
  const [minScore, setMinScore] = useState(0);
  const [aiFilters, setAiFilters] = useState<Set<AIDeclaration>>(new Set());
  const [sortBy, setSortBy] = useState("score");

  const load = useCallback(() => {
    const token = getToken();
    const params = new URLSearchParams();
    if (minScore > 0) params.set("minScore", String(minScore));
    if (aiFilters.size) params.set("aiDeclaration", [...aiFilters].join(","));
    if (sortBy) params.set("sortBy", sortBy);

    fetch(`${API}/employer/campaigns/${campaignId}/results?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => setCandidates(j.data ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [campaignId, minScore, aiFilters, sortBy]);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setCampaign(j.data))
      .catch(() => null);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.id))
    );
  }

  // Select every clean Yes / Strong Yes — flagged candidates are excluded so a
  // suspicious candidate is never bulk-selected. The employer still reviews
  // flagged ones individually.
  function selectTopPicks() {
    const picks = candidates
      .filter((c) => !c.flagged && (c.verdict === "STRONG_YES" || c.verdict === "YES"))
      .map((c) => c.id);
    setSelected(new Set(picks));
  }

  function toggleAi(d: AIDeclaration) {
    setAiFilters((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  }

  async function bulkStatus(status: string) {
    const token = getToken();
    await Promise.all(
      [...selected].map((id) =>
        fetch(`${API}/employer/campaigns/${campaignId}/candidates/${id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      )
    );
    setSelected(new Set());
    load();
  }

  async function confirmInvite() {
    const token = getToken();
    const r = await fetch(`${API}/employer/campaigns/${campaignId}/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds: [...selected] }),
    });
    const j = await r.json().catch(() => ({}));
    const d = j.data ?? {};
    const parts = [`${d.shortlisted ?? selected.size} shortlisted`];
    if (d.emailed) parts.push(`${d.emailed} emailed`);
    if (d.missingEmail) parts.push(`${d.missingEmail} had no email on file`);
    setInviteResult(parts.join(" · "));
    setShowInvite(false);
    setSelected(new Set());
    load();
    setTimeout(() => setInviteResult(null), 6000);
  }

  async function issueCertificates() {
    setCertIssuing(true);
    const token = getToken();
    try {
      const r = await fetch(`${API}/certificates/employer/campaigns/${campaignId}/certificates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ minScore: 0 }),
      });
      const j = await r.json();
      setCertResult(`${j.data?.issued ?? 0} certificates issued`);
      setTimeout(() => setCertResult(null), 5000);
    } finally {
      setCertIssuing(false);
    }
  }

  function exportCsv() {
    const token = getToken();
    fetch(`${API}/employer/campaigns/${campaignId}/export`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.text())
      .then((csv) => {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `campaign-results.csv`;
        a.click();
      });
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="sticky top-0 z-30 flex items-center gap-4 px-8 py-4"
        style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <Link href="/employer/campaigns" style={{ color: "#888888" }}><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-lg font-black text-white">{campaign?.roleName ?? "Results"}</h1>
          <p className="text-xs" style={{ color: "#555555" }}>
            {campaign?.companyName} · {candidates.length} scored candidates
          </p>
        </div>
        <button onClick={selectTopPicks}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "#1e1b4b", border: "1px solid #312e81" }}
          title="Select every clean Yes / Strong Yes candidate (flagged candidates excluded)">
          <Star size={14} /> Select Top Picks
        </button>
        <button onClick={issueCertificates} disabled={certIssuing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#b45309" }}
          title="Issue e-certificates to all reviewed candidates">
          <Award size={14} /> {certIssuing ? "Issuing…" : "Issue Certificates"}
        </button>
        <button onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e5e7eb" }}>
          <Download size={14} /> Export CSV
        </button>
      </header>

      {certResult && (
        <div className="px-8 py-2.5 text-sm font-semibold flex items-center gap-2"
          style={{ background: "#451a03", color: "#fbbf24", borderBottom: "1px solid #92400e" }}>
          <Award size={15} /> {certResult} — candidates can now view and share their certificates
        </div>
      )}

      {inviteResult && (
        <div className="px-8 py-2.5 text-sm font-semibold flex items-center gap-2"
          style={{ background: "#052e16", color: "#4ade80", borderBottom: "1px solid #166534" }}>
          <Check size={15} /> Invites sent — {inviteResult}
        </div>
      )}

      <div className="flex flex-1">
        {/* ── Filter panel ── */}
        <aside className="w-64 shrink-0 p-5 space-y-6" style={{ background: "#0d0d0d", borderRight: "1px solid #1a1a1a" }}>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#555555" }}>
              Min Score: {minScore}
            </label>
            <input type="range" min={0} max={100} value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="w-full mt-3" style={{ accentColor: "#6366f1" }} />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest block mb-3" style={{ color: "#555555" }}>
              AI Declaration
            </label>
            <div className="space-y-2">
              {(Object.keys(AI_BADGE) as AIDeclaration[]).map((d) => (
                <label key={d} className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <input type="checkbox" checked={aiFilters.has(d)} onChange={() => toggleAi(d)}
                    style={{ accentColor: AI_BADGE[d].color }} />
                  <span style={{ color: AI_BADGE[d].color }}>{AI_BADGE[d].label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest block mb-3" style={{ color: "#555555" }}>
              Sort By
            </label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#111111", border: "1px solid #2a2a2a", color: "#e5e7eb" }}>
              <option value="score">Overall Score</option>
              <option value="diagnosis">Diagnosis</option>
              <option value="design">Design</option>
              <option value="date">Submission Date</option>
            </select>
          </div>
        </aside>

        {/* ── Table ── */}
        <main className="flex-1 p-6 pb-28">
          {loading ? (
            <div className="text-center py-20 text-sm" style={{ color: "#555555" }}>Loading…</div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-20 text-sm" style={{ color: "#555555" }}>
              No scored candidates match your filters yet.
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222222" }}>
              <table className="w-full text-sm" style={{ background: "#0d0d0d" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a", background: "#111111" }}>
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" checked={selected.size === candidates.length && candidates.length > 0}
                        onChange={toggleAll} style={{ accentColor: "#6366f1" }} />
                    </th>
                    {["#", "Candidate", "Total", "Diag", "Design", "Comms", "Exec", "Verbal", "Authenticity", "Verdict", "AI", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "#444444" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => {
                    const s = c.submission;
                    const ai = c.submission?.followUp?.aiDeclaration;
                    const aiMeta = ai ? AI_BADGE[ai] : null;
                    const stMeta = STATUS_BADGE[c.status] ?? STATUS_BADGE.NEW;
                    return (
                      <tr key={c.id} style={{
                        borderBottom: "1px solid #161616",
                        borderLeft: c.recommended ? "3px solid #22c55e" : "3px solid transparent",
                        background: selected.has(c.id) ? "#13131f" : "transparent",
                      }}>
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                            style={{ accentColor: "#6366f1" }} />
                        </td>
                        <td className="px-3 py-3 text-xs font-bold" style={{ color: "#666666" }}>{c.rank}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                {c.user.githubUsername || c.user.email || "—"}
                                {c.recommended && (
                                  <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full"
                                    style={{ background: "#052e16", color: "#4ade80" }}>
                                    <Star size={9} /> Rec
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-sm font-black" style={{
                            color: (s?.scoreTotal ?? 0) >= 80 ? "#4ade80" : (s?.scoreTotal ?? 0) >= 60 ? "#fbbf24" : "#f87171",
                          }}>{s?.scoreTotal ?? "—"}</span>
                        </td>
                        <td className="px-3 py-3 text-xs" style={{ color: "#aaaaaa" }}>{s?.scoreDiagnosis ?? "—"}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: "#aaaaaa" }}>{s?.scoreDesign ?? "—"}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: "#aaaaaa" }}>{s?.scoreCommunication ?? "—"}</td>
                        <td className="px-3 py-3 text-xs" style={{ color: "#aaaaaa" }}>{s?.scoreExecution ?? "—"}</td>
                        <td className="px-3 py-3 text-xs font-bold">
                          {(s?.verbalPenalty ?? 0) > 0
                            ? <span style={{ color: "#f87171" }} title="Weak spoken defence — already reflected in Diagnosis & Design">⚠</span>
                            : s?.scoreTotal != null
                              ? <span style={{ color: "#4ade80" }}>✓</span>
                              : <span style={{ color: "#444" }}>—</span>}
                        </td>
                        {/* Authenticity — advisory chip, never changes rank */}
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: AUTH_META[c.authBand].color }} />
                            <span style={{ color: AUTH_META[c.authBand].color }}>{AUTH_META[c.authBand].label}</span>
                            {c.flagged && (
                              <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded"
                                style={{ background: "#450a0a", color: "#f87171" }}
                                title="Answers contradict the candidate's own AI declaration — review before deciding">
                                Review
                              </span>
                            )}
                          </span>
                        </td>
                        {/* Verdict — advisory, combines skill + integrity without merging the number */}
                        <td className="px-3 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: VERDICT_META[c.verdict].bg, color: VERDICT_META[c.verdict].color }}>
                            {VERDICT_META[c.verdict].label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {aiMeta && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: aiMeta.bg, color: aiMeta.color }}>{aiMeta.label}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: stMeta.bg, color: stMeta.color }}>
                            {c.status[0] + c.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/employer/campaigns/${campaignId}/candidates/${c.id}`}
                            className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#6366f1" }}>
                            View <ExternalLink size={11} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* ── Floating action bar ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl"
          style={{ background: "#1a1a1a", border: "1px solid #333333", marginLeft: "120px" }}>
          <span className="text-sm font-bold text-white">{selected.size} selected</span>
          <div className="w-px h-6" style={{ background: "#333333" }} />
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: "#6366f1" }}>
            <Mail size={13} /> Invite to Interview
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "#222222", color: "#e5e7eb" }}>
            <Download size={13} /> Export
          </button>
          <button onClick={() => bulkStatus("REVIEWED")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "#222222", color: "#e5e7eb" }}>
            <CheckCircle2 size={13} /> Mark Reviewed
          </button>
          <button onClick={() => bulkStatus("REJECTED")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "#2a0a0a", color: "#f87171" }}>
            <X size={13} /> Reject
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs font-medium" style={{ color: "#888888" }}>
            Clear
          </button>
        </div>
      )}

      {/* ── Invite modal ── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowInvite(false)}>
          <div className="rounded-xl max-w-lg w-full p-6" style={{ background: "#111111", border: "1px solid #2a2a2a" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-white">Invite {selected.size} candidate(s)</h2>
              <button onClick={() => setShowInvite(false)} style={{ color: "#888888" }}><X size={18} /></button>
            </div>

            <div className="rounded-lg p-4 mb-4 text-sm" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", color: "#aaaaaa" }}>
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#555555" }}>Email preview</div>
              <p className="mb-2"><span style={{ color: "#666" }}>Subject:</span> You&apos;ve been shortlisted — {campaign?.roleName} at {campaign?.companyName}</p>
              <div className="border-t my-3" style={{ borderColor: "#1e1e1e" }} />
              <p className="leading-relaxed text-xs">
                Hi [Candidate],<br /><br />
                You performed strongly on the {campaign?.companyName} {campaign?.roleName} assessment on DevSimulate.
                We&apos;d like to invite you for an interview.<br /><br />
                Book your slot: <span style={{ color: "#818cf8" }}>{campaign?.bookingLink ?? "[booking link]"}</span><br /><br />
                {campaign?.companyName} Hiring Team
              </p>
            </div>

            {!campaign?.bookingLink && (
              <div className="rounded-lg px-3 py-2 mb-4 text-xs" style={{ background: "#422006", color: "#fbbf24" }}>
                No booking link set on this campaign. Candidates will be shortlisted but the email won&apos;t include a link.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={confirmInvite}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: "#6366f1" }}>
                <Check size={15} /> Confirm & Send
              </button>
              <button onClick={() => setShowInvite(false)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#e5e7eb" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
