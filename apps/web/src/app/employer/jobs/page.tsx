"use client";

import { useState } from "react";
import {
  Briefcase, Plus, Search, Filter, ChevronDown, ChevronRight,
  MapPin, Clock, Users, Target, Star, Code2, X, Check,
  ExternalLink, MoreHorizontal, Eye, Pencil, Trash2, Copy,
  TrendingUp, AlertCircle, Building2, Globe, DollarSign,
  Zap, BookOpen, Hash, Sliders,
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TICKETS = [
  { id: "t1", title: "Fix auth middleware memory leak", difficulty: "Mid", stack: ["Node.js", "Redis"] },
  { id: "t2", title: "Build real-time notification system", difficulty: "Senior", stack: ["WebSockets", "Redis", "React"] },
  { id: "t3", title: "Implement OAuth2 PKCE flow", difficulty: "Mid", stack: ["TypeScript", "Node.js"] },
  { id: "t4", title: "Optimize PostgreSQL query performance", difficulty: "Senior", stack: ["SQL", "PostgreSQL"] },
  { id: "t5", title: "Build drag-and-drop Kanban board", difficulty: "Junior", stack: ["React", "TypeScript"] },
  { id: "t6", title: "Implement rate limiting middleware", difficulty: "Mid", stack: ["Node.js", "Redis"] },
];

const STACK_OPTIONS = [
  "React", "TypeScript", "Node.js", "Python", "Go", "PostgreSQL",
  "Redis", "AWS", "Docker", "GraphQL", "WebSockets", "SQL",
];

const JOBS: Job[] = [
  {
    id: "j1", title: "Senior Full-Stack Engineer", status: "open",
    location: "Remote", type: "Full-time", salary: "$140k–$180k",
    stack: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    minScore: 75, applicants: 24, qualified: 11,
    ticket: TICKETS[1], postedAt: "2026-05-10",
    description: "Join our platform team building real-time collaboration features at scale.",
    views: 312,
  },
  {
    id: "j2", title: "Backend Engineer – Auth & Security", status: "open",
    location: "New York, NY", type: "Full-time", salary: "$120k–$155k",
    stack: ["Node.js", "TypeScript", "Redis", "PostgreSQL"],
    minScore: 70, applicants: 18, qualified: 7,
    ticket: TICKETS[0], postedAt: "2026-05-14",
    description: "Own authentication and security infrastructure for our enterprise product.",
    views: 198,
  },
  {
    id: "j3", title: "Frontend Engineer – Design Systems", status: "open",
    location: "Remote", type: "Full-time", salary: "$110k–$145k",
    stack: ["React", "TypeScript"],
    minScore: 65, applicants: 31, qualified: 14,
    ticket: TICKETS[4], postedAt: "2026-05-16",
    description: "Build and maintain our component library used across 3 product surfaces.",
    views: 445,
  },
  {
    id: "j4", title: "Database Reliability Engineer", status: "closed",
    location: "San Francisco, CA", type: "Full-time", salary: "$150k–$190k",
    stack: ["PostgreSQL", "SQL"],
    minScore: 80, applicants: 9, qualified: 4,
    ticket: TICKETS[3], postedAt: "2026-04-20",
    description: "Ensure database reliability and performance at 100M+ queries/day.",
    views: 156,
  },
  {
    id: "j5", title: "Junior Frontend Developer", status: "draft",
    location: "Remote", type: "Contract", salary: "$70k–$90k",
    stack: ["React", "TypeScript"],
    minScore: 50, applicants: 0, qualified: 0,
    ticket: TICKETS[4], postedAt: "—",
    description: "Help build internal tooling dashboards for our operations team.",
    views: 0,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ticket { id: string; title: string; difficulty: string; stack: string[]; }

interface Job {
  id: string; title: string; status: "open" | "closed" | "draft";
  location: string; type: string; salary: string;
  stack: string[]; minScore: number;
  applicants: number; qualified: number;
  ticket: Ticket; postedAt: string;
  description: string; views: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Job["status"] }) {
  const cfg = {
    open:   { bg: "#ecfdf3", border: "#a7d8bd", color: "#067647", label: "Open" },
    closed: { bg: "#1c1917", border: "#44403c", color: "#a8a29e", label: "Closed" },
    draft:  { bg: "#1c1400", border: "#713f12", color: "#b54708", label: "Draft" },
  }[status];
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function DifficultyBadge({ level }: { level: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    Junior: { bg: "#172554", color: "#93c5fd" },
    Mid:    { bg: "#eef0fd", color: "#a5b4fc" },
    Senior: { bg: "#2d1b4e", color: "#d8b4fe" },
  };
  const c = cfg[level] ?? cfg.Mid;
  return (
    <span className="text-xs font-medium px-1.5 py-0.5 rounded"
      style={{ background: c.bg, color: c.color }}>
      {level}
    </span>
  );
}

function StackTag({ tag }: { tag: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded font-medium"
      style={{ background: "#eef0fd", color: "#4338ca", border: "1px solid #c7c9f7" }}>
      {tag}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#067647" : score >= 65 ? "#b54708" : "#b42318";
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1"
      style={{ background: "#ffffff", border: "1px solid #d5d9e0", color }}>
      <Target size={10} />
      {score}+
    </span>
  );
}

// ─── Job Row ─────────────────────────────────────────────────────────────────

function JobRow({ job, onView, onEdit }: { job: Job; onView: (j: Job) => void; onEdit: (j: Job) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const qualifiedPct = job.applicants > 0 ? Math.round((job.qualified / job.applicants) * 100) : 0;

  return (
    <tr className="border-b transition-colors"
      style={{ borderColor: "#eef1f5" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#ffffff"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>

      {/* Title */}
      <td className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "#eef0fd" }}>
            <Briefcase size={14} color="#4338ca" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#131722]">{job.title}</div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs flex items-center gap-1" style={{ color: "#8a93a3" }}>
                <MapPin size={10} />{job.location}
              </span>
              <span className="text-xs flex items-center gap-1" style={{ color: "#8a93a3" }}>
                <Clock size={10} />{job.type}
              </span>
              <span className="text-xs flex items-center gap-1" style={{ color: "#8a93a3" }}>
                <DollarSign size={10} />{job.salary}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5"><StatusBadge status={job.status} /></td>

      {/* Ticket */}
      <td className="px-4 py-3.5">
        <div>
          <div className="text-xs font-medium text-[#131722] truncate max-w-[160px]">{job.ticket.title}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <DifficultyBadge level={job.ticket.difficulty} />
          </div>
        </div>
      </td>

      {/* Min Score */}
      <td className="px-4 py-3.5"><ScoreBadge score={job.minScore} /></td>

      {/* Applicants */}
      <td className="px-4 py-3.5">
        <div className="text-sm text-[#131722] font-semibold">{job.applicants}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex-1 h-1 rounded-full" style={{ background: "#e4e7ec", width: "60px" }}>
            <div className="h-1 rounded-full" style={{ width: `${qualifiedPct}%`, background: "#4338ca" }} />
          </div>
          <span className="text-xs" style={{ color: "#067647" }}>{job.qualified} qualified</span>
        </div>
      </td>

      {/* Views */}
      <td className="px-4 py-3.5">
        <span className="text-sm" style={{ color: "#8a93a3" }}>{job.views}</span>
      </td>

      {/* Posted */}
      <td className="px-4 py-3.5">
        <span className="text-xs" style={{ color: "#8a93a3" }}>{job.postedAt}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1">
          <button onClick={() => onView(job)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#8a93a3" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff"; (e.currentTarget as HTMLElement).style.background = "#e4e7ec"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#8a93a3"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Eye size={14} />
          </button>
          <button onClick={() => onEdit(job)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#8a93a3" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff"; (e.currentTarget as HTMLElement).style.background = "#e4e7ec"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#8a93a3"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <Pencil size={14} />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "#8a93a3" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff"; (e.currentTarget as HTMLElement).style.background = "#e4e7ec"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#8a93a3"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 rounded-xl shadow-2xl z-50 w-44 py-1"
                style={{ background: "#eef1f5", border: "1px solid #d5d9e0" }}>
                {[
                  { icon: Copy, label: "Duplicate" },
                  { icon: Globe, label: "View public listing" },
                  { icon: Trash2, label: "Delete", danger: true },
                ].map(({ icon: Icon, label, danger }) => (
                  <button key={label} onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors"
                    style={{ color: danger ? "#b42318" : "#5a6472" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#e4e7ec"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

interface ModalProps { onClose: () => void; editJob?: Job | null; }

function JobModal({ onClose, editJob }: ModalProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle]         = useState(editJob?.title ?? "");
  const [description, setDesc]    = useState(editJob?.description ?? "");
  const [location, setLocation]   = useState(editJob?.location ?? "Remote");
  const [type, setType]           = useState(editJob?.type ?? "Full-time");
  const [salaryMin, setSalaryMin] = useState("120000");
  const [salaryMax, setSalaryMax] = useState("150000");
  const [selectedStack, setStack] = useState<string[]>(editJob?.stack ?? []);
  const [minScore, setMinScore]   = useState(editJob?.minScore ?? 65);
  const [selectedTicket, setTicket] = useState<Ticket | null>(editJob?.ticket ?? null);
  const [ticketSearch, setTicketSearch] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);

  const steps = ["Details", "Requirements", "Assessment", "Review"];
  const isEdit = !!editJob;

  function toggleStack(tag: string) {
    setStack(s => s.includes(tag) ? s.filter(t => t !== tag) : [...s, tag]);
  }

  async function handlePublish() {
    setPublishing(true);
    await new Promise(r => setTimeout(r, 1400));
    setPublishing(false);
    setDone(true);
    setTimeout(onClose, 1200);
  }

  const filteredTickets = TICKETS.filter(t =>
    t.title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
    t.stack.some(s => s.toLowerCase().includes(ticketSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#ffffff", border: "1px solid #d5d9e0", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid #e4e7ec" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#131722]">{isEdit ? "Edit Job Posting" : "Post a New Job"}</h2>
              <p className="text-xs mt-0.5" style={{ color: "#8a93a3" }}>Developers matching your criteria will see this listing.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "#8a93a3" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff"; (e.currentTarget as HTMLElement).style.background = "#e4e7ec"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#8a93a3"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <X size={16} />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-0">
            {steps.map((s, i) => {
              const n = i + 1;
              const active = step === n;
              const done2 = step > n;
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => step > n && setStep(n)}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: done2 ? "#3f37c9" : active ? "#4338ca" : "#eef1f5",
                        color: done2 || active ? "white" : "#9aa3b2",
                        border: active ? "2px solid #4338ca" : "none",
                      }}>
                      {done2 ? <Check size={10} /> : n}
                    </div>
                    <span className="text-xs font-medium hidden sm:block"
                      style={{ color: active ? "#ffffff" : done2 ? "#4338ca" : "#9aa3b2" }}>
                      {s}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-px mx-3"
                      style={{ background: step > n + 1 ? "#3f37c9" : step > n ? "#3f37c9" : "#e4e7ec" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 1: Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#5a6472" }}>Job Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-[#131722] outline-none"
                  style={{ background: "#f2f4f7", border: "1px solid #d5d9e0" }}
                  placeholder="e.g. Senior Backend Engineer" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#5a6472" }}>Description</label>
                <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-[#131722] outline-none resize-none"
                  style={{ background: "#f2f4f7", border: "1px solid #d5d9e0" }}
                  placeholder="What will this engineer work on?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#5a6472" }}>Location</label>
                  <input value={location} onChange={e => setLocation(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-[#131722] outline-none"
                    style={{ background: "#f2f4f7", border: "1px solid #d5d9e0" }}
                    placeholder="Remote / City, State" />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#5a6472" }}>Employment Type</label>
                  <select value={type} onChange={e => setType(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-[#131722] outline-none"
                    style={{ background: "#f2f4f7", border: "1px solid #d5d9e0" }}>
                    {["Full-time", "Part-time", "Contract", "Internship"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#5a6472" }}>Min Salary ($/yr)</label>
                  <input type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-[#131722] outline-none"
                    style={{ background: "#f2f4f7", border: "1px solid #d5d9e0" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#5a6472" }}>Max Salary ($/yr)</label>
                  <input type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-[#131722] outline-none"
                    style={{ background: "#f2f4f7", border: "1px solid #d5d9e0" }} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Requirements */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: "#5a6472" }}>Required Tech Stack</label>
                <div className="flex flex-wrap gap-2">
                  {STACK_OPTIONS.map(tag => {
                    const sel = selectedStack.includes(tag);
                    return (
                      <button key={tag} onClick={() => toggleStack(tag)}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                        style={{
                          background: sel ? "#eef0fd" : "#eef1f5",
                          border: sel ? "1px solid #3f37c9" : "1px solid #d5d9e0",
                          color: sel ? "#4338ca" : "#8a93a3",
                        }}>
                        {sel && <Check size={9} className="inline mr-1" />}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold" style={{ color: "#5a6472" }}>
                    Minimum Assessment Score
                  </label>
                  <span className="text-sm font-bold" style={{ color: minScore >= 75 ? "#067647" : minScore >= 60 ? "#b54708" : "#b42318" }}>
                    {minScore} / 100
                  </span>
                </div>
                <input type="range" min={30} max={95} step={5} value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: "#4338ca" }} />
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{ color: "#9aa3b2" }}>30 (Lenient)</span>
                  <span className="text-xs" style={{ color: "#9aa3b2" }}>95 (Strict)</span>
                </div>
                <div className="mt-3 rounded-xl p-3" style={{ background: "#f2f4f7", border: "1px solid #e4e7ec" }}>
                  <p className="text-xs" style={{ color: "#5a6472" }}>
                    Based on your current candidate pool,{" "}
                    <span className="font-bold text-[#131722]">
                      {minScore <= 50 ? "~68%" : minScore <= 65 ? "~41%" : minScore <= 75 ? "~28%" : "~14%"}
                    </span>{" "}
                    of developers would meet this threshold.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Assessment ticket */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs mb-3" style={{ color: "#5a6472" }}>
                  Choose a ticket candidates must complete before applying. Their score is compared against your minimum threshold.
                </p>
                <div className="relative mb-3">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8a93a3" }} />
                  <input value={ticketSearch} onChange={e => setTicketSearch(e.target.value)}
                    className="w-full rounded-xl pl-9 pr-3 py-2 text-sm text-[#131722] outline-none"
                    style={{ background: "#f2f4f7", border: "1px solid #d5d9e0" }}
                    placeholder="Search tickets by name or technology..." />
                </div>
                <div className="space-y-2">
                  {filteredTickets.map(t => {
                    const sel = selectedTicket?.id === t.id;
                    return (
                      <button key={t.id} onClick={() => setTicket(t)}
                        className="w-full text-left rounded-xl p-3 transition-all"
                        style={{
                          background: sel ? "#eef0fd" : "#f2f4f7",
                          border: sel ? "1px solid #3f37c9" : "1px solid #d5d9e0",
                        }}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                              style={{ borderColor: sel ? "#4338ca" : "#d5d9e0", background: sel ? "#4338ca" : "transparent" }}>
                              {sel && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-[#131722]">{t.title}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <DifficultyBadge level={t.difficulty} />
                                {t.stack.slice(0, 3).map(s => <StackTag key={s} tag={s} />)}
                              </div>
                            </div>
                          </div>
                          {sel && <Check size={14} color="#4338ca" className="shrink-0 mt-0.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e4e7ec" }}>
                <div className="px-4 py-3" style={{ background: "#f2f4f7", borderBottom: "1px solid #e4e7ec" }}>
                  <span className="text-xs font-semibold" style={{ color: "#5a6472" }}>JOB SUMMARY</span>
                </div>
                {[
                  { label: "Title", value: title || "—" },
                  { label: "Location", value: location },
                  { label: "Type", value: type },
                  { label: "Salary", value: `$${Number(salaryMin).toLocaleString()} – $${Number(salaryMax).toLocaleString()}` },
                  { label: "Tech Stack", value: selectedStack.length ? selectedStack.join(", ") : "None selected" },
                  { label: "Min Score", value: `${minScore} / 100` },
                  { label: "Assessment Ticket", value: selectedTicket?.title ?? "None selected" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start px-4 py-2.5"
                    style={{ borderBottom: "1px solid #ffffff" }}>
                    <span className="text-xs w-36 shrink-0" style={{ color: "#8a93a3" }}>{label}</span>
                    <span className="text-xs font-medium text-[#131722]">{value}</span>
                  </div>
                ))}
              </div>

              {!selectedTicket && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: "#1c0f00", border: "1px solid #713f12" }}>
                  <AlertCircle size={13} color="#b54708" />
                  <span className="text-xs" style={{ color: "#b54708" }}>No ticket selected — candidates will apply without an assessment.</span>
                </div>
              )}

              {done && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: "#ecfdf3", border: "1px solid #a7d8bd" }}>
                  <Check size={13} color="#067647" />
                  <span className="text-xs font-semibold" style={{ color: "#067647" }}>
                    Job posted successfully!
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderTop: "1px solid #e4e7ec", background: "#f2f4f7" }}>
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ color: "#8a93a3", border: "1px solid #e4e7ec" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ffffff"; (e.currentTarget as HTMLElement).style.borderColor = "#9aa3b2"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#8a93a3"; (e.currentTarget as HTMLElement).style.borderColor = "#e4e7ec"; }}>
            {step > 1 ? "Back" : "Cancel"}
          </button>

          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !title.trim()}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              style={{
                background: step === 1 && !title.trim() ? "#eef1f5" : "linear-gradient(135deg, #4f46e5, #4338ca)",
                color: step === 1 && !title.trim() ? "#9aa3b2" : "white",
                cursor: step === 1 && !title.trim() ? "not-allowed" : "pointer",
              }}>
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handlePublish} disabled={publishing || done}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              style={{
                background: done ? "#ecfdf3" : "linear-gradient(135deg, #4f46e5, #4338ca)",
                color: done ? "#067647" : "white",
              }}>
              {publishing ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Publishing...
                </>
              ) : done ? (
                <><Check size={14} /> Published!</>
              ) : (
                <><Zap size={14} /> {isEdit ? "Save Changes" : "Publish Job"}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Job Detail Panel ─────────────────────────────────────────────────────────

function JobDetailPanel({ job, onClose, onEdit }: { job: Job; onClose: () => void; onEdit: () => void }) {
  const qualifiedPct = job.applicants > 0 ? Math.round((job.qualified / job.applicants) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-lg overflow-y-auto"
        style={{ background: "#ffffff", borderLeft: "1px solid #d5d9e0" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{ background: "#ffffff", borderBottom: "1px solid #e4e7ec" }}>
          <StatusBadge status={job.status} />
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              style={{ background: "#eef0fd", color: "#4338ca", border: "1px solid #c7c9f7" }}>
              <Pencil size={11} /> Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "#8a93a3" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ffffff"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#8a93a3"}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Title block */}
          <div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#eef0fd" }}>
                <Briefcase size={18} color="#4338ca" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#131722]">{job.title}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs flex items-center gap-1" style={{ color: "#5a6472" }}>
                    <Building2 size={11} />TechCorp Inc.
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: "#5a6472" }}>
                    <MapPin size={11} />{job.location}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: "#5a6472" }}>
                    <Clock size={11} />{job.type}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm mt-3 leading-relaxed" style={{ color: "#5a6472" }}>{job.description}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: "Applicants", value: job.applicants },
              { icon: Target, label: "Qualified", value: job.qualified },
              { icon: Eye, label: "Views", value: job.views },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: "#f2f4f7", border: "1px solid #e4e7ec" }}>
                <div className="flex items-center justify-center mb-1.5">
                  <Icon size={14} color="#4338ca" />
                </div>
                <div className="text-xl font-bold text-[#131722]">{value}</div>
                <div className="text-xs mt-0.5" style={{ color: "#8a93a3" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Qualification funnel */}
          {job.applicants > 0 && (
            <div className="rounded-xl p-4" style={{ background: "#f2f4f7", border: "1px solid #e4e7ec" }}>
              <div className="text-xs font-semibold mb-3" style={{ color: "#5a6472" }}>QUALIFICATION FUNNEL</div>
              <div className="space-y-2.5">
                {[
                  { label: "Applied", count: job.applicants, color: "#4338ca", pct: 100 },
                  { label: "Completed Assessment", count: Math.round(job.applicants * 0.7), color: "#4338ca", pct: 70 },
                  { label: `Passed (≥${job.minScore})`, count: job.qualified, color: "#067647", pct: qualifiedPct },
                ].map(({ label, count, color, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs" style={{ color: "#5a6472" }}>{label}</span>
                      <span className="text-xs font-semibold text-[#131722]">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "#e4e7ec" }}>
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assessment ticket */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "#5a6472" }}>ASSESSMENT TICKET</div>
            <div className="rounded-xl p-4" style={{ background: "#eef0fd", border: "1px solid #c7c9f7" }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "#eef0fd" }}>
                  <Code2 size={14} color="#4338ca" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#131722]">{job.ticket.title}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <DifficultyBadge level={job.ticket.difficulty} />
                    {job.ticket.stack.map(s => <StackTag key={s} tag={s} />)}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: "1px solid #c7c9f7" }}>
                <span className="text-xs" style={{ color: "#4338ca" }}>Min passing score:</span>
                <ScoreBadge score={job.minScore} />
              </div>
            </div>
          </div>

          {/* Tech stack */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "#5a6472" }}>REQUIRED STACK</div>
            <div className="flex flex-wrap gap-2">
              {job.stack.map(s => <StackTag key={s} tag={s} />)}
            </div>
          </div>

          {/* Salary */}
          <div className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: "#f2f4f7", border: "1px solid #e4e7ec" }}>
            <div className="flex items-center gap-2">
              <DollarSign size={14} color="#067647" />
              <span className="text-sm font-semibold text-[#131722]">{job.salary} / year</span>
            </div>
            <span className="text-xs" style={{ color: "#8a93a3" }}>Posted {job.postedAt}</span>
          </div>

          {/* Public link */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "#5a6472" }}>SHAREABLE LINK</div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "#f2f4f7", border: "1px solid #e4e7ec" }}>
              <Globe size={13} color="#8a93a3" />
              <span className="flex-1 text-xs truncate" style={{ color: "#4338ca" }}>
                devsimulate.io/jobs/{job.id}
              </span>
              <button className="text-xs px-2 py-1 rounded-lg"
                style={{ background: "#eef0fd", color: "#4338ca" }}>
                <Copy size={11} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [tab, setTab] = useState<"all" | "open" | "closed" | "draft">("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [viewJob, setViewJob] = useState<Job | null>(null);

  const counts = {
    all: JOBS.length,
    open: JOBS.filter(j => j.status === "open").length,
    closed: JOBS.filter(j => j.status === "closed").length,
    draft: JOBS.filter(j => j.status === "draft").length,
  };

  const filtered = JOBS.filter(j => {
    const matchTab = tab === "all" || j.status === tab;
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.stack.some(s => s.toLowerCase().includes(search.toLowerCase()));
    return matchTab && matchSearch;
  });

  const totalApplicants = JOBS.filter(j => j.status === "open").reduce((s, j) => s + j.applicants, 0);
  const totalQualified  = JOBS.filter(j => j.status === "open").reduce((s, j) => s + j.qualified, 0);
  const openJobs        = counts.open;

  return (
    <div className="p-6" style={{ background: "#f5f6f8", minHeight: "100vh" }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#131722]">Job Postings</h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a93a3" }}>
            Manage open roles and attach DevSimulate assessments to filter top candidates.
          </p>
        </div>
        <button onClick={() => { setEditJob(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "linear-gradient(135deg, #4f46e5, #4338ca)", color: "white" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.9"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}>
          <Plus size={15} /> Post a Job
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Briefcase, label: "Open Positions", value: openJobs, color: "#4338ca" },
          { icon: Users, label: "Total Applicants", value: totalApplicants, color: "#4338ca" },
          { icon: TrendingUp, label: "Qualified Candidates", value: totalQualified, color: "#067647", sub: `${Math.round((totalQualified / (totalApplicants || 1)) * 100)}% pass rate` },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold" style={{ color: "#8a93a3" }}>{label.toUpperCase()}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#eef1f5" }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#131722]">{value}</div>
            {sub && <div className="text-xs mt-0.5" style={{ color: "#067647" }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>

        {/* Toolbar */}
        <div className="px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderBottom: "1px solid #eef1f5" }}>

          {/* Tabs */}
          <div className="flex items-center gap-0.5">
            {(["all", "open", "closed", "draft"] as const).map(t => {
              const active = tab === t;
              const label = t.charAt(0).toUpperCase() + t.slice(1);
              return (
                <button key={t} onClick={() => setTab(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                  style={{
                    background: active ? "#eef0fd" : "transparent",
                    color: active ? "#4338ca" : "#8a93a3",
                  }}>
                  {label}
                  <span className="px-1.5 py-0.5 rounded-full text-xs"
                    style={{ background: active ? "#c7c9f7" : "#eef1f5", color: active ? "#a5b4fc" : "#9aa3b2" }}>
                    {counts[t]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8a93a3" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#131722] outline-none"
              style={{ background: "#f2f4f7", border: "1px solid #d5d9e0", width: "220px" }}
              placeholder="Search jobs or stack..." />
          </div>
        </div>

        {/* Table */}
        {filtered.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #eef1f5" }}>
                {["Job Title", "Status", "Ticket", "Min Score", "Applicants", "Views", "Posted", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold"
                    style={{ color: "#9aa3b2" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => (
                <JobRow key={job.id} job={job}
                  onView={j => setViewJob(j)}
                  onEdit={j => { setEditJob(j); setModalOpen(true); }} />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <Briefcase size={32} color="#d5d9e0" className="mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#131722] mb-1">No job postings found</p>
            <p className="text-xs" style={{ color: "#8a93a3" }}>
              {search ? "Try a different search term." : `No ${tab === "all" ? "" : tab} jobs yet.`}
            </p>
            {tab === "draft" && (
              <button onClick={() => { setEditJob(null); setModalOpen(true); }}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#eef0fd", color: "#4338ca" }}>
                Create your first job
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modalOpen && <JobModal onClose={() => setModalOpen(false)} editJob={editJob} />}
      {viewJob && (
        <JobDetailPanel job={viewJob} onClose={() => setViewJob(null)}
          onEdit={() => { setEditJob(viewJob); setViewJob(null); setModalOpen(true); }} />
      )}
    </div>
  );
}
