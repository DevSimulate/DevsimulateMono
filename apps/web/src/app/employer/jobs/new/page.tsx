"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

interface Ticket { id: string; title: string; difficulty: string; }

export default function NewJobPage(): React.ReactElement {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [description, setDescription] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/"); return; }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    axios.get<{ data: Ticket[] }>(`${apiUrl}/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => setTickets(r.data.data)).catch(() => null);
  }, [router]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const token = getToken();
    const orgId = typeof window !== "undefined" ? localStorage.getItem("ds_org_id") : null;
    if (!token || !orgId) { router.push("/employer/signup"); return; }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
      await axios.post(
        `${apiUrl}/organisations/${orgId}/jobs`,
        { title, ticketId, description: description || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      router.push("/employer/dashboard");
    } catch {
      setError("Failed to create job. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/employer/dashboard" className="text-slate-400 hover:text-white text-sm">← Dashboard</Link>
        <span className="font-bold text-white">New Job Post</span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Job title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Senior .NET Engineer"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Assessment ticket *</label>
            <select
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Select a ticket…</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>{t.title} ({t.difficulty})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What you're looking for in this role…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !title || !ticketId}
            className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold py-3 text-sm transition-colors"
          >
            {loading ? "Creating…" : "Create Job Post"}
          </button>
        </form>
      </main>
    </div>
  );
}
