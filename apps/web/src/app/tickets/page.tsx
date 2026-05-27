"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

interface Ticket {
  id: string;
  title: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
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

export default function TicketsPage(): React.ReactElement {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/"); return; }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    axios
      .get<{ data: Ticket[] }>(`${apiUrl}/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setTickets(r.data.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [router]);

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
        <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm">
          ← Dashboard
        </Link>
        <span className="font-bold text-white">Available Tickets</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-4">
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
                  <span className="text-xs text-slate-500">{ticket.codebase.name}</span>
                  <span className="text-xs text-slate-600">· {ticket.expectedMinutes} min</span>
                </div>
                <p className="text-xs text-slate-500 mb-1">{ticket.codebase.description}</p>
                <Link href={`/tickets/${ticket.id}`} className="font-bold text-white hover:text-cyan-400 transition-colors">
                  {ticket.title}
                </Link>
              </div>

              <div className="shrink-0 text-right">
                {msg?.id === ticket.id ? (
                  <p
                    className={`text-xs mb-2 ${msg.ok ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {msg.text}
                  </p>
                ) : null}
                {msg?.id === ticket.id && msg.ok ? (
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
