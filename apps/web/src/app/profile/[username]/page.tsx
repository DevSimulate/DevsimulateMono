import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicProfile } from "@/lib/api";
import { format } from "date-fns";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    return { title: "Profile not found — DevSimulate" };
  }

  const dimensions = [
    { label: "Diagnosis", value: profile.scoreDiagnosis, max: 40 },
    { label: "Design", value: profile.scoreDesign, max: 30 },
    { label: "Communication", value: profile.scoreCommunication, max: 20 },
    { label: "Execution", value: profile.scoreExecution, max: 10 },
  ];
  const strongest = dimensions.reduce((a, b) =>
    a.value / a.max > b.value / b.max ? a : b
  );

  const description = `${username} scored ${profile.skillScore}/1000 on DevSimulate. Strongest in ${strongest.label}. Verified ${profile.primaryStack} developer.`;

  return {
    title: `${username}'s Developer Profile — DevSimulate`,
    description,
    openGraph: {
      title: `${username}'s Developer Profile — DevSimulate`,
      description,
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: `${username}'s Developer Profile — DevSimulate`,
      description,
    },
  };
}

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}): React.ReactElement {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm text-slate-300 font-medium">{label}</span>
        <span className="text-lg font-black text-white">
          {value}<span className="text-xs font-normal text-slate-500">/{max}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }): React.ReactElement {
  const s = score ?? 0;
  const color = s >= 70 ? "#16a34a" : s >= 40 ? "#d97706" : "#dc2626";
  const bg = s >= 70 ? "rgba(22,163,74,0.15)" : s >= 40 ? "rgba(217,119,6,0.15)" : "rgba(220,38,38,0.15)";
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold"
      style={{ color, backgroundColor: bg }}
    >
      {s}
    </span>
  );
}

export default async function ProfilePage({ params }: ProfilePageProps): Promise<React.ReactElement> {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    return (
      <div style={{ backgroundColor: "#0A1628" }} className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="text-5xl font-black text-white mb-2">404</div>
        <p className="text-slate-400 max-w-sm">
          This developer profile does not exist yet.<br />
          Join DevSimulate to build yours.
        </p>
        <Link href="/" className="mt-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-5 py-2.5 text-sm transition-colors">
          Get Started
        </Link>
      </div>
    );
  }

  const joinedDate = format(new Date(profile.joinedAt), "MMM yyyy");

  return (
    <div style={{ backgroundColor: "#0A1628" }} className="min-h-screen text-white">
      {/* Nav */}
      <header className="border-b border-white/10 px-6 py-4">
        <Link href="/" className="font-bold text-white tracking-tight">
          ⚡ DevSimulate
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">

        {/* Hero */}
        <div className="flex items-center gap-6 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://github.com/${profile.githubUsername}.png?size=96`}
            alt={profile.githubUsername}
            width={80}
            height={80}
            className="rounded-full ring-2 ring-cyan-500/40"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white truncate">@{profile.githubUsername}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-0.5 text-xs font-semibold text-cyan-400">
                {profile.primaryStack}
              </span>
              <span className="rounded-full border border-cyan-500/60 bg-cyan-500/15 px-3 py-0.5 text-xs font-semibold text-cyan-300">
                ✓ Verified by DevSimulate
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-5xl font-black text-cyan-400 leading-none">{profile.skillScore}</div>
            <div className="text-xs text-slate-500 mt-1">Skill Score</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Tickets Completed", value: profile.ticketsCompleted },
            { label: "Average Score", value: `${profile.averageScore}/100` },
            { label: "Member Since", value: joinedDate },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="text-xl font-black text-white">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Score breakdown */}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Score Breakdown
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <ScoreBar label="Diagnosis" value={profile.scoreDiagnosis} max={40} color="#00B4D8" />
          <ScoreBar label="Design" value={profile.scoreDesign} max={30} color="#8b5cf6" />
          <ScoreBar label="Communication" value={profile.scoreCommunication} max={20} color="#f59e0b" />
          <ScoreBar label="Execution" value={profile.scoreExecution} max={10} color="#10b981" />
        </div>

        {/* Recent activity */}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Recent Activity
        </h2>

        {profile.recentSubmissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500 text-sm">
            No submissions yet.
          </div>
        ) : (
          <div className="space-y-3 mb-10">
            {profile.recentSubmissions.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="text-sm text-slate-300 font-medium truncate flex-1">{s.ticketTitle}</div>
                <div className="flex items-center gap-3 shrink-0">
                  <ScoreBadge score={s.scoreTotal} />
                  <span className="text-xs text-slate-500">
                    {format(new Date(s.submittedAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-slate-600">
        Built with DevSimulate — devsimulate.io
      </footer>
    </div>
  );
}
