"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { ArrowLeft, Github, Mail, ExternalLink, Check } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type AIDeclaration = "NO_AI_USED" | "AI_USED_FOR_PHRASING" | "AI_USED_FOR_UNDERSTANDING" | "AI_USED_FOR_ANSWER";

const AI_BADGE: Record<AIDeclaration, { label: string; bg: string; color: string }> = {
  NO_AI_USED:                { label: "No AI Used",       bg: "#052e16", color: "#4ade80" },
  AI_USED_FOR_PHRASING:      { label: "AI for Phrasing",  bg: "#422006", color: "#fbbf24" },
  AI_USED_FOR_UNDERSTANDING: { label: "AI for Learning",  bg: "#431407", color: "#fb923c" },
  AI_USED_FOR_ANSWER:        { label: "AI Wrote Answers", bg: "#450a0a", color: "#f87171" },
};

interface ClaudeReview {
  summary?: string;
  diagnosis?: string;
  design?: string;
  communication?: string;
  execution?: string;
  topStrength?: string;
  topImprovement?: string;
}

interface CandidateDetail {
  candidate: {
    id: string;
    status: string;
    user: { githubUsername: string; email: string | null; skillScore: number };
    submission: {
      prUrl: string | null;
      prDescription: string | null;
      scoreTotal: number | null;
      scoreDiagnosis: number | null;
      scoreDesign: number | null;
      scoreCommunication: number | null;
      scoreExecution: number | null;
      claudeReview: ClaudeReview | null;
      graderResult: { result?: string } | null;
      pasteAttempts: number | null;
      submittedAt: string;
      ticket: { title: string; difficulty: string };
      followUp: {
        question1: string; question2: string | null;
        answer1: string | null; answer2: string | null;
        aiDeclaration: AIDeclaration | null;
        claudeFeedback: string | null;
        scoreBonus: number | null;
        verbalTranscript: string | null;
        verbalScore: number | null;
        verbalNote: string | null;
        employerSummary: string | null;
        declarationMismatch: boolean | null;
      } | null;
    } | null;
  };
  campaign: { id: string; roleName: string; companyName: string; bookingLink: string | null };
  timing: { minutesTaken: number; expectedMinutes: number; suspiciouslyFast: boolean } | null;
}

function ScoreBar({ label, value, max }: { label: string; value: number | null; max: number }) {
  const pct = value !== null ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs shrink-0" style={{ color: "#888888" }}>{label}</div>
      <div className="flex-1 h-2 rounded-full" style={{ background: "#1a1a1a" }}>
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#6366f1,#818cf8)" }} />
      </div>
      <div className="w-12 text-xs text-right font-bold text-white shrink-0">{value ?? "—"}/{max}</div>
    </div>
  );
}

