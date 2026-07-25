import type { Metadata } from "next";
import { format } from "date-fns";
import { getPublicCertificate } from "@/lib/api";
import { tierForScore } from "@/components/ui/Badge";
import { LMKR_SVG, DEVFEST_SVG, DEVSIM_SVG } from "@/components/certificate/certBrand";
import { VerifyActions } from "@/components/certificate/VerifyActions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

const TIER_LABEL: Record<string, string> = {
  EXCEPTIONAL: "Exceptional",
  STRONG: "Strong",
  SOLID: "Solid",
  DEVELOPING: "Developing",
  NEEDS_WORK: "Needs work",
};

interface VerifyPageProps {
  params: Promise<{ credentialId: string }>;
}

function credentialIdFor(id: string, issuedAt: string): string {
  const year = new Date(issuedAt).getFullYear();
  return `DS-${year}-DF-${id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`;
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const { credentialId } = await params;
  const cert = await getPublicCertificate(credentialId);

  if (!cert) {
    return { title: "Certificate not found — DevSimulate" };
  }

  const tier = TIER_LABEL[tierForScore(cert.score)];
  const title = `${cert.recipientName} — ${tier} — Verified by DevSimulate`;
  const description = `${cert.recipientName} completed ${cert.campaignName} for ${cert.companyName}, verified by DevSimulate.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

export default async function VerifyPage({ params }: VerifyPageProps): Promise<React.ReactElement> {
  const { credentialId } = await params;
  const cert = await getPublicCertificate(credentialId);

  if (!cert) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-paper text-center px-6">
        <div className="font-display text-lg font-bold text-ink">Certificate not found</div>
        <div className="text-sm text-muted font-mono">ID: {credentialId}</div>
      </div>
    );
  }

  const tier = tierForScore(cert.score);
  const issued = format(new Date(cert.issuedAt), "MMMM d, yyyy");
  const credId = credentialIdFor(cert.id, cert.issuedAt);
  const verifyUrl = `${APP_URL}/verify/${cert.id}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap');

        .verify-page { --sidebar-bg:#195792; --main-bg:#E7E7E8; --accent-orange:#E86F24; --accent-blue:#13A8E0;
          --text-primary:#111111; --text-secondary:#195792; --hairline:#C4C9D4;
          min-height:100vh; display:flex; flex-direction:column; align-items:center; gap:26px;
          padding:36px 16px; background:#D0D2D6; font-family:'Tomorrow',sans-serif; }
        .verify-page * { box-sizing:border-box; margin:0; padding:0; }
        .verify-scroll { max-width:100%; overflow-x:auto; }

        .vcert { width:1123px; max-width:100%; background:var(--main-bg); color:var(--text-primary);
          position:relative; display:flex; box-shadow:0 24px 60px rgba(25,87,146,0.15); overflow:hidden; }

        .vrail { width:230px; flex-shrink:0; background:var(--sidebar-bg); color:var(--main-bg);
          padding:44px 30px 36px; display:flex; flex-direction:column; position:relative; }
        .vrail-accent { position:absolute; top:0; left:0; width:100%; height:4px; background:var(--accent-orange); }
        .vrail-eyebrow { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#FFF; font-weight:600; }
        .vrail-title { font-size:28px; font-weight:700; color:#FFF; margin-top:14px; line-height:1.2; }
        .vhosted { margin-top:34px; padding-top:22px; border-top:1px solid rgba(19,168,224,0.3); }
        .vhosted-label { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#FFF; font-weight:600; margin-bottom:16px; }
        .vlmkr-logo { width:56px; height:56px; }
        .vrail-meta { margin-top:auto; font-size:11px; line-height:1.9; color:rgba(231,231,232,0.8); }
        .vrail-meta .vrail-label { display:block; letter-spacing:0.18em; text-transform:uppercase; font-size:10px; margin-bottom:2px; }
        .vrail-meta strong { color:#FFF; font-weight:600; font-size:15px; }

        .vmain { flex:1; padding:48px 56px 40px 52px; display:flex; flex-direction:column; position:relative; min-width:0; }
        .vfield-header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
        .vcert-title { font-size:17px; letter-spacing:0.26em; text-transform:uppercase; color:var(--text-secondary);
          font-weight:700; border-left:3px solid var(--accent-orange); padding:2px 0 2px 12px; line-height:1.3; }
        .vdevfest-logo { display:flex; justify-content:flex-end; flex-shrink:0; }
        .vdevfest-logo-inner { height:80px; width:244px; }

        .vverified { display:inline-flex; align-items:center; gap:8px; margin-top:20px; padding:8px 14px;
          border-radius:999px; background:rgba(19,168,224,0.12); color:var(--text-secondary); font-weight:700;
          font-size:12px; letter-spacing:0.08em; text-transform:uppercase; width:fit-content; }
        .vpresentation { margin-top:32px; }
        .vpresented-to { font-size:11px; letter-spacing:0.05em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; }
        .vname { font-size:54px; font-weight:700; line-height:1.05; margin-top:8px; letter-spacing:-0.01em; color:var(--text-primary); }
        .vname-rule { width:88px; height:4px; background:var(--accent-orange); margin:16px 0 26px; }
        .vmeta-row { display:flex; gap:40px; margin-bottom:26px; flex-wrap:wrap; }
        .vmeta-block .vmeta-label { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; margin-bottom:6px; }
        .vmeta-block .vmeta-value { font-size:20px; font-weight:700; color:var(--accent-orange); letter-spacing:-0.01em; }
        .vtier-value { font-size:20px; font-weight:700; color:var(--text-primary); }

        .vspectrum { margin-top:auto; padding-top:26px; border-top:1px solid var(--hairline); }
        .vspectrum-label { font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:var(--text-secondary); margin-bottom:14px; font-weight:600; }
        .vdimensions { display:flex; width:100%; }
        .vdim { padding-right:18px; } .vdim:last-child { padding-right:0; }
        .vdim.d40 { width:40%; } .vdim.d30 { width:30%; } .vdim.d20 { width:20%; } .vdim.d10 { width:10%; }
        .vbar { height:5px; background:var(--accent-blue); margin-bottom:9px; border-radius:0 2px 2px 0; }
        .vbar-40 { opacity:1; } .vbar-30 { opacity:0.8; } .vbar-20 { opacity:0.6; } .vbar-10 { opacity:0.4; }
        .vdim-name { font-size:13px; font-weight:600; color:var(--text-primary); }
        .vdim-weight { font-size:10.5px; color:var(--text-secondary); margin-top:2px; opacity:0.8; }
        .vmethod-line { margin-top:16px; font-size:12px; color:var(--text-primary); opacity:0.8; line-height:1.6; }

        .vfield-footer { margin-top:24px; padding-top:20px; border-top:1px solid var(--hairline);
          display:flex; align-items:flex-end; justify-content:space-between; gap:20px; }
        .vissuer-lockup { display:flex; align-items:center; gap:11px; }
        .vdevsim-mark { width:40px; height:40px; flex-shrink:0; }
        .vissued-by { font-size:9.5px; letter-spacing:0.18em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; }
        .vissuer-name { font-size:17px; font-weight:700; color:var(--text-primary); margin-top:2px; display:block; }
        .vcred { text-align:right; font-size:11px; line-height:1.8; }
        .vcred-id { color:var(--text-primary); font-weight:700; }

        @media (max-width:1180px){ .verify-scroll { width:100%; } }
      `}</style>

      <div className="verify-page">
        <div className="verify-scroll">
          <div className="vcert">
            <aside className="vrail">
              <div className="vrail-accent" />
              <div className="vrail-eyebrow">Assessment event</div>
              <div className="vrail-title">{cert.branding.brandName ?? cert.companyName}</div>

              <div className="vhosted">
                <div className="vhosted-label">Hosted by</div>
                <span className="vlmkr-logo" dangerouslySetInnerHTML={{ __html: LMKR_SVG }} />
              </div>

              <div className="vrail-meta">
                <span className="vrail-label">Issued</span>
                <strong>{issued}</strong>
              </div>
            </aside>

            <main className="vmain">
              <header className="vfield-header">
                <div className="vcert-title">CERTIFICATE<br />VERIFICATION</div>
                <div className="vdevfest-logo">
                  <div className="vdevfest-logo-inner" dangerouslySetInnerHTML={{ __html: DEVFEST_SVG }} />
                </div>
              </header>

              <div className="vverified">✓ Verified by DevSimulate</div>

              <div className="vpresentation">
                <div className="vpresented-to">This credential was issued to</div>
                <h1 className="vname">{cert.recipientName || `@${cert.githubUsername}`}</h1>
                <div className="vname-rule" />

                <div className="vmeta-row">
                  <div className="vmeta-block">
                    <div className="vmeta-label">Track</div>
                    <div className="vmeta-value">{cert.category ?? cert.campaignName}</div>
                  </div>
                  <div className="vmeta-block">
                    <div className="vmeta-label">Tier</div>
                    <div className="vtier-value">{TIER_LABEL[tier]}</div>
                  </div>
                  <div className="vmeta-block">
                    <div className="vmeta-label">Date</div>
                    <div className="vtier-value">{issued}</div>
                  </div>
                </div>
              </div>

              <div className="vspectrum">
                <div className="vspectrum-label">Core competencies assessed</div>
                <div className="vdimensions">
                  <div className="vdim d40"><div className="vbar vbar-40" /><div className="vdim-name">Diagnosis</div><div className="vdim-weight">40 pts</div></div>
                  <div className="vdim d30"><div className="vbar vbar-30" /><div className="vdim-name">Design</div><div className="vdim-weight">30 pts</div></div>
                  <div className="vdim d20"><div className="vbar vbar-20" /><div className="vdim-name">Communication</div><div className="vdim-weight">20 pts</div></div>
                  <div className="vdim d10"><div className="vbar vbar-10" /><div className="vdim-name">Execution</div><div className="vdim-weight">10 pts</div></div>
                </div>
                <div className="vmethod-line">
                  Assessment conducted through the DevSimulate platform using automated code review, pull request
                  analysis, hidden test-case validation, and a spoken defense of the solution. Full itemised scores
                  are available to the candidate and the hiring team only.
                </div>
              </div>

              <footer className="vfield-footer">
                <div className="vissuer-lockup">
                  <span className="vdevsim-mark" dangerouslySetInnerHTML={{ __html: DEVSIM_SVG }} />
                  <div>
                    <div className="vissued-by">Assessed &amp; issued by</div>
                    <span className="vissuer-name">DevSimulate</span>
                  </div>
                </div>
                <div className="vcred">
                  <div className="vcred-id">{credId}</div>
                </div>
              </footer>
            </main>
          </div>
        </div>

        <VerifyActions url={verifyUrl} />
      </div>
    </>
  );
}
