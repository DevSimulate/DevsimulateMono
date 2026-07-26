"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Plus, Users, Calendar, ChevronRight, Copy, Trophy, Pause, Play, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Menu } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface Campaign {
  id: string;
  roleName: string;
  companyName: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  candidateLimit: number;
  deadline: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  type: "HIRING" | "CONTEST";
  blockPaste: boolean;
  requireFullscreen: boolean;
  shareableSlug: string;
  devFestTag: string | null;
  codebase: { name: string; stack: string };
  _count: { candidates: number };
}

const STATUS_TONE: Record<Campaign["status"], BadgeTone> = {
  ACTIVE: "neutral",
  CLOSED: "neutral",
  DRAFT: "warn",
};
// Lifecycle labels — CLOSED means "paused" in this UI (the toggle action
// resumes it back to ACTIVE), so it reads that way rather than as a
// permanent end state.
const STATUS_LABEL: Record<Campaign["status"], string> = {
  ACTIVE: "Active",
  CLOSED: "Paused",
  DRAFT: "Draft",
};

export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tagPanel, setTagPanel]   = useState<string | null>(null);
  const [tagInput, setTagInput]   = useState("");
  const [certMsg, setCertMsg]     = useState<string | null>(null);
  const toast = useToast();

  function load() {
    const token = getToken();
    fetch(`${API}/employer/campaigns`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setCampaigns(j.data ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${APP_URL}/apply/${slug}`).then(() => {
      toast.show("Application link copied", "good");
    });
  }

  function copyBoardLink(slug: string) {
    navigator.clipboard.writeText(`${APP_URL}/leaderboard/${slug}`).then(() => {
      toast.show("Leaderboard link copied", "good");
    });
  }

  // Pause = set CLOSED · Resume = set ACTIVE
  async function toggleStatus(c: Campaign) {
    setBusyId(c.id);
    const token = getToken();
    const next = c.status === "ACTIVE" ? "CLOSED" : "ACTIVE";
    await fetch(`${API}/employer/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusyId(null);
    load();
  }

  async function saveDevFestTag(id: string) {
    setBusyId(id);
    const token = getToken();
    await fetch(`${API}/employer/campaigns/${id}/devfest-tag`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ devFestTag: tagInput.trim() || null }),
    });
    setBusyId(null);
    setTagPanel(null);
    load();
  }

  async function issueDevFestCerts(tag: string, campaignId: string) {
    setBusyId(campaignId);
    setCertMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API}/certificates/devfest/${encodeURIComponent(tag)}/certificates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ minScore: 0 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to issue certificates");
      const parts = Object.entries(j.data?.byCategory ?? {}).map(([cat, n]) => `${cat}: ${n}`);
      setCertMsg(`Issued ${j.data?.issued ?? 0} certificate(s) by category${parts.length ? ` — ${parts.join(", ")}` : ""}.`);
    } catch (e) {
      setCertMsg(e instanceof Error ? e.message : "Failed to issue certificates");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCampaign(id: string) {
    setBusyId(id);
    const token = getToken();
    await fetch(`${API}/employer/campaigns/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setConfirmDelete(null);
    setBusyId(null);
    load();
  }

  return (
    <div className="flex flex-col min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-surface border-b border-hairline">
        <div>
          <h1 className="font-display text-lg font-bold">Campaigns</h1>
          <p className="text-xs text-muted">Hiring assessment campaigns</p>
        </div>
        <Link href="/employer/campaigns/new">
          <Button variant="primary"><Plus size={15} /> New campaign</Button>
        </Link>
      </header>

      <main className="flex-1 px-8 py-6 min-w-0">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Create your first hiring campaign to start assessing candidates."
            actionLabel="Create campaign"
            onAction={() => { window.location.href = "/employer/campaigns/new"; }}
          />
        ) : (
          <div className="rounded border border-hairline bg-surface divide-y divide-hairline overflow-x-auto">
            {campaigns.map((c) => {
              const proctored = c.requireFullscreen || c.blockPaste;
              const proctoringDetail = [
                c.requireFullscreen && "fullscreen required",
                c.blockPaste && "paste disabled",
              ].filter(Boolean).join(" · ");

              return (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    {/* Identity */}
                    <div className="min-w-0 flex-[2]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{c.roleName}</span>
                        <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        <Badge tone="neutral">{c.type === "CONTEST" ? "Contest" : "Hiring"}</Badge>
                      </div>
                      <div className="text-xs text-muted mt-0.5">{c.companyName} · {c.codebase.name}</div>
                    </div>

                    {/* Pipeline count */}
                    <div className="flex items-center gap-1.5 text-xs text-muted w-28 shrink-0">
                      <Users size={13} />
                      <span className="font-mono">{c._count.candidates} / {c.candidateLimit}</span>
                    </div>

                    {/* Deadline */}
                    <div className="flex items-center gap-1.5 text-xs text-muted w-28 shrink-0">
                      <Calendar size={13} />
                      <span>{c.deadline ? new Date(c.deadline).toLocaleDateString() : "No deadline"}</span>
                    </div>

                    {/* Proctoring state — one plain mono label, not glyphs */}
                    <div className="w-24 shrink-0" title={proctoringDetail || undefined}>
                      <span className="text-xs font-mono text-muted">{proctored ? "Proctored" : "Unproctored"}</span>
                    </div>

                    {/* Actions — exactly two: primary + overflow menu */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link href={`/employer/campaigns/${c.id}/results`}>
                        <Button variant="primary" size="sm">Results <ChevronRight size={13} /></Button>
                      </Link>
                      <Menu
                        items={[
                          { label: "Copy application link", icon: <Copy size={14} />, onClick: () => copyLink(c.shareableSlug) },
                          { label: "Copy leaderboard link", icon: <Trophy size={14} />, onClick: () => copyBoardLink(c.shareableSlug) },
                          {
                            label: c.status === "ACTIVE" ? "Pause campaign" : "Resume campaign",
                            icon: c.status === "ACTIVE" ? <Pause size={14} /> : <Play size={14} />,
                            onClick: () => toggleStatus(c),
                            disabled: busyId === c.id,
                          },
                          // DevFest tagging (and the certificate issuance it unlocks) is a
                          // DevFest-only concept — a Hiring campaign has no leaderboard.
                          ...(c.type === "CONTEST" ? [{
                            label: c.devFestTag ? `DevFest tag: ${c.devFestTag}` : "Tag for DevFest leaderboard",
                            icon: <Tag size={14} />,
                            onClick: () => { setTagPanel(tagPanel === c.id ? null : c.id); setTagInput(c.devFestTag ?? ""); },
                          }] : []),
                        ]}
                        destructiveItem={{
                          label: "Delete campaign",
                          icon: <Trash2 size={14} />,
                          onClick: () => setConfirmDelete(c.id),
                          disabled: busyId === c.id,
                        }}
                      />
                    </div>
                  </div>

                  {/* DevFest tag panel */}
                  {tagPanel === c.id && (
                    <div className="mt-3 rounded border border-hairline bg-paper p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">DevFest tag</p>
                      <p className="text-xs text-muted mb-2">
                        Use the same tag on all campaigns in a DevFest. The public leaderboard is at{" "}
                        <span className="font-mono">/devfest/[tag]</span>.
                      </p>
                      <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="e.g. lmkr-devfest-2025"
                        className="w-full px-3 py-1.5 rounded border border-hairline bg-surface text-xs mb-2 outline-none focus:border-brand"
                        onKeyDown={(e) => e.key === "Enter" && saveDevFestTag(c.id)}
                      />
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={() => saveDevFestTag(c.id)} disabled={busyId === c.id} className="flex-1">
                          {busyId === c.id ? "Saving…" : "Save"}
                        </Button>
                        {c.devFestTag && (
                          <Button variant="destructive" size="sm" onClick={() => { setTagInput(""); saveDevFestTag(c.id); }} disabled={busyId === c.id}>
                            Remove
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setTagPanel(null)}>Cancel</Button>
                      </div>

                      {c.devFestTag && (
                        <div className="mt-3 pt-3 border-t border-hairline">
                          <p className="text-xs text-muted mb-2">
                            Issue e-certificates ranked by leaderboard category (Frontend / Backend / DevOps · Infra / System Design) across the whole DevFest.
                          </p>
                          <Button variant="primary" size="sm" onClick={() => issueDevFestCerts(c.devFestTag!, c.id)} disabled={busyId === c.id} className="w-full">
                            {busyId === c.id ? "Issuing…" : "Issue DevFest certificates (by category)"}
                          </Button>
                          {certMsg && <p className="text-xs mt-2 text-muted">{certMsg}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {confirmDelete === c.id && (
                    <div className="mt-3 rounded border px-3 py-3" style={{ background: "rgba(179,55,47,0.05)", borderColor: "rgba(179,55,47,0.25)" }}>
                      <div className="text-xs text-red mb-2">
                        Delete &ldquo;{c.roleName}&rdquo; and all its candidate data? This can&apos;t be undone.
                      </div>
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={() => deleteCampaign(c.id)} disabled={busyId === c.id} className="flex-1">
                          {busyId === c.id ? "Deleting…" : "Delete"}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)} className="flex-1">Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
