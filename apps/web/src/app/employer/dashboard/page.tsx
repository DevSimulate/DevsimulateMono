"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { Megaphone, Users, BarChart2, CheckCircle2, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const VERDICT_TONE: Record<string, BadgeTone> = {
  STRONG_YES: "good",
  YES: "good",
  MAYBE: "warn",
  NO: "bad",
};
const VERDICT_LABEL: Record<string, string> = {
  STRONG_YES: "Strong yes", YES: "Yes", MAYBE: "Maybe", NO: "No",
};
const BAND: Record<string, string> = { HIGH: "var(--emerald)", MEDIUM: "var(--signal-amber)", LOW: "var(--signal-red)" };
const STATUS_TONE: Record<string, BadgeTone> = { ACTIVE: "good", CLOSED: "neutral", DRAFT: "warn" };

interface Summary {
  stats: { activeCampaigns: number; totalAssessed: number; totalShortlisted: number; avgScore: number };
  campaigns: Array<{ id: string; roleName: string; companyName: string; codebase: string; status: string; count: number; limit: number }>;
  recent: Array<{ id: string; githubUsername: string; roleName: string; score: number; verdict: string; band: string; submittedAt: string }>;
}

function StatCard({ icon: Icon, label, value, unit }: { icon: React.ElementType; label: string; value: number | string; unit?: string }) {
  return (
    <Card className="p-5">
      <div className="w-9 h-9 rounded flex items-center justify-center mb-3 bg-emerald-weak">
        <Icon size={17} className="text-emerald" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-3xl font-bold text-ink">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      <div className="text-sm font-semibold mt-1 text-muted">{label}</div>
    </Card>
  );
}

export default function EmployerDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/dashboard-summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

  return (
    <div className="flex flex-col min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-surface border-b border-hairline">
        <div>
          <h1 className="font-display text-lg font-bold">Dashboard</h1>
          <p className="text-xs text-muted">Your hiring at a glance</p>
        </div>
        <Link href="/employer/campaigns/new">
          <Button variant="primary"><Plus size={15} /> New campaign</Button>
        </Link>
      </header>

      <main className="flex-1 px-8 py-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {loading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />) : (
            <>
              <StatCard icon={Megaphone} label="Active campaigns" value={s?.activeCampaigns ?? 0} />
              <StatCard icon={Users} label="Candidates assessed" value={s?.totalAssessed ?? 0} />
              <StatCard icon={CheckCircle2} label="Shortlisted" value={s?.totalShortlisted ?? 0} />
              <StatCard icon={BarChart2} label="Avg score" value={s?.avgScore ?? 0} unit="/100" />
            </>
          )}
        </div>

        <div className="flex gap-5">
          {/* Recent candidates */}
          <div className="flex-[60]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
                <span className="text-sm font-bold">Recent candidates</span>
                <Link href="/employer/candidates" className="flex items-center gap-1 text-xs font-semibold text-emerald">
                  View all <ChevronRight size={13} />
                </Link>
              </div>
              <Table className="border-0 rounded-none">
                <Thead>
                  <Tr>
                    {["Candidate", "Role", "Score", "Authenticity", "Verdict"].map((h, i) => (
                      <Th key={h} numeric={i === 2}>{h}</Th>
                    ))}
                  </Tr>
                </Thead>
                <tbody>
                  {loading ? null : (data?.recent ?? []).length === 0 ? (
                    <Tr><Td colSpan={5} className="text-center py-8 text-xs text-muted">No scored candidates yet. Share a campaign link to start.</Td></Tr>
                  ) : data!.recent.map((c) => (
                    <Tr key={c.id}>
                      <Td className="text-xs font-semibold">{c.githubUsername}</Td>
                      <Td className="text-xs text-muted">{c.roleName}</Td>
                      <Td numeric className="text-sm font-bold" style={{ color: c.score >= 80 ? "var(--emerald)" : c.score >= 60 ? "var(--signal-amber)" : "var(--signal-red)" }}>{c.score}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: BAND[c.band] }} />
                          <span style={{ color: BAND[c.band] }}>{c.band[0] + c.band.slice(1).toLowerCase()}</span>
                        </span>
                      </Td>
                      <Td><Badge tone={VERDICT_TONE[c.verdict]}>{VERDICT_LABEL[c.verdict]}</Badge></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          {/* Campaigns */}
          <div className="flex-[40]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-hairline">
                <span className="text-sm font-bold">Campaigns</span>
                <Link href="/employer/campaigns" className="text-xs font-semibold text-emerald">Manage</Link>
              </div>
              <div>
                {loading ? null : (data?.campaigns ?? []).length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted">
                    No campaigns yet.<br />
                    <Link href="/employer/campaigns/new" className="font-semibold text-emerald">Create one →</Link>
                  </div>
                ) : data!.campaigns.map((c, i) => (
                  <Link key={c.id} href={`/employer/campaigns/${c.id}/results`}
                    className={`block px-4 py-3 hover:bg-paper transition-colors duration-150 ${i < data!.campaigns.length - 1 ? "border-b border-hairline" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold truncate">{c.roleName}</span>
                      <Badge tone={STATUS_TONE[c.status]}>{c.status[0] + c.status.slice(1).toLowerCase()}</Badge>
                    </div>
                    <div className="text-xs text-muted">{c.codebase} · {c.count}/{c.limit} candidates</div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
