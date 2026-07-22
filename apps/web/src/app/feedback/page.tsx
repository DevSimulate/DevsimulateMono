"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// Brand palette
const INDIGO = "#4F46E5";
const INDIGO_SOFT = "#EEF0FF";
const INK = "#1A1A2E";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

const DEVSIM_SVG = `<svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="ds_fb_g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#818CF8"/><stop offset="1" stop-color="#A78BFA"/></linearGradient></defs>
<rect width="40" height="40" rx="10" fill="url(#ds_fb_g)"/>
<polyline points="15,12.5 25.5,20 15,27.5" fill="none" stroke="#FFFFFF" stroke-width="4.3" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="15" y="30.4" width="11" height="3.4" rx="1.7" fill="#2DD4BF"/>
</svg>`;

type Answers = {
  event?: string;
  overallRating?: number;
  nps?: number;
  vsTraditional?: string;
  vsTraditionalWhy?: string;
  ticketClear?: number;
  ticketRealistic?: number;
  ticketChallenging?: number;
  difficulty?: string;
  timeGiven?: string;
  instructionsClear?: string;
  instructionsIssue?: string;
  aiFeel?: string;
  aiComments?: string;
  verbalFeel?: string;
  verbalComments?: string;
  fairChance?: string;
  technicalIssues: string[];
  issueResolution?: string;
  bestPart?: string;
  improve?: string;
  contact?: string;
};

