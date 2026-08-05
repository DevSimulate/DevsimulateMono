"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const KEY_STORAGE = "ds_admin_key";

interface RosterRow {
  userId: string;
  email: string | null;
  githubUsername: string | null;
  fullName: string | null;
  disqualified: boolean;
  disqualifiedReason: string | null;
  campaign: { id: string; roleName: string; companyName: string };
  joinedAt: string;
  submissions: number;
  score: number | null;
  finalized: boolean;
  status: { state: string; detail: string; suggest: string | null };
}

interface Submission {
  id: string;
  ticketId: string;
  status: "PENDING" | "REVIEWED" | "VOID";
  finalized: boolean;
  scoreTotal: number | null;
  submittedAt: string;
  reviewedAt: string | null;
  prUrl: string | null;
  branchName: string | null;
  pasteAttempts: number;
  riskScore: number;
  defenceMode: string | null;
  defenceTrigger: string | null;
  needsAttention: boolean;
  needsAttentionReason: string | null;
  pendingAction: string | null;
  ticket: { title: string } | null;
  followUp: {
    question1: string | null; answer1: string | null; answer2: string | null;
    verbalQuestion: string | null; verbalTranscript: string | null;
    verbalScore: number | null; verbalNote: string | null;
  } | null;
}

interface Detail {
  user: {
    id: string; email: string | null; githubUsername: string | null; fullName: string | null;
    subscriptionTier: string; skillScore: number; createdAt: string;
    disqualifiedAt: string | null; disqualifiedReason: string | null;
  };
  campaign: {
    id: string; roleName: string; companyName: string; type: string; status: string;
    deadline: string | null; blockPaste: boolean; requireFullscreen: boolean;
  } | null;
  joinedAt: string | null;
  invite: {
    id: string; status: string; invitedAt: string; remindedAt: string | null; acceptedAt: string | null;
  } | null;
  submissions: Submission[];
  status: { state: string; detail: string; suggest: string | null };
}

const SUB_TONE: Record<Submission["status"], BadgeTone> = {
  PENDING: "warn", REVIEWED: "good", VOID: "neutral",
};

/** Which action the derived status points at, so the fix is one click away. */
const SUGGEST_LABEL: Record<string, string> = {
  requeue: "Requeue review",
  void: "Void the duplicate",
  "grant-typed": "Grant typed defence",
  resend: "Resend invite",
};

