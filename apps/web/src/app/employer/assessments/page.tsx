"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus, X, ChevronRight, ChevronLeft, Check, Clock,
  Users, BarChart2, Calendar, Send, Link2, Copy,
  AlertCircle, Search, Filter, Bell, RefreshCw,
  CheckCircle, PlayCircle, FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = "JUNIOR" | "MID" | "SENIOR";
type AssessmentStatus = "ACTIVE" | "COMPLETED" | "DRAFT";

interface MockTicket {
  id: string; code: string; title: string; description: string;
  difficulty: Difficulty; stack: string; avgScore: number; timesUsed: number; expectedMinutes: number;
}

interface Assessment {
  id: string; name: string; status: AssessmentStatus;
  ticket: { code: string; title: string; difficulty: Difficulty; stack: string };
  invited: number; completed: number; avgScore: number | null;
  deadline: string; createdAt: string; instructions: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const TICKETS: MockTicket[] = [
  { id: "t1", code: "NOVA-47", title: "Intermittent Order Fulfillment Failure", description: "A fire-and-forget Task creates a race condition causing orders to silently fail under concurrent load. Requires deep async/await understanding.", difficulty: "MID", stack: ".NET", avgScore: 63, timesUsed: 134, expectedMinutes: 60 },
  { id: "t2", code: "NOVA-52", title: "Discount Engine Priority Bug", description: "The discount engine applies all active rules additively instead of selecting only the highest-priority rule, causing customers to receive more discount than entitled.", difficulty: "JUNIOR", stack: ".NET", avgScore: 71, timesUsed: 89, expectedMinutes: 45 },
  { id: "t3", code: "NOVA-58", title: "Cascade Priority Discount Logic", description: "Contract > Promotional > Volume > Default priority rules are ignored. The engine must select only the single highest-priority matching active rule.", difficulty: "SENIOR", stack: ".NET", avgScore: 54, timesUsed: 47, expectedMinutes: 90 },
  { id: "t4", code: "CART-11", title: "Race Condition in Cart Service", description: "Concurrent add-to-cart requests cause duplicate line items due to a missing optimistic concurrency check on the cart aggregate.", difficulty: "SENIOR", stack: "NODE", avgScore: 58, timesUsed: 62, expectedMinutes: 75 },
  { id: "t5", code: "CART-08", title: "Cart Total Rounding Error", description: "Floating point arithmetic in the cart total calculation produces incorrect totals for certain item combinations. Classic precision bug.", difficulty: "JUNIOR", stack: "NODE", avgScore: 77, timesUsed: 103, expectedMinutes: 30 },
  { id: "t6", code: "AUTH-03", title: "JWT Expiry Not Enforced on Refresh", description: "Expired access tokens can be silently refreshed indefinitely when the refresh endpoint fails to validate the original token expiry claim.", difficulty: "MID", stack: "NODE", avgScore: 61, timesUsed: 78, expectedMinutes: 60 },
];

const INITIAL_ASSESSMENTS: Assessment[] = [
  { id: "a1", name: "Senior .NET Engineer Assessment", status: "ACTIVE", ticket: { code: "NOVA-47", title: "Intermittent Order Fulfillment Failure", difficulty: "MID", stack: ".NET" }, invited: 12, completed: 8, avgScore: 71, deadline: "2026-06-15", createdAt: "2026-05-10", instructions: "Please complete this assessment honestly without time pressure." },
  { id: "a2", name: "Junior Backend Track — May 2026", status: "ACTIVE", ticket: { code: "NOVA-52", title: "Discount Engine Priority Bug", difficulty: "JUNIOR", stack: ".NET" }, invited: 24, completed: 19, avgScore: 64, deadline: "2026-06-01", createdAt: "2026-05-05", instructions: "" },
  { id: "a3", name: "Q1 Engineering Hiring Wave", status: "COMPLETED", ticket: { code: "CART-11", title: "Race Condition in Cart Service", difficulty: "SENIOR", stack: "NODE" }, invited: 18, completed: 18, avgScore: 69, deadline: "2026-03-31", createdAt: "2026-03-01", instructions: "" },
  { id: "a4", name: "Node.js Mid-Level Screening", status: "COMPLETED", ticket: { code: "AUTH-03", title: "JWT Expiry Not Enforced on Refresh", difficulty: "MID", stack: "NODE" }, invited: 9, completed: 7, avgScore: 58, deadline: "2026-04-20", createdAt: "2026-04-01", instructions: "" },
  { id: "a5", name: "Draft: Senior Node Assessment", status: "DRAFT", ticket: { code: "CART-11", title: "Race Condition in Cart Service", difficulty: "SENIOR", stack: "NODE" }, invited: 0, completed: 0, avgScore: null, deadline: "2026-07-01", createdAt: "2026-05-20", instructions: "" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFF_STYLE: Record<Difficulty, { bg: string; color: string }> = {
  JUNIOR: { bg: "#052e16", color: "#4ade80" },
  MID:    { bg: "#451a03", color: "#fbbf24" },
  SENIOR: { bg: "#450a0a", color: "#f87171" },
};

const STATUS_STYLE: Record<AssessmentStatus, { bg: string; color: string; border: string; label: string; icon: React.ElementType }> = {
  ACTIVE:    { bg: "#052e16", color: "#4ade80", border: "#166534", label: "Active",    icon: PlayCircle },
  COMPLETED: { bg: "#0c1a2e", color: "#38bdf8", border: "#0369a1", label: "Completed", icon: CheckCircle },
  DRAFT:     { bg: "#1a1a1a", color: "#888888", border: "#333333", label: "Draft",     icon: FileText },
};

function scoreColor(s: number) {
  return s >= 80 ? "#4ade80" : s >= 60 ? "#fbbf24" : s >= 40 ? "#fb923c" : "#f87171";
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Select Ticket", "Configure", "Add Candidates", "Review & Send"];
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all"
                style={{
                  background: done ? "#6366f1" : active ? "#1e1b4b" : "#1a1a1a",
                  color: done || active ? "#ffffff" : "#444444",
                  border: active ? "2px solid #6366f1" : done ? "2px solid #6366f1" : "2px solid #222222",
                }}>
                {done ? <Check size={13} /> : n}
              </div>
              <span className="text-xs mt-1 hidden sm:block whitespace-nowrap"
                style={{ color: active ? "#ffffff" : done ? "#888888" : "#444444" }}>
                {labels[i]}
              </span>
            </div>
            {n < total && (
              <div className="w-16 sm:w-24 h-px mx-2 mb-4"
                style={{ background: n < current ? "#6366f1" : "#222222" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Assessment card ──────────────────────────────────────────────────────────

function AssessmentCard({
  assessment, onClose, onRemind,
}: {
  assessment: Assessment;
  onClose: (id: string) => void;
  onRemind: (id: string) => void;
}) {
  const { ticket, status } = assessment;
  const pct = assessment.invited > 0 ? Math.round((assessment.completed / assessment.invited) * 100) : 0;
  const st = STATUS_STYLE[status];
  const StatusIcon = st.icon;
  const days = daysUntil(assessment.deadline);
  const diffStyle = DIFF_STYLE[ticket.difficulty];

  return (
    <div className="rounded-xl p-5 transition-all"
      style={{ background: "#111111", border: "1px solid #222222" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#333333"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#222222"}>

      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-0.5"
              style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
              <StatusIcon size={11} />
              {st.label}
            </span>
            {status === "ACTIVE" && days <= 7 && days > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5"
                style={{ background: "#451a03", color: "#fbbf24", border: "1px solid #78350f" }}>
                <AlertCircle size={10} /> {days}d left
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-white truncate">{assessment.name}</h3>
        </div>
        {assessment.avgScore !== null && (
          <div className="text-right shrink-0">
            <div className="text-xl font-black" style={{ color: scoreColor(assessment.avgScore) }}>
              {assessment.avgScore}
            </div>
            <div className="text-xs" style={{ color: "#444444" }}>avg score</div>
          </div>
        )}
      </div>

      {/* Ticket badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold rounded px-2 py-0.5"
          style={{ background: diffStyle.bg, color: diffStyle.color }}>
          {ticket.code}
        </span>
        <span className="text-xs font-semibold rounded px-2 py-0.5"
          style={{ background: "#1e1b4b", color: "#818cf8" }}>
          {ticket.stack}
        </span>
        <span className="text-xs truncate" style={{ color: "#555555" }}>{ticket.title}</span>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span style={{ color: "#888888" }}>
            <span className="font-bold text-white">{assessment.completed}</span> / {assessment.invited} completed
          </span>
          <span style={{ color: "#555555" }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct === 100 ? "#4ade80" : "#6366f1" }} />
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs mb-4" style={{ color: "#555555" }}>
        <span className="flex items-center gap-1">
          <Calendar size={11} />
          {status === "COMPLETED" ? "Closed" : `Due`} {new Date(assessment.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
        <span className="flex items-center gap-1">
          <Users size={11} /> {assessment.invited} invited
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link href={`/employer/assessments/${assessment.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-white"
          style={{ background: "#6366f1" }}>
          View Results <ChevronRight size={12} />
        </Link>
        {status === "ACTIVE" && (
          <>
            <button onClick={() => onRemind(assessment.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "#111111", border: "1px solid #222222", color: "#888888" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#6366f1"; (e.currentTarget as HTMLElement).style.color = "#818cf8"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#222222"; (e.currentTarget as HTMLElement).style.color = "#888888"; }}>
              <Bell size={11} /> Send Reminder
            </button>
            <button onClick={() => onClose(assessment.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "#0a0a0a", border: "1px solid #991b1b", color: "#f87171" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#1a0a0a"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#0a0a0a"}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

interface CreateState {
  ticket: MockTicket | null;
  name: string;
  deadline: string;
  timeLimitEnabled: boolean;
  timeLimitMinutes: number;
  instructions: string;
  allowHints: boolean;
  emailInput: string;
  emails: string[];
  shareLink: string;
}

const EMPTY_STATE: CreateState = {
  ticket: null, name: "", deadline: "", timeLimitEnabled: false,
  timeLimitMinutes: 120, instructions: "", allowHints: false,
  emailInput: "", emails: [], shareLink: "",
};

function CreateModal({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (a: Assessment) => void;
}) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<CreateState>(EMPTY_STATE);
  const [stackFilter, setStackFilter] = useState<string>("ALL");
  const [diffFilter, setDiffFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => TICKETS.filter(t => {
    if (stackFilter !== "ALL" && t.stack !== stackFilter) return false;
    if (diffFilter !== "ALL" && t.difficulty !== diffFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [stackFilter, diffFilter, search]);

  function addEmails() {
    const raw = state.emailInput.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes("@") && !state.emails.includes(e));
    if (raw.length) setState(s => ({ ...s, emails: [...s.emails, ...raw], emailInput: "" }));
  }

  function generateLink() {
    const link = `https://devsimulate.io/assess/${Math.random().toString(36).slice(2, 10)}`;
    setState(s => ({ ...s, shareLink: link }));
  }

  function copyLink() {
    if (state.shareLink) {
      navigator.clipboard.writeText(state.shareLink).catch(() => null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleSend() {
    if (!state.ticket) return;
    setSending(true);
    setTimeout(() => {
      const newAssessment: Assessment = {
        id: `a${Date.now()}`,
        name: state.name || `${state.ticket!.code} Assessment`,
        status: state.emails.length > 0 || state.shareLink ? "ACTIVE" : "DRAFT",
        ticket: { code: state.ticket!.code, title: state.ticket!.title, difficulty: state.ticket!.difficulty, stack: state.ticket!.stack },
        invited: state.emails.length,
        completed: 0,
        avgScore: null,
        deadline: state.deadline || new Date(Date.now() + 14 * 86_400_000).toISOString().split("T")[0],
        createdAt: new Date().toISOString().split("T")[0],
        instructions: state.instructions,
      };
      onSend(newAssessment);
      setSending(false);
    }, 1200);
  }

  const canNext =
    step === 1 ? !!state.ticket :
    step === 2 ? !!state.name && !!state.deadline :
    step === 3 ? (state.emails.length > 0 || !!state.shareLink) :
    true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: "#111111", border: "1px solid #333333" }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid #1a1a1a" }}>
          <span className="text-base font-bold text-white">Create Assessment</span>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "#555555" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1a1a1a"; (e.currentTarget as HTMLElement).style.color = "#ffffff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#555555"; }}>
            <X size={15} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-4 shrink-0" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <StepIndicator current={step} total={4} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Select Ticket ── */}
          {step === 1 && (
            <div className="p-6">
              <h2 className="text-sm font-bold text-white mb-1">Choose a ticket</h2>
              <p className="text-xs mb-4" style={{ color: "#555555" }}>Select the engineering ticket candidates will solve.</p>

              {/* Filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-1.5 flex-1 min-w-[160px] rounded-lg border px-3 py-2"
                  style={{ background: "#0d0d0d", borderColor: "#222222" }}>
                  <Search size={13} style={{ color: "#555555" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search tickets…"
                    className="flex-1 bg-transparent text-xs outline-none text-white placeholder-[#444444]" />
                </div>
                <div className="flex items-center gap-1">
                  {["ALL", ".NET", "NODE"].map(s => (
                    <button key={s} onClick={() => setStackFilter(s)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: stackFilter === s ? "#6366f1" : "#1a1a1a", color: stackFilter === s ? "white" : "#888888" }}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {["ALL", "JUNIOR", "MID", "SENIOR"].map(d => (
                    <button key={d} onClick={() => setDiffFilter(d)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: diffFilter === d ? "#6366f1" : "#1a1a1a", color: diffFilter === d ? "white" : "#888888" }}>
                      {d === "ALL" ? "All" : d.charAt(0) + d.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ticket grid */}
              <div className="space-y-2">
                {filtered.map(t => {
                  const ds = DIFF_STYLE[t.difficulty];
                  const selected = state.ticket?.id === t.id;
                  return (
                    <button key={t.id}
                      onClick={() => setState(s => ({ ...s, ticket: t, name: s.name || `${t.code} Assessment` }))}
                      className="w-full text-left rounded-xl p-4 transition-all"
                      style={{
                        background: selected ? "#0d0d1a" : "#0d0d0d",
                        border: selected ? "1.5px solid #6366f1" : "1px solid #1a1a1a",
                      }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-bold rounded px-2 py-0.5" style={{ background: ds.bg, color: ds.color }}>{t.code}</span>
                            <span className="text-xs font-semibold rounded px-2 py-0.5" style={{ background: "#1e1b4b", color: "#818cf8" }}>{t.stack}</span>
                            <span className="text-xs" style={{ color: "#555555" }}>{t.difficulty}</span>
                          </div>
                          <div className="text-sm font-semibold text-white mb-1">{t.title}</div>
                          <div className="text-xs leading-relaxed line-clamp-2" style={{ color: "#666666" }}>{t.description}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-black" style={{ color: scoreColor(t.avgScore) }}>{t.avgScore}</div>
                          <div className="text-xs" style={{ color: "#444444" }}>avg</div>
                          <div className="text-xs mt-1" style={{ color: "#444444" }}>{t.timesUsed}× used</div>
                          <div className="flex items-center gap-1 text-xs mt-1 justify-end" style={{ color: "#444444" }}>
                            <Clock size={10} /> {t.expectedMinutes}m
                          </div>
                        </div>
                        {selected && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "#6366f1" }}>
                            <Check size={12} color="white" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-10 text-sm" style={{ color: "#555555" }}>No tickets match your filters.</div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Configure ── */}
          {step === 2 && state.ticket && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Configure assessment</h2>
                <p className="text-xs" style={{ color: "#555555" }}>Set the rules for how candidates will take this assessment.</p>
              </div>

              {/* Selected ticket summary */}
              <div className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: "#0d0d0d", border: "1px solid #222222" }}>
                <span className="text-xs font-bold rounded px-2 py-0.5"
                  style={{ background: DIFF_STYLE[state.ticket.difficulty].bg, color: DIFF_STYLE[state.ticket.difficulty].color }}>
                  {state.ticket.code}
                </span>
                <span className="text-xs font-semibold text-white flex-1">{state.ticket.title}</span>
                <button onClick={() => setStep(1)} className="text-xs" style={{ color: "#6366f1" }}>Change</button>
              </div>

              {/* Assessment name */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "#888888" }}>Assessment Name *</label>
                <input value={state.name} onChange={e => setState(s => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors text-white"
                  style={{ background: "#0d0d0d", borderColor: "#222222" }}
                  placeholder="e.g. Senior .NET Engineer Assessment"
                  onFocus={e => (e.currentTarget.style.borderColor = "#6366f1")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#222222")} />
              </div>

              {/* Deadline */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "#888888" }}>Deadline *</label>
                <input type="date" value={state.deadline} onChange={e => setState(s => ({ ...s, deadline: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors text-white"
                  style={{ background: "#0d0d0d", borderColor: "#222222", colorScheme: "dark" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#6366f1")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#222222")} />
              </div>

              {/* Time limit */}
              <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Time limit</div>
                    <div className="text-xs" style={{ color: "#555555" }}>Restrict how long candidates have to submit</div>
                  </div>
                  <button onClick={() => setState(s => ({ ...s, timeLimitEnabled: !s.timeLimitEnabled }))}
                    className="w-10 h-6 rounded-full transition-all relative"
                    style={{ background: state.timeLimitEnabled ? "#6366f1" : "#333333" }}>
                    <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                      style={{ left: state.timeLimitEnabled ? "calc(100% - 22px)" : "2px" }} />
                  </button>
                </div>
                {state.timeLimitEnabled && (
                  <div className="flex items-center gap-2">
                    <input type="number" value={state.timeLimitMinutes}
                      onChange={e => setState(s => ({ ...s, timeLimitMinutes: Number(e.target.value) }))}
                      className="w-24 rounded-lg border px-3 py-2 text-sm outline-none text-white"
                      style={{ background: "#111111", borderColor: "#333333" }}
                      min={15} max={480} />
                    <span className="text-sm" style={{ color: "#888888" }}>minutes</span>
                  </div>
                )}
              </div>

              {/* Allow hints */}
              <div className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <div>
                  <div className="text-sm font-semibold text-white">Allow hints</div>
                  <div className="text-xs" style={{ color: "#555555" }}>Candidates can request one hint per assessment</div>
                </div>
                <button onClick={() => setState(s => ({ ...s, allowHints: !s.allowHints }))}
                  className="w-10 h-6 rounded-full transition-all relative"
                  style={{ background: state.allowHints ? "#6366f1" : "#333333" }}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                    style={{ left: state.allowHints ? "calc(100% - 22px)" : "2px" }} />
                </button>
              </div>

              {/* Instructions */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "#888888" }}>Instructions for candidate</label>
                <textarea value={state.instructions} onChange={e => setState(s => ({ ...s, instructions: e.target.value }))}
                  rows={4} placeholder="Optional message shown to candidates before they begin…"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none transition-colors text-white placeholder-[#333333]"
                  style={{ background: "#0d0d0d", borderColor: "#222222" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#6366f1")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#222222")} />
              </div>
            </div>
          )}

          {/* ── Step 3: Add Candidates ── */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Add candidates</h2>
                <p className="text-xs" style={{ color: "#555555" }}>Paste email addresses or share a link candidates can use to self-enroll.</p>
              </div>

              {/* Email paste */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: "#888888" }}>
                  Paste email addresses
                </label>
                <textarea
                  value={state.emailInput}
                  onChange={e => setState(s => ({ ...s, emailInput: e.target.value }))}
                  rows={4}
                  placeholder={"ahmed@example.com\nali.h@company.io\nsara.m@dev.co"}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none transition-colors text-white placeholder-[#333333] font-mono"
                  style={{ background: "#0d0d0d", borderColor: "#222222" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#6366f1")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#222222")} />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: "#444444" }}>Separate by newline, comma, or semicolon</span>
                  <button onClick={addEmails}
                    disabled={!state.emailInput.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-white disabled:opacity-40"
                    style={{ background: "#6366f1" }}>
                    Add
                  </button>
                </div>
              </div>

              {/* Added emails */}
              {state.emails.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold" style={{ color: "#888888" }}>
                      {state.emails.length} candidate{state.emails.length !== 1 ? "s" : ""} added
                    </span>
                    <button onClick={() => setState(s => ({ ...s, emails: [] }))}
                      className="text-xs transition-colors" style={{ color: "#555555" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#f87171"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#555555"}>
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {state.emails.map(email => (
                      <div key={email}
                        className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1"
                        style={{ background: "#1a1a1a", color: "#888888", border: "1px solid #222222" }}>
                        {email}
                        <button onClick={() => setState(s => ({ ...s, emails: s.emails.filter(e => e !== email) }))}
                          style={{ color: "#555555" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#f87171"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#555555"}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "#1a1a1a" }} />
                <span className="text-xs" style={{ color: "#444444" }}>or share a link</span>
                <div className="flex-1 h-px" style={{ background: "#1a1a1a" }} />
              </div>

              {/* Share link */}
              <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Link2 size={14} style={{ color: "#6366f1" }} />
                  <span className="text-sm font-semibold text-white">Shareable link</span>
                </div>
                {state.shareLink ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs rounded-lg px-3 py-2 truncate"
                      style={{ background: "#111111", color: "#818cf8", border: "1px solid #222222" }}>
                      {state.shareLink}
                    </code>
                    <button onClick={copyLink}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: copied ? "#052e16" : "#1a1a1a", color: copied ? "#4ade80" : "#888888", border: "1px solid #222222" }}>
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                ) : (
                  <button onClick={generateLink}
                    className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all text-white"
                    style={{ background: "#1e1b4b", border: "1px solid #312e81" }}>
                    Generate shareable link
                  </button>
                )}
                <p className="text-xs mt-2" style={{ color: "#444444" }}>
                  Anyone with this link can self-enroll and take the assessment.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Send ── */}
          {step === 4 && state.ticket && (
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Review & send</h2>
                <p className="text-xs" style={{ color: "#555555" }}>Confirm everything before invitations go out.</p>
              </div>

              {[
                { label: "Assessment name", value: state.name },
                { label: "Ticket", value: `${state.ticket.code} — ${state.ticket.title}` },
                { label: "Deadline", value: state.deadline ? new Date(state.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—" },
                { label: "Time limit", value: state.timeLimitEnabled ? `${state.timeLimitMinutes} minutes` : "None" },
                { label: "Hints allowed", value: state.allowHints ? "Yes" : "No" },
                { label: "Candidates", value: state.emails.length > 0 ? `${state.emails.length} via email` : state.shareLink ? "Via shareable link" : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 py-3"
                  style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <span className="text-xs font-semibold" style={{ color: "#555555" }}>{label}</span>
                  <span className="text-xs font-semibold text-right text-white">{value}</span>
                </div>
              ))}

              {state.instructions && (
                <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <div className="text-xs font-semibold mb-2" style={{ color: "#555555" }}>Instructions</div>
                  <p className="text-xs leading-relaxed" style={{ color: "#888888" }}>{state.instructions}</p>
                </div>
              )}

              <div className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: "#0d0d1a", border: "1px solid #312e81" }}>
                <AlertCircle size={14} style={{ color: "#818cf8", marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: "#818cf8" }}>
                  Invitations will be sent immediately. Candidates receive a link to their GitHub-authenticated DevSimulate account where they can accept the ticket.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid #1a1a1a" }}>
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "#1a1a1a", color: "#888888" }}>
            <ChevronLeft size={14} />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all text-white disabled:opacity-40"
              style={{ background: "#6366f1" }}>
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all text-white disabled:opacity-70"
              style={{ background: sending ? "#4f46e5" : "#6366f1" }}>
              {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              {sending ? "Sending…" : `Send to ${state.emails.length || "candidates"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TAB_LABELS: { id: AssessmentStatus | "ALL"; label: string }[] = [
  { id: "ACTIVE",    label: "Active" },
  { id: "COMPLETED", label: "Completed" },
  { id: "DRAFT",     label: "Draft" },
];

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>(INITIAL_ASSESSMENTS);
  const [tab, setTab] = useState<AssessmentStatus>("ACTIVE");
  const [modalOpen, setModalOpen] = useState(false);
  const [reminderSent, setReminderSent] = useState<string | null>(null);

  const filtered = assessments.filter(a => a.status === tab);

  const counts = useMemo(() => ({
    ACTIVE:    assessments.filter(a => a.status === "ACTIVE").length,
    COMPLETED: assessments.filter(a => a.status === "COMPLETED").length,
    DRAFT:     assessments.filter(a => a.status === "DRAFT").length,
  }), [assessments]);

  function handleClose(id: string) {
    setAssessments(prev => prev.map(a => a.id === id ? { ...a, status: "COMPLETED" } : a));
  }

  function handleRemind(id: string) {
    setReminderSent(id);
    setTimeout(() => setReminderSent(null), 3000);
  }

  function handleSend(newAssessment: Assessment) {
    setAssessments(prev => [newAssessment, ...prev]);
    setModalOpen(false);
    setTab(newAssessment.status as AssessmentStatus);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>

      {/* Reminder toast */}
      {reminderSent && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: "#052e16", color: "#4ade80", border: "1px solid #166534" }}>
          <Bell size={14} /> Reminder sent to {(assessments.find(a => a.id === reminderSent)?.invited ?? 0) - (assessments.find(a => a.id === reminderSent)?.completed ?? 0)} pending candidates
        </div>
      )}

      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between"
        style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div>
          <h1 className="text-lg font-black text-white">Assessments</h1>
          <p className="text-xs" style={{ color: "#555555" }}>{counts.ACTIVE} active · {counts.COMPLETED} completed · {counts.DRAFT} draft</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
          <Plus size={15} /> Create Assessment
        </button>
      </header>

      {/* Tabs */}
      <div className="px-8" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div className="flex gap-0">
          {TAB_LABELS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as AssessmentStatus)}
              className="px-4 py-3.5 text-sm font-medium transition-colors relative flex items-center gap-2"
              style={{ color: tab === t.id ? "#ffffff" : "#555555" }}>
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: tab === t.id ? "#6366f1" : "#1a1a1a", color: tab === t.id ? "white" : "#555555" }}>
                {counts[t.id as AssessmentStatus]}
              </span>
              {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#6366f1" }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-8 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-4xl mb-4">📋</div>
            <div className="text-base font-bold text-white mb-2">No {tab.toLowerCase()} assessments</div>
            <div className="text-sm mb-6" style={{ color: "#555555" }}>
              {tab === "ACTIVE" ? "Create your first assessment to start screening candidates." : `No ${tab.toLowerCase()} assessments yet.`}
            </div>
            {tab === "ACTIVE" && (
              <button onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#6366f1" }}>
                <Plus size={15} /> Create Assessment
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(a => (
              <AssessmentCard key={a.id} assessment={a} onClose={handleClose} onRemind={handleRemind} />
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      {modalOpen && <CreateModal onClose={() => setModalOpen(false)} onSend={handleSend} />}
    </div>
  );
}
