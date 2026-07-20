"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";

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

// DevSimulate issuer mark — the terminal ">_" logo.
const DEVSIM_SVG = `<svg width="100%" height="100%" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="ds_receipt_g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#6366F1"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>
<rect width="40" height="40" rx="10" fill="url(#ds_receipt_g)"/>
<polyline points="15,12.5 25.5,20 15,27.5" fill="none" stroke="#FFFFFF" stroke-width="4.3" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="15" y="30.4" width="11" height="3.4" rx="1.7" fill="#2DD4BF"/>
</svg>`;

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
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eceef2", fontFamily: "sans-serif", color: "#666" }}>Loading…</div>;
  }
  if (!r) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "#eceef2", fontFamily: "sans-serif", color: "#888" }}>
        <div>{error ?? "Receipt not found."}</div>
        <div style={{ fontSize: 12, color: "#bbb" }}>ID: {id}</div>
      </div>
    );
  }

  const receiptUrl = `${APP_URL}/receipt/${r.id}`;
  const issued = format(new Date(r.issuedAt), "MMMM d, yyyy · HH:mm");
  const deductionTotal = r.deductions.reduce((s, d) => s + d.amount, 0);

  function copyLink() {
    navigator.clipboard.writeText(receiptUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .rc-page { --ink:#14161a; --muted:#6b7280; --line:#e4e7ec; --accent:#7c3aed; --pos:#166534; --neg:#b91c1c;
          min-height:100vh; display:flex; flex-direction:column; align-items:center; gap:20px;
          padding:36px 16px; background:#eceef2; font-family:'Inter',sans-serif; }
        .rc-page * { box-sizing:border-box; margin:0; padding:0; }

        .receipt { width:420px; max-width:100%; background:#fff; color:var(--ink);
          box-shadow:0 20px 50px rgba(20,22,26,0.12); border-radius:4px; overflow:hidden; position:relative; }
        .receipt::before, .receipt::after { content:""; display:block; height:10px;
          background:radial-gradient(circle at 8px -2px, transparent 8px, #fff 8px) repeat-x; background-size:16px 10px; }
        .receipt::before { box-shadow:none; }

        .rc-body { padding:8px 30px 26px; }
        .rc-head { display:flex; align-items:center; gap:10px; padding-bottom:16px; border-bottom:2px dashed var(--line); }
        .rc-mark { width:34px; height:34px; flex-shrink:0; }
        .rc-brand { font-weight:700; font-size:15px; letter-spacing:-0.01em; }
        .rc-brand span { color:var(--accent); }
        .rc-doctype { margin-left:auto; text-align:right; }
        .rc-doctype .t { font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted); font-weight:600; }

        .rc-meta { display:flex; justify-content:space-between; font-family:'JetBrains Mono',monospace;
          font-size:11px; color:var(--muted); padding:14px 0; border-bottom:1px dashed var(--line); }
        .rc-meta b { color:var(--ink); font-weight:600; }

        .rc-sub { padding:14px 0; border-bottom:1px dashed var(--line); }
        .rc-sub .name { font-size:18px; font-weight:700; }
        .rc-sub .gh { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--muted); }
        .rc-sub .ticket { margin-top:8px; font-size:13px; }
        .rc-sub .badge { display:inline-block; font-size:10px; font-weight:700; padding:1px 7px; border-radius:4px;
          background:#f3f4f6; color:#374151; text-transform:uppercase; letter-spacing:0.04em; margin-left:6px; }

        table.rc-items { width:100%; border-collapse:collapse; margin-top:12px; font-family:'JetBrains Mono',monospace; }
        .rc-items th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);
          font-weight:600; padding:6px 0; border-bottom:1px solid var(--line); }
        .rc-items th.num, .rc-items td.num { text-align:right; }
        .rc-items td { font-size:13px; padding:7px 0; border-bottom:1px solid #f3f4f6; }
        .rc-items td .w { color:var(--muted); font-size:11px; }

        .rc-line { display:flex; justify-content:space-between; font-family:'JetBrains Mono',monospace;
          font-size:13px; padding:6px 0; }
        .rc-line.sub { border-top:1px dashed var(--line); margin-top:8px; padding-top:12px; }
        .rc-line .neg { color:var(--neg); }
        .rc-ded-note { font-family:'Inter',sans-serif; font-size:11px; color:var(--muted); padding:0 0 6px 0; max-width:100%; }

        .rc-total { display:flex; justify-content:space-between; align-items:baseline; margin-top:12px; padding-top:14px;
          border-top:2px solid var(--ink); }
        .rc-total .lbl { font-size:12px; text-transform:uppercase; letter-spacing:0.12em; font-weight:700; }
        .rc-total .val { font-family:'JetBrains Mono',monospace; font-size:30px; font-weight:700; }
        .rc-total .val span { font-size:14px; color:var(--muted); font-weight:500; }

        .rc-review { margin-top:16px; padding-top:14px; border-top:1px dashed var(--line); }
        .rc-review-h { font-size:10px; text-transform:uppercase; letter-spacing:0.14em; color:var(--muted); font-weight:600; margin-bottom:8px; }
        .rc-review-summary { font-size:12.5px; line-height:1.5; color:var(--ink); margin-bottom:8px; }
        .rc-review-item { font-size:12px; line-height:1.5; color:var(--ink); margin-bottom:6px; }
        .rc-review-item .tag { display:inline-block; font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:700;
          text-transform:uppercase; letter-spacing:0.06em; padding:1px 6px; border-radius:4px; margin-right:6px; vertical-align:middle; }
        .rc-review-item .tag.pos { background:#dcfce7; color:#166534; }
        .rc-review-item .tag.imp { background:#fef3c7; color:#92400e; }

        .rc-extra { margin-top:16px; padding-top:14px; border-top:1px dashed var(--line);
          font-family:'JetBrains Mono',monospace; font-size:11.5px; color:var(--muted); display:flex; flex-direction:column; gap:5px; }
        .rc-extra .row { display:flex; justify-content:space-between; }
        .rc-extra b { color:var(--ink); font-weight:600; }

        .rc-verify { margin-top:16px; padding-top:14px; border-top:2px dashed var(--line); text-align:center; }
        .rc-verify .code { font-family:'JetBrains Mono',monospace; font-size:16px; font-weight:700; letter-spacing:0.14em; color:var(--accent); }
        .rc-verify .lbl { font-size:10px; text-transform:uppercase; letter-spacing:0.14em; color:var(--muted); margin-bottom:3px; }
        .rc-verify a { font-size:11px; color:var(--muted); text-decoration:none; word-break:break-all; }
        .rc-thanks { text-align:center; font-size:11px; color:var(--muted); margin-top:14px; letter-spacing:0.02em; }

        .rc-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
        .btn { font-family:'Inter',sans-serif; font-size:14px; font-weight:600; padding:10px 18px; border-radius:10px;
          cursor:pointer; border:none; text-decoration:none; display:inline-flex; align-items:center; gap:6px; transition:filter .15s; }
        .btn:hover { filter:brightness(1.05); }
        .btn-copy { background:#111827; color:#fff; } .btn-pdf { background:#7c3aed; color:#fff; }

        @media print {
          @page { size:auto; margin:8mm; }
          body { background:#fff; }
          .rc-page { padding:0; background:#fff; gap:0; }
          .rc-actions { display:none; }
          .receipt { box-shadow:none; }
        }
      `}</style>

      <div className="rc-page">
        <div className="receipt">
          <div className="rc-body">
            <div className="rc-head">
              <span className="rc-mark" dangerouslySetInnerHTML={{ __html: DEVSIM_SVG }} />
              <div className="rc-brand">Dev<span>Simulate</span></div>
              <div className="rc-doctype"><div className="t">Score Receipt</div></div>
            </div>

            <div className="rc-meta">
              <span>No. <b>{r.receiptNumber}</b></span>
              <span>{issued}</span>
            </div>

            <div className="rc-sub">
              <div className="name">{r.candidate.name}</div>
              {r.candidate.githubUsername && <div className="gh">@{r.candidate.githubUsername}</div>}
              <div className="ticket">
                {r.ticket.title}
                <span className="badge">{r.ticket.difficulty}</span>
                <span className="badge">{r.ticket.stack}</span>
              </div>
            </div>

            <table className="rc-items">
              <thead>
                <tr><th>Dimension</th><th className="num">Weight</th><th className="num">Marks</th></tr>
              </thead>
              <tbody>
                {r.lineItems.map((l) => (
                  <tr key={l.label}>
                    <td>{l.label}</td>
                    <td className="num"><span className="w">/{l.weight}</span></td>
                    <td className="num">{l.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="rc-line sub">
              <span>PR review subtotal</span>
              <span>{r.prBaseScore} / 100</span>
            </div>

            {r.deductions.map((d, i) => (
              <div key={i}>
                <div className="rc-line">
                  <span>{d.label}</span>
                  <span className="neg">− {d.amount}</span>
                </div>
                {d.note && <div className="rc-ded-note">{d.note}</div>}
              </div>
            ))}
            {r.deductions.length > 0 && (
              <div className="rc-line">
                <span>Total deductions</span>
                <span className="neg">− {deductionTotal}</span>
              </div>
            )}

            <div className="rc-total">
              <span className="lbl">Final Score</span>
              <span className="val">{r.finalScore}<span>/100</span></span>
            </div>

            {r.review && (r.review.summary || r.review.topStrength || r.review.topImprovement) && (
              <div className="rc-review">
                <div className="rc-review-h">Reviewer notes</div>
                {r.review.summary && <p className="rc-review-summary">{r.review.summary}</p>}
                {r.review.topStrength && (
                  <div className="rc-review-item"><span className="tag pos">Strength</span>{r.review.topStrength}</div>
                )}
                {r.review.topImprovement && (
                  <div className="rc-review-item"><span className="tag imp">To improve</span>{r.review.topImprovement}</div>
                )}
              </div>
            )}

            <div className="rc-extra">
              {r.verbal?.score != null && (
                <div className="row"><span>Verbal defence</span><b>{r.verbal.score} / 10</b></div>
              )}
              <div className="row"><span>Integrity risk</span><b>{r.riskScore} / 100</b></div>
              <div className="row"><span>Status</span><b>{r.finalized ? "Finalized" : "Provisional"}</b></div>
              {r.prUrl && (
                <div className="row"><span>PR</span><a href={r.prUrl} target="_blank" rel="noreferrer" style={{ color: "#7c3aed", textDecoration: "none" }}>view →</a></div>
              )}
            </div>

            <div className="rc-verify">
              <div className="lbl">Verification Code</div>
              <div className="code">{r.verificationCode}</div>
              <a href={receiptUrl} target="_blank" rel="noreferrer">{receiptUrl.replace(/^https?:\/\//, "")}</a>
            </div>

            <div className="rc-thanks">Scored by DevSimulate · diagnosis-weighted, AI-resistant assessment</div>
          </div>
        </div>

        <div className="rc-actions">
          <button onClick={copyLink} className="btn btn-copy">{copied ? "✓ Copied!" : "Copy Link"}</button>
          <button onClick={() => window.print()} className="btn btn-pdf">Save as PDF</button>
        </div>
      </div>
    </>
  );
}
