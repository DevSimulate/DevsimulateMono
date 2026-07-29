"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Campaign {
  id: string;
  roleName: string;
  companyName: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  deadline: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  type: "HIRING" | "CONTEST";
  codebase: { name: string; stack: string };
  _count: { candidates: number };
}

const STATUS_TONE: Record<string, BadgeTone> = { ACTIVE: "neutral", CLOSED: "neutral", DRAFT: "warn" };

export default function HiringDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    fetch(`${API}/employer/campaigns?type=HIRING`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((j) => setCampaigns(j.data ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  // Closed roles are finished work, not current work. They stay reachable —
  // results and invite history still matter after a role is filled — but they
  // don't belong in the list you scan to find the role you're running today.
  const closed = campaigns.filter((c) => c.status === "CLOSED");
  const open = campaigns.filter((c) => c.status !== "CLOSED");
  const shown = showClosed ? campaigns : open;

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 text-ink">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Hiring</h1>
          <p className="text-sm text-muted mt-1">
            Private, invite-only assessments for open roles. Candidates are invited by email and results stay confidential.
          </p>
        </div>
        <Link href="/employer/campaigns/new?type=HIRING"><Button variant="primary">New role</Button></Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState title="No hiring roles yet" description="Create one to start inviting candidates." />
      ) : shown.length === 0 ? (
        <EmptyState
          title="No open roles"
          description={`Every role is closed. ${closed.length} closed ${closed.length === 1 ? "role is" : "roles are"} hidden — show them to reach their results or invite history.`}
          actionLabel={`Show ${closed.length} closed`}
          onAction={() => setShowClosed(true)}
        />
      ) : (
        <div className="rounded border border-hairline bg-surface divide-y divide-hairline">
          {shown.map((c) => (
            <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-[220px]">
                <div className="text-sm font-semibold">{c.roleName}</div>
                <div className="text-xs text-muted mt-0.5">
                  {c.codebase?.name} · {c.difficulty} · {c._count?.candidates ?? 0} candidates
                  {c.deadline ? ` · closes ${new Date(c.deadline).toLocaleDateString()}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={STATUS_TONE[c.status]}>{c.status[0] + c.status.slice(1).toLowerCase()}</Badge>
                <Link href={`/employer/campaigns/${c.id}/invites`}><Button variant="primary" size="sm">Invitations →</Button></Link>
                <Link href={`/employer/campaigns/${c.id}/results`}><Button variant="secondary" size="sm">Results</Button></Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && closed.length > 0 && shown.length > 0 && (
        <button
          type="button"
          onClick={() => setShowClosed((v) => !v)}
          className="mt-3 text-xs text-muted hover:text-ink transition-colors"
        >
          {showClosed
            ? `Hide ${closed.length} closed ${closed.length === 1 ? "role" : "roles"}`
            : `Show ${closed.length} closed ${closed.length === 1 ? "role" : "roles"}`}
        </button>
      )}
    </div>
  );
}
