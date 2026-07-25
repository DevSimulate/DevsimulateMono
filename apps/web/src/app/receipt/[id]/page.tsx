"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { TierBadge, tierForScore } from "@/components/ui/Badge";
import { ScoreReceipt } from "@/components/ui/ScoreReceipt";

const API     = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface LineItem { label: string; weight: number; score: number; }
interface Deduction { label: string; amount: number; note?: string; }
interface Review {
  summary:       string | null;
  topStrength:   string | null;
  topImprovement:string | null;
  feedback:      { diagnosis?: string; design?: string; communication?: string; execution?: string } | null;
}

interface ReceiptData {
  id:             string;
  receiptNumber:  string;
  issuedAt:       string;
  finalized:      boolean;
  candidate:      { name: string; githubUsername: string | null };
  ticket:         { title: string; difficulty: string; stack: string };
  prUrl:          string | null;
  prBaseScore:    number;
  lineItems:      LineItem[];
  deductions:     Deduction[];
  review:         Review | null;
  verbal:         { score: number | null; note: string | null } | null;
  riskScore:      number;
  finalScore:     number;
  submittedAt:    string;
  signature:      string;
  verificationCode: string;
}

export default function ReceiptPage() {
  const { id }                = useParams<{ id: string }>();
  const [r, setR]             = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    fetch(`${API}/receipts/${id}`)
      .then((res) => res.json())
      .then((j) => {
        if (j.data) setR(j.data);
        else setError(j.error ?? "Receipt not found");
      })
      .catch((err) => setError(err?.message ?? "Failed to load receipt"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">Loading…</div>;
  }
  if (!r) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-2 text-sm text-muted">
        <div>{error ?? "Receipt not found."}</div>
        <div className="text-xs font-mono text-muted/70">ID: {id}</div>
      </div>
    );
  }

  const receiptUrl = `${APP_URL}/receipt/${r.id}`;
  const issued = format(new Date(r.issuedAt), "MMMM d, yyyy · HH:mm");
  const tier = tierForScore(r.finalScore);

  function copyLink() {
    navigator.clipboard.writeText(receiptUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center gap-5 px-4 py-10 print:bg-white print:py-0">
      <div className="w-full max-w-md">
        <div className="rounded border border-hairline bg-surface p-7">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-hairline">
            <Logo variant="horizontal" size={28} />
            <div className="ml-auto text-right">
              <div className="text-[11px] uppercase tracking-wide text-muted font-semibold">Score receipt</div>
            </div>
          </div>

          {/* Meta */}
          <div className="flex justify-between font-mono text-xs text-muted pb-3.5 mb-3.5 border-b border-dashed border-hairline">
            <span>No. <b className="text-ink">{r.receiptNumber}</b></span>
            <span>{issued}</span>
          </div>

          {/* Candidate + ticket */}
          <div className="pb-3.5 mb-4 border-b border-dashed border-hairline">
            <div className="font-display text-lg font-semibold text-ink">{r.candidate.name}</div>
            {r.candidate.githubUsername && <div className="font-mono text-xs text-muted">@{r.candidate.githubUsername}</div>}
            <div className="text-sm mt-2 text-ink flex items-center gap-2 flex-wrap">
              {r.ticket.title}
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-paper border border-hairline text-muted uppercase tracking-wide">{r.ticket.difficulty}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-paper border border-hairline text-muted uppercase tracking-wide">{r.ticket.stack}</span>
            </div>
          </div>

          {/* The itemised score receipt */}
          <ScoreReceipt
            variant="full"
            data={{
              prBaseScore: r.prBaseScore,
              finalScore: r.finalScore,
              lineItems: r.lineItems,
              deductions: r.deductions,
            }}
            className="!border-0 !p-0 mb-4"
          />

          <div className="flex justify-center mb-4">
            <TierBadge tier={tier} />
          </div>

          {r.review && (r.review.summary || r.review.topStrength || r.review.topImprovement) && (
            <div className="pt-4 mb-4 border-t border-dashed border-hairline">
              <div className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-2">Reviewer notes</div>
              {r.review.summary && <p className="text-xs leading-relaxed text-ink mb-2">{r.review.summary}</p>}
              {r.review.topStrength && (
                <div className="text-xs leading-relaxed text-ink mb-1.5">
                  <span className="inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mr-1.5 bg-emerald-weak text-emerald align-middle">Strength</span>
                  {r.review.topStrength}
                </div>
              )}
              {r.review.topImprovement && (
                <div className="text-xs leading-relaxed text-ink">
                  <span className="inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mr-1.5 bg-amber-weak text-amber align-middle">To improve</span>
                  {r.review.topImprovement}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 mb-4 border-t border-dashed border-hairline flex flex-col gap-1.5 font-mono text-[11px] text-muted">
            {r.verbal?.score != null && (
              <div className="flex justify-between"><span>Verbal defence</span><b className="text-ink">{r.verbal.score} / 10</b></div>
            )}
            <div className="flex justify-between"><span>Status</span><b className="text-ink">{r.finalized ? "Finalized" : "Provisional"}</b></div>
            {r.prUrl && (
              <div className="flex justify-between">
                <span>PR</span>
                <a href={r.prUrl} target="_blank" rel="noreferrer" className="text-brand no-underline">view →</a>
              </div>
            )}
          </div>

          <div className="pt-4 border-t-2 border-dashed border-hairline text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-0.5">Verification code</div>
            <div className="font-mono text-base font-bold tracking-wide text-emerald">{r.verificationCode}</div>
            <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-[11px] text-muted break-all">
              {receiptUrl.replace(/^https?:\/\//, "")}
            </a>
          </div>

          <p className="text-center text-[11px] text-muted mt-3.5">Scored by DevSimulate — diagnosis-weighted, AI-resistant assessment</p>
        </div>

        <div className="flex gap-2.5 justify-center mt-4 print:hidden">
          <Button variant="secondary" onClick={copyLink}>{copied ? "✓ Copied" : "Copy link"}</Button>
          <Button variant="primary" onClick={() => window.print()}>Save as PDF</Button>
        </div>
      </div>
    </div>
  );
}
