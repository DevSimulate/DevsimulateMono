"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface LeaderboardEntry {
  githubUsername: string;
  stack: string;
  ticketsCompleted: number;
  averageScore: number;
  bestScore: number;
}

const MEDAL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

const STACK_LABEL: Record<string, string> = {
  DOTNET: ".NET", ANGULAR: "Angular", JAVA: "Java", CPP: "C++",
  NODE: "Node.js", REACT: "React", PYTHON: "Python", DEVOPS: "DevOps",
  SYSTEM_DESIGN: "System Design",
};
const stackLabel = (s: string) => STACK_LABEL[s] ?? s;

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85 ? "#5B5BD6" : score >= 70 ? "#0D9488" : score >= 50 ? "#D97706" : "#9CA3AF";
  return (
    <span className="text-xl font-black" style={{ color }}>
      {score}
    </span>
  );
}

export default function LeaderboardPage(): React.ReactElement {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [stacks, setStacks] = useState<string[]>([]);
  const [activeStack, setActiveStack] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = activeStack === "ALL"
      ? `${API_URL}/users/leaderboard`
      : `${API_URL}/users/leaderboard?stack=${activeStack}`;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d: { data: LeaderboardEntry[]; stacks?: string[] }) => {
        setEntries(d.data ?? []);
        if (d.stacks && activeStack === "ALL") setStacks(d.stacks);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [activeStack]);

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>
      <nav className="sticky top-0 z-40 nav-glass px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={32} /></Link>
        <div className="flex items-center gap-6">
          <Link href="/tickets" className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
            Tickets
          </Link>
          <Link href="/dashboard" className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1A1A1A")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}>
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12 fade-in-up">
          <div className="section-label mb-1">Community</div>
          <h1 className="text-5xl font-black tracking-tight mb-3" style={{ color: "#1A1A1A" }}>
            Leaderboard
          </h1>
          <p className="text-base" style={{ color: "#6B6B6B" }}>
            Top engineers ranked by average score — <strong>within each stack</strong>.
          </p>
        </div>

        {/* Stack tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {["ALL", ...stacks].map((s) => (
            <button
              key={s}
              onClick={() => setActiveStack(s)}
              className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
              style={{
                background: activeStack === s ? "#5B5BD6" : "white",
                color: activeStack === s ? "white" : "#6B6B6B",
                border: `1px solid ${activeStack === s ? "#5B5BD6" : "#E4E2DD"}`,
              }}
            >
              {s === "ALL" ? "All Stacks" : stackLabel(s)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-20 text-sm" style={{ color: "#9CA3AF" }}>Loading…</div>
        )}

        {!loading && entries.length === 0 && (
          <div className="card rounded-2xl p-16 text-center fade-in-up">
            <div className="text-4xl mb-4">🏆</div>
            <p className="font-bold text-lg mb-1" style={{ color: "#1A1A1A" }}>No scores yet</p>
            <p className="text-sm mb-6" style={{ color: "#6B6B6B" }}>Be the first on the board.</p>
            <Link href="/onboarding/select" className="btn-primary">Start a ticket →</Link>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-3 fade-in-up">
            {entries.map((entry, i) => (
              <Link
                key={`${entry.githubUsername}-${entry.stack}`}
                href={`/profile/${entry.githubUsername}`}
                className="card rounded-2xl px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                style={{ display: "flex" }}
              >
                {/* Rank */}
                <div className="w-10 text-center shrink-0">
                  {i < 3 ? (
                    <span className="text-2xl">{MEDAL[i]}</span>
                  ) : (
                    <span className="text-sm font-black" style={{ color: "#9CA3AF" }}>#{i + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <img
                  src={`https://github.com/${entry.githubUsername}.png?size=40`}
                  alt={entry.githubUsername}
                  className="w-10 h-10 rounded-full shrink-0"
                  style={{ border: "2px solid #E4E2DD" }}
                />

                {/* Name + stack */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: "#1A1A1A" }}>
                    {entry.githubUsername}
                  </div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>
                    {stackLabel(entry.stack)} · {entry.ticketsCompleted} ticket{entry.ticketsCompleted !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Scores */}
                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-1 justify-end">
                    <ScoreBadge score={entry.averageScore} />
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>/100 avg</span>
                  </div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>
                    best: {entry.bestScore}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="text-xs text-center mt-10" style={{ color: "#9CA3AF" }}>
          Ranked by average score · Updated in real time ·{" "}
          <Link href="/onboarding/select" className="underline hover:text-indigo-600">Join the board →</Link>
        </p>
      </main>
    </div>
  );
}
