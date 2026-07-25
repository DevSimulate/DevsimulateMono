"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TierBadge, tierForScore } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface LeaderboardEntry {
  githubUsername: string;
  stack: string;
  ticketsCompleted: number;
  averageScore: number;
  bestScore: number;
}

const STACK_LABEL: Record<string, string> = {
  DOTNET: ".NET", ANGULAR: "Angular", JAVA: "Java", CPP: "C++",
  NODE: "Node.js", REACT: "React", PYTHON: "Python", DEVOPS: "DevOps",
  SYSTEM_DESIGN: "System Design",
};
const stackLabel = (s: string) => STACK_LABEL[s] ?? s;

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
    <div className="min-h-screen bg-paper text-ink">
      <nav className="sticky top-0 z-40 bg-surface border-b border-hairline px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={30} /></Link>
        <div className="flex items-center gap-6">
          <Link href="/tickets" className="text-sm font-medium text-muted hover:text-ink transition-colors duration-150">Tickets</Link>
          <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink transition-colors duration-150">Dashboard</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Community</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-3">Leaderboard</h1>
          <p className="text-base text-muted">
            Top engineers ranked by average score — within each stack.
          </p>
        </div>

        {/* Stack tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {["ALL", ...stacks].map((s) => (
            <Button
              key={s}
              variant={activeStack === s ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveStack(s)}
              className="!rounded-full"
            >
              {s === "ALL" ? "All stacks" : stackLabel(s)}
            </Button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-20 text-sm text-muted">Loading…</div>
        )}

        {!loading && entries.length === 0 && (
          <EmptyState title="No scores yet" description="Be the first on the board." actionLabel="Start a ticket" onAction={() => { window.location.href = "/onboarding/select"; }} />
        )}

        {!loading && entries.length > 0 && (
          <div className="rounded border border-hairline bg-surface divide-y divide-hairline overflow-hidden">
            {entries.map((entry, i) => (
              <Link
                key={`${entry.githubUsername}-${entry.stack}`}
                href={`/profile/${entry.githubUsername}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-paper transition-colors duration-150"
              >
                <span className="font-mono text-xs text-muted w-8 text-center shrink-0">#{i + 1}</span>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://github.com/${entry.githubUsername}.png?size=40`}
                  alt={entry.githubUsername}
                  className="w-10 h-10 rounded-full shrink-0 border border-hairline"
                />

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{entry.githubUsername}</div>
                  <div className="text-xs text-muted">
                    {stackLabel(entry.stack)} · {entry.ticketsCompleted} ticket{entry.ticketsCompleted !== 1 ? "s" : ""}
                  </div>
                </div>

                <TierBadge tier={tierForScore(entry.averageScore)} className="hidden sm:inline-flex" />

                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="font-display text-xl font-bold">{entry.averageScore}</span>
                    <span className="text-xs text-muted">/100 avg</span>
                  </div>
                  <div className="text-xs text-muted">best: {entry.bestScore}</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="text-xs text-center mt-10 text-muted">
          Ranked by average score · Updated in real time ·{" "}
          <Link href="/onboarding/select" className="underline text-brand">Join the board →</Link>
        </p>
      </main>
    </div>
  );
}
