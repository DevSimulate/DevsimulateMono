"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

interface TeamMember {
  userId: string;
  githubUsername: string;
  primaryStack: string;
  skillScore: number;
  role: string;
  ticketsThisMonth: number;
  ticketsTotal: number;
  weakestDimension: string;
  trend: "up" | "down" | "stable";
}

interface Ticket { id: string; title: string; difficulty: string; }

const TREND_ICON: Record<string, string> = { up: "↑", down: "↓", stable: "→" };
const TREND_COLOR: Record<string, string> = { up: "text-emerald-400", down: "text-red-400", stable: "text-slate-500" };

export default function TeamPage(): React.ReactElement {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStack, setFilterStack] = useState("");
  const [sortBy, setSortBy] = useState<"skillScore" | "scoreDiagnosis" | "scoreCommunication">("skillScore");
  const [modal, setModal] = useState<{ userId: string; username: string } | null>(null);
  const [selectedTicket, setSelectedTicket] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    const orgId = typeof window !== "undefined" ? localStorage.getItem("ds_org_id") : null;
    if (!token || !orgId) { router.push("/employer/signup"); return; }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get<{ data: TeamMember[] }>(`${apiUrl}/organisations/${orgId}/team/progress`, { headers }),
      axios.get<{ data: Ticket[] }>(`${apiUrl}/tickets`, { headers }),
    ])
      .then(([teamRes, ticketsRes]) => {
        setMembers(teamRes.data.data);
        setTickets(ticketsRes.data.data);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [router]);

  async function handleAssign(): Promise<void> {
    if (!modal || !selectedTicket) return;
    const token = getToken();
    if (!token) return;

    setAssigning(true);
    setAssignMsg(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    try {
      await axios.post(
        `${apiUrl}/tickets/${selectedTicket}/assign`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignMsg(`Ticket assigned to @${modal.username}`);
      setModal(null);
    } catch {
      setAssignMsg("Failed to assign ticket.");
    } finally {
      setAssigning(false);
    }
  }

  const stacks = [...new Set(members.map((m) => m.primaryStack))];

  const filtered = members
    .filter((m) => !filterStack || m.primaryStack === filterStack)
    .sort((a, b) => b.skillScore - a.skillScore);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/employer/dashboard" className="text-slate-400 hover:text-white text-sm">← Dashboard</Link>
        <span className="font-bold text-white">Team Training</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={filterStack}
            onChange={(e) => setFilterStack(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="">All stacks</option>
            {stacks.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="skillScore">Sort: Overall Score</option>
            <option value="scoreDiagnosis">Sort: Diagnosis</option>
            <option value="scoreCommunication">Sort: Communication</option>
          </select>

          <span className="text-sm text-slate-500 ml-auto">{filtered.length} members</span>
        </div>

        {/* Team table */}
        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={m.userId} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://github.com/${m.githubUsername}.png?size=40`}
                alt={m.githubUsername}
                width={36}
                height={36}
                className="rounded-full shrink-0"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">@{m.githubUsername}</span>
                  <span className={`text-xs font-bold ${TREND_COLOR[m.trend]}`}>
                    {TREND_ICON[m.trend]}
                  </span>
                </div>
                <div className="text-xs text-slate-500">{m.primaryStack} · {m.role}</div>
              </div>

              <div className="text-center shrink-0">
                <div className="text-xl font-black text-white">{m.skillScore}</div>
                <div className="text-xs text-slate-500">Skill</div>
              </div>

              <div className="text-center shrink-0">
                <div className="text-sm font-bold text-slate-300">{m.ticketsThisMonth}</div>
                <div className="text-xs text-slate-500">This month</div>
              </div>

              <div className="text-center shrink-0">
                <div className="text-xs rounded-full px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
                  ↓ {m.weakestDimension}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/profile/${m.githubUsername}`} target="_blank" className="text-xs text-cyan-400 hover:text-cyan-300">
                  Profile ↗
                </Link>
                <button
                  onClick={() => { setModal({ userId: m.userId, username: m.githubUsername }); setAssignMsg(null); }}
                  className="text-xs rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-slate-300 transition-colors"
                >
                  Assign Ticket
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Assign modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 w-full max-w-sm">
            <h3 className="font-bold text-white mb-1">Assign Ticket</h3>
            <p className="text-sm text-slate-400 mb-4">to @{modal.username}</p>

            <select
              value={selectedTicket}
              onChange={(e) => setSelectedTicket(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white mb-4 focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Select a ticket…</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>{t.title} ({t.difficulty})</option>
              ))}
            </select>

            {assignMsg && <p className="text-xs text-slate-400 mb-3">{assignMsg}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedTicket}
                className="flex-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold py-2.5 text-sm transition-colors"
              >
                {assigning ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
