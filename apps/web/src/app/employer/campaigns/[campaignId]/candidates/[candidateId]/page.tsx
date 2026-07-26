"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { ArrowLeft, Github, Mail, MailX, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, TierBadge, tierForScore } from "@/components/ui/Badge";
import { ScoreReceipt, ScoreReceiptDeduction } from "@/components/ui/ScoreReceipt";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const INK = "#10182B", MUTED = "#5E6673", HAIRLINE = "#D8DAD3", PAPER = "#FBFBF8", SURFACE = "#FFFFFF";
const BRAND = "#4F46E5";
const EMERALD = "#0B7A5E", EMERALD_WEAK = "#E6F3EF";
const AMBER = "#B7791F", AMBER_WEAK = "#FBF1E1";
const RED = "#B3372F", RED_WEAK = "#FBECEB";

type AIDeclaration = "NO_AI_USED" | "AI_USED_FOR_PHRASING" | "AI_USED_FOR_UNDERSTANDING" | "AI_USED_FOR_ANSWER";

const AI_BADGE: Record<AIDeclaration, { label: string; bg: string; color: string }> = {
  NO_AI_USED:                { label: "No AI used",       bg: EMERALD_WEAK, color: EMERALD },
  AI_USED_FOR_PHRASING:      { label: "AI for phrasing",  bg: AMBER_WEAK,   color: AMBER },
  AI_USED_FOR_UNDERSTANDING: { label: "AI for learning",  bg: AMBER_WEAK,   color: AMBER },
  AI_USED_FOR_ANSWER:        { label: "AI wrote answers", bg: RED_WEAK,     color: RED },
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
    // Proctoring flag — advisory, raised during the assessment. Never a sanction.
    flaggedForReview?: boolean;
    flaggedReason?: string | null;
    flaggedAt?: string | null;
    user: { githubUsername: string; email: string | null; skillScore: number };
    submission: {
      prUrl: string | null;
      prDescription: string | null;
      scoreTotal: number | null;
      scoreDiagnosis: number | null;
      scoreDesign: number | null;
      scoreCommunication: number | null;
      scoreExecution: number | null;
      scorePrBase: number | null;
      verbalPenalty: number | null;
      claudeReview: ClaudeReview | null;
      graderResult: {
        result?: string; // legacy pass/fail/inconclusive mirror — always present
        status?: string; // richer status when the grader sent per-test results
        counts?: { critical?: { passed?: number; failed?: number }; regression?: { passed?: number; failed?: number } };
      } | null;
      hiddenTestPenalty: number | null;
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

const GRADER_META: Record<string, { tone: "good" | "warn" | "bad"; text: string }> = {
  passed:            { tone: "good", text: "Verified correct — hidden tests passed" },
  pass:              { tone: "good", text: "Verified correct — hidden tests passed" },
  critical_failed:   { tone: "bad",  text: "Failed hidden verification" },
  fail:              { tone: "bad",  text: "Failed hidden verification" },
  regression_failed: { tone: "warn", text: "Passed core verification, but broke a related case" },
  build_failed:      { tone: "warn", text: "Candidate's code didn't build under CI" },
  timeout:           { tone: "warn", text: "Hidden test run timed out" },
  error:             { tone: "warn", text: "Hidden test couldn't run" },
  inconclusive:      { tone: "warn", text: "Hidden test couldn't run" },
};
const TONE_COLOR = { good: EMERALD, warn: AMBER, bad: RED } as const;
const TONE_WEAK = { good: EMERALD_WEAK, warn: AMBER_WEAK, bad: RED_WEAK } as const;

export default function CandidateDetailPage() {
  const { campaignId, candidateId } = useParams<{ campaignId: string; candidateId: string }>();
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("NEW");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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
    const r = await fetch(`${API}/employer/campaigns/${campaignId}/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds: [candidateId] }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.data?.emailed) toast.show("Interview invite sent", "good");
    else if (j.data?.missingEmail) toast.show("Shortlisted — candidate has no email on file, so no invite was sent", "bad");
    setStatus("SHORTLISTED");
  }

  async function reject() {
    const token = getToken();
    const r = await fetch(`${API}/employer/campaigns/${campaignId}/candidates/${candidateId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED" }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.data?.emailed) toast.show("Rejection email sent", "good");
    else toast.show("Rejected — candidate has no email on file, so no email was sent", "bad");
    setStatus("REJECTED");
  }

  if (loading) return <div className="p-10 text-sm" style={{ color: MUTED }}>Loading…</div>;
  if (!data?.candidate?.submission) return <div className="p-10 text-sm" style={{ color: MUTED }}>No data.</div>;

  const { candidate, campaign, timing } = data;
  const s = candidate.submission!;
  const fu = s.followUp;
  const review = s.claudeReview;
  const ai = fu?.aiDeclaration;

  const prBase = s.scorePrBase ?? ((s.scoreDiagnosis ?? 0) + (s.scoreDesign ?? 0) + (s.scoreCommunication ?? 0) + (s.scoreExecution ?? 0));
  const finalScore = s.scoreTotal ?? 0;
  const tier = tierForScore(finalScore);
  const graderKey = s.graderResult?.status ?? s.graderResult?.result;
  const graderMeta = graderKey ? GRADER_META[graderKey] : undefined;

  const deductions: ScoreReceiptDeduction[] = [];
  if ((s.verbalPenalty ?? 0) > 0) {
    deductions.push({ label: "Verbal defence", amount: s.verbalPenalty!, note: fu?.verbalNote ?? undefined });
  }
  if ((s.hiddenTestPenalty ?? 0) > 0) {
    deductions.push({ label: "Hidden verification", amount: s.hiddenTestPenalty!, note: graderMeta?.text });
  }

  // Every advisory signal in one place, always labelled as advisory — nothing
  // here has ever deducted a point, per the platform-wide rule.
  const flags: { text: string; tone: "good" | "warn" | "bad" }[] = [];
  if (graderMeta) flags.push({ text: graderMeta.text, tone: graderMeta.tone });
  if ((s.pasteAttempts ?? 0) > 0) flags.push({ text: `${s.pasteAttempts} paste attempt${s.pasteAttempts! > 1 ? "s" : ""} into answer fields`, tone: "warn" });
  if (candidate.flaggedForReview) flags.push({ text: `Flagged during assessment${candidate.flaggedReason ? ` — ${candidate.flaggedReason}` : ""}`, tone: "warn" });
  if (timing?.suspiciouslyFast) flags.push({ text: "Completed in under 20% of the estimated time", tone: "warn" });

  return (
    <div className="min-h-screen" style={{ color: INK, background: PAPER }}>
      <header className="sticky top-0 z-30 flex items-center gap-4 px-8 py-4" style={{ background: SURFACE, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Link href={`/employer/campaigns/${campaignId}/results`} style={{ color: MUTED }}><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold flex items-center gap-2" style={{ color: INK }}>
            {candidate.user.githubUsername}
            <a href={`https://github.com/${candidate.user.githubUsername}`} target="_blank" rel="noreferrer" style={{ color: MUTED }}><Github size={15} /></a>
          </h1>
          <p className="text-xs" style={{ color: MUTED }}>{campaign.roleName} · {campaign.companyName}</p>
        </div>
        <Button variant="destructive" onClick={reject}>
          <MailX size={14} className="mr-1.5" /> Reject
        </Button>
        <Button variant="primary" onClick={invite}>
          <Mail size={14} className="mr-1.5" /> Invite to interview
        </Button>
      </header>

      {/* Two-pane: left = evidence-linked receipt + tier + flags; right = the evidence itself */}
      <main className="max-w-5xl mx-auto w-full px-8 py-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">

        {/* ── Left pane ── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <ScoreReceipt
            variant="full"
            data={{ prBaseScore: prBase, finalScore, deductions, lineItems: [
              { label: "Diagnosis", weight: 40, score: s.scoreDiagnosis ?? 0 },
              { label: "Design", weight: 30, score: s.scoreDesign ?? 0 },
              { label: "Communication", weight: 20, score: s.scoreCommunication ?? 0 },
              { label: "Execution", weight: 10, score: s.scoreExecution ?? 0 },
            ] }}
          />

          <div className="flex items-center justify-between">
            <TierBadge tier={tier} />
            {ai && <Badge tone={ai === "NO_AI_USED" ? "good" : ai === "AI_USED_FOR_ANSWER" ? "bad" : "warn"}>{AI_BADGE[ai].label}</Badge>}
          </div>

          <p className="text-xs italic" style={{ color: MUTED }}>The final decision rests with you.</p>

          {timing && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: MUTED }}>Time on task</div>
              <div className="text-sm font-mono">
                <span className="font-bold" style={{ color: INK }}>{timing.minutesTaken} min</span>
                <span style={{ color: MUTED }}> / {timing.expectedMinutes} min estimated</span>
              </div>
            </Card>
          )}

          {flags.length > 0 && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wide font-semibold mb-2.5" style={{ color: MUTED }}>
                Advisory signals — nothing deducted
              </div>
              <div className="flex flex-col gap-2">
                {flags.map((f, i) => (
                  <div key={i} className="text-xs rounded px-2.5 py-2" style={{ background: TONE_WEAK[f.tone], color: TONE_COLOR[f.tone] }}>
                    {f.text}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: MUTED }}>Status</div>
            <select value={status} onChange={(e) => updateStatus(e.target.value)} disabled={saving}
              className="w-full rounded border px-3 py-2 text-sm outline-none" style={{ background: PAPER, borderColor: HAIRLINE, color: INK }}>
              <option value="NEW">New</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </Card>
        </div>

        {/* ── Right pane: evidence tabs ── */}
        <div>
          <Tabs
            defaultKey="writeup"
            items={[
              {
                key: "writeup",
                label: "Write-up",
                content: (
                  <div className="flex flex-col gap-4">
                    {review?.summary && (
                      <Card className="p-5">
                        <div className="text-xs uppercase tracking-wide font-semibold mb-3" style={{ color: MUTED }}>AI assessment</div>
                        <p className="text-sm italic leading-relaxed mb-4" style={{ color: MUTED }}>&ldquo;{review.summary}&rdquo;</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {review.topStrength && (
                            <div className="rounded p-3 border" style={{ background: EMERALD_WEAK, borderColor: `${EMERALD}40` }}>
                              <div className="text-xs font-bold mb-1" style={{ color: EMERALD }}>Top strength</div>
                              <div className="text-xs" style={{ color: INK }}>{review.topStrength}</div>
                            </div>
                          )}
                          {review.topImprovement && (
                            <div className="rounded p-3 border" style={{ background: AMBER_WEAK, borderColor: `${AMBER}40` }}>
                              <div className="text-xs font-bold mb-1" style={{ color: AMBER }}>Top improvement</div>
                              <div className="text-xs" style={{ color: INK }}>{review.topImprovement}</div>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}
                    {s.prDescription && (
                      <Card className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: MUTED }}>Candidate&apos;s PR description</div>
                          {s.prUrl && (
                            <a href={s.prUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold" style={{ color: BRAND }}>
                              View PR <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: INK }}>{s.prDescription}</p>
                      </Card>
                    )}
                    {!review?.summary && !s.prDescription && (
                      <p className="text-sm" style={{ color: MUTED }}>No write-up on file.</p>
                    )}
                  </div>
                ),
              },
              {
                key: "qa",
                label: "Q&A rounds",
                content: fu ? (
                  <Card className="p-5 flex flex-col gap-4">
                    <div>
                      <div className="text-sm font-semibold mb-1.5" style={{ color: INK }}>Q1: {fu.question1}</div>
                      <div className="text-sm rounded p-3" style={{ background: PAPER, color: MUTED }}>{fu.answer1 ?? "No answer"}</div>
                    </div>
                    {fu.question2 && (
                      <div>
                        <div className="text-sm font-semibold mb-1.5" style={{ color: INK }}>Q2: {fu.question2}</div>
                        <div className="text-sm rounded p-3" style={{ background: PAPER, color: MUTED }}>{fu.answer2 ?? "No answer"}</div>
                      </div>
                    )}
                    {fu.claudeFeedback && (
                      <div className="rounded p-3 border" style={{ background: SURFACE, borderColor: HAIRLINE }}>
                        <span className="text-xs font-bold" style={{ color: BRAND }}>Assessment: </span>
                        <span className="text-xs" style={{ color: MUTED }}>{fu.claudeFeedback}</span>
                      </div>
                    )}
                    {fu.employerSummary && (
                      <div className="rounded p-3 border" style={{ background: PAPER, borderColor: HAIRLINE }}>
                        <span className="text-xs font-bold" style={{ color: AMBER }}>Verification note: </span>
                        <span className="text-xs" style={{ color: MUTED }}>{fu.employerSummary}</span>
                      </div>
                    )}
                  </Card>
                ) : <p className="text-sm" style={{ color: MUTED }}>No follow-up on file.</p>,
              },
              {
                key: "verbal",
                label: "Verbal transcript",
                content: (fu?.verbalNote || fu?.verbalTranscript) ? (
                  <Card className="p-5 flex flex-col gap-3">
                    {fu?.verbalScore != null && (
                      <div className="flex justify-end">
                        <Badge tone={fu.verbalScore >= 7 ? "good" : fu.verbalScore >= 4 ? "warn" : "bad"}>{fu.verbalScore}/10 verbal</Badge>
                      </div>
                    )}
                    {fu?.verbalNote && (
                      <div className="rounded p-3 text-xs border" style={{ background: SURFACE, borderColor: HAIRLINE, color: MUTED }}>
                        <span className="font-bold" style={{ color: BRAND }}>Verbal assessment: </span>{fu.verbalNote}
                      </div>
                    )}
                    {fu?.verbalTranscript && (
                      <div>
                        <div className="text-xs mb-1" style={{ color: MUTED }}>What they said aloud (transcribed):</div>
                        <p className="text-sm leading-relaxed rounded p-3 whitespace-pre-wrap" style={{ background: PAPER, color: INK }}>
                          &ldquo;{fu.verbalTranscript}&rdquo;
                        </p>
                      </div>
                    )}
                  </Card>
                ) : <p className="text-sm" style={{ color: MUTED }}>No spoken defence on file.</p>,
              },
              {
                key: "declarations",
                label: "Declarations",
                content: (
                  <Card className="p-5 flex flex-col gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: MUTED }}>AI declaration</div>
                      {ai ? <Badge tone={ai === "NO_AI_USED" ? "good" : ai === "AI_USED_FOR_ANSWER" ? "bad" : "warn"}>{AI_BADGE[ai].label}</Badge>
                        : <span className="text-sm" style={{ color: MUTED }}>Not declared</span>}
                    </div>
                    {fu?.declarationMismatch && (
                      <div className="rounded p-3 text-xs border" style={{ background: AMBER_WEAK, borderColor: `${AMBER}40`, color: AMBER }}>
                        Advisory — answers read as uncritical relative to the declared AI use. Nothing was deducted; use judgement.
                      </div>
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
}
