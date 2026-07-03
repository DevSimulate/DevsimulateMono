"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BoltIcon } from "@/components/Logo";
import { format } from "date-fns";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
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

function medal(rank: number | null) {
  if (!rank) return null;
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function CertificatePage() {
  const { id } = useParams<{ id: string }>();
  const [cert, setCert]     = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    fetch(`${API}/certificates/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setCert(j.data); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#555" }}>
        Loading…
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#888" }}>
        Certificate not found.
      </div>
    );
  }

  const { branding } = cert;
  const primary  = branding.primaryColor;
  const accent   = branding.accentColor;
  const certUrl  = `${APP_URL}/certificate/${cert.id}`;
  const issued   = format(new Date(cert.issuedAt), "MMMM yyyy");

  // LinkedIn "Add to Profile" deep link
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
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .cert-card { box-shadow: none !important; border: 2px solid #e5e7eb !important; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 no-print"
        style={{ background: "#0a0a0a" }}>

        {/* Certificate card */}
        <div className="cert-card w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{ background: "#ffffff", boxShadow: `0 0 0 1px ${primary}44, 0 24px 80px ${primary}22` }}>

          {/* Top accent bar */}
          <div className="h-2" style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }} />

          <div className="p-10 text-center">
            {/* Logos */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt={branding.brandName} className="h-10 object-contain" />
                ) : (
                  <span className="font-black text-lg" style={{ color: primary }}>{branding.brandName}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 opacity-50">
                <BoltIcon size={16} />
                <span className="text-xs font-bold text-gray-500">DevSimulate</span>
              </div>
            </div>

            {/* Certificate heading */}
            <div className="text-xs font-bold uppercase tracking-[0.25em] mb-3" style={{ color: primary }}>
              Certificate of Achievement
            </div>
            <div className="text-sm text-gray-400 mb-2">This certifies that</div>

            {/* Participant */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <img
                src={`https://github.com/${cert.githubUsername}.png?size=64`}
                alt={cert.githubUsername}
                className="w-14 h-14 rounded-full"
                style={{ border: `3px solid ${primary}` }}
              />
            </div>
            <div className="text-3xl font-black mb-1" style={{ color: "#111827" }}>
              {cert.githubUsername}
            </div>
            <div className="text-sm text-gray-400 mb-6">successfully completed</div>

            {/* Campaign name */}
            <div className="inline-block px-5 py-2 rounded-full text-sm font-bold text-white mb-6"
              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
              {branding.brandName} — {cert.campaignName}
            </div>

            {/* Score + Rank */}
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: primary }}>{cert.score}</div>
                <div className="text-xs text-gray-400 mt-1">out of 100</div>
              </div>
              {cert.rank && (
                <div className="w-px h-12 bg-gray-200" />
              )}
              {cert.rank && (
                <div className="text-center">
                  <div className="text-4xl font-black" style={{ color: accent }}>{medal(cert.rank)}</div>
                  <div className="text-xs text-gray-400 mt-1">Final Rank</div>
                </div>
              )}
            </div>

            {/* Date + ID */}
            <div className="text-xs text-gray-400 mb-8">
              Issued {issued} · Certificate ID: <span className="font-mono">{cert.id}</span>
            </div>

            {/* Bottom accent bar */}
            <div className="h-px mb-8" style={{ background: `linear-gradient(90deg, transparent, ${primary}44, transparent)` }} />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 no-print">
              {/* Add to LinkedIn */}
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-bold text-white"
                style={{ background: "#0A66C2" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Add to LinkedIn
              </a>

              {/* Copy link */}
              <button onClick={copyLink}
                className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold"
                style={{ background: "#f3f4f6", color: "#111827" }}>
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>

              {/* Print / Save PDF */}
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold"
                style={{ background: "#f3f4f6", color: "#111827" }}>
                Save as PDF
              </button>
            </div>
          </div>

          {/* Bottom accent bar */}
          <div className="h-2" style={{ background: `linear-gradient(90deg, ${accent}, ${primary})` }} />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1.5 mt-6">
          <BoltIcon size={14} />
          <span className="text-xs" style={{ color: "#555" }}>
            Verified by <span className="font-bold" style={{ color: "#888" }}>DevSimulate</span>
          </span>
        </div>
      </div>
    </>
  );
}
