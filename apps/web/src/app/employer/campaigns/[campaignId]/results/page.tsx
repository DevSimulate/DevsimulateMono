"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  ArrowLeft, Download, Mail, Check, X, ExternalLink, Star, CheckCircle2, Award,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// Precision Instrument palette used throughout this page's lookup tables —
// emerald means verified/passing signal only (no AI used, defended, high
// confidence, positive verdict), amber is advisory, red is a negative signal.
// Brand indigo (buttons/links elsewhere on this page) never appears in these
// lookup tables — they're all judgment/quality signals, not actions.
const INK = "#10182B", MUTED = "#5E6673", HAIRLINE = "#D8DAD3", PAPER = "#FBFBF8", SURFACE = "#FFFFFF";
const BRAND = "#4F46E5", BRAND_WEAK = "#EEF0FD";
const EMERALD = "#0B7A5E", EMERALD_WEAK = "#E6F3EF";
const AMBER = "#B7791F", AMBER_WEAK = "#FBF1E1";
const RED = "#B3372F", RED_WEAK = "#FBECEB";

type AIDeclaration = "NO_AI_USED" | "AI_USED_FOR_PHRASING" | "AI_USED_FOR_UNDERSTANDING" | "AI_USED_FOR_ANSWER";

const AI_BADGE: Record<AIDeclaration, { label: string; bg: string; color: string }> = {
  NO_AI_USED:                { label: "No AI",      bg: EMERALD_WEAK, color: EMERALD },
  AI_USED_FOR_PHRASING:      { label: "Phrasing",   bg: AMBER_WEAK,   color: AMBER },
  AI_USED_FOR_UNDERSTANDING: { label: "Learning",   bg: AMBER_WEAK,   color: AMBER },
  AI_USED_FOR_ANSWER:        { label: "Full AI",    bg: RED_WEAK,     color: RED },
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  NEW:         { bg: EMERALD_WEAK, color: EMERALD },
  REVIEWED:    { bg: "#F1F0EB",    color: MUTED },
  SHORTLISTED: { bg: EMERALD_WEAK, color: EMERALD },
  REJECTED:    { bg: RED_WEAK,     color: RED },
};

type Verdict = "STRONG_YES" | "YES" | "MAYBE" | "NO";
type AuthBand = "HIGH" | "MEDIUM" | "LOW";

const VERDICT_META: Record<Verdict, { label: string; bg: string; color: string }> = {
  STRONG_YES: { label: "Strong yes", bg: EMERALD_WEAK, color: EMERALD },
  YES:        { label: "Yes",        bg: EMERALD_WEAK, color: EMERALD },
  MAYBE:      { label: "Maybe",      bg: AMBER_WEAK,   color: AMBER },
  NO:         { label: "No",         bg: RED_WEAK,     color: RED },
};

const AUTH_META: Record<AuthBand, { label: string; color: string }> = {
  HIGH:   { label: "High",   color: EMERALD },
  MEDIUM: { label: "Medium", color: AMBER },
  LOW:    { label: "Low",    color: RED },
};

// ─── Role-weighted scoring (mirrors the API's ROLE_WEIGHTS) ───────────────────
type DimKey = "diagnosis" | "design" | "communication" | "execution";
type RoleKey = "balanced" | "architect" | "debugger" | "lead";

const ROLES: Record<RoleKey, { label: string; sub: string; hint: string; w: Record<DimKey, number> }> = {
  balanced:  { label: "Balanced",       sub: "default rubric",    hint: "Balanced — the default rubric weighting",             w: { diagnosis: .40, design: .30, communication: .20, execution: .10 } },
  architect: { label: "Architect",      sub: "design-led",        hint: "Architect — rewards design judgment & trade-offs",    w: { diagnosis: .25, design: .45, communication: .20, execution: .10 } },
  debugger:  { label: "Debugger / SRE", sub: "diagnosis-led",     hint: "Debugger / SRE — rewards root-cause diagnosis depth", w: { diagnosis: .50, design: .20, communication: .15, execution: .15 } },
  lead:      { label: "Team Lead",      sub: "communication-led", hint: "Team Lead — rewards communicating the why",           w: { diagnosis: .20, design: .25, communication: .40, execution: .15 } },
};
const DIM_LABEL: Record<DimKey, string> = { diagnosis: "Diagnosis", design: "Design", communication: "Communication", execution: "Execution" };

