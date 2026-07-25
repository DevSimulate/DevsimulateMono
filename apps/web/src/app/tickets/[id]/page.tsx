"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StageTracker } from "@/components/assessment/StageTracker";

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

const DIFF_TONE: Record<string, BadgeTone> = { JUNIOR: "good", MID: "warn", SENIOR: "neutral" };

const RUBRIC_ITEMS = [
  { key: "diagnosis", label: "Diagnosis", max: 40, desc: "Did you identify the root cause, not just the symptom?" },
  { key: "design", label: "Design", max: 30, desc: "Is the solution robust, maintainable and well-considered?" },
  { key: "communication", label: "Communication", max: 20, desc: "Did you explain your reasoning clearly in the PR description?" },
  { key: "execution", label: "Execution", max: 10, desc: "Does the code actually fix the problem?" },
] as const;

// The full journey ahead — this page is always "Ticket", the first stage.
const STAGE_LABELS = ["Ticket", "Write-up", "Review", "Q1", "Q2", "Speak", "Score"];

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
        ? "You've used your 2 assessments this month — resets on the 1st."
        : "Failed to assign ticket. You may already have it assigned."
      );
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-muted">Loading…</div>;
  }

  if (!ticket) return <></>;

  const branchName = `ds/ticket-${ticket.id.slice(0, 8)}-${ticket.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-hairline bg-surface px-6 py-4 flex items-center gap-4">
        <Link href="/tickets" className="text-sm text-muted hover:text-ink transition-colors duration-150">← Tickets</Link>
        <span className="font-semibold truncate">{ticket.title}</span>
      </header>

      <StageTracker labels={STAGE_LABELS} currentIndex={0} />

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Title + assign */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge tone={DIFF_TONE[ticket.difficulty]}>{ticket.difficulty}</Badge>
              <span className="text-xs text-muted">{ticket.codebase.name}</span>
              <span className="text-xs text-muted">· {ticket.stack}</span>
              <span className="text-xs text-muted font-mono">· ~{ticket.expectedMinutes} min</span>
            </div>
            <h1 className="font-display text-2xl font-bold">{ticket.title}</h1>
          </div>

          <div className="shrink-0 text-right">
            {assigned ? (
              <Link href="/dashboard">
                <Button variant="primary">Go to dashboard →</Button>
              </Link>
            ) : (
              <Button variant="primary" onClick={handleAssign} disabled={assigning}>
                {assigning ? "Assigning…" : "Assign to me"}
              </Button>
            )}
            {error && <p className="text-xs text-red mt-2 max-w-[220px] text-right">{error}</p>}
          </div>
        </div>

        {/* AI policy + expected time — stated plainly before anyone starts */}
        <Card className="p-4 bg-brand-weak !border-[rgba(79,70,229,0.25)]">
          <p className="text-xs leading-relaxed text-ink">
            <span className="font-semibold">Use any AI tool you like.</span> We don&apos;t measure typing — we measure
            judgment. You&apos;ll declare how you used AI at the end; it never changes your score. Expect to spend
            about <span className="font-mono font-semibold">{ticket.expectedMinutes} min</span> here, though a first
            attempt often takes longer.
          </p>
        </Card>

        {/* Description */}
        <section className="rounded border border-hairline bg-surface p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">The problem</h2>
          <p className="text-sm leading-relaxed text-ink">{ticket.description}</p>
        </section>

        {/* Files + branch */}
        <section className="rounded border border-hairline bg-surface p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Files to investigate</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {ticket.filesInvolved.map((f) => (
              <span key={f} className="text-xs font-mono rounded bg-paper border border-hairline px-2.5 py-1.5 text-ink">
                {f}
              </span>
            ))}
          </div>
          <div className="text-xs text-muted">
            Branch name: <span className="font-mono text-ink">{branchName}</span>
          </div>
        </section>

        {/* Scoring rubric */}
        <section className="rounded border border-hairline bg-surface p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">How you&apos;ll be scored</h2>
          <div className="flex flex-col gap-4">
            {RUBRIC_ITEMS.map(({ key, label, max, desc }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-muted font-mono">0–{max} pts</span>
                </div>
                <p className="text-xs text-muted mb-1.5">{desc}</p>
                <p className="text-xs text-ink bg-paper rounded px-3 py-2 leading-relaxed">
                  {ticket.rubric[key]}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Codebase context */}
        <section className="rounded border border-hairline bg-surface p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Codebase</h2>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">{ticket.codebase.name}</span>
            <a href={ticket.codebase.repoUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
              View repo ↗
            </a>
          </div>
          <p className="text-xs text-muted leading-relaxed line-clamp-4">{ticket.codebase.companyLore}</p>
        </section>

      </main>
    </div>
  );
}
