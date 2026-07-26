"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Input, Field, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const KEY_STORAGE = "ds_admin_key";

interface FollowUp {
  answeredAt: string | null;
  verbalScore: number | null;
  verbalTranscript: string | null;
}

interface NeedsAttentionRow {
  id: string;
  scoreTotal: number | null;
  lowConfidenceScoring: boolean;
  needsAttentionReason: string | null;
  staleNotifiedAt: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  defenceMode: "VOICE" | "TYPED" | null;
  defenceTrigger: string | null;
  user: { githubUsername: string | null; email: string | null; fullName: string | null };
  ticket: { title: string };
  followUp: FollowUp | null;
}

interface TypedRateRow {
  campaignId: string;
  roleName: string;
  companyName: string;
  typed: number;
  total: number;
  rate: number;
  flagged: boolean;
}

export default function AdminReviewQueuePage() {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  const [rows, setRows] = useState<NeedsAttentionRow[]>([]);
  const [typedRates, setTypedRates] = useState<TypedRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<NeedsAttentionRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);

  const toast = useToast();

  useEffect(() => {
    const stored = sessionStorage.getItem(KEY_STORAGE);
    if (stored) setKey(stored);
  }, []);

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/submissions/needs-attention`, {
        headers: { "x-admin-key": adminKey },
      });
      if (r.status === 401) {
        sessionStorage.removeItem(KEY_STORAGE);
        setKey(null);
        setKeyError("Invalid admin key");
        return;
      }
      const j = await r.json();
      setRows(j.data ?? []);
      // Typed-mode rate is a product signal (browser/device patterns), not a
      // per-candidate one — load it alongside the queue.
      try {
        const rr = await fetch(`${API}/admin/campaigns/typed-mode-rate`, { headers: { "x-admin-key": adminKey } });
        const rj = await rr.json();
        if (rr.ok) setTypedRates(rj.data ?? []);
      } catch { /* non-critical */ }
    } catch {
      toast.show("Failed to load the review queue", "bad");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  async function grantTyped(id: string) {
    if (!key) return;
    setGrantingId(id);
    try {
      const r = await fetch(`${API}/admin/submissions/${id}/grant-typed`, {
        method: "POST",
        headers: { "x-admin-key": key },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to grant typed defence");
      toast.show("Typed defence granted — the candidate can complete it typed", "good");
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, defenceMode: "TYPED", defenceTrigger: "admin_grant" } : row)));
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed to grant typed defence", "bad");
    } finally {
      setGrantingId(null);
    }
  }

  useEffect(() => {
    if (key) void load(key);
  }, [key, load]);

  function unlock() {
    if (!keyInput.trim()) return;
    setKeyError(null);
    sessionStorage.setItem(KEY_STORAGE, keyInput.trim());
    setKey(keyInput.trim());
  }

  async function runSweep() {
    if (!key) return;
    setSweeping(true);
    try {
      const r = await fetch(`${API}/admin/stale-sweep`, { method: "POST", headers: { "x-admin-key": key } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Sweep failed");
      toast.show(`Sweep complete — ${j.data.found} found, ${j.data.emailed} candidate(s) emailed`, "good");
      await load(key);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Sweep failed", "bad");
    } finally {
      setSweeping(false);
    }
  }

  async function confirmFinalize() {
    if (!key || !finalizeTarget) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/admin/submissions/${finalizeTarget.id}/finalize`, {
        method: "POST",
        headers: { "x-admin-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to finalize");
      toast.show("Submission finalized and published", "good");
      setRows((prev) => prev.filter((r) => r.id !== finalizeTarget.id));
      setFinalizeTarget(null);
      setReason("");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed to finalize", "bad");
    } finally {
      setBusy(false);
    }
  }

  if (!key) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-6">
        <Card className="p-6 w-full max-w-sm">
          <h1 className="font-display text-lg font-bold mb-1">Admin</h1>
          <p className="text-sm text-muted mb-4">Enter the admin key to view the review queue.</p>
          <Field label="Admin key" error={keyError ?? undefined}>
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              autoFocus
            />
          </Field>
          <Button variant="primary" onClick={unlock} className="w-full">Unlock</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="px-8 py-4 bg-surface border-b border-hairline flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-bold">Review queue</h1>
          <p className="text-xs text-muted">Submissions stalled before publication — each needs a human decision</p>
        </div>
        <Button variant="secondary" onClick={runSweep} disabled={sweeping}>
          {sweeping ? "Sweeping…" : "Run sweep now"}
        </Button>
      </header>

      <main className="flex-1 px-8 py-6 max-w-4xl mx-auto">
        {/* Typed-defence rate — a product signal. >10% (with a real sample) is a
            browser/device pattern to investigate, not a candidate pattern. */}
        {typedRates.length > 0 && (
          <div className="mb-6 rounded border border-hairline bg-surface p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Typed-defence rate by campaign</div>
            <div className="flex flex-col gap-2">
              {typedRates.map((t) => (
                <div key={t.campaignId} className="flex items-center justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate">
                    {t.roleName} <span className="text-muted">· {t.companyName}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-muted font-mono text-xs">{t.typed}/{t.total}</span>
                    <span className={t.flagged ? "font-semibold text-amber" : "text-muted"}>
                      {Math.round(t.rate * 100)}%
                    </span>
                    {t.flagged && <Badge tone="warn">investigate</Badge>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing needs attention" description="Every submission has either been finalized or is still within its normal window." />
        ) : (
          <div className="rounded border border-hairline bg-surface divide-y divide-hairline">
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              return (
                <div key={row.id}>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {row.user.fullName ?? row.user.githubUsername ?? "Unknown candidate"}
                          {row.user.githubUsername && <span className="text-muted font-normal"> · @{row.user.githubUsername}</span>}
                        </div>
                        <div className="text-xs text-muted mt-0.5">{row.ticket.title}</div>
                        <p className="text-xs text-muted mt-2 max-w-lg leading-relaxed">{row.needsAttentionReason}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {row.defenceMode === "TYPED" && <Badge tone="neutral">Typed defence</Badge>}
                        {row.lowConfidenceScoring && <Badge tone="warn">Low-confidence scoring</Badge>}
                        <span className="font-display text-xl font-bold">{row.scoreTotal ?? "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted font-mono">
                      <span>Submitted {format(new Date(row.submittedAt), "MMM d, HH:mm")}</span>
                      {row.reviewedAt && <span>Reviewed {format(new Date(row.reviewedAt), "MMM d, HH:mm")}</span>}
                      {row.staleNotifiedAt && <span>Notified {format(new Date(row.staleNotifiedAt), "MMM d, HH:mm")}</span>}
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button variant="quiet" size="sm" onClick={() => setExpanded(isOpen ? null : row.id)}>
                        {isOpen ? "Hide evidence" : "View evidence"}
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => { setFinalizeTarget(row); setReason(""); }}>
                        Finalize
                      </Button>
                      {row.defenceMode !== "TYPED" && (
                        <Button variant="secondary" size="sm" onClick={() => void grantTyped(row.id)} disabled={grantingId === row.id}>
                          {grantingId === row.id ? "Granting…" : "Grant typed defence"}
                        </Button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="mt-3 rounded border border-hairline bg-paper p-4 font-mono text-xs">
                        {row.followUp?.verbalTranscript ? (
                          <>
                            <div className="flex justify-between text-muted mb-2">
                              <span>Verbal transcript</span>
                              <span>Score: {row.followUp.verbalScore ?? "—"}/10</span>
                            </div>
                            <p className="font-sans normal-case text-ink leading-relaxed whitespace-pre-wrap">{row.followUp.verbalTranscript}</p>
                          </>
                        ) : (
                          <p className="font-sans normal-case text-muted leading-relaxed">
                            No verbal transcript on file — the candidate never completed the spoken defence. Finalizing
                            publishes the score without it, and without penalty.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Modal
        open={!!finalizeTarget}
        onClose={() => setFinalizeTarget(null)}
        title="Finalize this submission?"
        description="This publishes the score exactly as a normal completion would — to the candidate, the employer, and the leaderboard. No deduction is applied for whatever caused the delay."
        tone="destructive"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFinalizeTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={confirmFinalize} disabled={busy}>
              {busy ? "Finalizing…" : "Finalize and publish"}
            </Button>
          </>
        }
      >
        <Field label="Reason (optional, for the log)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Candidate reported a mic failure, verified over email" />
        </Field>
      </Modal>
    </div>
  );
}