export default function CandidateDetailPage() {
  const { campaignId, candidateId } = useParams<{ campaignId: string; candidateId: string }>();
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("NEW");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/campaigns/${campaignId}/candidates/${candidateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => { setData(j.data); setStatus(j.data?.candidate?.status ?? "NEW"); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [campaignId, candidateId]);

  async function updateStatus(newStatus: string) {
    setStatus(newStatus);
    setSaving(true);
    const token = getToken();
    await fetch(`${API}/employer/campaigns/${campaignId}/candidates/${candidateId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
  }

  async function invite() {
    const token = getToken();
    await fetch(`${API}/employer/campaigns/${campaignId}/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds: [candidateId] }),
    });
    setStatus("SHORTLISTED");
  }

  if (loading) return <div className="p-10 text-sm" style={{ color: "#555" }}>Loading…</div>;
  if (!data?.candidate?.submission) return <div className="p-10 text-sm" style={{ color: "#555" }}>No data.</div>;

  const { candidate, campaign, timing } = data;
  const s = candidate.submission!;
  const fu = s.followUp;
  const review = s.claudeReview;
  const ai = fu?.aiDeclaration;

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="sticky top-0 z-30 flex items-center gap-4 px-8 py-4"
        style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <Link href={`/employer/campaigns/${campaignId}/results`} style={{ color: "#888888" }}><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            {candidate.user.githubUsername}
            <a href={`https://github.com/${candidate.user.githubUsername}`} target="_blank" rel="noreferrer"
              style={{ color: "#888888" }}><Github size={15} /></a>
          </h1>
          <p className="text-xs" style={{ color: "#555555" }}>{campaign.roleName} · {campaign.companyName}</p>
        </div>
        <button onClick={invite}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
          <Mail size={14} /> Invite to Interview
        </button>
      </header>

      <main className="flex-1 px-8 py-6 max-w-3xl mx-auto w-full space-y-5">

        {/* Score hero */}
        <div className="rounded-xl p-6 flex items-center gap-8" style={{ background: "#111111", border: "1px solid #222222" }}>
          <div className="text-center">
            <div className="text-5xl font-black" style={{
              color: (s.scoreTotal ?? 0) >= 80 ? "#4ade80" : (s.scoreTotal ?? 0) >= 60 ? "#fbbf24" : "#f87171",
            }}>{s.scoreTotal ?? "—"}</div>
            <div className="text-xs" style={{ color: "#555" }}>/ 100</div>
          </div>
          <div className="flex-1 space-y-2.5">
            <ScoreBar label="Diagnosis" value={s.scoreDiagnosis} max={40} />
            <ScoreBar label="Design" value={s.scoreDesign} max={30} />
            <ScoreBar label="Communication" value={s.scoreCommunication} max={20} />
            <ScoreBar label="Execution" value={s.scoreExecution} max={10} />
          </div>
        </div>

        {/* Final-score reconciliation + automated test + integrity flags */}
        {(() => {
          const prBase = (s.scoreDiagnosis ?? 0) + (s.scoreDesign ?? 0) + (s.scoreCommunication ?? 0) + (s.scoreExecution ?? 0);
          const gap = prBase - (s.scoreTotal ?? 0);
          const g = s.graderResult?.result;
          const gMap: Record<string, { bg: string; color: string; text: string }> = {
            pass:         { bg: "#052e16", color: "#4ade80", text: "✓ Verified correct under load — hidden test passed" },
            fail:         { bg: "#450a0a", color: "#f87171", text: "🚩 Failed hidden correctness test — Execution capped" },
            inconclusive: { bg: "#422006", color: "#fbbf24", text: "⚠ Hidden test couldn't run — flagged for review" },
          };
          const gc = g ? gMap[g] : undefined;
          const pastes = s.pasteAttempts ?? 0;
          if (gap <= 0 && !gc && pastes === 0) return null;
          return (
            <div className="space-y-2">
              {gap > 0 && (
                <div className="rounded-lg px-4 py-2 text-xs" style={{ background: "#1a1305", color: "#fbbf24", border: "1px solid #422006" }}>
                  <span className="font-bold">PR review {prBase} → final {s.scoreTotal} (−{gap})</span> after verification deductions (verbal / hidden test).
                </div>
              )}
              {gc && (
                <div className="rounded-lg px-4 py-2 text-xs font-semibold" style={{ background: gc.bg, color: gc.color }}>{gc.text}</div>
              )}
              {pastes > 0 && (
                <div className="rounded-lg px-4 py-2 text-xs font-semibold" style={{ background: "#422006", color: "#fbbf24" }}>
                  ⚠ {pastes} paste attempt{pastes > 1 ? "s" : ""} into answer fields (advisory)
                </div>
              )}
            </div>
          );
        })()}

        {/* Time-on-task — tracked signal, not a hard gate */}
        {timing && (
          <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "#555" }}>Time on Task</div>
              <div className="text-sm">
                <span className="font-bold text-white">{timing.minutesTaken} min</span>
                <span style={{ color: "#666" }}> taken · {timing.expectedMinutes} min estimated</span>
              </div>
            </div>
            {timing.suspiciouslyFast && (
              <span className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: "#450a0a", color: "#f87171", border: "1px solid #991b1b" }}
                title="Completed in under 20% of the estimated time — verify the work is genuine">
                ⚠ Unusually fast
              </span>
            )}
          </div>
        )}

        {/* Status + AI declaration */}
        <div className="flex gap-4">
          <div className="flex-1 rounded-xl p-4" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#555" }}>Status</div>
            <select value={status} onChange={(e) => updateStatus(e.target.value)} disabled={saving}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#e5e7eb" }}>
              <option value="NEW">New</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="flex-1 rounded-xl p-4" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div className="text-xs uppercase tracking-widest mb-2" style={{ color: "#555" }}>AI Declaration</div>
            {ai ? (
              <span className="text-sm font-semibold px-3 py-1.5 rounded-lg inline-block"
                style={{ background: AI_BADGE[ai].bg, color: AI_BADGE[ai].color }}>{AI_BADGE[ai].label}</span>
            ) : <span className="text-sm" style={{ color: "#555" }}>Not declared</span>}
          </div>
        </div>

        {/* Claude feedback */}
        {review?.summary && (
          <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "#555" }}>Claude&apos;s Assessment</div>
            <p className="text-sm italic leading-relaxed mb-4" style={{ color: "#aaaaaa" }}>&ldquo;{review.summary}&rdquo;</p>
            <div className="grid grid-cols-2 gap-3">
              {review.topStrength && (
                <div className="rounded-lg p-3" style={{ background: "#052e16", border: "1px solid #166534" }}>
                  <div className="text-xs font-bold mb-1" style={{ color: "#4ade80" }}>Top Strength</div>
                  <div className="text-xs" style={{ color: "#dddddd" }}>{review.topStrength}</div>
                </div>
              )}
              {review.topImprovement && (
                <div className="rounded-lg p-3" style={{ background: "#422006", border: "1px solid #92400e" }}>
                  <div className="text-xs font-bold mb-1" style={{ color: "#fbbf24" }}>Top Improvement</div>
                  <div className="text-xs" style={{ color: "#dddddd" }}>{review.topImprovement}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PR description */}
        {s.prDescription && (
          <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-widest" style={{ color: "#555" }}>Candidate&apos;s PR Description</div>
              {s.prUrl && (
                <a href={s.prUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#6366f1" }}>
                  View PR <ExternalLink size={11} />
                </a>
              )}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#cccccc" }}>{s.prDescription}</p>
          </div>
        )}

        {/* Follow-up Q&A */}
        {fu && (
          <div className="rounded-xl p-5 space-y-4" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div className="text-xs uppercase tracking-widest" style={{ color: "#555" }}>Follow-up Questions</div>
            <div>
              <div className="text-sm font-semibold text-white mb-1.5">Q1: {fu.question1}</div>
              <div className="text-sm rounded-lg p-3" style={{ background: "#0d0d0d", color: "#bbbbbb" }}>
                {fu.answer1 ?? "No answer"}
              </div>
            </div>
            {fu.question2 && (
              <div>
                <div className="text-sm font-semibold text-white mb-1.5">Q2: {fu.question2}</div>
                <div className="text-sm rounded-lg p-3" style={{ background: "#0d0d0d", color: "#bbbbbb" }}>
                  {fu.answer2 ?? "No answer"}
                </div>
              </div>
            )}
            {fu.claudeFeedback && (
              <div className="rounded-lg p-3" style={{ background: "#0d0d1a", border: "1px solid #2d2b55" }}>
                <span className="text-xs font-bold" style={{ color: "#818cf8" }}>Assessment: </span>
                <span className="text-xs" style={{ color: "#cccccc" }}>{fu.claudeFeedback}</span>
              </div>
            )}
            {fu.employerSummary && (
              <div className="rounded-lg p-3" style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}>
                <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>Verification note: </span>
                <span className="text-xs" style={{ color: "#cccccc" }}>{fu.employerSummary}</span>
              </div>
            )}
          </div>
        )}

        {/* Spoken explanation — verbal defense (the un-fakeable signal) */}
        {(fu?.verbalNote || fu?.verbalTranscript) && (
          <div className="rounded-xl p-5 space-y-3" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest" style={{ color: "#555" }}>Spoken Explanation — Verbal Defense</div>
              {fu?.verbalScore != null && (
                <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{
                  background: fu.verbalScore >= 7 ? "#052e16" : fu.verbalScore >= 4 ? "#422006" : "#450a0a",
                  color:      fu.verbalScore >= 7 ? "#4ade80" : fu.verbalScore >= 4 ? "#fbbf24" : "#f87171",
                }}>{fu.verbalScore}/10 verbal</span>
              )}
            </div>
            {fu?.verbalNote && (
              <div className="rounded-lg p-3 text-xs" style={{ background: "#0d0d1a", border: "1px solid #2d2b55", color: "#cccccc" }}>
                <span className="font-bold" style={{ color: "#818cf8" }}>Verbal assessment: </span>{fu.verbalNote}
              </div>
            )}
            {fu?.verbalTranscript && (
              <div>
                <div className="text-xs mb-1" style={{ color: "#666" }}>What they said aloud (transcribed):</div>
                <p className="text-sm leading-relaxed rounded-lg p-3 whitespace-pre-wrap" style={{ background: "#0d0d0d", color: "#bbbbbb" }}>
                  &ldquo;{fu.verbalTranscript}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