export default function FeedbackPage() {
  const [a, setA] = useState<Answers>({ technicalIssues: [] });
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the optional ?event= tag client-side (avoids useSearchParams Suspense).
  useEffect(() => {
    const ev = new URLSearchParams(window.location.search).get("event");
    if (ev) setA((prev) => ({ ...prev, event: ev }));
  }, []);

  const set = (k: keyof Answers, v: unknown) => setA((prev) => ({ ...prev, [k]: v }));
  const toggleIssue = (v: string) =>
    setA((prev) => {
      const has = prev.technicalIssues.includes(v);
      const none = v === "No issues";
      const next = has
        ? prev.technicalIssues.filter((x) => x !== v)
        : [...prev.technicalIssues.filter((x) => (none ? false : x !== "No issues")), v];
      return { ...prev, technicalIssues: next };
    });

  const submit = async () => {
    setError(null);
    const missing: number[] = [];
    if (a.overallRating == null) missing.push(1);
    if (a.nps == null) missing.push(2);
    if (!a.vsTraditional) missing.push(3);
    if (a.ticketClear == null || a.ticketRealistic == null || a.ticketChallenging == null) missing.push(4);
    if (!a.difficulty) missing.push(5);
    if (!a.timeGiven) missing.push(6);
    if (!a.instructionsClear) missing.push(7);
    if (!a.aiFeel) missing.push(8);
    if (!a.verbalFeel) missing.push(9);
    if (!a.fairChance) missing.push(10);
    if (a.technicalIssues.length === 0) missing.push(11);
    if (!a.issueResolution) missing.push(12);
    if (!a.bestPart?.trim()) missing.push(13);
    if (!a.improve?.trim()) missing.push(14);
    if (missing.length) {
      setError(`Please answer all required questions — missing: ${missing.map((n) => `Q${n}`).join(", ")}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a),
      });
      const j = await res.json();
      if (res.ok && j.success) setDone(true);
      else setError(j.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={pageBg}>
        <div style={{ ...card, textAlign: "center", padding: "48px 28px" }}>
          <div style={{ fontSize: 46, marginBottom: 10 }}>🚀</div>
          <h1 style={{ fontSize: 22, color: INK, margin: "0 0 10px" }}>Thank you!</h1>
          <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            This genuinely shapes the next event. Winners and category results will be shared on the
            DevFest leaderboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageBg}>
      <div style={card}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, #4338CA, #6366F1)`, padding: "26px 28px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span dangerouslySetInnerHTML={{ __html: DEVSIM_SVG }} />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.2 }}>DevSimulate</span>
          </div>
          <h1 style={{ fontSize: 21, margin: "0 0 6px", fontWeight: 800 }}>DevFest — Participant Feedback</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "#DDE2FF", lineHeight: 1.6 }}>
            Thanks for taking part! We built this to feel like real engineering work — your honest
            feedback makes it better. Takes about a minute, and it&apos;s anonymous unless you choose to
            share your name.
          </p>
        </div>

        <div style={{ padding: "26px 28px 8px" }}>
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {/* Section A */}
          <SectionLabel>Overall experience</SectionLabel>

          <Q n={1} label="How would you rate your overall DevFest experience?" required>
            <Stars value={a.overallRating} onChange={(v) => set("overallRating", v)} />
          </Q>

          <Q n={2} label="How likely are you to recommend a DevSimulate-style assessment to a fellow developer?" required>
            <Nps value={a.nps} onChange={(v) => set("nps", v)} />
          </Q>

          <Q n={3} label="Compared to traditional coding assessments (LeetCode-style tests, take-home tasks), this felt…" required>
            <Choice
              options={[
                "Much more realistic / relevant to real work",
                "Somewhat more realistic",
                "About the same",
                "Less realistic",
              ]}
              value={a.vsTraditional}
              onChange={(v) => set("vsTraditional", v)}
            />
            <TextArea placeholder="Why? (optional)" value={a.vsTraditionalWhy} onChange={(v) => set("vsTraditionalWhy", v)} />
          </Q>

          {/* Section B */}
          <SectionLabel>The assessment itself</SectionLabel>

          <Q n={4} label="The ticket/problem I worked on was…" required>
            <Likert rows={[
              { key: "ticketClear", text: "Clear and well-explained" },
              { key: "ticketRealistic", text: "Realistic (felt like a real bug/task)" },
              { key: "ticketChallenging", text: "Appropriately challenging" },
            ]} values={a} onChange={(k, v) => set(k as keyof Answers, v)} />
          </Q>

          <Q n={5} label="The difficulty level was:" required>
            <Choice options={["Too easy", "Slightly easy", "Just right", "Slightly hard", "Too hard"]} value={a.difficulty} onChange={(v) => set("difficulty", v)} />
          </Q>

          <Q n={6} label="The time given for the assessment was:" required>
            <Choice options={["Too short", "Slightly short", "Just right", "More than enough"]} value={a.timeGiven} onChange={(v) => set("timeGiven", v)} />
          </Q>

          <Q n={7} label="Were the instructions for getting started (repo, setup, submitting your PR) clear?" required>
            <Choice options={["Yes, smooth", "Mostly, minor confusion", "No, I struggled"]} value={a.instructionsClear} onChange={(v) => set("instructionsClear", v)} />
            <TextArea placeholder="What tripped you up? (optional)" value={a.instructionsIssue} onChange={(v) => set("instructionsIssue", v)} />
          </Q>

          {/* Section C */}
          <SectionLabel>Format: AI &amp; verbal defense</SectionLabel>

          <Q n={8} label="You were allowed to use AI while coding. How did that feel?" required>
            <Choice
              options={[
                "Great — it reflects how I actually work",
                "Good, but I wasn't sure how much to rely on it",
                "Neutral",
                "I'd have preferred no AI",
              ]}
              value={a.aiFeel}
              onChange={(v) => set("aiFeel", v)}
            />
            <TextArea placeholder="Comments (optional)" value={a.aiComments} onChange={(v) => set("aiComments", v)} />
          </Q>

          <Q n={9} label="The follow-up questions / verbal defense (explaining your solution) were:" required>
            <Choice
              options={[
                "Fair and a good test of understanding",
                "Fair but stressful",
                "Unclear or unexpected",
                "I didn't reach this part",
              ]}
              value={a.verbalFeel}
              onChange={(v) => set("verbalFeel", v)}
            />
            <TextArea placeholder="Comments (optional)" value={a.verbalComments} onChange={(v) => set("verbalComments", v)} />
          </Q>

          <Q n={10} label="Did the assessment give you a fair chance to show your real engineering ability?" required>
            <Choice options={["Definitely yes", "Mostly", "Somewhat", "Not really"]} value={a.fairChance} onChange={(v) => set("fairChance", v)} />
          </Q>

          {/* Section D */}
          <SectionLabel>Platform &amp; technical</SectionLabel>

          <Q n={11} label="Did you hit any technical issues during the assessment? (select all that apply)" required>
            <Multi
              options={[
                "No issues",
                "Trouble cloning / setting up the repo",
                "Problems creating or submitting the PR",
                "The review/questions didn't load or errored",
                "Got disqualified/warned unexpectedly",
                "Lost work or got disconnected",
              ]}
              selected={a.technicalIssues}
              onToggle={toggleIssue}
            />
          </Q>

          <Q n={12} label="If you hit an issue, how well was it resolved?" required>
            <Choice options={["Resolved quickly", "Resolved eventually", "Not resolved", "N/A"]} value={a.issueResolution} onChange={(v) => set("issueResolution", v)} />
          </Q>

          {/* Section E */}
          <SectionLabel>Open feedback</SectionLabel>

          <Q n={13} label="What was the best part of the DevFest assessment?" required>
            <TextArea placeholder="Your answer" value={a.bestPart} onChange={(v) => set("bestPart", v)} rows={3} />
          </Q>

          <Q n={14} label="What's the one thing you'd most want us to improve?" required>
            <TextArea placeholder="Your answer" value={a.improve} onChange={(v) => set("improve", v)} rows={3} />
          </Q>

          <Q n={15} label="Name / email — only if you'd like us to follow up or share results (optional)">
            <input
              value={a.contact ?? ""}
              onChange={(e) => set("contact", e.target.value)}
              placeholder="Optional"
              style={inputStyle}
            />
          </Q>

          <button onClick={submit} disabled={submitting} style={{ ...submitBtn, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Submitting…" : "Submit feedback"}
          </button>
          <p style={{ textAlign: "center", color: MUTED, fontSize: 12, margin: "14px 0 24px" }}>
            Anonymous unless you share your name · Powered by DevSimulate
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- building blocks ---------------- */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: INDIGO, margin: "26px 0 4px" }}>
      {children}
    </div>
  );
}

