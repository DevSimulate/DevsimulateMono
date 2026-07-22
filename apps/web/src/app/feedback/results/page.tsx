"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const INDIGO = "#4F46E5";
const INK = "#1A1A2E";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";

interface Summary {
  event: string | null;
  total: number;
  overall: { avg: number | null; distribution: Record<string, number> };
  nps: { score: number | null; promoters: number; passives: number; detractors: number; responses: number };
  ticket: { clear: number | null; realistic: number | null; challenging: number | null };
  vsTraditional: Record<string, number>;
  difficulty: Record<string, number>;
  timeGiven: Record<string, number>;
  instructionsClear: Record<string, number>;
  aiFeel: Record<string, number>;
  verbalFeel: Record<string, number>;
  fairChance: Record<string, number>;
  technicalIssues: Record<string, number>;
  issueResolution: Record<string, number>;
  recent: { overallRating: number | null; nps: number | null; difficulty: string | null; bestPart: string | null; improve: string | null; createdAt: string }[];
}

export default function ResultsPage() {
  const [d, setD] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const qs = new URLSearchParams();
    if (p.get("event")) qs.set("event", p.get("event")!);
    if (p.get("key")) qs.set("key", p.get("key")!);
    fetch(`${API}/survey/summary?${qs.toString()}`)
      .then((r) => r.json())
      .then((j) => (j.data ? setD(j.data) : setError(j.error ?? "Failed to load")))
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Center>Loading results…</Center>;
  if (error) return <Center>{error}</Center>;
  if (!d) return <Center>No data.</Center>;

  const npsColor = d.nps.score == null ? MUTED : d.nps.score >= 50 ? GREEN : d.nps.score >= 0 ? AMBER : RED;

  return (
    <div style={pageBg}>
      <div style={{ width: "100%", maxWidth: 860 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: INDIGO }}>
            Survey Results {d.event ? `· ${d.event}` : "· All events"}
          </div>
          <h1 style={{ fontSize: 26, color: INK, margin: "4px 0 0", fontWeight: 800 }}>DevFest Feedback Dashboard</h1>
        </div>

        {d.total === 0 ? (
          <div style={card}><p style={{ margin: 0, color: MUTED }}>No responses yet. Share the feedback link and they&apos;ll appear here.</p></div>
        ) : (
          <>
            {/* Top KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 18 }}>
              <Kpi label="Responses" value={String(d.total)} color={INK} />
              <Kpi label="Avg experience" value={d.overall.avg != null ? `${d.overall.avg}/5` : "—"} color={INDIGO} />
              <Kpi label="NPS" value={d.nps.score != null ? String(d.nps.score) : "—"} color={npsColor} sub={`${d.nps.responses} rated`} />
              <Kpi label="Fair chance: yes" value={pctYes(d.fairChance)} color={GREEN} />
            </div>

            {/* NPS breakdown */}
            <Section title="Recommendation (NPS)">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip label="Promoters (9–10)" n={d.nps.promoters} color={GREEN} />
                <Chip label="Passives (7–8)" n={d.nps.passives} color={AMBER} />
                <Chip label="Detractors (0–6)" n={d.nps.detractors} color={RED} />
              </div>
            </Section>

            {/* Overall distribution */}
            <Section title="Overall experience (1–5)">
              <Bars data={ratingRecord(d.overall.distribution)} total={d.total} />
            </Section>

            {/* vs traditional — the strategic one */}
            <Section title="Vs. traditional coding assessments">
              <Bars data={d.vsTraditional} total={sum(d.vsTraditional)} />
            </Section>

            {/* Ticket quality */}
            <Section title="Ticket quality (avg /5)">
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                <Metric label="Clear" v={d.ticket.clear} />
                <Metric label="Realistic" v={d.ticket.realistic} />
                <Metric label="Challenging" v={d.ticket.challenging} />
              </div>
            </Section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
              <Section title="Difficulty"><Bars data={d.difficulty} total={sum(d.difficulty)} /></Section>
              <Section title="Time given"><Bars data={d.timeGiven} total={sum(d.timeGiven)} /></Section>
              <Section title="Instructions clarity"><Bars data={d.instructionsClear} total={sum(d.instructionsClear)} /></Section>
              <Section title="AI while coding"><Bars data={d.aiFeel} total={sum(d.aiFeel)} /></Section>
              <Section title="Verbal defense"><Bars data={d.verbalFeel} total={sum(d.verbalFeel)} /></Section>
              <Section title="Fair chance to show ability"><Bars data={d.fairChance} total={sum(d.fairChance)} /></Section>
            </div>

            {/* Technical issues */}
            <Section title="Technical issues reported">
              {sum(d.technicalIssues) === 0
                ? <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>None reported.</p>
                : <Bars data={d.technicalIssues} total={d.total} barColor={RED} />}
            </Section>

            {/* Open text */}
            <Section title="What people said">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {d.recent.filter((r) => r.bestPart || r.improve).length === 0 && (
                  <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>No written comments yet.</p>
                )}
                {d.recent.filter((r) => r.bestPart || r.improve).map((r, i) => (
                  <div key={i} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 6 }}>
                      {r.overallRating ? `★ ${r.overallRating}/5` : ""}{r.nps != null ? ` · NPS ${r.nps}` : ""}{r.difficulty ? ` · ${r.difficulty}` : ""}
                    </div>
                    {r.bestPart && <p style={{ margin: "0 0 6px", fontSize: 13.5, color: INK }}><b style={{ color: GREEN }}>+ </b>{r.bestPart}</p>}
                    {r.improve && <p style={{ margin: 0, fontSize: 13.5, color: INK }}><b style={{ color: AMBER }}>→ </b>{r.improve}</p>}
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
        <p style={{ textAlign: "center", color: MUTED, fontSize: 11.5, margin: "10px 0 30px" }}>DevSimulate · survey dashboard</p>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const ratingRecord = (o: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const k of ["5", "4", "3", "2", "1"]) out[`${k} ★`] = o[k] ?? 0;
  return out;
};
const pctYes = (o: Record<string, number>): string => {
  const t = sum(o);
  if (!t) return "—";
  const yes = (o["Definitely yes"] ?? 0) + (o["Mostly"] ?? 0);
  return `${Math.round((yes / t) * 100)}%`;
};

/* ---------- components ---------- */
function Center({ children }: { children: ReactNode }) {
  return <div style={{ ...pageBg, alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 15 }}>{children}</div>;
}
function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function Bars({ data, total, barColor = INDIGO }: { data: Record<string, number>; total: number; barColor?: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>—</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {entries.map(([label, n]) => {
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12.5, color: INK, marginBottom: 3 }}>{label}</div>
              <div style={{ background: "#EEF0F4", borderRadius: 5, height: 9 }}>
                <div style={{ width: `${pct}%`, background: barColor, height: "100%", borderRadius: 5, minWidth: n ? 3 : 0 }} />
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, whiteSpace: "nowrap", minWidth: 44, textAlign: "right" }}>{n} · {pct}%</div>
          </div>
        );
      })}
    </div>
  );
}
function Chip({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderLeft: `4px solid ${color}`, borderRadius: 8, padding: "8px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{n}</div>
      <div style={{ fontSize: 11.5, color: MUTED }}>{label}</div>
    </div>
  );
}
function Metric({ label, v }: { label: string; v: number | null }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: INDIGO }}>{v != null ? `${v}` : "—"}</div>
      <div style={{ fontSize: 12, color: MUTED }}>{label}</div>
    </div>
  );
}

/* ---------- styles ---------- */
const pageBg: CSSProperties = {
  minHeight: "100vh",
  background: "#EEF0F5",
  padding: "30px 16px",
  fontFamily: "'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif",
  display: "flex",
  justifyContent: "center",
  color: INK,
};
const card: CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: "18px 20px",
  boxShadow: "0 4px 20px rgba(30,30,60,0.06)",
};
