"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Plus, Users, Calendar, ChevronRight, Megaphone, Copy, Check, Pause, Play, Trash2, Trophy } from "lucide-react";

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
  codebase: { name: string; stack: string };
  _count: { candidates: number };
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  ACTIVE: { bg: "#052e16", color: "#4ade80", border: "#166534" },
  CLOSED: { bg: "#1a1a1a", color: "#888888", border: "#333333" },
  DRAFT:  { bg: "#1e1b4b", color: "#818cf8", border: "#312e81" },
};

export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBoard, setCopiedBoard] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
        style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div>
          <h1 className="text-lg font-black text-white">Campaigns</h1>
          <p className="text-xs" style={{ color: "#555555" }}>Hiring assessment campaigns</p>
        </div>
        <Link href="/employer/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
          <Plus size={15} /> New Campaign
        </Link>
      </header>

      <main className="flex-1 px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl p-5 animate-pulse h-48"
                style={{ background: "#111111", border: "1px solid #222222" }} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl p-16 text-center" style={{ background: "#111111", border: "1px solid #222222" }}>
            <Megaphone size={40} style={{ color: "#333333" }} className="mx-auto mb-4" />
            <div className="text-lg font-bold text-white mb-1">No campaigns yet</div>
            <div className="text-sm mb-6" style={{ color: "#888888" }}>
              Create your first hiring campaign to start assessing candidates.
            </div>
            <Link href="/employer/campaigns/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#6366f1" }}>
              <Plus size={15} /> Create Campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {campaigns.map((c) => {
              const st = STATUS_STYLE[c.status];
              return (
                <div key={c.id} className="rounded-xl p-5 flex flex-col"
                  style={{ background: "#111111", border: "1px solid #222222" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <div className="text-base font-black text-white truncate">{c.roleName}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#666666" }}>{c.companyName}</div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {c.status[0] + c.status.slice(1).toLowerCase()}
                    </span>
                  </div>

                  <div className="text-xs font-semibold mb-3 px-2.5 py-1 rounded-md inline-block w-fit"
                    style={{ background: "#1a1a1a", color: "#818cf8" }}>
                    {c.codebase.name}
                  </div>

                  <div className="space-y-2 mb-4 text-xs" style={{ color: "#888888" }}>
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
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                      style={{ background: "#6366f1" }}>
                      View Results <ChevronRight size={13} />
                    </Link>
                    <button onClick={() => copyLink(c.shareableSlug, c.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
                      title="Copy application (join) link">
                      {copiedId === c.id
                        ? <Check size={14} style={{ color: "#4ade80" }} />
                        : <Copy size={14} style={{ color: "#888888" }} />}
                    </button>
                    {/* Copy public leaderboard link */}
                    <button onClick={() => copyBoardLink(c.shareableSlug, c.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
                      title="Copy live leaderboard link (shareable, no login)">
                      {copiedBoard === c.id
                        ? <Check size={14} style={{ color: "#4ade80" }} />
                        : <Trophy size={14} style={{ color: "#fbbf24" }} />}
                    </button>
                    {/* Pause / Resume */}
                    <button onClick={() => toggleStatus(c)} disabled={busyId === c.id}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-50"
                      style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
                      title={c.status === "ACTIVE" ? "Pause campaign" : "Resume campaign"}>
                      {c.status === "ACTIVE"
                        ? <Pause size={14} style={{ color: "#fbbf24" }} />
                        : <Play size={14} style={{ color: "#4ade80" }} />}
                    </button>
                    {/* Delete */}
                    <button onClick={() => setConfirmDelete(c.id)} disabled={busyId === c.id}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-50"
                      style={{ background: "#1a0a0a", border: "1px solid #3f1010" }}
                      title="Delete campaign">
                      <Trash2 size={14} style={{ color: "#f87171" }} />
                    </button>
                  </div>

                  {/* Delete confirmation */}
                  {confirmDelete === c.id && (
                    <div className="mt-3 rounded-lg p-3" style={{ background: "#1a0a0a", border: "1px solid #3f1010" }}>
                      <div className="text-xs mb-2" style={{ color: "#f87171" }}>
                        Delete &ldquo;{c.roleName}&rdquo; and all its candidate data? This can&apos;t be undone.
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => deleteCampaign(c.id)} disabled={busyId === c.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                          style={{ background: "#dc2626" }}>
                          {busyId === c.id ? "Deleting…" : "Delete"}
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#aaa" }}>
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
