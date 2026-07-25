"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";
import { EdgeBanner } from "@/components/EdgeBanner";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email,public_repo` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") + "/auth/callback"
  )}`;

interface Branding {
  logoUrl:      string | null;
  primaryColor: string;
  accentColor:  string;
  brandName:    string;
}

interface CampaignInfo {
  id: string;
  roleName: string;
  companyName: string;
  difficulty: string;
  type?: "HIRING" | "CONTEST";
  codebase: { name: string; description: string };
  branding: Branding;
}

interface AssignedTicket {
  id: string;
  title: string;
  difficulty: string;
  expectedMinutes: number;
}

const DEFAULT_BRANDING: Branding = {
  logoUrl: null,
  primaryColor: "#0B7A5E",
  accentColor: "#0B7A5E",
  brandName: "DevSimulate",
};

const STAGES = ["Work", "Write-up", "Follow-up", "Verbal defence", "Result"];

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [ticket, setTicket]     = useState<AssignedTicket | null>(null);
  const [loading, setLoading]   = useState(true);
  const [joining, setJoining]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [authed, setAuthed]     = useState(false);
  const [fullName, setFullName] = useState("");

  const branding: Branding = campaign?.branding ?? DEFAULT_BRANDING;

  useEffect(() => {
    setAuthed(!!getToken());
    fetch(`${API}/employer/campaigns/apply/${slug}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setCampaign(j.data); else setError(j.error ?? "Campaign not found"); })
      .catch(() => setError("Failed to load campaign"))
      .finally(() => setLoading(false));
  }, [slug]);

  // Capture the emailed invitation token up front. GitHub OAuth round-trips and
  // drops the query string, so it's stashed locally and replayed on join — that's
  // what ties this person back to their row in the recruiter's candidate list.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("invite");
    if (t) localStorage.setItem(`ds_invite:${slug}`, t);
  }, [slug]);

  function signIn() {
    localStorage.setItem("ds_submit_return", `/apply/${slug}`);
    window.location.href = GITHUB_AUTH_URL;
  }

  async function join() {
    if (!fullName.trim()) { setError("Please enter your full name before joining."); return; }
    setJoining(true);
    setError(null);
    const token = getToken();
    const inviteToken = localStorage.getItem(`ds_invite:${slug}`);
    try {
      const res = await fetch(`${API}/employer/campaigns/apply/${slug}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          ...(inviteToken ? { inviteToken } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to join");
      localStorage.removeItem(`ds_invite:${slug}`);
      setTicket(json.data.ticket);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join campaign");
    } finally {
      setJoining(false);
    }
  }

  const totalMinutes = campaign?.difficulty === "SENIOR" ? 90 : 45;

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">Loading…</div>;
  }

  if (error && !campaign) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-center px-6">
        <div>
          <div className="font-display text-lg font-bold text-ink mb-2">Campaign unavailable</div>
          <div className="text-sm text-muted">{error}</div>
        </div>
      </div>
    );
  }

  // Ticket assigned confirmation
  if (ticket) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded border border-hairline bg-surface p-8 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-weak">
            <Check size={28} className="text-emerald" />
          </div>
          <h1 className="font-display text-xl font-bold text-ink mb-1">You&apos;re in</h1>
          <p className="text-sm mb-6 text-muted">
            Your ticket for {campaign?.companyName} is assigned. Open it in VS Code to start.
          </p>
          <div className="rounded border border-hairline bg-paper p-4 mb-6 text-left">
            <div className="text-xs uppercase tracking-wide mb-1.5 text-muted">Your ticket</div>
            <div className="text-sm font-semibold text-ink mb-1">{ticket.title}</div>
            <div className="text-xs font-mono text-muted">{ticket.difficulty} · ~{ticket.expectedMinutes} min</div>
          </div>
          <a href="/dashboard" className="block">
            <Button variant="primary" size="lg" className="w-full" style={{ background: branding.primaryColor, borderColor: branding.primaryColor }}>
              Go to dashboard <ArrowRight size={15} className="ml-1" />
            </Button>
          </a>
        </div>
      </div>
    );
  }

  // Campaign landing
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 py-10">
      <EdgeBanner />
      <div className="max-w-md w-full">
        <div className="rounded border border-hairline bg-surface p-8">
          {/* Logo + status badge */}
          <div className="flex items-center justify-between mb-6">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={branding.brandName} className="h-14 w-14 rounded object-contain bg-paper" />
            ) : (
              <div
                className="w-16 h-16 rounded flex items-center justify-center text-lg font-display font-bold border"
                style={{ background: branding.primaryColor + "14", borderColor: branding.primaryColor + "40", color: branding.primaryColor }}
              >
                {campaign?.companyName?.slice(0, 4).toUpperCase()}
              </div>
            )}
            <Badge tone="good">
              {campaign?.type === "CONTEST" ? "Contest is live" : "Now accepting candidates"}
            </Badge>
          </div>

          <div
            className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-3"
            style={{ background: branding.primaryColor + "14", color: branding.primaryColor }}
          >
            {campaign?.type === "CONTEST" ? `${campaign?.companyName} DevFest` : `${campaign?.companyName} is hiring`}
          </div>

          <h1 className="font-display text-2xl font-bold text-ink mb-2">{campaign?.roleName}</h1>
          <p className="text-sm leading-relaxed mb-5 text-muted">
            {campaign?.type === "CONTEST" ? (
              <>Solve a real coding challenge, get AI-scored, and climb the live leaderboard. Top of your stack wins.</>
            ) : (
              <>Complete a real coding ticket. An AI model scores your work and {campaign?.companyName} reviews top performers for interviews.</>
            )}
          </p>

          {/* The fairness promise — the hero of this page */}
          <div className="rounded border border-emerald bg-emerald-weak px-5 py-4 mb-5 text-center">
            <p className="font-display text-lg font-semibold leading-snug text-emerald">
              A tooling failure never costs you points.
            </p>
          </div>

          {/* Stages ahead */}
          <div className="mb-5">
            <div className="text-xs uppercase tracking-wide text-muted mb-2">What&apos;s ahead</div>
            <div className="flex items-center flex-wrap gap-x-1 gap-y-2 text-xs font-medium text-ink">
              {STAGES.map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted">→</span>}
                  <span className="rounded-full border border-hairline px-2.5 py-1">{s}</span>
                </span>
              ))}
            </div>
          </div>

          {/* AI policy, stated plainly */}
          <div className="rounded border border-hairline px-4 py-3 mb-5 text-xs text-muted leading-relaxed">
            AI tools are allowed while you code. They&apos;re locked during the defence — that part is you.
          </div>

          {/* Ticket preview */}
          <div className="rounded border border-hairline bg-paper p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wide text-muted">You&apos;ll solve</div>
              <Badge tone={campaign?.difficulty === "SENIOR" ? "bad" : campaign?.difficulty === "MID" ? "warn" : "good"}>
                {campaign?.difficulty}
              </Badge>
            </div>
            <div className="text-sm font-semibold text-ink mb-1">{campaign?.codebase.name}</div>
            <div className="text-xs leading-relaxed text-muted">{campaign?.codebase.description}</div>
          </div>

          {error && (
            <div className="rounded border border-red bg-red-weak px-3 py-2 mb-4 text-xs text-red">{error}</div>
          )}

          {authed ? (
            <>
              <div className="mb-3">
                <label className="block text-xs font-semibold mb-1.5 text-muted">
                  Your full name <span className="text-red">*</span>
                  <span className="font-normal ml-1">(appears on your certificate)</span>
                </label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sarah Ahmed"
                  onKeyDown={(e) => e.key === "Enter" && join()}
                />
              </div>
              <Button
                variant="primary" size="lg" className="w-full"
                onClick={join} disabled={joining}
                style={{ background: branding.primaryColor, borderColor: branding.primaryColor }}
              >
                {joining ? "Assigning your ticket…" : <>Join campaign <ArrowRight size={15} className="ml-1" /></>}
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="lg" className="w-full" onClick={signIn}>
              Sign in with GitHub to apply
            </Button>
          )}
          <p className="text-xs text-center mt-3 text-muted">
            Free · No credit card · ~{totalMinutes} min total
          </p>
        </div>

        {/* Powered by footer */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <BoltIcon size={14} />
          <span className="text-xs text-muted">Powered by <span className="font-semibold">DevSimulate</span></span>
        </div>
      </div>
    </div>
  );
}
