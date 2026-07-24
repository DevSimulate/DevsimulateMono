"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface Campaign {
  id: string;
  roleName: string;
  companyName: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  deadline: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  type: "HIRING" | "CONTEST";
  shareableSlug: string;
  devFestTag: string | null;
  codebase: { name: string; stack: string };
  _count: { candidates: number };
}

export default function DevFestDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/employer/campaigns`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((j) => setCampaigns((j.data ?? []).filter((c: Campaign) => c.type === "CONTEST")))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  function copy(slug: string, id: string) {
    navigator.clipboard.writeText(`${APP_URL}/apply/${slug}`).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // Group events by their DevFest tag — one event usually spans several tracks.
  const tags = [...new Set(campaigns.map((c) => c.devFestTag).filter((t): t is string => !!t))];

  return (
    <div style={page}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>DevFest events</h1>
          <p style={{ fontSize: 14, color: "#6B7280", margin: "4px 0 0" }}>
            Public contests. Anyone with the share link can enter, and results appear on a live public leaderboard.
          </p>
        </div>
        <Link href="/employer/campaigns/new" style={primaryBtn}>+ New track</Link>
      </div>

      {tags.length > 0 && (
        <div style={{ ...card, marginTop: 20, background: "#F5F5FF", borderColor: "#C7D2FE" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#4338CA", marginBottom: 8 }}>
            Public leaderboards
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tags.map((t) => (
              <Link key={t} href={`/devfest/${t}`} style={ghostBtn}>🏆 {t}</Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        {loading && <p style={{ color: "#6B7280", fontSize: 14 }}>Loading…</p>}

        {!loading && campaigns.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 32, color: "#6B7280" }}>
            No DevFest tracks yet. Create one and tag it to publish a leaderboard.
          </div>
        )}

        {campaigns.map((c) => (
          <div key={c.id} style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{c.roleName}</div>
                <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 3 }}>
                  {c.codebase?.name} · {c.difficulty} · {c._count?.candidates ?? 0} participants
                  {c.devFestTag ? ` · ${c.devFestTag}` : " · no tag (won't show on a leaderboard)"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={statusPill(c.status)}>{c.status}</span>
                <button onClick={() => copy(c.shareableSlug, c.id)} style={{ ...ghostBtn, border: "1.5px solid #C7D2FE", cursor: "pointer" }}>
                  {copied === c.id ? "✓ Copied" : "Copy entry link"}
                </button>
                <Link href={`/employer/campaigns/${c.id}/results`} style={primaryBtn}>Results</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 920, margin: "0 auto", padding: "32px 20px",
  fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1A1A2E",
};
const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16,
};
const primaryBtn: React.CSSProperties = {
  background: "#4F46E5", color: "#fff", borderRadius: 9, padding: "8px 14px",
  fontSize: 13.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
};
const ghostBtn: React.CSSProperties = {
  background: "#fff", color: "#4F46E5", border: "1.5px solid #C7D2FE", borderRadius: 9,
  padding: "8px 14px", fontSize: 13.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
};
function statusPill(s: string): React.CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    ACTIVE: { bg: "#DCFCE7", fg: "#15803D" },
    CLOSED: { bg: "#F1F5F9", fg: "#475569" },
    DRAFT:  { bg: "#EEF0FF", fg: "#4338CA" },
  };
  const c = map[s] ?? map.DRAFT;
  return {
    background: c.bg, color: c.fg, borderRadius: 20, padding: "6px 12px",
    fontSize: 11.5, fontWeight: 700, alignSelf: "center",
  };
}