export default function AdminCandidatesPage() {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [q, setQ] = useState("");
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) setKey(saved);
  }, []);

  function unlock() {
    const k = keyInput.trim();
    if (!k) return;
    localStorage.setItem(KEY_STORAGE, k);
    setKey(k);
  }

  const loadRoster = useCallback(async (query = "") => {
    if (!key) return;
    setSearching(true);
    try {
      const r = await fetch(`${API}/admin/candidates${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
        headers: { "x-admin-key": key },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to load candidates");
      setRoster(j.data ?? []);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed to load candidates", "bad");
    } finally {
      setSearching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Everyone is listed by default — the point is to see who needs attention
  // without already knowing whose name to type.
  useEffect(() => { if (key) void loadRoster(); }, [key, loadRoster]);

  const open = useCallback(async (userId: string) => {
    if (!key) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/candidates/${userId}`, { headers: { "x-admin-key": key } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to load");
      setDetail(j.data);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed to load", "bad");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function reinstate(userId: string) {
    if (!key) return;
    setBusy("Reinstate");
    try {
      const r = await fetch(`${API}/admin/candidates/${userId}/reinstate`, {
        method: "POST",
        headers: { "x-admin-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ restoreSubmission: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Reinstate failed");
      const url = j.data?.resumeUrl as string | undefined;
      if (url) {
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.show("Reinstated — resume link copied to clipboard", "good");
      } else {
        toast.show("Reinstated (no voided submission to restore)", "good");
      }
      await loadRoster(q.trim());
      if (detail) await open(detail.user.id);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Reinstate failed", "bad");
    } finally {
      setBusy(null);
    }
  }

  async function act(path: string, label: string, body?: Record<string, unknown>) {
    if (!key || !detail) return;
    setBusy(label);
    try {
      const r = await fetch(`${API}/admin/${path}`, {
        method: "POST",
        headers: { "x-admin-key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `${label} failed`);
      toast.show(`${label} — done`, "good");
      await open(detail.user.id);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : `${label} failed`, "bad");
    } finally {
      setBusy(null);
    }
  }

  // ── Key gate ──────────────────────────────────────────────────────────────
  if (!key) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center px-5">
        <Card className="p-6 w-full max-w-sm">
          <h1 className="font-display text-lg font-bold mb-1">Admin</h1>
          <p className="text-xs text-muted mb-4">Enter the admin key to continue.</p>
          <Field label="Admin key">
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              placeholder="x-admin-key"
            />
          </Field>
          <Button variant="primary" onClick={unlock} className="w-full mt-3">Unlock</Button>
        </Card>
      </div>
    );
  }

  // Prefer a live submission; fall back to the newest voided one so the actions
  // panel still has a subject. `voided` keeps the label honest about which.
  const live = detail?.submissions.filter((s) => s.status !== "VOID") ?? [];
  const target = live[0] ?? detail?.submissions[0] ?? null;
  const voided = !!target && target.status === "VOID";

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 bg-surface border-b border-hairline px-6 py-3.5 flex items-center gap-4">
        <div>
          <h1 className="font-display text-lg font-bold">Candidates</h1>
          <p className="text-xs text-muted">Look someone up, see everything, act on it</p>
        </div>
        <Link href="/admin" className="ml-auto text-xs font-medium text-muted hover:text-ink">Review queue →</Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="flex gap-2 mb-6">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadRoster(q.trim())}
            placeholder="Filter by email, GitHub username, or name"
            className="flex-1"
          />
          <Button variant="secondary" onClick={() => loadRoster(q.trim())} disabled={searching}>
            {searching ? "Loading…" : "Filter"}
          </Button>
          {q && (
            <Button variant="quiet" onClick={() => { setQ(""); void loadRoster(); }} disabled={searching}>
              Clear
            </Button>
          )}
        </div>

        {/* Result picker — only when ambiguous */}
        {/* Roster — everyone in a hiring campaign, worst-first. Click to open. */}
        {!detail && (
          roster.length === 0 && !searching ? (
            <EmptyState title="No candidates" description={q ? "Nothing matches that filter." : "Nobody has joined a hiring campaign yet."} />
          ) : (
            <div className="rounded border border-hairline bg-surface divide-y divide-hairline mb-6">
              {roster.map((r) => (
                <div key={r.userId} className="px-4 py-3 hover:bg-paper transition-colors flex items-center gap-4">
                  <button onClick={() => open(r.userId)} className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                      {r.fullName ?? r.githubUsername ?? "—"}
                      {r.disqualified && <Badge tone="bad">Disqualified</Badge>}
                      {r.finalized && <Badge tone="good">Complete</Badge>}
                    </div>
                    <div className="text-xs text-muted font-mono truncate">
                      {r.email} · @{r.githubUsername}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {r.status.state}{r.status.detail ? " — " + r.status.detail : ""}
                    </div>
                  </button>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{r.score ?? "—"}</div>
                    <div className="text-[11px] text-muted">{r.submissions} sub{r.submissions === 1 ? "" : "s"}</div>
                  </div>
                  {/* The fix, without having to open the record first. */}
                  {r.disqualified && (
                    <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => reinstate(r.userId)}>
                      {busy === "Reinstate" ? "…" : "Reinstate"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {loading && <Skeleton className="h-64 w-full" />}

        {detail && !loading && (
          <div className="flex flex-col gap-4">

            {/* Identity */}
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{detail.user.fullName ?? "—"}</div>
                  <div className="text-xs text-muted font-mono mt-0.5">
                    {detail.user.email} · @{detail.user.githubUsername}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone="neutral">{detail.user.subscriptionTier}</Badge>
                  <Badge tone="neutral">skill {detail.user.skillScore}</Badge>
                  {detail.user.disqualifiedAt && <Badge tone="bad">Disqualified</Badge>}
                </div>
              </div>
              {detail.user.disqualifiedReason && (
                <p className="text-xs text-red mt-2">{detail.user.disqualifiedReason}</p>
              )}
            </Card>

            {/* Campaign + invite */}
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Campaign</p>
              {detail.campaign ? (
                <>
                  <div className="text-sm font-semibold">
                    {detail.campaign.roleName} <span className="text-muted font-normal">· {detail.campaign.companyName}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {detail.invite ? `invited ${format(new Date(detail.invite.invitedAt), "d MMM")}` : "no invite record"}
                    {detail.joinedAt ? ` · started ${format(new Date(detail.joinedAt), "d MMM")}` : " · not started"}
                    {detail.campaign.deadline ? ` · closes ${format(new Date(detail.campaign.deadline), "d MMM")}` : " · no deadline"}
                  </div>
                  <div className="text-xs font-mono text-muted mt-1.5">
                    {detail.campaign.requireFullscreen || detail.campaign.blockPaste
                      ? `proctored: ${[detail.campaign.requireFullscreen && "fullscreen", detail.campaign.blockPaste && "paste blocked"].filter(Boolean).join(" + ")}`
                      : "unproctored"}
                    {" · "}{detail.campaign.type} · {detail.campaign.status}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted">Not in any campaign — organic/practice user.</p>
              )}
            </Card>

            {/* Submissions */}
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">
                Submissions ({detail.submissions.length})
              </p>
              {detail.submissions.length === 0 ? (
                <p className="text-xs text-muted">None yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-hairline">
                  {detail.submissions.map((s) => (
                    <div key={s.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={SUB_TONE[s.status]}>{s.status}</Badge>
                        {s.finalized && <Badge tone="good">finalized</Badge>}
                        <span className="text-xs font-mono text-muted">
                          {format(new Date(s.submittedAt), "d MMM HH:mm")}
                        </span>
                        <span className="text-sm font-semibold">
                          {s.scoreTotal !== null ? `${s.scoreTotal}/100` : "—"}
                        </span>
                        <span className="text-xs text-muted truncate">{s.ticket?.title}</span>
                      </div>
                      <div className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap font-mono">
                        {s.prUrl && (
                          <a href={s.prUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                            {s.prUrl.replace("https://github.com/", "")}
                          </a>
                        )}
                        {s.pasteAttempts > 0 && <span>paste×{s.pasteAttempts}</span>}
                        {s.riskScore > 0 && <span>risk {s.riskScore}</span>}
                        {s.defenceMode && <span>{s.defenceMode.toLowerCase()}</span>}
                        {s.defenceTrigger && <span>({s.defenceTrigger})</span>}
                        {s.followUp?.answer1 && <span>Q1 answered</span>}
                        {s.followUp?.verbalScore !== null && s.followUp?.verbalScore !== undefined && (
                          <span>verbal {s.followUp.verbalScore}/10</span>
                        )}
                      </div>
                      {s.followUp?.verbalQuestion && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted cursor-pointer">Defence question &amp; answer</summary>
                          <p className="text-xs mt-1.5 text-ink"><span className="text-muted">Asked:</span> {s.followUp.verbalQuestion}</p>
                          {s.followUp.verbalTranscript && (
                            <p className="text-xs mt-1.5 text-ink"><span className="text-muted">Said:</span> {s.followUp.verbalTranscript}</p>
                          )}
                          {s.followUp.verbalNote && (
                            <p className="text-xs mt-1.5 text-muted">{s.followUp.verbalNote}</p>
                          )}
                        </details>
                      )}
                      {s.needsAttentionReason && (
                        <p className="text-xs text-amber mt-1">{s.needsAttentionReason}</p>
                      )}
                      <p className="text-[10px] text-muted font-mono mt-1 opacity-60">{s.id}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Derived status — the reason they're stuck, with the fix */}
            <Card className={`p-5 ${detail.status.suggest ? "!border-brand bg-brand-weak" : ""}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Status</p>
              <p className="text-sm font-semibold">{detail.status.state}</p>
              <p className="text-xs text-muted mt-1">{detail.status.detail}</p>
              {detail.status.suggest && (
                <p className="text-xs text-brand font-semibold mt-2">
                  Suggested: {SUGGEST_LABEL[detail.status.suggest] ?? detail.status.suggest}
                </p>
              )}
            </Card>

            {/* Actions */}
            <Card className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Actions</p>
              {target ? (
                <>
                  {/* A voided submission is out of play. Finalize would publish a
                      withdrawn result and Grant-typed would unlock a defence for
                      an assessment nobody is taking — so only the action that
                      deliberately brings it back stays available. */}
                  {voided && (
                    <p className="text-xs text-amber mb-3">
                      This submission is voided. The candidate resubmits from VS Code —
                      or use Requeue to bring this one back and re-review it.
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={detail.status.suggest === "requeue" ? "primary" : "secondary"}
                      size="sm"
                      disabled={!!busy}
                      onClick={() => act(`submissions/${target.id}/requeue`, "Requeue review")}
                    >
                      {busy === "Requeue review" ? "Working…" : voided ? "Restore & re-review" : "Requeue review"}
                    </Button>
                    <Button
                      variant={detail.status.suggest === "void" ? "primary" : "secondary"}
                      size="sm"
                      disabled={!!busy || voided}
                      onClick={() => act(`submissions/${target.id}/void`, "Void", { reason: "Voided from the admin console" })}
                    >
                      {busy === "Void" ? "Working…" : "Void"}
                    </Button>
                    <Button
                      variant="secondary" size="sm" disabled={!!busy || voided || target.finalized}
                      onClick={() => act(`submissions/${target.id}/finalize`, "Finalize", { reason: "Finalized from the admin console" })}
                    >
                      {busy === "Finalize" ? "Working…" : "Finalize"}
                    </Button>
                    <Button
                      variant={detail.status.suggest === "grant-typed" ? "primary" : "secondary"}
                      size="sm"
                      disabled={!!busy || voided}
                      onClick={() => act(`submissions/${target.id}/grant-typed`, "Grant typed")}
                    >
                      {busy === "Grant typed" ? "Working…" : "Grant typed defence"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted mt-3">
                    Acting on <span className="font-mono">{target.id.slice(0, 8)}</span> —{" "}
                    {voided ? "the most recent submission (voided; nothing is live)." : "the most recent live submission."}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">No submission to act on.</p>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
