"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Check, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface Campaign {
  id: string;
  roleName: string;
  companyName: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  deadline: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  type: "HIRING" | "CONTEST";
  shareableSlug: string;
  devFestTag: string | null;
  codebase: { name: string; stack: string };
  _count: { candidates: number };
}

const STATUS_TONE: Record<string, BadgeTone> = { ACTIVE: "neutral", CLOSED: "neutral", DRAFT: "warn" };

export default function DevFestDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/employer/campaigns`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((j) => setCampaigns((j.data ?? []).filter((c: Campaign) => c.type === "CONTEST")))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  function copy(slug: string, id: string) {
    navigator.clipboard.writeText(`${APP_URL}/apply/${slug}`).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // Group events by their DevFest tag — one event usually spans several tracks.
  const tags = [...new Set(campaigns.map((c) => c.devFestTag).filter((t): t is string => !!t))];

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 text-ink">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">DevFest events</h1>
          <p className="text-sm text-muted mt-1">
            Public contests. Anyone with the share link can enter, and results appear on a live public leaderboard.
          </p>
        </div>
        <Link href="/employer/campaigns/new"><Button variant="primary">New track</Button></Link>
      </div>

      {tags.length > 0 && (
        <Card className="p-4 mb-5" style={{ background: "rgba(79,70,229,0.05)", borderColor: "rgba(79,70,229,0.25)" }}>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Public leaderboards</div>
          <div className="flex gap-2 flex-wrap">
            {tags.map((t) => (
              <Link key={t} href={`/devfest/${t}`}>
                <Button variant="secondary" size="sm"><Trophy size={13} className="text-amber" /> {t}</Button>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState title="No DevFest tracks yet" description="Create one and tag it to publish a leaderboard." />
      ) : (
        <div className="rounded border border-hairline bg-surface divide-y divide-hairline">
          {campaigns.map((c) => (
            <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-[220px]">
                <div className="text-sm font-semibold">{c.roleName}</div>
                <div className="text-xs text-muted mt-0.5">
                  {c.codebase?.name} · {c.difficulty} · {c._count?.candidates ?? 0} participants
                  {c.devFestTag ? ` · ${c.devFestTag}` : " · no tag (won't show on a leaderboard)"}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={STATUS_TONE[c.status]}>{c.status[0] + c.status.slice(1).toLowerCase()}</Badge>
                <Button variant="secondary" size="sm" onClick={() => copy(c.shareableSlug, c.id)}>
                  {copied === c.id ? <><Check size={13} className="text-emerald" /> Copied</> : "Copy entry link"}
                </Button>
                <Link href={`/employer/campaigns/${c.id}/results`}><Button variant="primary" size="sm">Results</Button></Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
