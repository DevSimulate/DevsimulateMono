"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken } from "@/lib/auth";
import Logo from "@/components/Logo";
import { OpenInVsCode } from "@/components/OpenInVsCode";
import { getMe, getSubmissions, getAssignments, getScoreHistory, ScoreHistoryPoint } from "@/lib/api";
import { User, Submission, TicketAssignment, ClaudeReview, Difficulty } from "@devsimulate/shared";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Dot,
} from "recharts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScoreReceipt, ScoreReceiptData } from "@/components/ui/ScoreReceipt";

const DIFFICULTY_TONE: Record<Difficulty, BadgeTone> = {
  JUNIOR: "good",
  MID: "warn",
  SENIOR: "neutral",
};

interface CertSummary {
  id:           string;
  campaignName: string;
  companyName:  string;
  brandName:    string;
  logoUrl:      string | null;
  primaryColor: string;
  score:        number;
  rank:         number | null;
  issuedAt:     string;
}

interface FollowUp {
  claudeFeedback: string | null;
  answeredAt: string | null;
  scoreBonus: number | null;
  verbalScore: number | null;
  verbalNote: string | null;
}

// Candidate-facing: category-level only — never the repro script, test names,
// or cap mechanics.
const GRADER_META: Record<string, { tone: BadgeTone; text: string }> = {
  pass:         { tone: "good", text: "Verified — the reported issue no longer reproduces" },
  fail:         { tone: "bad",  text: "The reported issue could still be reproduced" },
  inconclusive: { tone: "warn", text: "Automated verification couldn't run — flagged for review, no penalty" },
};

