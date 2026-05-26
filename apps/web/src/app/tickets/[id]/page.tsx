"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import { getToken } from "@/lib/auth";

interface Ticket {
  id: string;
  title: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  description: string;
  filesInvolved: string[];
  expectedMinutes: number;
  stack: string;
  rubric: { diagnosis: string; design: string; communication: string; execution: string };
  codebase: { name: string; repoUrl: string; companyLore: string };
}

const DIFF_COLOR: Record<string, string> = {
  JUNIOR: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  MID: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  SENIOR: "bg-red-500/10 text-red-400 border-red-500/20",
};

const RUBRIC_ITEMS = [
  { key: "diagnosis", label: "Diagnosis", max: 40, desc: "Did you identify the root cause, not just the symptom?" },
  { key: "design", label: "Design", max: 30, desc: "Is the solution robust, maintainable and well-considered?" },
  { key: "communication", label: "Communication", max: 20, desc: "Did you explain your reasoning clearly in the PR description?" },
  { key: "execution", label: "Execution", max: 10, desc: "Does the code actually fix the problem?" },
] as const;

export default function TicketDetailPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/"); return; }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    axios
      .get<{ data: Ticket }>(`${apiUrl}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setTicket(r.data.data))
      .catch(() => router.push("/tickets"))
      .finally(() => setLoading(false));
  }, [router, ticketId]);

  async function handleAssign(): Promise<void> {
    const token = getToken();
    if (!token || !ticket) return;

    setAssigning(true);
    setError(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    try {
      await axios.post(
        `${apiUrl}/tickets/${ticket.id}/assign`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssigned(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const code = e.response?.data?.error;
      setError(code === "FREE_TIER_LIMIT"
        ? "Free tier limit reached (2 tickets). Upgrade to Pro to continue."
        : "Failed to assign ticket. You may already have it assigned."
      );
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading…</div>;
  }

  if (!ticket) return <></>;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/tickets" className="text-slate-400 hover:text-white text-sm">← Tickets</Link>
        <span className="font-bold text-white">{ticket.title}</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Title + assign */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${DIFF_COLOR[ticket.difficulty]}`}>
                {ticket.difficulty}
              </span>
              <span className="text-xs text-slate-500">{ticket.codebase.name}</span>
              <span className="text-xs text-slate-600">· {ticket.stack}</span>
              <span className="text-xs text-slate-600">· {ticket.expectedMinutes} min</span>
            </div>
            <h1 className="text-2xl font-black text-white">{ticket.title}</h1>
          </div>

          <div className="shrink-0">
            {assigned ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2.5 text-sm transition-colors block"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold px-5 py-2.5 text-sm transition-colors"
              >
                {assigning ? "Assigning…" : "Assign to me"}
              </button>
            )}
            {error && <p className="text-xs text-red-400 mt-2 max-w-[200px] text-right">{error}</p>}
          </div>
        </div>

        {/* Description */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">The Problem</h2>
          <p className="text-slate-300 leading-relaxed">{ticket.description}</p>
        </section>

        {/* Files */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Files to Investigate</h2>
          <div className="flex flex-wrap gap-2">
            {ticket.filesInvolved.map((f) => (
              <span key={f} className="text-sm font-mono rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-300">
                {f}
              </span>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Branch name:{" "}
            <code className="text-slate-400">ds/ticket-{ticket.id.slice(0, 8)}-{ticket.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}</code>
          </div>
        </section>

        {/* Scoring rubric */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">How You'll Be Scored</h2>
          <div className="space-y-4">
            {RUBRIC_ITEMS.map(({ key, label, max, desc }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <span className="text-xs text-slate-500">0–{max} pts</span>
                </div>
                <p className="text-xs text-slate-500 mb-1">{desc}</p>
                <p className="text-xs text-slate-400 bg-slate-800 rounded px-3 py-2 leading-relaxed">
                  {ticket.rubric[key]}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Codebase context */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Codebase</h2>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-white">{ticket.codebase.name}</span>
            <a
              href={ticket.codebase.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              View repo ↗
            </a>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-4">{ticket.codebase.companyLore}</p>
        </section>

      </main>
    </div>
  );
}
