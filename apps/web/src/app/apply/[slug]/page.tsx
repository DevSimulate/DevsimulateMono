"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { BoltIcon } from "@/components/Logo";
import { Check, ArrowRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") + "/auth/callback"
  )}`;

interface CampaignInfo {
  id: string;
  roleName: string;
  companyName: string;
  difficulty: string;
  codebase: { name: string; description: string };
}

interface AssignedTicket {
  id: string;
  title: string;
  difficulty: string;
  expectedMinutes: number;
}

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [ticket, setTicket] = useState<AssignedTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
    fetch(`${API}/employer/campaigns/apply/${slug}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setCampaign(j.data); else setError(j.error ?? "Campaign not found"); })
      .catch(() => setError("Failed to load campaign"))
      .finally(() => setLoading(false));
  }, [slug]);

  function signIn() {
    localStorage.setItem("ds_submit_return", `/apply/${slug}`);
    window.location.href = GITHUB_AUTH_URL;
  }

  async function join() {
    setJoining(true);
    setError(null);
    const token = getToken();
    try {
      const res = await fetch(`${API}/employer/campaigns/apply/${slug}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to join");
      setTicket(json.data.ticket);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join campaign");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#888" }}>Loading…</div>;
  }

  if (error && !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6" style={{ background: "#0a0a0a" }}>
        <div>
          <div className="text-lg font-bold text-white mb-2">Campaign unavailable</div>
          <div className="text-sm" style={{ color: "#888" }}>{error}</div>
        </div>
      </div>
    );
  }

  // Ticket assigned confirmation
  if (ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
        <div className="max-w-md w-full rounded-2xl p-8 text-center" style={{ background: "#111111", border: "1px solid #222222" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#052e16" }}>
            <Check size={28} style={{ color: "#4ade80" }} />
          </div>
          <h1 className="text-xl font-black text-white mb-1">You&apos;re in!</h1>
          <p className="text-sm mb-6" style={{ color: "#888" }}>
            Your ticket for {campaign?.companyName} is assigned. Open it in VS Code to start.
          </p>
          <div className="rounded-lg p-4 mb-6 text-left" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
            <div className="text-xs uppercase tracking-widest mb-1.5" style={{ color: "#555" }}>Your Ticket</div>
            <div className="text-sm font-bold text-white mb-1">{ticket.title}</div>
            <div className="text-xs" style={{ color: "#888" }}>{ticket.difficulty} · ~{ticket.expectedMinutes} min</div>
          </div>
          <a href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
            Go to Dashboard <ArrowRight size={15} />
          </a>
        </div>
      </div>
    );
  }

  // Campaign landing
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0a0a0a" }}>
      <div className="max-w-md w-full">
        <div className="rounded-2xl p-8" style={{ background: "#111111", border: "1px solid #222222" }}>
          {/* Company logo placeholder + accepting badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-lg font-black"
              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888" }}>
              {campaign?.companyName?.slice(0, 4).toUpperCase()}
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: "#052e16", color: "#4ade80", border: "1px solid #166534" }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#4ade80" }} />
              Now Accepting Candidates
            </span>
          </div>

          <div className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-3"
            style={{ background: "#1e1b4b", color: "#818cf8" }}>
            {campaign?.companyName} is hiring
          </div>

          <h1 className="text-2xl font-black text-white mb-2">{campaign?.roleName}</h1>
          <p className="text-sm leading-relaxed mb-5" style={{ color: "#aaaaaa" }}>
            Complete a real coding ticket. Claude AI scores your work and{" "}
            {campaign?.companyName} reviews top performers for interviews.
          </p>

          {/* Ticket preview */}
          <div className="rounded-lg p-4 mb-5" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-widest" style={{ color: "#555" }}>You&apos;ll Solve</div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: campaign?.difficulty === "SENIOR" ? "#450a0a" : campaign?.difficulty === "MID" ? "#451a03" : "#052e16",
                  color: campaign?.difficulty === "SENIOR" ? "#f87171" : campaign?.difficulty === "MID" ? "#fbbf24" : "#4ade80",
                }}>
                {campaign?.difficulty}
              </span>
            </div>
            <div className="text-sm font-bold text-white mb-1">{campaign?.codebase.name}</div>
            <div className="text-xs leading-relaxed" style={{ color: "#888" }}>{campaign?.codebase.description}</div>
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 mb-4 text-xs" style={{ background: "#1c0000", color: "#f87171" }}>{error}</div>
          )}

          {authed ? (
            <button onClick={join} disabled={joining}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>
              {joining ? "Assigning your ticket…" : <>Join Campaign <ArrowRight size={15} /></>}
            </button>
          ) : (
            <button onClick={signIn}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-bold text-white"
              style={{ background: "#24292e" }}>
              Sign in with GitHub to Apply
            </button>
          )}
          <p className="text-xs text-center mt-3" style={{ color: "#555" }}>
            Free · No credit card · ~{campaign?.difficulty === "SENIOR" ? "90" : "45"} min
          </p>
        </div>

        {/* Powered by footer */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <BoltIcon size={14} />
          <span className="text-xs" style={{ color: "#555" }}>Powered by <span className="font-bold" style={{ color: "#888" }}>DevSimulate</span></span>
        </div>
      </div>
    </div>
  );
}