type DefenseLevel = "DEFENDED" | "SHAKY" | "FAILED" | "NONE";
const DEFENSE_META: Record<DefenseLevel, { label: string; color: string; bg: string }> = {
  DEFENDED: { label: "Defended",        color: EMERALD, bg: EMERALD_WEAK },
  SHAKY:    { label: "Shaky defence",   color: AMBER,   bg: AMBER_WEAK },
  FAILED:   { label: "Couldn't defend", color: RED,     bg: RED_WEAK },
  NONE:     { label: "No verbal",       color: MUTED,   bg: "#F1F0EB" },
};

type Confidence = "HIGH" | "MEDIUM" | "LOW";
const CONF_META: Record<Confidence, { label: string; color: string }> = {
  // These describe how much to TRUST the score, which is not the same as how
  // much the scoring runs disagreed. "High variance" implied the latter and was
  // wrong: a candidate with three identical runs (76/76/76) still showed it,
  // because the flag actually fires when the defence contradicts the written
  // work or the AI declaration. Labelled for what it means.
  HIGH:   { label: "Defended · consistent", color: EMERALD },
  MEDIUM: { label: "Partly corroborated",   color: AMBER },
  LOW:    { label: "Contradicts written work", color: RED },
};

interface Signals {
  skillProfile: Record<DimKey, { value: number; max: number; pct: number }>;
  weakestDimension: DimKey;
  defense: { level: DefenseLevel; score: number | null };
  consistency: { code: number; written: number; spoken: number };
  confidence: Confidence;
  strength: string | null;
  concern: string | null;
}

interface Candidate {
  id: string;
  rank: number;
  recommended: boolean;
  status: string;
  authScore: number;
  authBand: AuthBand;
  flagged: boolean;
  verdict: Verdict;
  signals: Signals | null;
  effort: { minutes: number | null; expected: number | null; difficulty: string | null };
  user: { id: string; githubUsername: string; email: string | null };
  // Score story — already returned by the API, just newly consumed here.
  scorePrBase: number | null;
  scoreGap: number | null;
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
  type: "HIRING" | "CONTEST";
}

const SENIOR_BAR = 65;
// A gap this large or more gets the amber "strong code, weak defence" flag.
const NOTABLE_GAP = 10;

function weightedScore(sig: Signals | null, role: RoleKey): number | null {
  if (!sig) return null;
  const w = ROLES[role].w, p = sig.skillProfile;
  return Math.round(
    p.diagnosis.pct * w.diagnosis + p.design.pct * w.design +
    p.communication.pct * w.communication + p.execution.pct * w.execution
  );
}
const scoreColor = (s: number) => s >= 80 ? EMERALD : s >= 60 ? INK : s >= 45 ? AMBER : RED;
function levelFit(s: number): { label: string; color: string; ico: string } {
  if (s >= 80) return { label: "Exceeds", color: EMERALD, ico: "★" };
  if (s >= 58) return { label: "Meets",   color: MUTED, ico: "◆" };
  return { label: "Below level", color: RED, ico: "▽" };
}
const triColor = (v: number) => v >= 1 ? EMERALD : v >= 0.5 ? AMBER : RED;

function Triangle({ t, size }: { t: { code: number; written: number; spoken: number }; size: number }) {
  const s = size, pad = size * 0.17, r = size * 0.09;
  const P: Record<"code" | "written" | "spoken", [number, number]> = {
    code: [s / 2, pad], written: [pad, s - pad], spoken: [s - pad, s - pad],
  };
  const keys: Array<"code" | "written" | "spoken"> = ["code", "written", "spoken"];
  const edges: Array<["code" | "written" | "spoken", "code" | "written" | "spoken"]> = [
    ["code", "written"], ["written", "spoken"], ["code", "spoken"],
  ];
  return (
    <svg width={size} height={size * 0.86} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      {edges.map(([a, b], i) => {
        const mn = Math.min(t[a], t[b]);
        return <line key={i} x1={P[a][0]} y1={P[a][1]} x2={P[b][0]} y2={P[b][1]}
          stroke={triColor(mn)} strokeWidth={1.5} strokeDasharray={mn < 1 ? "3 3" : undefined} opacity={0.7} />;
      })}
      {keys.map((k) => <circle key={k} cx={P[k][0]} cy={P[k][1]} r={r} fill={triColor(t[k])} />)}
    </svg>
  );
}

