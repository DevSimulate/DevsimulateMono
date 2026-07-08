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

interface Participant {
  rank:          number;
  githubUsername: string;
  score:         number;
  diag:          number | null;
  design:        number | null;
  comms:         number | null;
  exec:          number | null;
  verbalPenalty: number;
}

interface Board {
  campaignName: string;
  companyName:  string;
  codebase:     string;
  type:         "HIRING" | "CONTEST";
  status:       string;
  participants: Participant[];
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
      <main className="max-w-5xl mx-auto px-6 py-10">
        {board.participants.length === 0 ? (
          <div className="text-center py-20" style={{ color: "#555" }}>
            <div className="text-4xl mb-3">⏳</div>
            <div className="text-lg font-bold text-white mb-1">No scores yet</div>
            <div className="text-sm">Be the first to solve your ticket and top the board.</div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
            {/* Table header */}
            <div className="grid text-xs font-bold uppercase tracking-widest px-5 py-3"
              style={{ background: "#111111", color: "#444", gridTemplateColumns: "48px 48px 1fr 56px 56px 56px 56px 72px 72px" }}>
              <div />
              <div />
              <div>Candidate</div>
              <div className="text-center">Diag<br/><span style={{color:"#333",fontSize:9}}>/40</span></div>
              <div className="text-center">Design<br/><span style={{color:"#333",fontSize:9}}>/30</span></div>
              <div className="text-center">Comms<br/><span style={{color:"#333",fontSize:9}}>/20</span></div>
              <div className="text-center">Exec<br/><span style={{color:"#333",fontSize:9}}>/10</span></div>
              <div className="text-center">Verbal<br/><span style={{color:"#333",fontSize:9}}>penalty</span></div>
              <div className="text-center">Final</div>
            </div>

            {board.participants.map((p) => (
              <div key={p.githubUsername}
                className="grid items-center px-5 py-3.5 transition-colors"
                style={{
                  gridTemplateColumns: "48px 48px 1fr 56px 56px 56px 56px 72px 72px",
                  background: p.rank <= 3 ? "#0d1117" : "transparent",
                  borderTop: "1px solid #161616",
                  borderLeft: `3px solid ${p.rank === 1 ? accent : p.rank <= 3 ? primary + "88" : "transparent"}`,
                }}>
                {/* Medal / rank */}
                <div className="text-center">
                  {p.rank <= 3
                    ? <span className="text-xl">{MEDAL[p.rank]}</span>
                    : <span className="text-xs font-black" style={{ color: "#555" }}>#{p.rank}</span>}
                </div>
                {/* Avatar */}
                <div>
                  <img src={`https://github.com/${p.githubUsername}.png?size=40`} alt={p.githubUsername}
                    className="w-8 h-8 rounded-full" style={{ border: `2px solid ${primary}44` }} />
                </div>
                {/* Username */}
                <div className="font-bold text-sm text-white truncate">{p.githubUsername}</div>
                {/* Diag */}
                <div className="text-center text-sm" style={{ color: "#aaa" }}>{p.diag ?? "—"}</div>
                {/* Design */}
                <div className="text-center text-sm" style={{ color: "#aaa" }}>{p.design ?? "—"}</div>
                {/* Comms */}
                <div className="text-center text-sm" style={{ color: "#aaa" }}>{p.comms ?? "—"}</div>
                {/* Exec */}
                <div className="text-center text-sm" style={{ color: "#aaa" }}>{p.exec ?? "—"}</div>
                {/* Verbal penalty */}
                <div className="text-center text-sm font-bold">
                  {p.verbalPenalty > 0
                    ? <span style={{ color: "#f87171" }}>−{p.verbalPenalty}</span>
                    : <span style={{ color: "#4ade80" }}>✓</span>}
                </div>
                {/* Final score */}
                <div className="text-center text-xl font-black" style={{ color: scoreColor(p.score) }}>{p.score}</div>
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