function SubmissionCard({ submission }: { submission: Submission }) {
  const review = submission.claudeReview as ClaudeReview | null;
  const isReviewed = submission.status === "REVIEWED";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = submission as any;
  const followUp = sub.followUp as FollowUp | null;
  const ticketTitle = sub.ticket?.title ?? "Unknown ticket";
  const graderResult = sub.graderResult as { result?: string } | undefined;
  const hideResults = !!sub.hideResults;
  const campaignRole = sub.campaignRole as string | null | undefined;
  const campaignCompany = sub.campaignCompany as string | null | undefined;

  const prBase = (submission.scoreDiagnosis ?? 0) + (submission.scoreDesign ?? 0) +
                 (submission.scoreCommunication ?? 0) + (submission.scoreExecution ?? 0);
  const gap = prBase - (submission.scoreTotal ?? 0);
  const gapReason = followUp?.verbalScore != null
    ? (followUp.verbalScore <= 3 ? "spoken explanation couldn't be defended aloud" : "weak spoken explanation")
    : undefined;

  const receiptData: ScoreReceiptData = {
    prBaseScore: prBase,
    finalScore: submission.scoreTotal ?? 0,
    lineItems: [
      { label: "Diagnosis", weight: 40, score: submission.scoreDiagnosis ?? 0 },
      { label: "Design", weight: 30, score: submission.scoreDesign ?? 0 },
      { label: "Communication", weight: 20, score: submission.scoreCommunication ?? 0 },
      { label: "Execution", weight: 10, score: submission.scoreExecution ?? 0 },
    ],
    deductions: gap > 0 ? [{ label: "Verbal defence", amount: gap, note: gapReason }] : [],
  };

  return (
    <Card className="p-5">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm mb-1 truncate">{ticketTitle}</div>
          <a href={submission.prUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand hover:underline">
            View PR →
          </a>
        </div>

        <div className="shrink-0">
          {!isReviewed && (
            <Badge tone="neutral">Under review</Badge>
          )}
          {isReviewed && submission.scoreTotal === null && (
            <Badge tone="warn">Pending score</Badge>
          )}
        </div>
      </div>

      {/* Reviewed content */}
      {isReviewed && hideResults && (
        <div className="rounded border border-hairline bg-paper px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-ink">Received ✓ </span>
          {campaignRole && campaignCompany
            ? `Your assessment for ${campaignRole} at ${campaignCompany} is complete and has been received. `
            : "Your assessment is complete and has been received. "}
          The hiring team is reviewing all candidates — you&apos;ll hear the outcome by email.
        </div>
      )}

      {isReviewed && !hideResults && submission.scoreTotal !== null && (
        <div className="flex flex-col gap-3">
          <ScoreReceipt variant="full" animate={false} data={receiptData} />

          {graderResult?.result && GRADER_META[graderResult.result] && (
            <Badge tone={GRADER_META[graderResult.result].tone} className="w-fit">
              {GRADER_META[graderResult.result].text}
            </Badge>
          )}

          {review && (review.summary || review.topStrength || review.topImprovement) && (
            <div className="rounded border border-hairline bg-paper p-4">
              {review.summary && <p className="text-sm italic leading-relaxed mb-3 text-muted">&ldquo;{review.summary}&rdquo;</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {review.topStrength && (
                  <div className="rounded border border-[rgba(11,122,94,0.25)] bg-emerald-weak p-3 text-xs">
                    <div className="font-semibold mb-1 text-emerald">Top strength</div>
                    <div className="text-ink">{review.topStrength}</div>
                  </div>
                )}
                {review.topImprovement && (
                  <div className="rounded border border-[rgba(183,121,31,0.25)] bg-amber-weak p-3 text-xs">
                    <div className="font-semibold mb-1 text-amber">Top improvement</div>
                    <div className="text-ink">{review.topImprovement}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {followUp?.claudeFeedback && (
            <div className="rounded border border-hairline px-4 py-3 text-xs leading-relaxed">
              <span className="font-semibold text-brand">Assessment: </span>
              <span className="text-ink">{followUp.claudeFeedback}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ScoreHistoryPoint & { label: string } }>;
}

function ScoreTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border border-hairline bg-surface p-3 text-xs shadow-overlay">
      <div className="font-semibold mb-1 text-ink">{d.ticketTitle}</div>
      <div className="mb-2 text-muted">{d.label}</div>
      <div className="flex flex-col gap-1">
        {[
          { label: "Total", val: `${d.scoreTotal}/100`, bold: true },
          { label: "Diagnosis", val: `${d.scoreDiagnosis}/40` },
          { label: "Design", val: `${d.scoreDesign}/30` },
          { label: "Comms", val: `${d.scoreCommunication}/20` },
          { label: "Execution", val: `${d.scoreExecution}/10` },
        ].map(({ label, val, bold }) => (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-muted">{label}</span>
            <span className={bold ? "font-bold font-display text-ink" : "text-ink"}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressChart({ history }: { history: ScoreHistoryPoint[] }) {
  if (history.length === 0) {
    return (
      <EmptyState title="No submissions yet" description="Complete your first ticket to see progress." />
    );
  }

  const data = history.map((h) => ({
    ...h,
    label: format(new Date(h.submittedAt), "MMM dd"),
    scoreTotal: h.scoreTotal ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D8DAD3" />
        <XAxis dataKey="label" tick={{ fill: "#5E6673", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: "#5E6673", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ScoreTooltip />} cursor={{ stroke: "#D8DAD3" }} />
        <Line
          type="monotone"
          dataKey="scoreTotal"
          stroke="#4F46E5"
          strokeWidth={2.5}
          dot={<Dot r={4} fill="#4F46E5" stroke="white" strokeWidth={2} />}
          activeDot={{ r: 6, fill: "#4F46E5", stroke: "white", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user,        setUser]        = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignments, setAssignments] = useState<TicketAssignment[]>([]);
  const [history,     setHistory]     = useState<ScoreHistoryPoint[]>([]);
  const [certs,       setCerts]       = useState<CertSummary[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [nameEdit,    setNameEdit]    = useState(false);
  const [nameInput,   setNameInput]   = useState("");
  const [nameSaving,  setNameSaving]  = useState(false);
  const [ticketsHref, setTicketsHref] = useState("/tickets");

  useEffect(() => {
    const saved = localStorage.getItem("ds_selected_stack");
    if (saved) setTicketsHref(`/tickets?stack=${saved}`);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/login"); return; }

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    const certsPromise = fetch(`${API_URL}/certificates/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => j.data ?? []).catch(() => []);

    Promise.all([getMe(token), getSubmissions(token), getAssignments(token), getScoreHistory(token), certsPromise])
      .then(([me, subs, assigns, hist, certList]) => {
        setUser(me);
        setSubmissions(subs);
        setAssignments(assigns);
        setHistory(hist);
        setCerts(certList);
      })
      .catch(() => { clearToken(); router.push("/"); })
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  async function saveName() {
    setNameSaving(true);
    const token = getToken();
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    try {
      const res = await fetch(`${API_URL}/users/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: nameInput.trim() }),
      });
      const j = await res.json();
      if (j.data && user) setUser({ ...user, fullName: j.data.fullName });
      setNameEdit(false);
    } finally {
      setNameSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (!user) return <></>;

  const reviewed = submissions.filter((s) => s.status === "REVIEWED");
  const visibleSubmissions = submissions.filter((s) => s.status === "REVIEWED" || s.status === "PENDING");
  // Hiring candidates never see their score — exclude those submissions from
  // the average too, not just the per-submission card.
  const scoredForAvg = reviewed.filter((s) => !(s as unknown as { hideResults?: boolean }).hideResults);
  const avgScore =
    scoredForAvg.length > 0
      ? Math.round(scoredForAvg.reduce((sum, s) => sum + (s.scoreTotal ?? 0), 0) / scoredForAvg.length)
      : null;

  const stats = [
    { label: "Skill score",    value: user.skillScore,                               unit: "pts" },
    { label: "Tickets solved", value: reviewed.length,                               unit: "" },
    { label: "Avg score",      value: avgScore !== null ? avgScore : "—",            unit: avgScore !== null ? "/100" : "" },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface border-b border-hairline px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={30} /></Link>
        <div className="flex items-center gap-5">
          <Link href={ticketsHref} className="text-sm font-medium text-muted hover:text-ink transition-colors duration-150">
            Browse tickets
          </Link>
          <Link href={`/profile/${user.githubUsername}`} className="text-sm font-medium text-muted hover:text-ink transition-colors duration-150">
            @{user.githubUsername}
          </Link>
          <Button variant="secondary" size="sm" onClick={handleLogout}>Logout</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* Certificate name banner */}
        {!user.fullName && !nameEdit && (
          <Card className="p-4 mb-6 flex items-center justify-between gap-4 bg-amber-weak !border-[rgba(183,121,31,0.25)]">
            <div>
              <p className="text-sm font-semibold text-amber">Set your real name for certificates</p>
              <p className="text-xs mt-0.5 text-muted">Your GitHub username appears on certificates right now. Add your real name.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => { setNameInput(""); setNameEdit(true); }}>
              Set name
            </Button>
          </Card>
        )}
        {nameEdit && (
          <Card className="p-4 mb-6">
            <p className="text-xs font-semibold mb-3 text-muted">Your name on certificates</p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Sarah Ahmed"
                autoFocus
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && saveName()}
              />
              <Button variant="primary" onClick={saveName} disabled={nameSaving || !nameInput.trim()}>
                {nameSaving ? "Saving…" : "Save"}
              </Button>
              <Button variant="secondary" onClick={() => setNameEdit(false)}>Cancel</Button>
            </div>
          </Card>
        )}
        {user.fullName && !nameEdit && (
          <Card className="p-3 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted">Certificate name</p>
              <p className="text-sm font-semibold">{user.fullName}</p>
            </div>
            <Button variant="quiet" size="sm" onClick={() => { setNameInput(user.fullName ?? ""); setNameEdit(true); }}>
              Edit
            </Button>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {stats.map(({ label, value, unit }) => (
            <Card key={label} className="p-5">
              <div className="font-display text-2xl font-bold">
                {value}
                {unit && <span className="text-sm font-normal text-muted"> {unit}</span>}
              </div>
              <div className="text-xs mt-1 text-muted">{label}</div>
            </Card>
          ))}
        </div>

        {/* Active tickets */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Active tickets
              {assignments.length > 0 && <Badge tone="neutral">{assignments.length}</Badge>}
            </div>
            <Link href={ticketsHref} className="text-xs font-semibold text-brand">Browse all →</Link>
          </div>

          {assignments.length === 0 ? (
            <EmptyState
              title="All caught up"
              description="You have no active tickets. Pick a new one to keep building."
              actionLabel="Browse tickets"
              onAction={() => { window.location.href = ticketsHref; }}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {assignments.map((a) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ticket = (a as any).ticket;
                if (!ticket) return null;
                return (
                  <Card key={a.id} className="p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <Link href={`/tickets/${ticket.id}`} className="font-semibold text-base flex-1 hover:text-brand transition-colors duration-150">
                        {ticket.title}
                      </Link>
                      <Badge tone={DIFFICULTY_TONE[ticket.difficulty as Difficulty]}>{ticket.difficulty}</Badge>
                    </div>

                    {ticket.codebase && (
                      <div className="text-xs font-semibold mb-2 text-brand">
                        {ticket.codebase.name} — <span className="text-muted font-normal">{ticket.codebase.description}</span>
                      </div>
                    )}

                    <p className="text-sm leading-relaxed mb-4 text-muted">{ticket.description}</p>

                    <div className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-muted">
                      Files to investigate
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {ticket.filesInvolved.map((f: string) => (
                        <code key={f} className="text-xs rounded px-2.5 py-1 font-mono bg-brand-weak text-brand">
                          {f}
                        </code>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-muted">
                        {ticket.stack !== "SYSTEM_DESIGN" && (
                          <>
                            <span>Branch: <code className="font-mono text-ink">{a.branchName}</code></span>
                            <span>·</span>
                          </>
                        )}
                        <span className="font-mono">Est. {ticket.expectedMinutes} min</span>
                      </div>
                      {ticket.stack === "SYSTEM_DESIGN" ? (
                        <Link href={`/submit?ticketId=${ticket.id}`}>
                          <Button variant="primary" size="sm">Write system design</Button>
                        </Link>
                      ) : (
                        <OpenInVsCode
                          assignmentId={a.id}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded px-4 py-2 text-xs font-semibold transition-colors duration-150 cursor-pointer bg-brand text-white hover:brightness-110"
                        />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Progress chart */}
        <section className="mb-10">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-4">Your progress</div>
          <Card className="p-5">
            <ProgressChart history={history} />
            {history.length === 1 && (
              <p className="text-center text-xs mt-2 text-muted">Complete more tickets to see your trend</p>
            )}
          </Card>
        </section>

        {/* Certificates */}
        {certs.length > 0 && (
          <section className="mb-10">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-4">My certificates</div>
            <div className="flex flex-col gap-3">
              {certs.map((cert) => (
                <Card key={cert.id} className="p-4 flex items-center gap-4">
                  {cert.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cert.logoUrl} alt={cert.brandName} className="h-10 w-10 rounded object-contain shrink-0 bg-paper p-1" />
                  ) : (
                    <div className="h-10 w-10 rounded flex items-center justify-center text-xs font-bold shrink-0 bg-brand-weak text-brand">
                      {cert.brandName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {cert.brandName || cert.companyName} — {cert.campaignName}
                    </div>
                    <div className="text-xs text-muted">
                      Score: <span className="font-semibold text-ink">{cert.score}</span>
                      {cert.rank ? ` · Rank #${cert.rank}` : ""}
                      {" · "}{format(new Date(cert.issuedAt), "MMM yyyy")}
                    </div>
                  </div>
                  <a href={`/certificate/${cert.id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary" size="sm">View certificate</Button>
                  </a>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Submission history */}
        <section>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-4">Submission history</div>

          {visibleSubmissions.length === 0 ? (
            <EmptyState title="No submissions yet" description="Install the VS Code extension to get started." />
          ) : (
            <div className="flex flex-col gap-4">
              {visibleSubmissions.map((sub) => (
                <SubmissionCard key={sub.id} submission={sub} />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
