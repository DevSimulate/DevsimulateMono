"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { format } from "date-fns";

interface Candidate {
  id: string;
  status: string;
  invitedAt: string;
  candidate: { githubUsername: string; skillScore: number; primaryStack: string };
  submission: {
    scoreTotal: number | null;
    scoreDiagnosis: number | null;
    scoreDesign: number | null;
    scoreCommunication: number | null;
    scoreExecution: number | null;
    prDescription: string;
    submittedAt: string;
    minutesToComplete: number | null;
  } | null;
}

function ScoreDot({ value, max }: { value: number | null; max: number }): React.ReactElement {
  const s = value ?? 0;
  const pct = s / max;
  const color = pct >= 0.7 ? "bg-emerald-500" : pct >= 0.4 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold text-[#131722] ${color}`}>
      {s}
    </span>
  );
}

export default function CandidatesPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    const orgId = typeof window !== "undefined" ? localStorage.getItem("ds_org_id") : null;
    if (!token || !orgId) { router.push("/employer/signup"); return; }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    axios.get<{ data: Candidate[] }>(
      `${apiUrl}/organisations/${orgId}/jobs/${jobId}/applications`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => setCandidates(r.data.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [router, jobId]);

  async function handleInvite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const token = getToken();
    const orgId = typeof window !== "undefined" ? localStorage.getItem("ds_org_id") : null;
    if (!token || !orgId) return;

    setInviting(true);
    setInviteMsg(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    try {
      await axios.post(
        `${apiUrl}/organisations/${orgId}/jobs/${jobId}/invite`,
        { candidateUsername: inviteUsername },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInviteMsg(`Invitation sent to @${inviteUsername}`);
      setInviteUsername("");
    } catch {
      setInviteMsg("Failed to invite candidate. Check the username and try again.");
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-[#131722]">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/employer/dashboard" className="text-slate-400 hover:text-[#131722] text-sm">← Dashboard</Link>
        <span className="font-bold text-[#131722]">Candidates</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Invite bar */}
        <form onSubmit={handleInvite} className="flex items-center gap-3 mb-6">
          <input
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            placeholder="GitHub username to invite"
            className="flex-1 max-w-xs rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-[#131722] placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={inviting || !inviteUsername}
            className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold px-4 py-2 text-sm transition-colors"
          >
            {inviting ? "Inviting…" : "Invite Candidate"}
          </button>
          {inviteMsg && <span className="text-xs text-slate-400">{inviteMsg}</span>}
        </form>

        {/* Candidates table */}
        {candidates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500 text-sm">
            No candidates yet. Invite someone above.
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900">
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://github.com/${c.candidate.githubUsername}.png?size=40`}
                    alt={c.candidate.githubUsername}
                    width={36}
                    height={36}
                    className="rounded-full shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#131722] text-sm">@{c.candidate.githubUsername}</div>
                    <div className="text-xs text-slate-500">{c.candidate.primaryStack} · Skill {c.candidate.skillScore}</div>
                  </div>

                  {/* Overall score */}
                  {c.submission?.scoreTotal != null ? (
                    <div className={`text-2xl font-black shrink-0 ${
                      c.submission.scoreTotal >= 70 ? "text-emerald-400"
                        : c.submission.scoreTotal >= 40 ? "text-amber-400"
                        : "text-red-400"
                    }`}>
                      {c.submission.scoreTotal}
                      <span className="text-xs font-normal text-slate-500">/100</span>
                    </div>
                  ) : (
                    <span className="text-xs rounded-full px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                      {c.status}
                    </span>
                  )}

                  {/* Dimension badges */}
                  {c.submission && (
                    <div className="flex gap-1 shrink-0">
                      <ScoreDot value={c.submission.scoreDiagnosis} max={40} />
                      <ScoreDot value={c.submission.scoreDesign} max={30} />
                      <ScoreDot value={c.submission.scoreCommunication} max={20} />
                      <ScoreDot value={c.submission.scoreExecution} max={10} />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href={`/profile/${c.candidate.githubUsername}`}
                      target="_blank"
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Profile ↗
                    </Link>
                    {c.submission && (
                      <button
                        onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                        className="text-xs text-slate-400 hover:text-[#131722]"
                      >
                        {expanded === c.id ? "Hide" : "PR desc"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        console.log("PDF export — candidate:", c.candidate.githubUsername, c.submission);
                        alert("PDF export coming soon");
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      PDF
                    </button>
                  </div>
                </div>

                {/* Expanded PR description */}
                {expanded === c.id && c.submission && (
                  <div className="border-t border-slate-800 px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">PR Description</span>
                      {c.submission.minutesToComplete && (
                        <span className="text-xs text-slate-500">{c.submission.minutesToComplete} min to complete</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {c.submission.prDescription}
                    </p>
                    <div className="mt-2 text-xs text-slate-600">
                      Submitted {format(new Date(c.submission.submittedAt), "MMM d, yyyy")}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
