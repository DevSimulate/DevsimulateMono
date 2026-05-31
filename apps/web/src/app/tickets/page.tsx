"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/auth";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") +
    "/auth/callback"
  )}`;

const STACK_META: Record<string, { label: string; color: string; bg: string }> = {
  DOTNET:        { label: ".NET 8",              color: "#6366f1", bg: "#EEF2FF" },
  SYSTEM_DESIGN: { label: "Architecture",        color: "#5B5BD6", bg: "#EBEBFF" },
  PYTHON:        { label: "Python + LangChain",  color: "#92400E", bg: "#FEF3C7" },
  NODE:          { label: "Node.js + TypeScript", color: "#1D4ED8", bg: "#DBEAFE" },
  REACT:         { label: "React + TypeScript",  color: "#0369A1", bg: "#E0F2FE" },
};

interface Ticket {
  id: string;
  title: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  stack: string;
  description: string;
  filesInvolved: string[];
  expectedMinutes: number;
  codebase: { name: string; repoUrl: string; description: string };
}

const DIFF_COLOR: Record<string, string> = {
  JUNIOR: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  MID: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  SENIOR: "bg-red-500/10 text-red-400 border-red-500/20",
};

interface UsageData {
  used: number;
  limit: number | null;
  tier: string;
}

function TicketsList(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stack = searchParams.get("stack") ?? undefined;
  const codebaseId = searchParams.get("codebaseId") ?? undefined;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      const returnParams = new URLSearchParams();
      if (stack) returnParams.set("stack", stack);
      if (codebaseId) returnParams.set("codebaseId", codebaseId);
      localStorage.setItem("ds_submit_return", `/tickets${returnParams.size ? `?${returnParams}` : ""}`);
      window.location.href = GITHUB_AUTH_URL;
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    const headers = { Authorization: `Bearer ${token}` };
    const params = new URLSearchParams();
    if (stack) params.set("stack", stack);
    if (codebaseId) params.set("codebaseId", codebaseId);
    const ticketsUrl = `${apiUrl}/tickets${params.size ? `?${params}` : ""}`;

    Promise.all([
      axios.get<{ data: Ticket[] }>(ticketsUrl, { headers }),
      axios.get<{ data: UsageData }>(`${apiUrl}/billing/usage`, { headers }),
    ])
      .then(([ticketsRes, usageRes]) => {
        setTickets(ticketsRes.data.data);
        setUsage(usageRes.data.data);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [router, stack]);

  async function handleAssign(ticketId: string): Promise<void> {
    const token = getToken();
    if (!token) return;

    setAssigning(ticketId);
    setMsg(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    try {
      await axios.post(
        `${apiUrl}/tickets/${ticketId}/assign`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsg({ id: ticketId, text: "Ticket assigned! Head to your dashboard.", ok: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      const code = error.response?.data?.error;
      if (code === "FREE_TIER_LIMIT") {
        setMsg({ id: ticketId, text: "Free tier limit reached (2 tickets). Upgrade to Pro.", ok: false });
      } else {
        setMsg({ id: ticketId, text: "Failed to assign ticket.", ok: false });
      }
    } finally {
      setAssigning(null);
    }
  }

  const stackMeta = stack ? STACK_META[stack] : null;
  const codebaseName = tickets[0]?.codebase?.name ?? (stack ? stack : "All Codebases");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/onboarding/select" className="text-slate-400 hover:text-white text-sm">
          ← Choose codebase
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{codebaseName}</span>
          {stackMeta && (
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: stackMeta.bg, color: stackMeta.color }}
            >
              {stackMeta.label}
            </span>
          )}
        </div>
        <span className="text-slate-600 text-sm ml-auto">{tickets.length} tickets</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        {usage && usage.limit !== null && (
          <div className={`rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
            usage.used >= usage.limit
              ? "border-red-500/30 bg-red-500/10"
              : "border-slate-700 bg-slate-900"
          }`}>
            <div>
              <p className="text-sm font-bold text-white">
                {usage.used} of {usage.limit} free submissions used this month
              </p>
              {usage.used >= usage.limit && (
                <p className="text-xs text-slate-400 mt-0.5">You&apos;ve hit the free limit. Upgrade to Pro for unlimited tickets.</p>
              )}
            </div>
            {usage.used >= usage.limit ? (
              <Link href="/pricing" className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 text-sm transition-colors">
                Upgrade → $9/mo
              </Link>
            ) : (
              <span className="shrink-0 text-xs text-slate-500">{usage.limit - usage.used} remaining</span>
            )}
          </div>
        )}

        {tickets.length === 0 && (
          <div className="text-center text-slate-500 py-20">No tickets available.</div>
        )}

        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="rounded-xl border border-slate-800 bg-slate-900 p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${DIFF_COLOR[ticket.difficulty]}`}
                  >
                    {ticket.difficulty}
                  </span>
                  {ticket.stack === "SYSTEM_DESIGN" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      Architecture
                    </span>
                  )}
                  {ticket.stack === "PYTHON" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 border-amber-500/20">
                      Python
                    </span>
                  )}
                  {ticket.stack === "REACT" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border" style={{ background: "#E0F2FE", color: "#0369A1", borderColor: "#BAE6FD" }}>
                      React
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{ticket.codebase.name}</span>
                  <span className="text-xs text-slate-600">· {ticket.expectedMinutes} min</span>
                </div>
                <Link href={`/tickets/${ticket.id}`} className="font-bold text-white hover:text-cyan-400 transition-colors">
                  {ticket.title}
                </Link>
              </div>

              <div className="shrink-0 text-right">
                {msg?.id === ticket.id ? (
                  <p className={`text-xs mb-2 ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>
                    {msg.text}
                  </p>
                ) : null}
                {ticket.stack === "SYSTEM_DESIGN" ? (
                  <Link
                    href={`/submit?ticketId=${ticket.id}`}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 text-sm transition-colors inline-block"
                  >
                    Write Design →
                  </Link>
                ) : msg?.id === ticket.id && msg.ok ? (
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 text-sm transition-colors inline-block"
                  >
                    Go to Dashboard →
                  </Link>
                ) : ticket.stack === "PYTHON" ? (
                  <button
                    onClick={() => handleAssign(ticket.id)}
                    disabled={assigning === ticket.id}
                    className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold px-4 py-2 text-sm transition-colors"
                  >
                    {assigning === ticket.id ? "Assigning…" : "Assign to me"}
                  </button>
                ) : msg?.id === ticket.id && msg.ok ? (
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 text-sm transition-colors"
                  >
                    Go to Dashboard →
                  </Link>
                ) : (
                  <button
                    onClick={() => handleAssign(ticket.id)}
                    disabled={assigning === ticket.id}
                    className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold px-4 py-2 text-sm transition-colors"
                  >
                    {assigning === ticket.id ? "Assigning…" : "Assign to me"}
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-4 line-clamp-3">
              {ticket.description}
            </p>

            <div className="flex flex-wrap gap-2">
              {ticket.filesInvolved.map((f) => (
                <span
                  key={f}
                  className="text-xs rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-slate-400 font-mono"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

export default function TicketsPage(): React.ReactElement {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading…
      </div>
    }>
      <TicketsList />
    </Suspense>
  );
}
