"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { QUOTA_REACHED_MESSAGE } from "@/lib/limits";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email,public_repo` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") +
    "/auth/callback"
  )}`;

const STACK_LABEL: Record<string, string> = {
  DOTNET: ".NET 8", SYSTEM_DESIGN: "Architecture", PYTHON: "Python + LangChain",
  NODE: "Node.js + TypeScript", REACT: "React + TypeScript", DEVOPS: "Terraform + K8s",
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

const DIFF_TONE: Record<string, BadgeTone> = { JUNIOR: "good", MID: "warn", SENIOR: "neutral" };

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

    // No codebase chosen → don't dump every ticket from every codebase.
    // Send the user to pick a codebase first.
    if (!stack && !codebaseId) {
      router.replace("/onboarding/select");
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
  }, [router, stack, codebaseId]);

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
        setMsg({ id: ticketId, text: QUOTA_REACHED_MESSAGE, ok: false });
      } else {
        setMsg({ id: ticketId, text: "Failed to assign ticket.", ok: false });
      }
    } finally {
      setAssigning(null);
    }
  }

  const stackLabel = stack ? STACK_LABEL[stack] : null;
  const codebaseName = tickets[0]?.codebase?.name ?? (stack ? stack : "All codebases");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-hairline bg-surface px-6 py-4 flex items-center gap-4">
        <Link href="/onboarding/select" className="text-sm text-muted hover:text-ink transition-colors duration-150">
          ← Choose codebase
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-display font-bold">{codebaseName}</span>
          {stackLabel && <Badge tone="neutral">{stackLabel}</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Link
            href={`/onboarding/guide${codebaseId ? `?codebaseId=${codebaseId}` : ""}`}
            className="text-xs font-medium text-muted hover:text-ink transition-colors duration-150"
          >
            How it works
          </Link>
          <span className="text-sm text-muted">{tickets.length} tickets</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : (
          <>
            {usage && usage.limit !== null && (
              <Card className={`p-4 flex items-center justify-between gap-4 ${usage.used >= usage.limit ? "!border-red bg-red-weak" : ""}`}>
                <div>
                  <p className="text-sm font-semibold">
                    {usage.used} of {usage.limit} assessments used this month
                  </p>
                  {usage.used >= usage.limit && (
                    <p className="text-xs text-muted mt-0.5">You&apos;ve used your monthly limit — resets on the 1st.</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {usage.used >= usage.limit ? "0 remaining" : `${usage.limit - usage.used} remaining`}
                </span>
              </Card>
            )}

            {tickets.length === 0 ? (
              <EmptyState title="No tickets available" description="Check back soon, or try a different codebase." />
            ) : (
              tickets.map((ticket) => (
                <Card key={ticket.id} className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge tone={DIFF_TONE[ticket.difficulty]}>{ticket.difficulty}</Badge>
                        <Badge tone="neutral">{STACK_LABEL[ticket.stack] ?? ticket.stack}</Badge>
                        <span className="text-xs text-muted">{ticket.codebase.name}</span>
                        <span className="text-xs text-muted font-mono">· {ticket.expectedMinutes} min</span>
                      </div>
                      <Link href={`/tickets/${ticket.id}`} className="font-semibold text-ink hover:text-brand transition-colors duration-150">
                        {ticket.title}
                      </Link>
                    </div>

                    <div className="shrink-0 text-right">
                      {msg?.id === ticket.id && (
                        <p className={`text-xs mb-2 max-w-[200px] ${msg.ok ? "text-emerald" : "text-red"}`}>
                          {msg.text}
                        </p>
                      )}
                      {ticket.stack === "SYSTEM_DESIGN" ? (
                        <Link href={`/submit?ticketId=${ticket.id}`}>
                          <Button variant="primary" size="sm">Write design →</Button>
                        </Link>
                      ) : msg?.id === ticket.id && msg.ok ? (
                        <Link href="/dashboard">
                          <Button variant="primary" size="sm">Go to dashboard →</Button>
                        </Link>
                      ) : (
                        <Button variant="primary" size="sm" onClick={() => handleAssign(ticket.id)} disabled={assigning === ticket.id}>
                          {assigning === ticket.id ? "Assigning…" : "Assign to me"}
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted leading-relaxed mb-4 line-clamp-3">
                    {ticket.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {ticket.filesInvolved.map((f) => (
                      <span key={f} className="text-xs rounded bg-paper border border-hairline px-2 py-1 text-muted font-mono">
                        {f}
                      </span>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function TicketsPage(): React.ReactElement {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper flex items-center justify-center text-muted">
        Loading…
      </div>
    }>
      <TicketsList />
    </Suspense>
  );
}
