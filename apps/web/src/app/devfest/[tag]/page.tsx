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
  stack:         string;
  campaignName:  string;
}

interface Category {
  name:         string;
  icon:         string;
  participants: Participant[];
}

interface DevFest {
  tag:              string;
  deadline:         string | null;
  companyName:      string;
  branding:         Branding;
  categories:       Category[];
  overallChampion:  (Participant & { category: string }) | null;
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function scoreColor(s: number): string {
  return s >= 85 ? "#4ade80" : s >= 70 ? "#fbbf24" : s >= 50 ? "#fb923c" : "#f87171";
}

const STACK_LABEL: Record<string, string> = {
  REACT: "React", ANGULAR: "Angular", JAVA: "Java", CPP: "C++",
  DOTNET: ".NET", PYTHON: "Python", NODE: "Node.js",
  DEVOPS: "DevOps", SYSTEM_DESIGN: "System Design",
};

export default function DevFestPage() {
  const { tag } = useParams<{ tag: string }>();
  const [fest, setFest]     = useState<DevFest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [now, setNow]       = useState(() => Date.now());

  // Tick every second so the countdown stays live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(() => {
    fetch(`${API}/devfest/${tag}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setFest(j.data);
        else setError(j.error ?? "Not found");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [tag]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07070a", color: "#555" }}>
        Loading DevFest…
      </div>
    );
  }
  if (error || !fest) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07070a", color: "#888" }}>
        <div className="text-center">
          <div className="text-5xl mb-4">🏗️</div>
          <div className="text-lg font-bold text-white mb-2">DevFest not found</div>
          <div className="text-sm" style={{ color: "#555" }}>{error}</div>
        </div>
      </div>
    );
  }

  const { branding, categories, overallChampion } = fest;
  const primary = branding.primaryColor;
  const accent  = branding.accentColor;

  const deadlineMs = fest.deadline ? new Date(fest.deadline).getTime() : null;
  const closed     = deadlineMs != null && now >= deadlineMs;
  const festYear   = fest.deadline ? new Date(fest.deadline).getFullYear() : new Date().getFullYear();

  return (
    <div className="min-h-screen" style={{ background: "#07070a", color: "#e5e7eb" }}>

      {/* ── Hero header ── */}
      <header className="relative overflow-hidden px-6 py-12 text-center"
        style={{ borderBottom: "1px solid #131313", background: "linear-gradient(160deg, #0d0d14 0%, #07070a 100%)" }}>

        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${primary}18 0%, transparent 70%)`,
        }} />

        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.brandName}
                className="h-10 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <BoltIcon size={28} />
                <span className="text-xl font-black text-white">{branding.brandName}</span>
              </div>
            )}
          </div>

          {closed ? (
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5"
              style={{ background: "#1a0c0c", color: "#f87171", border: "1px solid #3a1a1a" }}>
              ⏹ COMPETITION CLOSED
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5"
              style={{ background: "#0c0c0c", color: "#4ade80", border: "1px solid #1a3a1a" }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: "#4ade80" }} />
              LIVE LEADERBOARD
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-2">
            DevFest <span style={{ color: accent }}>{festYear}</span>
          </h1>

          {deadlineMs != null && (
            <div className="mb-3">
              {closed ? (
                <span className="text-sm font-semibold" style={{ color: "#f87171" }}>
                  Closed {new Date(fest.deadline!).toLocaleString()} — submissions are no longer accepted
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm font-mono font-bold px-4 py-2 rounded-lg"
                  style={{ background: "#0c0c0c", border: `1px solid ${accent}55`, color: accent }}>
                  ⏱ Closes in {formatCountdown(deadlineMs - now)}
                </span>
              )}
            </div>
          )}

          <p className="text-sm" style={{ color: "#555" }}>
            Hosted by {fest.companyName} · {categories.reduce((n, c) => n + c.participants.length, 0)} scored participants · {closed ? "Final results" : "Updates every 30s"}
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-12">

        {/* ── Overall champion banner ── */}
        {overallChampion && (
          <div className="rounded-2xl p-6 relative overflow-hidden"
            style={{ background: "#0d0d0d", border: `1px solid ${accent}44` }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse 70% 60% at 20% 50%, ${accent}10 0%, transparent 70%)` }} />
            <div className="relative z-10 flex flex-wrap items-center gap-4">
              <div className="text-5xl">🏆</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: accent }}>Overall Champion</p>
                <div className="flex items-center gap-3">
                  <img src={`https://github.com/${overallChampion.githubUsername}.png?size=56`}
                    alt={overallChampion.githubUsername}
                    className="w-12 h-12 rounded-full shrink-0"
                    style={{ border: `2px solid ${accent}` }} />
                  <div>
                    <p className="text-xl font-black text-white">{overallChampion.githubUsername}</p>
                    <p className="text-xs" style={{ color: "#777" }}>
                      {overallChampion.category} · {STACK_LABEL[overallChampion.stack] ?? overallChampion.stack}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-4xl font-black" style={{ color: scoreColor(overallChampion.score) }}>
                  {overallChampion.score}
                </p>
                <p className="text-xs" style={{ color: "#555" }}>/ 100</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Category sections ── */}
        {categories.length === 0 ? (
          <div className="text-center py-24" style={{ color: "#555" }}>
            <div className="text-5xl mb-4">⏳</div>
            <p className="text-lg font-bold text-white mb-1">No scores yet</p>
            <p className="text-sm">Scores will appear here as participants complete their tickets.</p>
          </div>
        ) : (
          categories.map((cat) => (
            <section key={cat.name}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{cat.icon}</span>
                <h2 className="text-xl font-black text-white">{cat.name}</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-1"
                  style={{ background: "#111", color: "#555", border: "1px solid #1a1a1a" }}>
                  {cat.participants.length} scored
                </span>
              </div>

              {cat.participants.length === 0 ? (
                <div className="rounded-xl py-10 text-center text-sm"
                  style={{ background: "#0c0c0c", border: "1px solid #131313", color: "#444" }}>
                  No scored participants yet in this category.
                </div>
              ) : (
                <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid #131313" }}>
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase tracking-widest"
                        style={{ background: "#0c0c0c", color: "#3a3a3a" }}>
                        <th className="px-4 py-3 w-12 text-center">#</th>
                        <th className="px-2 py-3 w-10" />
                        <th className="px-2 py-3">Candidate</th>
                        <th className="px-3 py-3 text-center">Stack</th>
                        <th className="px-3 py-3 text-center">
                          Diag<br /><span className="text-[9px]" style={{ color: "#252525" }}>/40</span>
                        </th>
                        <th className="px-3 py-3 text-center">
                          Design<br /><span className="text-[9px]" style={{ color: "#252525" }}>/30</span>
                        </th>
                        <th className="px-3 py-3 text-center">
                          Comms<br /><span className="text-[9px]" style={{ color: "#252525" }}>/20</span>
                        </th>
                        <th className="px-3 py-3 text-center">
                          Exec<br /><span className="text-[9px]" style={{ color: "#252525" }}>/10</span>
                        </th>
                        <th className="px-4 py-3 text-center">Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.participants.map((p) => (
                        <tr key={`${p.githubUsername}-${p.stack}`}
                          style={{
                            background:    p.rank <= 3 ? "#0d0f0d" : "transparent",
                            borderTop:     "1px solid #111",
                            borderLeft:    `3px solid ${p.rank === 1 ? accent : p.rank <= 3 ? primary + "66" : "transparent"}`,
                          }}>
                          <td className="px-4 py-3 text-center">
                            {p.rank <= 3
                              ? <span className="text-lg">{MEDAL[p.rank]}</span>
                              : <span className="text-xs font-black" style={{ color: "#444" }}>#{p.rank}</span>}
                          </td>
                          <td className="px-2 py-3">
                            <img src={`https://github.com/${p.githubUsername}.png?size=40`}
                              alt={p.githubUsername}
                              className="w-8 h-8 rounded-full"
                              style={{ border: `2px solid ${primary}33` }} />
                          </td>
                          <td className="px-2 py-3">
                            <p className="font-bold text-sm text-white">{p.githubUsername}</p>
                            <p className="text-[10px]" style={{ color: "#555" }}>{p.campaignName}</p>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                              style={{ background: "#111", color: "#777", border: "1px solid #1a1a1a" }}>
                              {STACK_LABEL[p.stack] ?? p.stack}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center text-sm" style={{ color: "#aaa" }}>{p.diag ?? "—"}</td>
                          <td className="px-3 py-3 text-center text-sm" style={{ color: "#aaa" }}>{p.design ?? "—"}</td>
                          <td className="px-3 py-3 text-center text-sm" style={{ color: "#aaa" }}>{p.comms ?? "—"}</td>
                          <td className="px-3 py-3 text-center text-sm" style={{ color: "#aaa" }}>{p.exec ?? "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xl font-black" style={{ color: scoreColor(p.score) }}>
                              {p.score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))
        )}

        <p className="text-xs text-center pb-6" style={{ color: "#333" }}>
          Scores calculated by AI · Verbal defence verified · Powered by DevSimulate
        </p>
      </main>
    </div>
  );
}