export default function ResultsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<RoleKey>("balanced");
  const [interview, setInterview] = useState<Record<string, { loading: boolean; error?: string; dimension?: string; questions?: string[] }>>({});
  const [showInvite,    setShowInvite]    = useState(false);
  const [inviteResult,  setInviteResult]  = useState<string | null>(null);
  const [certIssuing,   setCertIssuing]   = useState(false);
  const [certResult,    setCertResult]    = useState<string | null>(null);
  const [rejectResult,  setRejectResult]  = useState<string | null>(null);

  // Filters
  const [minScore, setMinScore] = useState(0);
  const [aiFilters, setAiFilters] = useState<Set<AIDeclaration>>(new Set());

  const load = useCallback(() => {
    const token = getToken();
    const params = new URLSearchParams();
    if (minScore > 0) params.set("minScore", String(minScore));
    if (aiFilters.size) params.set("aiDeclaration", [...aiFilters].join(","));

    fetch(`${API}/employer/campaigns/${campaignId}/results?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => setCandidates(j.data ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [campaignId, minScore, aiFilters]);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setCampaign(j.data))
      .catch(() => null);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Rank by the role-weighted score, client-side, so switching role is instant.
  const ranked = useMemo(() => {
    return candidates
      .map((c) => ({ c, ws: weightedScore(c.signals, role) }))
      .sort((a, b) => (b.ws ?? -1) - (a.ws ?? -1));
  }, [candidates, role]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  async function genInterview(candId: string) {
    if (interview[candId]?.loading || interview[candId]?.questions) return;
    setInterview((p) => ({ ...p, [candId]: { loading: true } }));
    try {
      const token = getToken();
      const r = await fetch(`${API}/employer/campaigns/${campaignId}/candidates/${candId}/interview-questions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const j = await r.json();
      if (j.data?.questions?.length) {
        setInterview((p) => ({ ...p, [candId]: { loading: false, dimension: j.data.dimension, questions: j.data.questions } }));
      } else {
        setInterview((p) => ({ ...p, [candId]: { loading: false, error: j.error ?? "Couldn't generate questions" } }));
      }
    } catch {
      setInterview((p) => ({ ...p, [candId]: { loading: false, error: "Couldn't reach the server" } }));
    }
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.id))
    );
  }
  function selectTopPicks() {
    const picks = ranked
      .filter(({ c }) => !c.flagged && (c.verdict === "STRONG_YES" || c.verdict === "YES"))
      .map(({ c }) => c.id);
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
    const count = selected.size;
    const results = await Promise.all(
      [...selected].map((id) =>
        fetch(`${API}/employer/campaigns/${campaignId}/candidates/${id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }).then((r) => r.json()).catch(() => ({}))
      )
    );
    if (status === "REJECTED") {
      const emailed = results.filter((r) => r?.data?.emailed).length;
      setRejectResult(`${count} rejected — ${emailed} emailed`);
      setTimeout(() => setRejectResult(null), 6000);
    }
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

  // Hiring certificates are generic (DevSimulate-branded, no employer logo) and
  // only go to candidates who scored 65+; DevFest keeps its own category-ranked
  // issuance flow (via the campaigns list's DevFest tag panel) and issues to
  // every participant regardless of score.
  async function issueCertificates() {
    setCertIssuing(true);
    const token = getToken();
    try {
      const r = await fetch(`${API}/certificates/employer/campaigns/${campaignId}/certificates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ minScore: campaign?.type === "HIRING" ? 65 : 0 }),
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
    <div className="flex flex-col min-h-screen" style={{ color: INK, background: PAPER }}>
      <header className="sticky top-0 z-30 flex items-center gap-4 px-8 py-4" style={{ background: SURFACE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Link href="/employer/campaigns" style={{ color: MUTED }}><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold" style={{ color: INK }}>{campaign?.roleName ?? "Results"}</h1>
          <p className="text-xs" style={{ color: MUTED }}>
            {campaign?.companyName} · {candidates.length} scored candidates · ranked for role fit
          </p>
        </div>
        <Button variant="secondary" onClick={selectTopPicks} title="Select every clean Yes / Strong Yes candidate (flagged candidates excluded)">
          <Star size={14} className="mr-1.5" /> Select top picks
        </Button>
        <Button
          variant="secondary"
          onClick={issueCertificates}
          disabled={certIssuing}
          title={campaign?.type === "HIRING" ? "Issue a DevSimulate certificate to every candidate scoring 65+" : "Issue e-certificates to all reviewed candidates"}
        >
          <Award size={14} className="mr-1.5" style={{ color: AMBER }} />
          {certIssuing ? "Issuing…" : campaign?.type === "HIRING" ? "Issue certificates (65+)" : "Issue certificates"}
        </Button>
        <Button variant="secondary" onClick={exportCsv}>
          <Download size={14} className="mr-1.5" /> Export CSV
        </Button>
      </header>

      {certResult && (
        <div className="px-8 py-2.5 text-sm font-semibold flex items-center gap-2" style={{ background: AMBER_WEAK, color: AMBER, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Award size={15} /> {certResult} — candidates can now view and share their certificates
        </div>
      )}
      {inviteResult && (
        <div className="px-8 py-2.5 text-sm font-semibold flex items-center gap-2" style={{ background: EMERALD_WEAK, color: EMERALD, borderBottom: `1px solid ${HAIRLINE}` }}>
          <Check size={15} /> Invites sent — {inviteResult}
        </div>
      )}
      {rejectResult && (
        <div className="px-8 py-2.5 text-sm font-semibold flex items-center gap-2" style={{ background: RED_WEAK, color: RED, borderBottom: `1px solid ${HAIRLINE}` }}>
          <X size={15} /> {rejectResult}
        </div>
      )}

      {/* ── Role-weighting bar ── */}
      <div className="px-8 py-3 flex items-center gap-4 flex-wrap" style={{ background: SURFACE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Rank for</span>
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(ROLES) as RoleKey[]).map((rk) => {
            const active = role === rk;
            return (
              <button key={rk} onClick={() => setRole(rk)}
                className="flex flex-col items-start px-3 py-1.5 rounded text-left transition-colors duration-150"
                style={{ background: active ? BRAND_WEAK : SURFACE, border: `1px solid ${active ? BRAND : HAIRLINE}` }}>
                <span className="text-xs font-semibold" style={{ color: active ? BRAND : MUTED }}>{ROLES[rk].label}</span>
                <span className="text-[10px]" style={{ color: MUTED }}>{ROLES[rk].sub}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          {(Object.keys(DIM_LABEL) as DimKey[]).map((d) => {
            const pct = Math.round(ROLES[role].w[d] * 100);
            return (
              <div key={d} className="flex items-center gap-1.5">
                <span className="font-mono text-[10px]" style={{ color: MUTED }}>{DIM_LABEL[d].slice(0, 4)}</span>
                <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: HAIRLINE }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: BRAND }} />
                </div>
                <span className="font-mono text-[10px] tabular-nums" style={{ color: MUTED }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1">
        {/* ── Filter panel ── */}
        <aside className="w-64 shrink-0 p-5 space-y-6" style={{ background: PAPER, borderRight: `1px solid ${HAIRLINE}` }}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
              Min score: <span className="font-mono">{minScore}</span>
            </label>
            <input type="range" min={0} max={100} value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="w-full mt-3" style={{ accentColor: EMERALD }} />
          </div>
          <div className="text-xs leading-relaxed" style={{ color: MUTED }}>
            <div className="font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>Reading the signals</div>
            Score is <b style={{ color: INK }}>re-weighted</b> for the role above. <b style={{ color: INK }}>Gap</b> is
            the PR score minus the final score — a large gap means strong code, weaker defence. The
            <b style={{ color: INK }}> consistency</b> triangle compares code · written · spoken.
            All flags below are <b>advisory — nothing is auto-rejected.</b>
          </div>
        </aside>

        {/* ── Table ── */}
        <main className="flex-1 p-6 pb-28">
          {loading ? (
            <div className="text-center py-20 text-sm" style={{ color: MUTED }}>Loading…</div>
          ) : candidates.length === 0 ? (
            <EmptyState title="No scored candidates yet" description="Results appear here once candidates finish their assessments, or adjust your filters." />
          ) : (
            <div className="rounded overflow-x-auto" style={{ border: `1px solid ${HAIRLINE}` }}>
              <table className="w-full text-sm font-mono" style={{ background: SURFACE, minWidth: 1040 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${HAIRLINE}`, background: PAPER }}>
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" checked={selected.size === candidates.length && candidates.length > 0}
                        onChange={toggleAll} style={{ accentColor: EMERALD }} />
                    </th>
                    {["#", "Candidate", "PR score", "Final", "Gap", "Level fit", "Defence", "Verdict", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-3 font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(({ c, ws }, i) => {
                    const sig = c.signals;
                    const ai = c.submission?.followUp?.aiDeclaration;
                    const stMeta = STATUS_BADGE[c.status] ?? STATUS_BADGE.NEW;
                    const isOpen = expanded.has(c.id);
                    const conf = sig?.confidence ?? "MEDIUM";
                    // Only the decision bar. This used to also fire on conf ===
                    // "LOW", which was largely the AI-declaration mismatch — a
                    // flag that hit 65% of candidates and is no longer shown
                    // anywhere, so it must not drive a visible badge either.
                    // What remains is the honest case: the score is close
                    // enough to the cut-off that a point either way changes the
                    // answer, so look before deciding.
                    const borderline = ws != null && Math.abs(ws - SENIOR_BAR) <= 4;
                    const fit = ws != null ? levelFit(ws) : null;
                    const def = sig ? DEFENSE_META[sig.defense.level] : DEFENSE_META.NONE;
                    const gap = c.scoreGap;
                    const notableGap = gap != null && gap >= NOTABLE_GAP;
                    return (
                      <Fragment key={c.id}>
                        <tr onClick={() => toggleExpand(c.id)} style={{
                          borderBottom: isOpen ? "none" : `1px solid ${HAIRLINE}`,
                          borderLeft: `3px solid ${c.recommended ? EMERALD : "transparent"}`,
                          background: selected.has(c.id) ? PAPER : "transparent",
                          cursor: "pointer",
                        }}>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} style={{ accentColor: EMERALD }} />
                          </td>
                          <td className="px-3 py-3 text-xs font-bold tabular-nums" style={{ color: i === 0 ? AMBER : MUTED }}>{i + 1}</td>
                          <td className="px-3 py-3 font-sans">
                            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: INK }}>
                              {c.user.githubUsername || c.user.email || "—"}
                              {c.recommended && (
                                <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full" style={{ background: EMERALD_WEAK, color: EMERALD }}>
                                  <Star size={9} /> Rec
                                </span>
                              )}
                            </div>
                            {c.effort?.minutes != null && c.effort.expected != null && (
                              <div className="font-mono text-[10px] mt-0.5" style={{ color: MUTED }}>
                                {c.effort.minutes}m / {c.effort.expected}m
                              </div>
                            )}
                          </td>
                          {/* PR score (base, pre-deduction) */}
                          <td className="px-3 py-3 tabular-nums" style={{ color: MUTED }}>
                            {c.scorePrBase ?? "—"}
                          </td>
                          {/* Final (role-weighted) + confidence */}
                          <td className="px-3 py-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-bold tabular-nums" style={{ color: ws != null ? scoreColor(ws) : MUTED }}>
                                {ws ?? "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {borderline && (
                                <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded" title={`Role-weighted score is within 4 points of the ${SENIOR_BAR} decision bar — worth a second look before deciding`}
                                  style={{ background: AMBER_WEAK, color: AMBER }}>RE-REVIEW</span>
                              )}
                            </div>
                          </td>
                          {/* Gap — the signature insight */}
                          <td className="px-3 py-3">
                            {gap != null && gap > 0 ? (
                              <span
                                className="inline-flex items-center text-xs font-bold px-2 py-1 rounded-full tabular-nums"
                                style={{ background: notableGap ? AMBER_WEAK : "#F1F0EB", color: notableGap ? AMBER : MUTED }}
                                title={notableGap ? "Strong code, weaker defence — review the transcript" : undefined}
                              >
                                −{gap}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: MUTED }}>—</span>
                            )}
                          </td>
                          {/* Level fit */}
                          <td className="px-3 py-3 font-sans">
                            {fit && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded"
                                style={{ color: fit.color, background: SURFACE, border: `1px solid ${fit.color}33` }}>
                                <span>{fit.ico}</span>{fit.label}
                              </span>
                            )}
                          </td>
                          {/* Defence */}
                          <td className="px-3 py-3 font-sans">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded" style={{ color: def.color, background: def.bg }}>
                              {def.label}
                              {sig?.defense.score != null && <span className="text-[10px] opacity-80 tabular-nums">{sig.defense.score}/10</span>}
                            </span>
                          </td>
                          {/* Authenticity — HIDDEN.
                              authenticity = 100 - riskScore, and riskScore is
                              currently unusable: calculateRiskScore measures
                              "elapsed" as Date.now() - submittedAt, but it runs
                              inside the review worker ~30s after submission. So
                              the "submitted suspiciously fast" branch fires for
                              EVERY candidate and adds a flat +40, putting a
                              permanent ceiling on the score. Nobody can reach
                              High; almost everyone reads Medium regardless of
                              what they did.

                              Restore this column once the elapsed calculation
                              measures assignment -> submission instead, and
                              existing rows are recomputed.

                          <td className="px-3 py-3 font-sans">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: AUTH_META[c.authBand].color }} />
                              <span style={{ color: AUTH_META[c.authBand].color }}>{AUTH_META[c.authBand].label}</span>
                            </span>
                          </td>
                          */}
                          {/* Verdict */}
                          <td className="px-3 py-3 font-sans">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: VERDICT_META[c.verdict].bg, color: VERDICT_META[c.verdict].color }}>
                              {VERDICT_META[c.verdict].label}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-sans">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: stMeta.bg, color: stMeta.color }}>
                              {c.status[0] + c.status.slice(1).toLowerCase()}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-sans" onClick={(e) => e.stopPropagation()}>
                            <Link href={`/employer/campaigns/${campaignId}/candidates/${c.id}`} className="flex items-center gap-1 text-xs font-semibold" style={{ color: EMERALD }}>
                              View <ExternalLink size={11} />
                            </Link>
                          </td>
                        </tr>

                        {/* Expanded: skill profile + consistency + interview probe */}
                        {isOpen && sig && (
                          <tr style={{ borderBottom: `1px solid ${HAIRLINE}`, background: PAPER }}>
                            <td colSpan={12} className="px-6 py-5 font-sans">
                              <div className="grid gap-6" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: MUTED }}>
                                    Skill profile <span style={{ color: EMERALD }}>· weighted for {ROLES[role].label}</span>
                                  </div>
                                  <div className="space-y-2.5">
                                    {(Object.keys(DIM_LABEL) as DimKey[]).map((d) => {
                                      const p = sig.skillProfile[d];
                                      const lead = ROLES[role].w[d] === Math.max(...Object.values(ROLES[role].w));
                                      const col = p.pct >= 75 ? EMERALD : p.pct >= 55 ? INK : p.pct >= 40 ? AMBER : RED;
                                      return (
                                        <div key={d} className="grid items-center gap-3" style={{ gridTemplateColumns: "110px 1fr 34px" }}>
                                          <span className="text-xs" style={{ color: lead ? EMERALD : MUTED, fontWeight: lead ? 700 : 400 }}>
                                            {DIM_LABEL[d]}{lead ? " ◂" : ""}
                                          </span>
                                          <div className="h-2 rounded-full overflow-hidden" style={{ background: HAIRLINE }}>
                                            <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, background: col }} />
                                          </div>
                                          <span className="font-mono text-[11px] tabular-nums text-right" style={{ color: MUTED }}>{p.pct}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 text-xs" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                                    {sig.strength && <span style={{ color: MUTED }}><b style={{ color: EMERALD }}>Strength</b> · {sig.strength}</span>}
                                    {sig.concern && <span style={{ color: MUTED }}><b style={{ color: RED }}>Watch</b> · {sig.concern}</span>}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
                                    Interview pack — probes {DIM_LABEL[(interview[c.id]?.dimension as DimKey) ?? sig.weakestDimension].toLowerCase()}
                                  </div>
                                  {interview[c.id]?.questions ? (
                                    <div className="space-y-2.5">
                                      {interview[c.id]!.questions!.map((q, qi) => (
                                        <div key={qi} className="flex gap-2.5 text-xs leading-relaxed" style={{ color: INK }}>
                                          <span className="font-bold tabular-nums flex-none" style={{ color: EMERALD }}>{qi + 1}</span>
                                          <span>{q}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <Button variant="secondary" size="sm" onClick={() => genInterview(c.id)} disabled={interview[c.id]?.loading}>
                                      {interview[c.id]?.loading ? "Generating…" : "Generate 3 interview questions"}
                                    </Button>
                                  )}
                                  {interview[c.id]?.error && (
                                    <div className="text-xs mt-2" style={{ color: RED }}>{interview[c.id]?.error}</div>
                                  )}
                                  <Link href={`/employer/campaigns/${campaignId}/candidates/${c.id}`} className="inline-flex items-center gap-1 text-xs font-semibold mt-3" style={{ color: EMERALD }}>
                                    Open full profile <ExternalLink size={11} />
                                  </Link>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded shadow-overlay"
          style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, marginLeft: "120px" }}>
          <span className="text-sm font-bold" style={{ color: INK }}>{selected.size} selected</span>
          <div className="w-px h-6" style={{ background: HAIRLINE }} />
          <Button variant="destructive" size="sm" onClick={() => bulkStatus("REJECTED")}>
            <X size={13} className="mr-1.5" /> Reject
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
            <Mail size={13} className="mr-1.5" /> Invite to interview
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download size={13} className="mr-1.5" /> Export
          </Button>
          <Button variant="secondary" size="sm" onClick={() => bulkStatus("REVIEWED")}>
            <CheckCircle2 size={13} className="mr-1.5" /> Mark reviewed
          </Button>
          <button onClick={() => setSelected(new Set())} className="text-xs font-medium" style={{ color: MUTED }}>
            Clear
          </button>
        </div>
      )}

      {/* ── Invite modal ── */}
      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title={`Invite ${selected.size} candidate(s)`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button variant="primary" onClick={confirmInvite}><Check size={15} className="mr-1.5" /> Confirm & send</Button>
          </>
        }
      >
        <div className="rounded p-4 mb-4 text-sm" style={{ background: PAPER, border: `1px solid ${HAIRLINE}`, color: MUTED }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: MUTED }}>Email preview</div>
          <p className="mb-2"><span style={{ color: MUTED }}>Subject:</span> You&apos;ve been shortlisted — {campaign?.roleName} at {campaign?.companyName}</p>
          <div className="border-t my-3" style={{ borderColor: HAIRLINE }} />
          <p className="leading-relaxed text-xs">
            Hi [Candidate],<br /><br />
            You performed strongly on the {campaign?.companyName} {campaign?.roleName} assessment on DevSimulate.
            We&apos;d like to invite you for an interview.<br /><br />
            {campaign?.bookingLink
              ? <>Book your slot: <span className="font-mono" style={{ color: EMERALD }}>{campaign.bookingLink}</span></>
              : <>The hiring team will reach out with next steps.</>}
            <br /><br />
            {campaign?.companyName} Hiring Team
          </p>
        </div>
      </Modal>
    </div>
  );
}
