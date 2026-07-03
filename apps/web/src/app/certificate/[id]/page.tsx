"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";

const API     = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface CertData {
  id:             string;
  githubUsername: string;
  campaignName:   string;
  companyName:    string;
  score:          number;
  rank:           number | null;
  issuedAt:       string;
  branding: {
    logoUrl:      string | null;
    primaryColor: string;
    accentColor:  string;
    brandName:    string;
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
        if (j.data) {
          setCert(j.data);
        } else {
          setError(j.error ?? "Certificate not found");
        }
      })
      .catch((err) => setError(err?.message ?? "Failed to load certificate"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f0e8", fontFamily: "Georgia, serif", color: "#555" }}>
        Loading…
      </div>
    );
  }

  if (!cert) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", background: "#f5f0e8", fontFamily: "Georgia, serif", color: "#888" }}>
        <div>{error ?? "Certificate not found."}</div>
        {error && <div style={{ fontSize: "12px", color: "#bbb" }}>ID: {id}</div>}
      </div>
    );
  }

  const { branding } = cert;
  const navy    = "#1B2A4A";
  const gold    = "#C5963A";
  const certUrl = `${APP_URL}/certificate/${cert.id}`;
  const issued  = format(new Date(cert.issuedAt), "MMMM d, yyyy");

  const linkedInUrl = [
    "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME",
    `&name=${encodeURIComponent(`${branding.brandName} — ${cert.campaignName}`)}`,
    `&issueYear=${new Date(cert.issuedAt).getFullYear()}`,
    `&issueMonth=${new Date(cert.issuedAt).getMonth() + 1}`,
    `&certUrl=${encodeURIComponent(certUrl)}`,
    `&certId=${encodeURIComponent(cert.id)}`,
  ].join("");

  function copyLink() {
    navigator.clipboard.writeText(certUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Cinzel:wght@400;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #f0ebe0; }

        .cert-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: #f0ebe0;
          font-family: 'EB Garamond', Georgia, 'Times New Roman', serif;
        }

        .cert-wrap {
          width: 100%;
          max-width: 860px;
          position: relative;
        }

        /* Outer border */
        .cert-card {
          background: #FDFCF7;
          border: 3px solid ${navy};
          padding: 10px;
          position: relative;
        }

        /* Inner border */
        .cert-inner {
          border: 1.5px solid ${gold};
          padding: 10px;
          position: relative;
        }

        /* Second inner line */
        .cert-body {
          border: 1px solid ${navy}22;
          padding: 48px 56px 40px;
          position: relative;
          text-align: center;
        }

        /* Corner ornaments */
        .corner {
          position: absolute;
          width: 28px;
          height: 28px;
          color: ${gold};
          font-size: 22px;
          line-height: 1;
        }
        .corner-tl { top: -2px;  left: -2px; }
        .corner-tr { top: -2px;  right: -2px; transform: scaleX(-1); }
        .corner-bl { bottom: -2px; left: -2px; transform: scaleY(-1); }
        .corner-br { bottom: -2px; right: -2px; transform: scale(-1); }

        /* Top logo row */
        .cert-logos {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        .cert-org-logo {
          height: 40px;
          object-fit: contain;
        }

        .cert-org-initials {
          font-family: 'Cinzel', serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: ${navy};
        }

        .cert-powered {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #999;
          font-family: 'Cinzel', serif;
        }

        /* Gold divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 auto 24px;
          max-width: 480px;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, ${gold}, transparent);
        }
        .divider-diamond {
          width: 6px;
          height: 6px;
          background: ${gold};
          transform: rotate(45deg);
          flex-shrink: 0;
        }

        /* Headings */
        .cert-title {
          font-family: 'Cinzel', serif;
          font-size: 11px;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: ${gold};
          margin-bottom: 16px;
        }

        .cert-presents {
          font-family: 'EB Garamond', serif;
          font-size: 17px;
          font-style: italic;
          color: #5a5a5a;
          margin-bottom: 8px;
        }

        /* Recipient name */
        .cert-name {
          font-family: 'Cinzel', serif;
          font-size: 38px;
          font-weight: 700;
          color: ${navy};
          letter-spacing: 0.04em;
          line-height: 1.15;
          margin-bottom: 20px;
          border-bottom: 2px solid ${navy}22;
          padding-bottom: 16px;
        }

        .cert-body-text {
          font-size: 17px;
          color: #444;
          line-height: 1.7;
          margin-bottom: 10px;
        }

        .cert-campaign {
          font-family: 'Cinzel', serif;
          font-size: 16px;
          font-weight: 600;
          color: ${navy};
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .cert-org-name {
          font-size: 15px;
          font-style: italic;
          color: #666;
          margin-bottom: 28px;
        }

        /* Score row */
        .cert-scores {
          display: flex;
          align-items: stretch;
          justify-content: center;
          gap: 0;
          margin: 0 auto 28px;
          max-width: 360px;
          border: 1px solid ${navy}22;
        }

        .cert-score-block {
          flex: 1;
          padding: 14px 20px;
          text-align: center;
        }

        .cert-score-block + .cert-score-block {
          border-left: 1px solid ${navy}22;
        }

        .cert-score-value {
          font-family: 'Cinzel', serif;
          font-size: 28px;
          font-weight: 700;
          color: ${navy};
          line-height: 1;
          margin-bottom: 4px;
        }

        .cert-score-label {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #999;
        }

        /* Seal */
        .cert-seal {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 2px solid ${gold};
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex-direction: column;
          gap: 2px;
        }

        .cert-seal::before {
          content: '';
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          border: 1px solid ${gold}88;
        }

        .cert-seal-text {
          font-family: 'Cinzel', serif;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: ${gold};
          text-transform: uppercase;
          text-align: center;
          line-height: 1.4;
          position: relative;
          z-index: 1;
          padding: 0 4px;
        }

        /* Signatures */
        .cert-sig-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid ${navy}22;
        }

        .cert-sig {
          text-align: center;
          flex: 1;
        }

        .cert-sig + .cert-sig {
          border-left: none;
        }

        .cert-sig-line {
          width: 140px;
          height: 1px;
          background: ${navy}55;
          margin: 0 auto 6px;
        }

        .cert-sig-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #999;
        }

        .cert-sig-name {
          font-size: 13px;
          font-style: italic;
          color: #555;
          margin-bottom: 2px;
        }

        /* Footer */
        .cert-footer {
          text-align: center;
          margin-top: 18px;
        }

        .cert-id {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: #bbb;
          letter-spacing: 0.08em;
        }

        /* Actions bar — hidden on print */
        .cert-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 28px;
          flex-wrap: wrap;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          text-decoration: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: 0.02em;
          transition: opacity 0.15s;
        }
        .btn:hover { opacity: 0.88; }

        .btn-linkedin { background: #0A66C2; color: white; }
        .btn-copy    { background: #1B2A4A; color: white; }
        .btn-pdf     { background: #f0ebe0; color: #1B2A4A; border: 1px solid #1B2A4A44; }

        @media print {
          .cert-actions { display: none !important; }
          .cert-page    { background: white; padding: 0; }
          .cert-card    { box-shadow: none; }
          body          { background: white; }
        }
      `}</style>

      <div className="cert-page">
        <div className="cert-wrap">
          <div className="cert-card">
            <div className="cert-inner">
              {/* Corner ornaments */}
              <span className="corner corner-tl">✦</span>
              <span className="corner corner-tr">✦</span>
              <span className="corner corner-bl">✦</span>
              <span className="corner corner-br">✦</span>

              <div className="cert-body">

                {/* Logo row */}
                <div className="cert-logos">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={branding.brandName} className="cert-org-logo" />
                  ) : (
                    <span className="cert-org-initials">{branding.brandName.toUpperCase()}</span>
                  )}
                  <span className="cert-powered">Verified by DevSimulate</span>
                </div>

                {/* Title */}
                <div className="cert-title">Certificate of Achievement</div>

                <div className="divider">
                  <div className="divider-line" />
                  <div className="divider-diamond" />
                  <div className="divider-line" />
                </div>

                <div className="cert-presents">This is to certify that</div>

                {/* Recipient */}
                <div className="cert-name">{cert.githubUsername}</div>

                <div className="cert-body-text">
                  has successfully demonstrated excellence in
                </div>

                <div className="cert-campaign">{cert.campaignName}</div>
                <div className="cert-org-name">conducted by {branding.brandName}</div>

                <div className="divider" style={{ marginBottom: 24 }}>
                  <div className="divider-line" />
                  <div className="divider-diamond" />
                  <div className="divider-line" />
                </div>

                {/* Score blocks */}
                <div className="cert-scores">
                  <div className="cert-score-block">
                    <div className="cert-score-value">{cert.score}<span style={{ fontSize: 14 }}>/100</span></div>
                    <div className="cert-score-label">Score Achieved</div>
                  </div>
                  {cert.rank && (
                    <div className="cert-score-block">
                      <div className="cert-score-value">#{cert.rank}</div>
                      <div className="cert-score-label">Final Rank</div>
                    </div>
                  )}
                </div>

                {/* Seal */}
                <div className="cert-seal">
                  <div className="cert-seal-text">
                    DEV<br />SIMULATE<br />VERIFIED
                  </div>
                </div>

                {/* Signature row */}
                <div className="cert-sig-row">
                  <div className="cert-sig">
                    <div className="cert-sig-name" style={{ fontFamily: "'EB Garamond', serif", fontSize: 18, color: "#1B2A4A" }}>
                      {branding.brandName}
                    </div>
                    <div className="cert-sig-line" />
                    <div className="cert-sig-label">Issuing Organisation</div>
                  </div>
                  <div className="cert-sig" style={{ flex: "0 0 auto", padding: "0 32px" }}>
                    <div style={{ width: 56, height: 56, border: `2px solid ${gold}`, borderRadius: "50%", margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 22 }}>✦</span>
                    </div>
                  </div>
                  <div className="cert-sig">
                    <div className="cert-sig-name">{issued}</div>
                    <div className="cert-sig-line" />
                    <div className="cert-sig-label">Date of Issue</div>
                  </div>
                </div>

                {/* Certificate ID */}
                <div className="cert-footer" style={{ marginTop: 16 }}>
                  <div className="cert-id">Certificate ID: {cert.id}</div>
                </div>

              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="cert-actions">
            <a href={linkedInUrl} target="_blank" rel="noreferrer" className="btn btn-linkedin">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Add to LinkedIn
            </a>
            <button onClick={copyLink} className="btn btn-copy">
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
            <button onClick={() => window.print()} className="btn btn-pdf">
              Save as PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
