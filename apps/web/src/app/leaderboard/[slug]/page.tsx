"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { BoltIcon } from "@/components/Logo";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Branding {
  logoUrl:      string | null;
  primaryColor: string;
  accentColor:  string;
  brandName:    string;
}

interface Board {
  campaignName: string;
  companyName:  string;
  codebase:     string;
  type:         "HIRING" | "CONTEST";
  status:       string;
  participants: Array<{ rank: number; githubUsername: string; score: number }>;
  totalJoined:  number;
  branding:     Branding;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function scoreColor(s: number): string {
  return s >= 85 ? "#4ade80" : s >= 70 ? "#fbbf24" : s >= 50 ? "#fb923c" : "#f87171";
}

export default function CampaignLeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [board, setBoard]   = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`${API}/employer/campaigns/leaderboard/${slug}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setBoard(j.data); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [slug]);

  // Live: refresh every 20s
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#555" }}>Loading…</div>;
  }
  if (!board) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#888" }}>Leaderboard not found.</div>;
  }

  const isContest   = board.type === "CONTEST";
  const branding    = board.branding;
  const primary     = branding.primaryColor;
  const accent      = branding.accentColor;

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a", color: "#e5e7eb" }}>
      {/* Header */}
      <header className="px-8 py-6 text-center" style={{ borderBottom: "1px solid #1a1a1a" }}>
        <div className="flex items-center justify-center gap-3 mb-3">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.brandName} className="h-8 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <BoltIcon size={26} />
              <span className="font-black text-white">{branding.brandName}</span>
            </div>
          )}
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-3"
          style={{ background: "#052e16", color: "#4ade80", border: "1px solid #166534" }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: "#4ade80" }} />
          {board.status === "ACTIVE" ? "LIVE" : "FINAL"}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white">🏆 {board.campaignName}</h1>
        <p className="text-sm mt-1" style={{ color: "#888" }}>
          {board.companyName} {isContest ? "DevFest" : ""} · {board.codebase} · {board.totalJoined} joined
        </p>
      </header>

      {/* Board */}
      <main className="max-w-2xl mx-auto px-6 py-10">
        {board.participants.length === 0 ? (
          <div className="text-center py-20" style={{ color: "#555" }}>
            <div className="text-4xl mb-3">⏳</div>
            <div className="text-lg font-bold text-white mb-1">No scores yet</div>
            <div className="text-sm">Be the first to solve your ticket and top the board.</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {board.participants.map((p) => (
              <div key={p.githubUsername}
                className="flex items-center gap-4 rounded-xl px-5 py-3.5 transition-colors"
                style={{
                  background: p.rank <= 3 ? "#111827" : "#0d0d0d",
                  border: `1px solid ${p.rank === 1 ? accent : p.rank <= 3 ? primary + "66" : "#1a1a1a"}`,
                }}>
                <div className="w-10 text-center shrink-0">
                  {p.rank <= 3
                    ? <span className="text-2xl">{MEDAL[p.rank]}</span>
                    : <span className="text-sm font-black" style={{ color: "#555" }}>#{p.rank}</span>}
                </div>
                <img src={`https://github.com/${p.githubUsername}.png?size=40`} alt={p.githubUsername}
                  className="w-9 h-9 rounded-full shrink-0" style={{ border: `2px solid ${primary}44` }} />
                <div className="flex-1 min-w-0 font-bold text-sm text-white truncate">{p.githubUsername}</div>
                <div className="text-2xl font-black shrink-0" style={{ color: scoreColor(p.score) }}>{p.score}</div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-center mt-10" style={{ color: "#555" }}>
          Updates live · Powered by DevSimulate · Scored by AI
        </p>
      </main>
    </div>
  );
}
