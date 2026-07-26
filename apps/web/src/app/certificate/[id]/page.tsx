"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { LMKR_SVG, DEVFEST_SVG, DEVSIM_SVG } from "@/components/certificate/certBrand";
import { BoltIcon } from "@/components/Logo";
import { TierBadge, tierForScore } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const API     = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface Dimensions { diagnosis: number; design: number; communication: number; execution: number; }

interface CertData {
  id:             string;
  recipientName:  string;
  githubUsername: string;
  campaignName:   string;
  companyName:    string;
  campaignType:   "HIRING" | "CONTEST";
  score:          number;
  rank:           number | null;
  category:       string | null;
  issuedAt:       string;
  dimensions:     Dimensions | null;
  branding: {
    logoUrl:      string | null;
    primaryColor: string;
    accentColor:  string;
    brandName:    string | null;
  };
}

export default function CertificatePage() {
  const { id }              = useParams<{ id: string }>();
  const [cert, setCert]       = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    fetch(`${API}/certificates/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setCert(j.data);
        else setError(j.error ?? "Certificate not found");
      })
      .catch((err) => setError(err?.message ?? "Failed to load certificate"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#D0D2D6", fontFamily: "sans-serif", color: "#555" }}>
        Loading…
      </div>
    );
  }

  if (!cert) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", background: "#D0D2D6", fontFamily: "sans-serif", color: "#888" }}>
        <div>{error ?? "Certificate not found."}</div>
        {error && <div style={{ fontSize: "12px", color: "#bbb" }}>ID: {id}</div>}
      </div>
    );
  }

  const certUrl = `${APP_URL}/certificate/${cert.id}`;
  const year    = new Date(cert.issuedAt).getFullYear();
  const credId  = `DS-${year}-${cert.campaignType === "CONTEST" ? "DF" : "HR"}-${cert.id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`;

  function copyLink() {
    navigator.clipboard.writeText(certUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (cert.campaignType === "HIRING") {
    return (
      <GenericCertificate cert={cert} certUrl={certUrl} credId={credId} copied={copied} onCopy={copyLink} />
    );
  }

  return <DevFestCertificate cert={cert} certUrl={certUrl} credId={credId} copied={copied} onCopy={copyLink} />;
}

/**
 * The generic, DevSimulate-only certificate for the Hiring flow — no
 * employer logo or brand colours, just the candidate's score and real
 * 4-dimension breakdown. The branded rail-and-field template below is
 * reserved for DevFest.
 */
function GenericCertificate({
  cert, certUrl, credId, copied, onCopy,
}: {
  cert: CertData; certUrl: string; credId: string; copied: boolean; onCopy: () => void;
}) {
  const issued = format(new Date(cert.issuedAt), "MMMM d, yyyy");
  const tier = tierForScore(cert.score);
  const dims = cert.dimensions;
  const DIMS = dims
    ? [
        { label: "Diagnosis", value: dims.diagnosis, max: 40 },
        { label: "Design", value: dims.design, max: 30 },
        { label: "Communication", value: dims.communication, max: 20 },
        { label: "Execution", value: dims.execution, max: 10 },
      ]
    : [];

  const linkedInUrl = [
    "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME",
    `&name=${encodeURIComponent("DevSimulate Certified Developer")}`,
    `&issueYear=${new Date(cert.issuedAt).getFullYear()}`,
    `&issueMonth=${new Date(cert.issuedAt).getMonth() + 1}`,
    `&certUrl=${encodeURIComponent(certUrl)}`,
    `&certId=${encodeURIComponent(cert.id)}`,
  ].join("");

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center gap-6 px-4 py-10 print:bg-white print:py-0">
      <div className="w-full max-w-lg rounded border border-hairline bg-surface p-10 text-center">
        <div className="flex justify-center mb-6"><BoltIcon size={40} /></div>
        <div className="text-[11px] uppercase tracking-widest text-muted font-semibold mb-1">Certificate of achievement</div>
        <div className="text-xs text-muted mb-8">DevSimulate technical assessment</div>

        <div className="text-xs uppercase tracking-wide text-muted mb-2">This certifies that</div>
        <h1 className="font-display text-4xl font-bold text-ink mb-1">{cert.recipientName || `@${cert.githubUsername}`}</h1>
        <div className="text-sm text-muted mb-8">completed the {cert.campaignName} assessment</div>

        <div className="flex items-center justify-center gap-6 mb-8">
          <div>
            <div className="font-display text-5xl font-bold text-ink leading-none">{cert.score}</div>
            <div className="text-xs text-muted mt-1">/ 100</div>
          </div>
          <div className="w-px h-12 bg-hairline" />
          <TierBadge tier={tier} />
        </div>

        {DIMS.length > 0 && (
          <div className="border-t border-hairline pt-6 mb-6 text-left">
            <div className="text-[11px] uppercase tracking-widest text-muted font-semibold mb-4 text-center">Assessed across four dimensions</div>
            <div className="flex flex-col gap-3">
              {DIMS.map((d) => (
                <div key={d.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink font-medium">{d.label}</span>
                    <span className="font-mono text-muted">{d.value}/{d.max}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-hairline overflow-hidden">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (d.value / d.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted leading-relaxed mb-6">
          Assessed via automated code review, pull request analysis, hidden test-case validation,
          and a spoken defence of the solution.
        </p>

        <div className="border-t border-hairline pt-5 flex items-center justify-between text-left">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted font-semibold">Issued</div>
            <div className="text-sm text-ink">{issued}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-muted font-semibold">Credential</div>
            <div className="font-mono text-sm text-ink">{credId}</div>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted mt-4">Verified by DevSimulate — {certUrl.replace(/^https?:\/\//, "")}</p>
      </div>

      <div className="flex gap-2.5 print:hidden">
        <a href={linkedInUrl} target="_blank" rel="noreferrer">
          <Button variant="secondary">Add to LinkedIn</Button>
        </a>
        <Button variant="secondary" onClick={onCopy}>{copied ? "✓ Copied" : "Copy link"}</Button>
        <Button variant="primary" onClick={() => window.print()}>Save as PDF</Button>
      </div>
    </div>
  );
}

/** The branded DevFest certificate — unchanged rail-and-field template. */
function DevFestCertificate({
  cert, certUrl, credId, copied, onCopy,
}: {
  cert: CertData; certUrl: string; credId: string; copied: boolean; onCopy: () => void;
}) {
  const issued = format(new Date(cert.issuedAt), "MMMM d, yyyy");
  const verifyDisplay = certUrl.replace(/^https?:\/\//, "");
  const year = new Date(cert.issuedAt).getFullYear();

  const linkedInUrl = [
    "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME",
    `&name=${encodeURIComponent(`LMKR DevFest 2026 — ${cert.campaignName}`)}`,
    `&issueYear=${year}`,
    `&issueMonth=${new Date(cert.issuedAt).getMonth() + 1}`,
    `&certUrl=${encodeURIComponent(certUrl)}`,
    `&certId=${encodeURIComponent(cert.id)}`,
  ].join("");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap');

        .cert-page { --sidebar-bg:#195792; --main-bg:#E7E7E8; --accent-orange:#E86F24; --accent-blue:#13A8E0;
          --text-primary:#111111; --text-secondary:#195792; --hairline:#C4C9D4;
          min-height:100vh; display:flex; flex-direction:column; align-items:center; gap:26px;
          padding:36px 16px; background:#D0D2D6; font-family:'Tomorrow',sans-serif; }
        .cert-page * { box-sizing:border-box; margin:0; padding:0; }
        .cert-scroll { max-width:100%; overflow-x:auto; }

        .certificate { width:1123px; height:794px; background:var(--main-bg); color:var(--text-primary);
          position:relative; display:flex; box-shadow:0 24px 60px rgba(25,87,146,0.15); overflow:hidden; }

        .rail { width:230px; flex-shrink:0; background:var(--sidebar-bg); color:var(--main-bg);
          padding:44px 30px 36px; display:flex; flex-direction:column; position:relative; }
        .rail-accent { position:absolute; top:0; left:0; width:100%; height:4px; background:var(--accent-orange); }
        .rail-eyebrow { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#FFF; font-weight:600; }
        .rail-title { font-size:28px; font-weight:700; color:#FFF; margin-top:14px; line-height:1.2; }
        .hosted-section { margin-top:34px; padding-top:22px; border-top:1px solid rgba(19,168,224,0.3); }
        .hosted-label { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#FFF; font-weight:600; margin-bottom:16px; }
        .lmkr-logo { width:56px; height:56px; }
        .rail-meta { margin-top:auto; font-size:11px; line-height:1.9; color:rgba(231,231,232,0.8); }
        .rail-meta .rail-label { display:block; letter-spacing:0.18em; text-transform:uppercase; font-size:10px; margin-bottom:2px; }
        .rail-meta strong { color:#FFF; font-weight:600; font-size:15px; }

        .main-field { flex:1; padding:48px 56px 40px 52px; display:flex; flex-direction:column; position:relative; min-width:0; }
        .field-header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
        .cert-title { font-size:17px; letter-spacing:0.26em; text-transform:uppercase; color:var(--text-secondary);
          font-weight:700; border-left:3px solid var(--accent-orange); padding:2px 0 2px 12px; line-height:1.3; }
        .devfest-logo { display:flex; justify-content:flex-end; flex-shrink:0; }
        .devfest-logo-inner { height:80px; width:244px; }

        .presentation-block { margin-top:48px; }
        .presented-to { font-size:11px; letter-spacing:0.05em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; }
        .candidate-name { font-size:54px; font-weight:700; line-height:1.05; margin-top:8px; letter-spacing:-0.01em; color:var(--text-primary); }
        .name-rule { width:88px; height:4px; background:var(--accent-orange); margin:16px 0 26px; }
        .category-block { margin-bottom:26px; }
        .category-label { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; margin-bottom:6px; }
        .category-value { font-size:20px; font-weight:700; color:var(--accent-orange); letter-spacing:-0.01em; }
        .attainment { font-size:15px; line-height:1.65; color:var(--text-primary); max-width:620px; }
        .accent-bold { color:var(--accent-orange); font-weight:700; }

        .spectrum { margin-top:auto; padding-top:26px; border-top:1px solid var(--hairline); }
        .spectrum-label { font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:var(--text-secondary); margin-bottom:14px; font-weight:600; }
        .dimensions { display:flex; width:100%; }
        .dim { padding-right:18px; } .dim:last-child { padding-right:0; }
        .dim.d40 { width:40%; } .dim.d30 { width:30%; } .dim.d20 { width:20%; } .dim.d10 { width:10%; }
        .bar { height:5px; background:var(--accent-blue); margin-bottom:9px; border-radius:0 2px 2px 0; }
        .bar-40 { opacity:1; } .bar-30 { opacity:0.8; } .bar-20 { opacity:0.6; } .bar-10 { opacity:0.4; }
        .dim-name { font-size:13px; font-weight:600; color:var(--text-primary); }
        .dim-weight { font-size:10.5px; color:var(--text-secondary); margin-top:2px; opacity:0.8; }
        .method-line { margin-top:16px; font-size:12px; color:var(--text-primary); opacity:0.8; line-height:1.6; }

        .field-footer { margin-top:24px; padding-top:20px; border-top:1px solid var(--hairline);
          display:flex; align-items:flex-end; justify-content:space-between; gap:20px; }
        .issuer-lockup { display:flex; align-items:center; gap:11px; }
        .devsim-mark { width:40px; height:40px; flex-shrink:0; }
        .issued-by { font-size:9.5px; letter-spacing:0.18em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; }
        .issuer-name { font-size:17px; font-weight:700; color:var(--text-primary); margin-top:2px; text-decoration:none; display:block; }
        .verify { text-align:right; font-size:11px; line-height:1.8; text-decoration:none; }
        .cred-id { color:var(--text-primary); font-weight:700; }
        .verify-url { color:var(--text-secondary); font-weight:500; margin-top:2px; }

        .cert-actions { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
        .btn { display:inline-flex; align-items:center; gap:8px; font-family:'Tomorrow',sans-serif; font-size:14px;
          font-weight:600; padding:11px 20px; border-radius:10px; cursor:pointer; border:none; text-decoration:none; transition:filter .15s; }
        .btn:hover { filter:brightness(1.05); }
        .btn-linkedin { background:#0A66C2; color:#FFF; }
        .btn-copy { background:#195792; color:#FFF; }
        .btn-pdf { background:#E86F24; color:#FFF; }

        @media (max-width:1180px){ .cert-scroll { width:100%; } }
        @media print {
          @page { size:A4 landscape; margin:0; }
          body { background:#FFF; }
          .cert-page { padding:0; background:#FFF; gap:0; }
          .cert-actions { display:none; }
          .certificate { box-shadow:none; }
        }
      `}</style>

      <div className="cert-page">
        <div className="cert-scroll">
          <div className="certificate">

            {/* LEFT RAIL — the event */}
            <aside className="rail">
              <div className="rail-accent" />
              <div className="rail-eyebrow">Assessment Event</div>
              <div className="rail-title">LMKR DevFest &rsquo;26</div>

              <div className="hosted-section">
                <div className="hosted-label">Hosted by</div>
                <a href="https://lmkr.com/" target="_blank" rel="noopener noreferrer" className="lmkr-logo"
                  dangerouslySetInnerHTML={{ __html: LMKR_SVG }} />
              </div>

              <div className="rail-meta">
                <span className="rail-label">Issued</span>
                <strong>{issued}</strong>
              </div>
            </aside>

            {/* MAIN FIELD — the credential */}
            <main className="main-field">
              <header className="field-header">
                <div className="cert-title">CERTIFICATE OF<br />PARTICIPATION</div>
                <div className="devfest-logo">
                  <div className="devfest-logo-inner" dangerouslySetInnerHTML={{ __html: DEVFEST_SVG }} />
                </div>
              </header>

              <div className="presentation-block">
                <div className="presented-to">This certificate is proudly presented to</div>
                <h1 className="candidate-name">{cert.recipientName || `@${cert.githubUsername}`}</h1>
                <div className="name-rule" />
                <div className="category-block">
                  <div className="category-label">Category</div>
                  <div className="category-value">{cert.category ?? "Participant"}</div>
                </div>
                <div className="attainment">
                  <p>In recognition of successfully completing the <span className="accent-bold">LMKR DEVFEST 2026</span> Coding Challenge and demonstrating excellence across four core competency areas.</p>
                </div>
              </div>

              <div className="spectrum">
                <div className="spectrum-label">Core Competencies</div>
                <div className="dimensions">
                  <div className="dim d40"><div className="bar bar-40" /><div className="dim-name">Diagnosis</div><div className="dim-weight">40 pts</div></div>
                  <div className="dim d30"><div className="bar bar-30" /><div className="dim-name">Design</div><div className="dim-weight">30 pts</div></div>
                  <div className="dim d20"><div className="bar bar-20" /><div className="dim-name">Communication</div><div className="dim-weight">20 pts</div></div>
                  <div className="dim d10"><div className="bar bar-10" /><div className="dim-name">Execution</div><div className="dim-weight">10 pts</div></div>
                </div>
                <div className="method-line">
                  Assessment conducted through the DevSimulate platform using automated code review, pull request analysis, hidden test-case validation, and a spoken defense of the solution.
                </div>
              </div>

              <footer className="field-footer">
                <div className="issuer-lockup">
                  <span className="devsim-mark" dangerouslySetInnerHTML={{ __html: DEVSIM_SVG }} />
                  <div>
                    <div className="issued-by">Assessed &amp; issued by</div>
                    <a href="https://www.devsimulate.com/" target="_blank" rel="noopener noreferrer" className="issuer-name">DevSimulate</a>
                  </div>
                </div>
                <a href={certUrl} target="_blank" rel="noopener noreferrer" className="verify">
                  <div className="cred-id">{credId}</div>
                  <div className="verify-url">{verifyDisplay}</div>
                </a>
              </footer>
            </main>

          </div>
        </div>

        {/* Actions */}
        <div className="cert-actions">
          <a href={linkedInUrl} target="_blank" rel="noreferrer" className="btn btn-linkedin">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Add to LinkedIn
          </a>
          <button onClick={onCopy} className="btn btn-copy">{copied ? "✓ Copied!" : "Copy Link"}</button>
          <button onClick={() => window.print()} className="btn btn-pdf">Save as PDF</button>
        </div>
      </div>
    </>
  );
}
