"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Plus, Users, Calendar, ChevronRight, Megaphone, Copy, Check, Pause, Play, Trash2, Trophy, Tag } from "lucide-react";

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
  shareableSlug: string;
  devFestTag: string | null;
  codebase: { name: string; stack: string };
  _count: { candidates: number };
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  ACTIVE: { bg: "#ecfdf3", color: "#067647", border: "#a7d8bd" },
  CLOSED: { bg: "#eef1f5", color: "#5a6472", border: "#d5d9e0" },
  DRAFT:  { bg: "#eef0fd", color: "#4338ca", border: "#c7c9f7" },
};

export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBoard, setCopiedBoard] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tagPanel, setTagPanel]   = useState<string | null>(null);
  const [tagInput, setTagInput]   = useState("");
  const [certMsg, setCertMsg]     = useState<string | null>(null);

  function load() {
    const token = getToken();
    fetch(`${API}/employer/campaigns`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setCampaigns(j.data ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function copyLink(slug: string, id: string) {
    navigator.clipboard.writeText(`${APP_URL}/apply/${slug}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function copyBoardLink(slug: string, id: string) {
    navigator.clipboard.writeText(`${APP_URL}/leaderboard/${slug}`).then(() => {
      setCopiedBoard(id);
      setTimeout(() => setCopiedBoard(null), 2000);
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
    <div className="flex flex-col min-h-screen" style={{ color: "#131722" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
        style={{ background: "#f5f6f8", borderBottom: "1px solid #eef1f5" }}>
        <div>
          <h1 className="text-lg font-black text-[#131722]">Campaigns</h1>
          <p className="text-xs" style={{ color: "#8a93a3" }}>Hiring assessment campaigns</p>
        </div>
        <Link href="/employer/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#131722]"
          style={{ background: "linear-gradient(135deg, #4f46e5, #4338ca)" }}>
          <Plus size={15} /> New Campaign
        </Link>
      </header>

      <main className="flex-1 px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl p-5 animate-pulse h-48"
                style={{ background: "#ffffff", border: "1px solid #e4e7ec" }} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl p-16 text-center" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
            <Megaphone size={40} style={{ color: "#d5d9e0" }} className="mx-auto mb-4" />
            <div className="text-lg font-bold text-[#131722] mb-1">No campaigns yet</div>
            <div className="text-sm mb-6" style={{ color: "#5a6472" }}>
              Create your first hiring campaign to start assessing candidates.
            </div>
            <Link href="/employer/campaigns/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#131722]"
              style={{ background: "#4338ca" }}>
              <Plus size={15} /> Create Campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {campaigns.map((c) => {
              const st = STATUS_STYLE[c.status];
              return (
                <div key={c.id} className="rounded-xl p-5 flex flex-col"
                  style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <div className="text-base font-black text-[#131722] truncate">{c.roleName}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#8a93a3" }}>{c.companyName}</div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {c.status[0] + c.status.slice(1).toLowerCase()}
                    </span>
                  </div>

                  <div className="text-xs font-semibold mb-3 px-2.5 py-1 rounded-md inline-block w-fit"
                    style={{ background: "#eef1f5", color: "#4338ca" }}>
                    {c.codebase.name}
                  </div>

                  <div className="space-y-2 mb-4 text-xs" style={{ color: "#5a6472" }}>
                    <div className="flex items-center gap-2">
                      <Users size={13} />
                      <span>{c._count.candidates} / {c.candidateLimit} candidates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={13} />
                      <span>{c.deadline ? new Date(c.deadline).toLocaleDateString() : "No deadline"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <Link href={`/employer/campaigns/${c.id}/results`}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold text-[#131722] transition-colors"
                      style={{ background: "#4338ca" }}>
                      View Results <ChevronRight size={13} />
                    </Link>
                    <button onClick={() => copyLink(c.shareableSlug, c.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "#eef1f5", border: "1px solid #d5d9e0" }}
                      title="Copy application (join) link">
                      {copiedId === c.id
                        ? <Check size={14} style={{ color: "#067647" }} />
                        : <Copy size={14} style={{ color: "#5a6472" }} />}
                    </button>
                    {/* Copy public leaderboard link */}
                    <button onClick={() => copyBoardLink(c.shareableSlug, c.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "#eef1f5", border: "1px solid #d5d9e0" }}
                      title="Copy live leaderboard link (shareable, no login)">
                      {copiedBoard === c.id
                        ? <Check size={14} style={{ color: "#067647" }} />
                        : <Trophy size={14} style={{ color: "#b54708" }} />}
                    </button>
                    {/* Pause / Resume */}
                    <button onClick={() => toggleStatus(c)} disabled={busyId === c.id}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-50"
                      style={{ background: "#eef1f5", border: "1px solid #d5d9e0" }}
                      title={c.status === "ACTIVE" ? "Pause campaign" : "Resume campaign"}>
                      {c.status === "ACTIVE"
                        ? <Pause size={14} style={{ color: "#b54708" }} />
                        : <Play size={14} style={{ color: "#067647" }} />}
                    </button>
                    {/* DevFest tag */}
                    <button
                      onClick={() => { setTagPanel(tagPanel === c.id ? null : c.id); setTagInput(c.devFestTag ?? ""); }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: c.devFestTag ? "#0c1a0c" : "#eef1f5",
                        border: c.devFestTag ? "1px solid #2d5a2d" : "1px solid #d5d9e0",
                      }}
                      title={c.devFestTag ? `DevFest: ${c.devFestTag}` : "Tag for DevFest leaderboard"}>
                      <Tag size={14} style={{ color: c.devFestTag ? "#067647" : "#5a6472" }} />
                    </button>
                    {/* Delete */}
                    <button onClick={() => setConfirmDelete(c.id)} disabled={busyId === c.id}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-50"
                      style={{ background: "#fef3f2", border: "1px solid #3f1010" }}
                      title="Delete campaign">
                      <Trash2 size={14} style={{ color: "#b42318" }} />
                    </button>
                  </div>

                  {/* DevFest tag panel */}
                  {tagPanel === c.id && (
                    <div className="mt-3 rounded-lg p-3" style={{ background: "#0c1a0c", border: "1px solid #2d5a2d" }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#067647" }}>
                        DevFest tag
                      </p>
                      <p className="text-[10px] mb-2" style={{ color: "#8a93a3" }}>
                        Use the same tag on all campaigns in a DevFest. The public leaderboard is at{" "}
                        <span style={{ color: "#5a6472" }}>/devfest/[tag]</span>.
                      </p>
                      <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="e.g. lmkr-devfest-2025"
                        className="w-full px-3 py-1.5 rounded-lg text-xs mb-2"
                        style={{ background: "#0a140a", border: "1px solid #2d5a2d", color: "#131722", outline: "none" }}
                        onKeyDown={(e) => e.key === "Enter" && saveDevFestTag(c.id)}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveDevFestTag(c.id)} disabled={busyId === c.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold text-[#131722] disabled:opacity-50"
                          style={{ background: "#a7d8bd" }}>
                          {busyId === c.id ? "Saving…" : "Save"}
                        </button>
                        {c.devFestTag && (
                          <button onClick={() => { setTagInput(""); saveDevFestTag(c.id); }} disabled={busyId === c.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                            style={{ background: "#eef1f5", border: "1px solid #d5d9e0", color: "#b42318" }}>
                            Remove
                          </button>
                        )}
                        <button onClick={() => setTagPanel(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: "#eef1f5", border: "1px solid #d5d9e0", color: "#5a6472" }}>
                          Cancel
                        </button>
                      </div>

                      {c.devFestTag && (
                        <div className="mt-3 pt-3" style={{ borderTop: "1px solid #1e3a1e" }}>
                          <p className="text-[10px] mb-2" style={{ color: "#8a93a3" }}>
                            Issue e-certificates ranked by leaderboard category (Frontend / Backend / DevOps · Infra / System Design) across the whole DevFest.
                          </p>
                          <button onClick={() => issueDevFestCerts(c.devFestTag!, c.id)} disabled={busyId === c.id}
                            className="w-full py-1.5 rounded-lg text-xs font-bold text-[#131722] disabled:opacity-50"
                            style={{ background: "#7c3aed" }}>
                            {busyId === c.id ? "Issuing…" : "🏅 Issue DevFest Certificates (by category)"}
                          </button>
                          {certMsg && (
                            <p className="text-[10px] mt-2" style={{ color: "#a5b4fc" }}>{certMsg}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {confirmDelete === c.id && (
                    <div className="mt-3 rounded-lg p-3" style={{ background: "#fef3f2", border: "1px solid #3f1010" }}>
                      <div className="text-xs mb-2" style={{ color: "#b42318" }}>
                        Delete &ldquo;{c.roleName}&rdquo; and all its candidate data? This can&apos;t be undone.
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => deleteCampaign(c.id)} disabled={busyId === c.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold text-[#131722] disabled:opacity-50"
                          style={{ background: "#dc2626" }}>
                          {busyId === c.id ? "Deleting…" : "Delete"}
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: "#eef1f5", border: "1px solid #d5d9e0", color: "#5a6472" }}>
                          Cancel
                        </button>
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