function Q({ n, label, required, children }: { n: number; label: string; required?: boolean; children: ReactNode }) {
  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, marginBottom: 12, lineHeight: 1.5 }}>
        <span style={{ color: INDIGO, fontWeight: 700 }}>{n}.</span> {label}
        {required && <span style={{ color: "#DC2626", marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function Choice({ options, value, onChange }: { options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt) => {
        const on = value === opt;
        return (
          <button key={opt} onClick={() => onChange(opt)} style={optRow(on)}>
            <span style={radio(on)} />
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function Multi({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button key={opt} onClick={() => onToggle(opt)} style={optRow(on)}>
            <span style={checkbox(on)}>{on ? "✓" : ""}</span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function Stars({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-label={`${s} star`}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 30, lineHeight: 1, color: (value ?? 0) >= s ? "#F59E0B" : "#D1D5DB", padding: 0 }}
        >
          ★
        </button>
      ))}
      <span style={{ alignSelf: "center", marginLeft: 8, color: MUTED, fontSize: 12 }}>
        {value ? `${value}/5` : "1 = Poor · 5 = Excellent"}
      </span>
    </div>
  );
}

function Nps({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              style={{
                width: 38, height: 38, borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 700,
                border: `1.5px solid ${on ? INDIGO : LINE}`,
                background: on ? INDIGO : "#fff",
                color: on ? "#fff" : INK,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, fontSize: 11.5, marginTop: 7 }}>
        <span>0 — Not at all likely</span>
        <span>10 — Extremely likely</span>
      </div>
    </div>
  );
}

function Likert({
  rows,
  values,
  onChange,
}: {
  rows: { key: string; text: string }[];
  values: Record<string, unknown>;
  onChange: (k: string, v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((row) => (
        <div key={row.key}>
          <div style={{ fontSize: 13.5, color: INK, marginBottom: 7 }}>{row.text}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((v) => {
              const on = values[row.key] === v;
              return (
                <button
                  key={v}
                  onClick={() => onChange(row.key, v)}
                  style={{
                    width: 40, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
                    border: `1.5px solid ${on ? INDIGO : LINE}`,
                    background: on ? INDIGO_SOFT : "#fff",
                    color: on ? INDIGO : MUTED,
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ color: MUTED, fontSize: 11.5 }}>1 = Strongly disagree · 5 = Strongly agree</div>
    </div>
  );
}

function TextArea({ placeholder, value, onChange, rows = 2 }: { placeholder: string; value?: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{ ...inputStyle, marginTop: 10, resize: "vertical", fontFamily: "inherit" }}
    />
  );
}

/* ---------------- styles ---------------- */

const pageBg: CSSProperties = {
  minHeight: "100vh",
  background: "#EEF0F5",
  padding: "28px 14px",
  fontFamily: "'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif",
  display: "flex",
  justifyContent: "center",
  color: INK,
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 620,
  background: "#fff",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 10px 40px rgba(30,30,60,0.12)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: `1.5px solid ${LINE}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  color: INK,
  outline: "none",
};

const submitBtn: CSSProperties = {
  width: "100%",
  marginTop: 24,
  padding: "14px",
  background: INDIGO,
  color: "#fff",
  border: "none",
  borderRadius: 12,
  fontSize: 15.5,
  fontWeight: 700,
  cursor: "pointer",
};

function optRow(on: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 11,
    textAlign: "left",
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1.5px solid ${on ? INDIGO : LINE}`,
    background: on ? INDIGO_SOFT : "#fff",
    color: INK,
    fontSize: 14,
    cursor: "pointer",
    lineHeight: 1.4,
  };
}

function radio(on: boolean): CSSProperties {
  return {
    flexShrink: 0,
    width: 17,
    height: 17,
    borderRadius: "50%",
    border: `2px solid ${on ? INDIGO : "#C4C7D0"}`,
    background: on ? `radial-gradient(circle, ${INDIGO} 0 5px, #fff 6px)` : "#fff",
    boxSizing: "border-box",
  };
}

function checkbox(on: boolean): CSSProperties {
  return {
    flexShrink: 0,
    width: 18,
    height: 18,
    borderRadius: 5,
    border: `2px solid ${on ? INDIGO : "#C4C7D0"}`,
    background: on ? INDIGO : "#fff",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  };
}
