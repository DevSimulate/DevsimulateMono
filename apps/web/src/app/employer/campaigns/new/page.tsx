"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import { ArrowLeft, Copy, Check, ExternalLink, Briefcase, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface Codebase { id: string; name: string; stack: string; }

const SELECT_CLASS = "w-full rounded border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-[rgba(79,70,229,0.25)]";

const TYPE_META = {
  HIRING:  { icon: Briefcase, title: "Hiring", desc: "Assess external candidates, shortlist & invite to interview" },
  CONTEST: { icon: Trophy,    title: "DevFest / Contest", desc: "Public contest — compete on a live leaderboard, crown winners" },
} as const;

function isValidType(v: string | null): v is "HIRING" | "CONTEST" {
  return v === "HIRING" || v === "CONTEST";
}

/**
 * Turns a "YYYY-MM-DD" date input into the last instant of that day in the
 * organiser's own timezone.
 *
 * Built from parts rather than `new Date(str)`, because that parses a bare date
 * as UTC midnight — so "5 August" in Karachi would land at 05:00 on the 5th
 * local, closing the campaign most of a day before the date everyone agreed on.
 */
function endOfLocalDay(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function NewCampaignForm() {
  const searchParams = useSearchParams();
  // Arriving from the Hiring or DevFest section locks the type to that
  // section — the two flows shouldn't cross, so there's no picker to
  // second-guess it. Arriving from "All campaigns" still gets the choice.
  const lockedType = isValidType(searchParams.get("type")) ? searchParams.get("type") as "HIRING" | "CONTEST" : null;

  const [codebases, setCodebases] = useState<Codebase[]>([]);
  const [form, setForm] = useState({
    roleName: "",
    codebaseId: "",
    difficulty: "MID",
    candidateLimit: 100,
    deadline: "",
    companyName: "",
    devFestTag: "",
    type: lockedType ?? ("HIRING" as "HIRING" | "CONTEST"),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Optional ticket curation
  const [library, setLibrary] = useState<Array<{ id: string; title: string; expectedMinutes: number }>>([]);
  const [pickMode, setPickMode] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

  const isContest = form.type === "CONTEST";

  useEffect(() => {
    const token = getToken();
    fetch(`${API}/employer/campaigns/codebases`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        setCodebases(j.data ?? []);
        if (j.data?.[0]) setForm((f) => ({ ...f, codebaseId: j.data[0].id }));
      })
      .catch(() => null);

    // Pre-fill the company name with the employer's organisation (e.g. LMKR).
    fetch(`${API}/employer/campaigns/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.orgName) setForm((f) => (f.companyName ? f : { ...f, companyName: j.data.orgName }));
      })
      .catch(() => null);
  }, []);

  // Minimum selectable deadline = today, local, as YYYY-MM-DD.
  const minDate = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();

  // Load the ticket library whenever codebase/difficulty changes
  useEffect(() => {
    if (!form.codebaseId || !form.difficulty) return;
    const token = getToken();
    fetch(`${API}/employer/campaigns/ticket-library?codebaseId=${form.codebaseId}&difficulty=${form.difficulty}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => { setLibrary(j.data ?? []); setSelectedTickets(new Set()); })
      .catch(() => setLibrary([]));
  }, [form.codebaseId, form.difficulty]);

  function toggleTicket(id: string) {
    setSelectedTickets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    if (!form.roleName || !form.codebaseId || !form.companyName) {
      setError("Role name, codebase, and company name are required.");
      return;
    }
    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/employer/campaigns`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // A deadline is a DAY, so it closes at the END of that day, local time.
          // Sending the bare date would parse as UTC midnight — the *start* of
          // the day — cutting candidates off roughly 24 hours early.
          deadline: form.deadline ? endOfLocalDay(form.deadline).toISOString() : "",
          ticketIds: pickMode ? [...selectedTickets] : [],
          devFestTag: isContest ? (form.devFestTag.trim() || undefined) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create campaign");
      setCreatedSlug(json.data.shareableSlug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  const fullLink = createdSlug ? `${APP_URL}/apply/${createdSlug}` : "";

  function copyLink() {
    navigator.clipboard.writeText(fullLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Success view
  if (createdSlug) {
    return (
      <div className="flex flex-col min-h-screen bg-paper text-ink">
        <header className="px-8 py-4 bg-surface border-b border-hairline">
          <h1 className="font-display text-lg font-bold">Campaign created</h1>
        </header>
        <main className="flex-1 px-8 py-10 max-w-2xl mx-auto w-full">
          <Card className="p-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-weak">
              <Check size={28} className="text-emerald" />
            </div>
            <div className="font-display text-xl font-bold mb-1">Your campaign is live!</div>
            <div className="text-sm mb-6 text-muted">
              Share this link with candidates. When they open it, they sign in with GitHub and
              get assigned a ticket automatically.
            </div>

            <div className="rounded border border-hairline bg-paper p-4 mb-6 text-left">
              <div className="text-xs uppercase tracking-widest mb-2 text-muted">Application link</div>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-sm break-all text-brand">{fullLink}</code>
                <Button variant="secondary" size="sm" onClick={copyLink} className="shrink-0">
                  {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </Button>
              </div>
            </div>

            <div className="rounded border border-hairline bg-paper p-4 mb-6 text-left">
              <div className="text-xs uppercase tracking-widest mb-2 text-muted">What candidates see</div>
              <div className="text-sm text-muted">
                {isContest ? (
                  <>
                    <span className="font-semibold text-ink">{form.companyName}</span> is running{" "}
                    <span className="font-semibold text-ink">{form.roleName}</span>. Solve a real{" "}
                    {form.difficulty.toLowerCase()}-level coding challenge, get AI-scored, and climb the live leaderboard.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-ink">{form.companyName}</span> is hiring for{" "}
                    <span className="font-semibold text-ink">{form.roleName}</span>. Complete a real{" "}
                    {form.difficulty.toLowerCase()}-level coding ticket to be considered.
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/employer/campaigns" className="flex-1">
                <Button variant="primary" className="w-full">View all campaigns</Button>
              </Link>
              <a href={fullLink} target="_blank" rel="noreferrer">
                <Button variant="secondary">Preview <ExternalLink size={13} /></Button>
              </a>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  const backHref = lockedType === "CONTEST" ? "/employer/devfest" : lockedType === "HIRING" ? "/employer/hiring" : "/employer/campaigns";

  // Form view
  return (
    <div className="flex flex-col min-h-screen bg-paper text-ink">
      <header className="px-8 py-4 flex items-center gap-4 bg-surface border-b border-hairline">
        <Link href={backHref} className="text-muted hover:text-ink transition-colors duration-150"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="font-display text-lg font-bold">{isContest ? "New DevFest track" : "New role"}</h1>
          <p className="text-xs text-muted">{isContest ? "Create a public DevFest contest" : "Create a hiring assessment campaign"}</p>
        </div>
      </header>

      <main className="flex-1 px-8 py-8 max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-5">

          {error && (
            <div className="rounded border px-4 py-3 text-sm text-red bg-red-weak !border-[rgba(179,55,47,0.25)]">
              {error}
            </div>
          )}

          {/* Campaign type — locked when arriving from the Hiring or DevFest
              section (they're different flows and shouldn't cross); an open
              choice only from the neutral "All campaigns" entry point. */}
          {lockedType ? (
            <div className="flex items-center gap-2">
              {(() => { const Icon = TYPE_META[lockedType].icon; return <Icon size={14} className="text-brand" />; })()}
              <Badge tone="neutral">{TYPE_META[lockedType].title} campaign</Badge>
            </div>
          ) : (
            <Field label="Campaign type">
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(TYPE_META) as Array<"HIRING" | "CONTEST">).map((v) => {
                  const meta = TYPE_META[v];
                  const Icon = meta.icon;
                  const active = form.type === v;
                  return (
                    <button key={v} type="button" onClick={() => setForm({ ...form, type: v })}
                      className={`text-left rounded border p-3 transition-colors duration-150 ${active ? "border-brand bg-brand-weak" : "border-hairline bg-surface hover:bg-paper"}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={14} className={active ? "text-brand" : "text-muted"} />
                        <div className={`text-sm font-semibold ${active ? "text-brand" : "text-ink"}`}>{meta.title}</div>
                      </div>
                      <div className="text-xs text-muted">{meta.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {/* Shared basics */}
          <Card className="p-5 flex flex-col gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Basics</div>

            <Field label={isContest ? "Contest name" : "Role name"}>
              <Input value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                placeholder={isContest ? "DevFest — Angular" : "Senior Backend Engineer"} />
            </Field>

            <Field label="Company name">
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Acme Inc." />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Codebase">
                <select value={form.codebaseId} onChange={(e) => setForm({ ...form, codebaseId: e.target.value })} className={SELECT_CLASS}>
                  {codebases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>

              <Field label="Difficulty">
                <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className={SELECT_CLASS}>
                  <option value="JUNIOR">Junior</option>
                  <option value="MID">Mid</option>
                  <option value="SENIOR">Senior</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={isContest ? "Participant limit" : "Candidate limit"}>
                <Input type="number" value={form.candidateLimit}
                  onChange={(e) => setForm({ ...form, candidateLimit: parseInt(e.target.value) || 0 })} />
              </Field>

              <Field label={isContest ? "Deadline (competition closes)" : "Deadline"}>
                <input
                  type="date"
                  value={form.deadline}
                  min={minDate}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                  className="w-full rounded border border-hairline bg-surface px-3 py-2.5 text-sm outline-none cursor-pointer text-ink focus:border-brand focus:ring-2 focus:ring-[rgba(79,70,229,0.25)]"
                />
                <p className="text-[11px] text-muted mt-1.5">
                  {form.deadline
                    ? `Closes end of ${endOfLocalDay(form.deadline).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, your time.`
                    : "Optional. The application link stops working at the end of this day."}
                </p>
              </Field>
            </div>
          </Card>

          {/* DevFest gets its own section; Hiring has nothing extra to
              collect — interviews are invited by email, not a booking link. */}
          {isContest && (
            <Card className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <Trophy size={13} /> DevFest details
              </div>
              <Field
                label="DevFest tag (optional)"
                helper="Use the same tag on all campaigns in a DevFest to pool them onto one public leaderboard, at /devfest/[tag]. You can also add this later."
              >
                <Input value={form.devFestTag} onChange={(e) => setForm({ ...form, devFestTag: e.target.value })}
                  placeholder="e.g. lmkr-devfest-2025" />
              </Field>
            </Card>
          )}

          {/* Optional ticket curation */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold">Which tickets?</div>
              <label className="flex items-center gap-2 text-xs cursor-pointer text-muted">
                <input type="checkbox" checked={pickMode} onChange={(e) => setPickMode(e.target.checked)} className="accent-brand" />
                Choose specific tickets
              </label>
            </div>
            {!pickMode ? (
              <div className="text-xs text-muted">
                Each candidate gets a <span className="text-ink">random {form.difficulty.toLowerCase()} ticket</span> from this codebase — different candidates get different problems, so they can&apos;t share answers.
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                {library.length === 0 ? (
                  <div className="text-xs text-muted">No tickets found for this codebase + difficulty.</div>
                ) : library.map((t) => (
                  <label key={t.id} className={`flex items-start gap-2.5 rounded px-3 py-2 cursor-pointer transition-colors duration-150 border ${selectedTickets.has(t.id) ? "bg-brand-weak border-brand" : "bg-surface border-hairline"}`}>
                    <input type="checkbox" checked={selectedTickets.has(t.id)} onChange={() => toggleTicket(t.id)} className="mt-0.5 accent-brand" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{t.title}</div>
                      <div className="text-xs text-muted">~{t.expectedMinutes} min</div>
                    </div>
                  </label>
                ))}
                {library.length > 0 && (
                  <div className="text-xs pt-1 text-muted">
                    {selectedTickets.size === 0
                      ? "Pick at least one. Candidates get a random ticket from your selection."
                      : `${selectedTickets.size} selected — candidates get a random one of these.`}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Button variant="primary" size="lg" onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "Creating…" : "Create campaign & generate link"}
          </Button>
        </div>
      </main>
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">Loading…</div>}>
      <NewCampaignForm />
    </Suspense>
  );
}
