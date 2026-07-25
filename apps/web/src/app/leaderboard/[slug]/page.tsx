"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { BoltIcon } from "@/components/Logo";
import { Badge } from "@/components/ui/Badge";
import { TierBadge, tierForScore } from "@/components/ui/Badge";
import { ScoreReceipt } from "@/components/ui/ScoreReceipt";

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

export default function CampaignLeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [board, setBoard]   = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

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
    return <div className="min-h-screen flex items-center justify-center bg-paper text-muted text-sm">Loading…</div>;
  }
  if (!board) {
    return <div className="min-h-screen flex items-center justify-center bg-paper text-muted text-sm">Leaderboard not found.</div>;
  }

  const isContest = board.type === "CONTEST";
  const branding   = board.branding;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="px-8 py-6 text-center border-b border-hairline bg-surface">
        <div className="flex items-center justify-center gap-3 mb-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.brandName} className="h-8 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <BoltIcon size={26} />
              <span className="font-display font-bold">{branding.brandName}</span>
            </div>
          )}
        </div>
        <Badge tone="neutral" className="mb-3">
          {board.status === "ACTIVE" && <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />}
          {board.status === "ACTIVE" ? "Live" : "Final"}
        </Badge>
        <h1 className="font-display text-3xl sm:text-4xl font-bold">{board.campaignName}</h1>
        <p className="text-sm mt-1 text-muted">
          {board.companyName} {isContest ? "DevFest" : ""} · {board.codebase} · {board.totalJoined} joined
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {board.participants.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <div className="text-lg font-bold text-ink mb-1">No scores yet</div>
            <div className="text-sm">Be the first to solve your ticket and top the board.</div>
          </div>
        ) : (
          <div className="rounded border border-hairline bg-surface divide-y divide-hairline overflow-hidden">
            {board.participants.map((p) => {
              const isOpen = expanded === p.githubUsername;
              return (
                <div key={p.githubUsername}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.githubUsername)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-paper transition-colors duration-150"
                  >
                    <span className="font-mono text-xs text-muted w-8 text-center shrink-0">#{p.rank}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://github.com/${p.githubUsername}.png?size=40`} alt={p.githubUsername}
                      className="w-8 h-8 rounded-full shrink-0 border border-hairline" />
                    <span className="flex-1 min-w-0 font-semibold text-sm truncate">{p.githubUsername}</span>
                    <TierBadge tier={tierForScore(p.score)} className="hidden sm:inline-flex" />
                    <span className="font-display text-xl font-bold w-14 text-right shrink-0">{p.score}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4">
                      <ScoreReceipt variant="full" animate={false} data={receiptFor(p)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-center mt-10 text-muted">
          Updates live · Powered by DevSimulate · Scored by AI
        </p>
      </main>
    </div>
  );
}
