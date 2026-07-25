"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { BoltIcon } from "@/components/Logo";
import { Badge, TierBadge, tierForScore } from "@/components/ui/Badge";
import { ScoreReceipt } from "@/components/ui/ScoreReceipt";
import { Card } from "@/components/ui/Card";

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

const STACK_LABEL: Record<string, string> = {
  REACT: "React", ANGULAR: "Angular", JAVA: "Java", CPP: "C++",
  DOTNET: ".NET", PYTHON: "Python", NODE: "Node.js",
  DEVOPS: "DevOps", SYSTEM_DESIGN: "System Design",
};

/** Reconstructs a ScoreReceipt from leaderboard-shaped participant data (dimension scores + verbal penalty). */
function receiptFor(p: Participant) {
  const lineItems = [
    { label: "Diagnosis", weight: 40, score: p.diag ?? 0 },
    { label: "Design", weight: 30, score: p.design ?? 0 },
    { label: "Communication", weight: 20, score: p.comms ?? 0 },
    { label: "Execution", weight: 10, score: p.exec ?? 0 },
  ];
  const prBaseScore = lineItems.reduce((sum, l) => sum + l.score, 0);
  return {
    prBaseScore,
    finalScore: p.score,
    lineItems,
    deductions: p.verbalPenalty > 0 ? [{ label: "Verbal defence", amount: p.verbalPenalty }] : [],
  };
}

export default function DevFestPage() {
  const { tag } = useParams<{ tag: string }>();
  const [fest, setFest]     = useState<DevFest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [now, setNow]       = useState(() => Date.now());
  const [expanded, setExpanded] = useState<string | null>(null);

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
    return <div className="min-h-screen flex items-center justify-center bg-paper text-muted text-sm">Loading DevFest…</div>;
  }
  if (error || !fest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-center">
        <div>
          <div className="font-display text-lg font-bold text-ink mb-2">DevFest not found</div>
          <div className="text-sm text-muted">{error}</div>
        </div>
      </div>
    );
  }

  const { branding, categories, overallChampion } = fest;

  const deadlineMs = fest.deadline ? new Date(fest.deadline).getTime() : null;
  const closed     = deadlineMs != null && now >= deadlineMs;
  const festYear   = fest.deadline ? new Date(fest.deadline).getFullYear() : new Date().getFullYear();

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="px-6 py-12 text-center border-b border-hairline bg-surface">
        <div className="flex items-center justify-center gap-3 mb-4">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.brandName} className="h-10 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <BoltIcon size={28} />
              <span className="font-display text-xl font-bold">{branding.brandName}</span>
            </div>
          )}
        </div>

        <Badge tone="neutral" className="mb-5">
          {!closed && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />}
          {closed ? "Competition closed" : "Live leaderboard"}
        </Badge>

        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-2">
          DevFest {festYear}
        </h1>

        {deadlineMs != null && (
          <div className="mb-3">
            {closed ? (
              <span className="text-sm font-semibold text-red">
                Closed {new Date(fest.deadline!).toLocaleString()} — submissions are no longer accepted
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm font-mono font-bold px-4 py-2 rounded border border-hairline bg-paper">
                Closes in {formatCountdown(deadlineMs - now)}
              </span>
            )}
          </div>
        )}

        <p className="text-sm text-muted">
          Hosted by {fest.companyName} · {categories.reduce((n, c) => n + c.participants.length, 0)} scored participants · {closed ? "Final results" : "Updates every 30s"}
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-12">

        {/* Overall champion */}
        {overallChampion && (
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1 text-muted">Overall champion</p>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://github.com/${overallChampion.githubUsername}.png?size=56`}
                    alt={overallChampion.githubUsername}
                    className="w-12 h-12 rounded-full shrink-0 border-2 border-emerald" />
                  <div>
                    <p className="font-display text-xl font-bold">{overallChampion.githubUsername}</p>
                    <p className="text-xs text-muted">
                      {overallChampion.category} · {STACK_LABEL[overallChampion.stack] ?? overallChampion.stack}
                    </p>
                  </div>
                </div>
              </div>
              <TierBadge tier={tierForScore(overallChampion.score)} />
              <div className="text-right shrink-0">
                <p className="font-display text-4xl font-bold">{overallChampion.score}</p>
                <p className="text-xs text-muted">/ 100</p>
              </div>
            </div>
          </Card>
        )}

        {/* Category sections */}
        {categories.length === 0 ? (
          <div className="text-center py-24 text-muted">
            <p className="text-lg font-bold text-ink mb-1">No scores yet</p>
            <p className="text-sm">Scores will appear here as participants complete their tickets.</p>
          </div>
        ) : (
          categories.map((cat) => (
            <section key={cat.name}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-display text-xl font-bold">{cat.name}</h2>
                <Badge tone="neutral">{cat.participants.length} scored</Badge>
              </div>

              {cat.participants.length === 0 ? (
                <div className="rounded border border-hairline bg-surface py-10 text-center text-sm text-muted">
                  No scored participants yet in this category.
                </div>
              ) : (
                <div className="rounded border border-hairline bg-surface divide-y divide-hairline overflow-hidden">
                  {cat.participants.map((p) => {
                    const key = `${p.githubUsername}-${p.stack}`;
                    const isOpen = expanded === key;
                    return (
                      <div key={key}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : key)}
                          className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-paper transition-colors duration-150"
                        >
                          <span className="font-mono text-xs text-muted w-8 text-center shrink-0">#{p.rank}</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://github.com/${p.githubUsername}.png?size=40`} alt={p.githubUsername}
                            className="w-8 h-8 rounded-full shrink-0 border border-hairline" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{p.githubUsername}</p>
                            <p className="text-[11px] text-muted truncate">{p.campaignName}</p>
                          </div>
                          <Badge tone="neutral" className="hidden sm:inline-flex">{STACK_LABEL[p.stack] ?? p.stack}</Badge>
                          <TierBadge tier={tierForScore(p.score)} className="hidden md:inline-flex" />
                          <span className="font-display text-xl font-bold w-14 text-right shrink-0">{p.score}</span>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4">
                            <ScoreReceipt variant="full" animate={false} data={receiptFor(p)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))
        )}

        <p className="text-xs text-center pb-6 text-muted">
          Scores calculated by AI · Verbal defence verified · Powered by DevSimulate
        </p>
      </main>
    </div>
  );
}
