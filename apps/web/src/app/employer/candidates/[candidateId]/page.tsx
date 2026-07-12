"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Github, ExternalLink, Flag, AlertTriangle,
  CheckCircle, Clock, GitPullRequest, FileCode, Plus,
  Download, Mail, Calendar, Bot, MessageSquare, BookOpen,
  UserCheck, Shield, ClipboardList,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ─── Types ────────────────────────────────────────────────────────────────────

type AIDeclaration = "NO_AI_USED" | "AI_USED_FOR_PHRASING" | "AI_USED_FOR_UNDERSTANDING" | "AI_USED_FOR_ANSWER";
type Difficulty = "JUNIOR" | "MID" | "SENIOR";

interface QuestionBehavior {
  question: string;
  pasteEvents: number;
  pasteChars: number;
  tabSwitches: number;
  tabAwaySeconds: number;
  timeToFirstKeySeconds: number;
  totalTimeSeconds: number;
  pattern: string;
  patternType: "genuine" | "research" | "paste" | "suspicious";
}

interface CandidateDetail {
  id: string;
  name: string;
  email: string;
  githubUsername: string;
  initials: string;
  ticket: {
    code: string; title: string; difficulty: Difficulty; stack: string;
    submittedAt: string; timeTakenMinutes: number;
    prUrl: string; prTitle: string; filesChanged: number;
    linesAdded: number; linesRemoved: number; branchName: string;
  };
  scores: { total: number; diagnosis: number; design: number; communication: number; execution: number; bonus: number };
  review: {
    summary: string; topStrength: string; topImprovement: string;
    diagnosis: string; design: string; communication: string; execution: string;
  };
  followUp: {
    questions: Array<{ q: string; a: string; score: number; timeTaken: string }>;
    bonus: number; feedback: string;
  };
  authenticity: {
    score: number; declaration: AIDeclaration;
    mismatch: boolean; flagged: boolean; employerSummary: string;
    perQuestion: QuestionBehavior[];
  };
  percentile: number;
  benchmark: { average: number; top10: number };
  scoreHistory: Array<{ ticket: string; score: number; date: string }>;
}

interface CompareCandidate {
  id: string;
  name: string;
  initials: string;
  total: number;
  diagnosis: number;
  design: number;
  communication: number;
  execution: number;
  authenticity: number;
  flagged: boolean;
  declarationMismatch: boolean;
  timeMinutes: number;
  recommendation: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFF_STYLE: Record<Difficulty, { bg: string; color: string }> = {
  JUNIOR: { bg: "#ecfdf3", color: "#067647" },
  MID:    { bg: "#fff8ec", color: "#b54708" },
  SENIOR: { bg: "#fef3f2", color: "#b42318" },
};

const AI_META: Record<AIDeclaration, { label: string; icon: React.ElementType; color: string }> = {
  NO_AI_USED:                { label: "No AI used",       icon: UserCheck,     color: "#067647" },
  AI_USED_FOR_PHRASING:      { label: "AI for phrasing",  icon: MessageSquare, color: "#4338ca" },
  AI_USED_FOR_UNDERSTANDING: { label: "AI to understand", icon: BookOpen,      color: "#38bdf8" },
  AI_USED_FOR_ANSWER:        { label: "AI wrote answer",  icon: Bot,           color: "#b42318" },
};

const PATTERN_COLOR: Record<QuestionBehavior["patternType"], { bg: string; color: string; border: string }> = {
  genuine:    { bg: "#ecfdf3", color: "#067647", border: "#a7d8bd" },
  research:   { bg: "#0c1a2e", color: "#38bdf8", border: "#0369a1" },
  paste:      { bg: "#fef3f2", color: "#b42318", border: "#991b1b" },
  suspicious: { bg: "#fff8ec", color: "#b54708", border: "#78350f" },
};

function scoreColor(s: number) {
  return s >= 80 ? "#067647" : s >= 60 ? "#b54708" : s >= 40 ? "#b54708" : "#b42318";
}

function fmt(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// ─── Sub-components (unchanged) ───────────────────────────────────────────────

function ScoreCircle({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = scoreColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e7ec" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black text-[#131722]" style={{ fontSize: size * 0.28 }}>{score}</span>
        <span className="text-xs" style={{ color: "#8a93a3" }}>/100</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const color = scoreColor(pct);
  return (
    <div className="rounded-xl p-4" style={{ background: "#f2f4f7", border: "1px solid #eef1f5" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "#5a6472" }}>{label}</span>
        <span className="text-base font-black" style={{ color }}>{value}<span className="text-xs font-normal" style={{ color: "#9aa3b2" }}>/{max}</span></span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "#eef1f5" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-xs mt-1.5" style={{ color: "#9aa3b2" }}>{pct}%</div>
    </div>
  );
}

function BehaviorTimeline({ bq }: { bq: QuestionBehavior }) {
  const events: Array<{ label: string; color: string; time?: string }> = [];
  events.push({ label: "opened", color: "#8a93a3" });
  if (bq.pasteEvents > 0) {
    events.push({ label: `+${bq.pasteChars}ch paste`, color: "#b42318", time: `${bq.timeToFirstKeySeconds}s` });
  } else {
    events.push({ label: "first key", color: "#4338ca", time: `${bq.timeToFirstKeySeconds}s` });
  }
  events.push({ label: "submitted", color: "#067647", time: fmt(bq.totalTimeSeconds - bq.timeToFirstKeySeconds) });
  const pStyle = PATTERN_COLOR[bq.patternType];

  return (
    <div className="rounded-xl p-4" style={{ background: "#f2f4f7", border: "1px solid #eef1f5" }}>
      <p className="text-xs font-semibold mb-3 leading-relaxed" style={{ color: "#5a6472" }}>
        Q: {bq.question}
      </p>
      <div className="flex items-center gap-0 mb-4 overflow-x-auto pb-1">
        {events.map((ev, i) => (
          <div key={i} className="flex items-center shrink-0">
            {i > 0 && (
              <div className="flex items-center">
                <div className="h-px w-8 sm:w-16" style={{ background: "#d5d9e0" }} />
                <span className="text-xs px-1.5" style={{ color: "#8a93a3", whiteSpace: "nowrap" }}>{ev.time}</span>
                <div className="h-px w-8 sm:w-16" style={{ background: "#d5d9e0" }} />
              </div>
            )}
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: ev.color }} />
              <span className="text-xs mt-1" style={{ color: ev.color, whiteSpace: "nowrap" }}>{ev.label}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 flex-wrap mb-3">
        <div className="text-xs" style={{ color: "#8a93a3" }}>
          <span style={{ color: bq.pasteEvents > 0 ? "#b42318" : "#067647" }}>●</span>
          {" "}Paste events: <strong style={{ color: bq.pasteEvents > 0 ? "#b42318" : "#5a6472" }}>{bq.pasteEvents}{bq.pasteChars > 0 ? ` (${bq.pasteChars} chars)` : ""}</strong>
        </div>
        <div className="text-xs" style={{ color: "#8a93a3" }}>
          <span style={{ color: bq.tabSwitches > 1 ? "#b54708" : "#8a93a3" }}>●</span>
          {" "}Tab switches: <strong style={{ color: "#5a6472" }}>{bq.tabSwitches}{bq.tabAwaySeconds > 0 ? ` (away ${bq.tabAwaySeconds}s)` : ""}</strong>
        </div>
        <div className="text-xs" style={{ color: "#8a93a3" }}>
          Total time: <strong style={{ color: "#5a6472" }}>{fmt(bq.totalTimeSeconds)}</strong>
        </div>
      </div>
      <span className="text-xs font-semibold rounded-full px-2.5 py-0.5"
        style={{ background: pStyle.bg, color: pStyle.color, border: `1px solid ${pStyle.border}` }}>
        {bq.pattern}
      </span>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "results",   label: "Assessment Results" },
  { id: "breakdown", label: "Score Breakdown" },
  { id: "behavior",  label: "Behavior Analysis" },
  { id: "notes",     label: "Notes" },
  { id: "compare",   label: "Compare" },
];

// ─── Assessment Tab ───────────────────────────────────────────────────────────

function AssessmentTab({ c }: { c: CandidateDetail }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const { ticket, scores, review, followUp } = c;
  const diffStyle = DIFF_STYLE[ticket.difficulty] ?? DIFF_STYLE.MID;

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-bold rounded px-2 py-0.5"
                style={{ background: diffStyle.bg, color: diffStyle.color }}>
                {ticket.code}
              </span>
              <span className="text-xs font-semibold rounded px-2 py-0.5"
                style={{ background: "#eef0fd", color: "#4338ca" }}>
                {ticket.stack}
              </span>
              <span className="text-xs font-semibold rounded px-2 py-0.5"
                style={{ background: "#f2f4f7", color: "#8a93a3", border: "1px solid #e4e7ec" }}>
                {ticket.difficulty}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#131722]">{ticket.title}</h3>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "#8a93a3" }}>
              <Calendar size={12} /> {new Date(ticket.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#8a93a3" }}>
              <Clock size={12} /> {ticket.timeTakenMinutes} min to complete
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <ScoreBar label="Diagnosis"     value={scores.diagnosis}     max={40} />
          <ScoreBar label="Design"        value={scores.design}        max={30} />
          <ScoreBar label="Communication" value={scores.communication} max={20} />
          <ScoreBar label="Execution"     value={scores.execution}     max={10} />
        </div>

        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: "#f5f6f8", border: "1px solid #eef1f5" }}>
          <span className="text-sm font-semibold" style={{ color: "#5a6472" }}>Total Score</span>
          <span className="text-2xl font-black ml-auto" style={{ color: scoreColor(scores.total) }}>
            {scores.total}<span className="text-sm font-normal" style={{ color: "#9aa3b2" }}>/100</span>
          </span>
          {scores.bonus > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#eef0fd", color: "#4338ca" }}>+{scores.bonus} bonus</span>
          )}
        </div>
      </div>

      {/* Claude review */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e4e7ec" }}>
        <button
          onClick={() => setReviewOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left"
          style={{ background: "#ffffff" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#eef1f5"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#ffffff"}>
          <span className="text-sm font-bold text-[#131722]">Claude Review Summary</span>
          <span className="text-xs" style={{ color: "#8a93a3" }}>{reviewOpen ? "collapse ▲" : "expand ▼"}</span>
        </button>

        {reviewOpen && (
          <div className="px-5 pb-5 space-y-4" style={{ background: "#f2f4f7" }}>
            <p className="text-sm leading-relaxed pt-4" style={{ color: "#5a6472", fontFamily: "ui-monospace, monospace" }}>
              &ldquo;{review.summary}&rdquo;
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Diagnosis",     text: review.diagnosis,     color: "#4338ca" },
                { label: "Design",        text: review.design,        color: "#38bdf8" },
                { label: "Communication", text: review.communication, color: "#b54708" },
                { label: "Execution",     text: review.execution,     color: "#067647" },
              ].map(({ label, text, color }) => (
                <div key={label} className="rounded-lg p-3" style={{ background: "#ffffff", border: "1px solid #eef1f5" }}>
                  <div className="text-xs font-bold mb-1" style={{ color }}>{label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "#5a6472" }}>{text}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "#ecfdf3", border: "1px solid #a7d8bd" }}>
                <div className="text-xs font-bold mb-1" style={{ color: "#067647" }}>Top Strength</div>
                <div className="text-xs leading-relaxed" style={{ color: "#86efac" }}>{review.topStrength}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#fff8ec", border: "1px solid #78350f" }}>
                <div className="text-xs font-bold mb-1" style={{ color: "#b54708" }}>Top Improvement</div>
                <div className="text-xs leading-relaxed" style={{ color: "#fcd34d" }}>{review.topImprovement}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PR details */}
      <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
        <div className="flex items-center gap-2 mb-4">
          <GitPullRequest size={15} style={{ color: "#4338ca" }} />
          <span className="text-sm font-bold text-[#131722]">PR Details</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Files changed",  value: ticket.filesChanged,           icon: FileCode },
            { label: "Lines added",    value: `+${ticket.linesAdded}`,   color: "#067647", icon: Plus },
            { label: "Lines removed",  value: `-${ticket.linesRemoved}`,  color: "#b42318", icon: ClipboardList },
            { label: "Time taken",     value: `${ticket.timeTakenMinutes}m`, icon: Clock },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-lg p-3 text-center" style={{ background: "#f2f4f7", border: "1px solid #eef1f5" }}>
              <Icon size={14} style={{ color: "#8a93a3", margin: "0 auto 6px" }} />
              <div className="text-base font-black" style={{ color: color ?? "#ffffff" }}>{value}</div>
              <div className="text-xs" style={{ color: "#8a93a3" }}>{label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <code className="text-xs px-2 py-1 rounded" style={{ background: "#f2f4f7", color: "#5a6472", border: "1px solid #eef1f5" }}>
            {ticket.branchName}
          </code>
          <a href={ticket.prUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
            style={{ color: "#4338ca" }}>
            View PR on GitHub <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Follow-up Q&A */}
      {followUp.questions.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e4e7ec" }}>
          <div className="px-5 py-4" style={{ background: "#ffffff", borderBottom: "1px solid #eef1f5" }}>
            <span className="text-sm font-bold text-[#131722]">Follow-up Questions</span>
            {followUp.bonus > 0 && (
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#eef0fd", color: "#4338ca" }}>
                +{followUp.bonus} bonus points
              </span>
            )}
          </div>
          <div className="divide-y" style={{ background: "#f2f4f7", borderColor: "#eef1f5" }}>
            {followUp.questions.map((fq, i) => (
              <div key={i} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <p className="text-xs font-semibold" style={{ color: "#4338ca" }}>Q{i + 1}: {fq.q}</p>
                  <span className="text-xs font-black shrink-0" style={{ color: scoreColor(fq.score * 10) }}>
                    {fq.score}/10
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#5a6472", fontFamily: "ui-monospace, monospace" }}>
                  &ldquo;{fq.a}&rdquo;
                </p>
              </div>
            ))}
            {followUp.feedback && (
              <div className="px-5 py-3 text-xs leading-relaxed" style={{ color: "#8a93a3" }}>
                <span className="font-semibold" style={{ color: "#4338ca" }}>AI Assessment: </span>
                {followUp.feedback}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Score Breakdown Tab ──────────────────────────────────────────────────────

function ScoreBreakdownTab({ c }: { c: CandidateDetail }) {
  const { scores, percentile, benchmark, scoreHistory } = c;
  const radarData = [
    { dim: "Diagnosis",  value: Math.round((scores.diagnosis / 40) * 100),     full: 100 },
    { dim: "Design",     value: Math.round((scores.design / 30) * 100),         full: 100 },
    { dim: "Comms",      value: Math.round((scores.communication / 20) * 100),  full: 100 },
    { dim: "Execution",  value: Math.round((scores.execution / 10) * 100),      full: 100 },
    { dim: "Follow-up",  value: Math.round((scores.bonus / 20) * 100),          full: 100 },
  ];
  const benchmarkData = [
    { name: "This candidate", score: scores.total,      color: "#4338ca" },
    { name: "Ticket average", score: benchmark.average, color: "#8a93a3" },
    { name: "Top 10%",        score: benchmark.top10,   color: "#067647" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
          <h3 className="text-sm font-bold text-[#131722] mb-4">Skill Radar</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e4e7ec" />
              <PolarAngleAxis dataKey="dim" tick={{ fill: "#5a6472", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="value" stroke="#4338ca" fill="#4338ca" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
          <h3 className="text-sm font-bold text-[#131722] mb-1">Benchmark Comparison</h3>
          <p className="text-xs mb-4" style={{ color: "#8a93a3" }}>{c.ticket.code} · all candidates</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={benchmarkData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#9aa3b2", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#5a6472", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip cursor={{ fill: "#eef1f5" }}
                contentStyle={{ background: "#ffffff", border: "1px solid #e4e7ec", borderRadius: 8, fontSize: 12, color: "white" }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {benchmarkData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 rounded-lg px-4 py-3 text-xs" style={{ background: "#f2f4f7", border: "1px solid #eef1f5" }}>
            This candidate scored better than{" "}
            <span className="font-black" style={{ color: scoreColor(percentile) }}>{percentile}%</span>
            {" "}of all developers who attempted {c.ticket.code}.
          </div>
        </div>
      </div>

      {scoreHistory.length > 1 && (
        <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
          <h3 className="text-sm font-bold text-[#131722] mb-4">Score History</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={scoreHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
              <XAxis dataKey="date" tick={{ fill: "#8a93a3", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#8a93a3", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e4e7ec", borderRadius: 8, fontSize: 12, color: "white" }}
                formatter={(v) => [`${v}/100`, "Score"]} />
              <Line type="monotone" dataKey="score" stroke="#4338ca" strokeWidth={2.5}
                dot={{ fill: "#4338ca", stroke: "#f5f6f8", strokeWidth: 2, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Behavior Tab ─────────────────────────────────────────────────────────────

function BehaviorTab({ c }: { c: CandidateDetail }) {
  const { authenticity } = c;
  const ai = AI_META[authenticity.declaration] ?? AI_META.NO_AI_USED;
  const AiIcon = ai.icon;

  const overallStyle =
    authenticity.score >= 80
      ? { bg: "#ecfdf3", border: "#a7d8bd", color: "#067647", icon: CheckCircle, title: "No integrity concerns detected.", body: "Candidate demonstrated genuine understanding throughout. Declaration matches observed behavior." }
      : authenticity.score >= 50
      ? { bg: "#fff8ec", border: "#e6c98a", color: "#b54708", icon: AlertTriangle, title: "Minor assisted patterns detected.", body: "Common in modern engineering practice. Review follow-up answers directly before deciding." }
      : { bg: "#fef3f2", border: "#991b1b", color: "#b42318", icon: Flag, title: "Significant integrity concerns detected.", body: "Recommend direct technical interview before proceeding. Declaration mismatch flagged." };

  const OverallIcon = overallStyle.icon;

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#8a93a3" }}>Authenticity Score</div>
            <div className="text-5xl font-black mb-1" style={{ color: scoreColor(authenticity.score) }}>
              {authenticity.score}
            </div>
            <div className="text-sm" style={{ color: "#8a93a3" }}>/ 100</div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#8a93a3" }}>AI Declaration</div>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ai.color }}>
                <AiIcon size={15} />
                {ai.label}
              </div>
            </div>
            {authenticity.mismatch && (
              <div className="flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
                style={{ background: "#fff8ec", color: "#b54708", border: "1px solid #78350f" }}>
                <AlertTriangle size={11} /> Declaration mismatch
              </div>
            )}
            {authenticity.flagged && (
              <div className="flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
                style={{ background: "#fef3f2", color: "#b42318", border: "1px solid #991b1b" }}>
                <Flag size={11} /> Integrity flag
              </div>
            )}
          </div>
        </div>
        {authenticity.employerSummary && (
          <div className="mt-4 pt-4 text-xs leading-relaxed" style={{ borderTop: "1px solid #eef1f5", color: "#5a6472" }}>
            <span className="font-semibold" style={{ color: "#4338ca" }}>AI Assessment: </span>
            {authenticity.employerSummary}
          </div>
        )}
      </div>

      {authenticity.perQuestion.length > 0 && (
        <div>
          <div className="text-sm font-bold text-[#131722] mb-3">Per-Question Behavior</div>
          <div className="space-y-3">
            {authenticity.perQuestion.map((bq, i) => (
              <BehaviorTimeline key={i} bq={bq} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl p-5" style={{ background: overallStyle.bg, border: `1px solid ${overallStyle.border}` }}>
        <div className="flex items-start gap-3">
          <OverallIcon size={18} className="shrink-0 mt-0.5" style={{ color: overallStyle.color }} />
          <div>
            <div className="text-sm font-bold mb-1" style={{ color: overallStyle.color }}>{overallStyle.title}</div>
            <div className="text-xs leading-relaxed" style={{ color: overallStyle.color, opacity: 0.8 }}>{overallStyle.body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ c }: { c: CandidateDetail }) {
  const [notes, setNotes] = useState([
    { id: 1, author: "You", text: "Review complete. Check behavior analysis tab for authenticity details.", ts: "May 26, 2026 · 9:00 AM" },
  ]);
  const [draft, setDraft] = useState("");

  function addNote() {
    if (!draft.trim()) return;
    setNotes(n => [{
      id: Date.now(), author: "You", text: draft.trim(),
      ts: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
          " · " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    }, ...n]);
    setDraft("");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#8a93a3" }}>
          <Shield size={12} /> Internal notes — never visible to candidate ({c.name})
        </div>
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Add a note…" rows={3}
          className="w-full rounded-lg border px-3 py-2.5 text-sm resize-none focus:outline-none transition-colors"
          style={{ background: "#f2f4f7", borderColor: "#e4e7ec", color: "#131722" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#4338ca")}
          onBlur={e => (e.currentTarget.style.borderColor = "#e4e7ec")} />
        <div className="flex justify-end mt-2">
          <button onClick={addNote} disabled={!draft.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#131722] disabled:opacity-40"
            style={{ background: "#4338ca" }}>
            <Plus size={14} /> Add note
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {notes.map(n => (
          <div key={n.id} className="rounded-xl p-4" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "#eef0fd", color: "#4338ca" }}>Y</div>
                <span className="text-xs font-semibold text-[#131722]">{n.author}</span>
              </div>
              <span className="text-xs" style={{ color: "#9aa3b2" }}>{n.ts}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#5a6472" }}>{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Compare Tab ──────────────────────────────────────────────────────────────

const REC_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "STRONG YES": { color: "#067647", bg: "#ecfdf3", border: "#a7d8bd" },
  "YES":        { color: "#86efac", bg: "#ecfdf3", border: "#a7d8bd" },
  "MAYBE":      { color: "#b54708", bg: "#fff8ec", border: "#78350f" },
  "NO":         { color: "#b42318", bg: "#fef3f2", border: "#991b1b" },
};

function CompareTab({ currentId }: { currentId: string }) {
  const [compareData, setCompareData] = useState<CompareCandidate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/employer/candidates/compare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateIds: [] }), // empty = all
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json() as { candidates: CompareCandidate[] };
        setCompareData(json.candidates);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load compare data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl p-8 text-center animate-pulse" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
        <div className="w-32 h-4 rounded mx-auto mb-3" style={{ background: "#eef1f5" }} />
        <div className="w-48 h-3 rounded mx-auto" style={{ background: "#eef1f5" }} />
      </div>
    );
  }

  if (error || !compareData) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
        <p className="text-sm" style={{ color: "#b42318" }}>{error ?? "Could not load compare data"}</p>
      </div>
    );
  }

  const rows: Array<{ label: string; key: keyof CompareCandidate; isTime?: boolean }> = [
    { label: "Total Score",   key: "total" },
    { label: "Authenticity",  key: "authenticity" },
    { label: "Diagnosis",     key: "diagnosis" },
    { label: "Design",        key: "design" },
    { label: "Communication", key: "communication" },
    { label: "Execution",     key: "execution" },
    { label: "Time Taken",    key: "timeMinutes", isTime: true },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e4e7ec" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#ffffff", borderBottom: "1px solid #e4e7ec" }}>
              <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "#9aa3b2" }}>Dimension</th>
              {compareData.map(c => (
                <th key={c.id} className="px-5 py-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: c.id === currentId ? "#eef0fd" : "#eef1f5",
                        color: c.id === currentId ? "#4338ca" : "#8a93a3",
                        border: c.id === currentId ? "2px solid #4338ca" : "1px solid #d5d9e0",
                      }}>
                      {c.initials}
                    </div>
                    <span className="text-xs font-semibold text-[#131722]">{c.name.split(" ")[0]}</span>
                    {c.flagged && <Flag size={10} style={{ color: "#b42318" }} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: "#f2f4f7" }}>
            {rows.map((row, ri) => {
              const vals = compareData.map(c => c[row.key] as number);
              const best = row.isTime ? Math.min(...vals) : Math.max(...vals);

              return (
                <tr key={row.key as string}
                  style={{ borderBottom: ri < rows.length - 1 ? "1px solid #eef1f5" : "none" }}>
                  <td className="px-5 py-3.5 text-xs font-semibold" style={{ color: "#8a93a3" }}>{row.label}</td>
                  {compareData.map((c, ci) => {
                    const v = vals[ci];
                    const isBest = v === best;
                    return (
                      <td key={c.id} className="px-5 py-3.5 text-center"
                        style={{ borderLeft: c.flagged ? "2px solid #b4231833" : undefined }}>
                        <div className={`text-xs font-semibold ${isBest ? "rounded-lg px-2 py-0.5 inline-block" : ""}`}
                          style={isBest
                            ? { background: "#ecfdf3", color: "#067647", border: "1px solid #a7d8bd" }
                            : { color: "#5a6472" }}>
                          {row.key === "total" || row.key === "authenticity"
                            ? <span style={{ color: scoreColor(v) }}>{v}/100</span>
                            : row.isTime
                            ? `${v} min`
                            : v}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Flagged row */}
            <tr style={{ borderBottom: "1px solid #eef1f5" }}>
              <td className="px-5 py-3.5 text-xs font-semibold" style={{ color: "#8a93a3" }}>Flagged</td>
              {compareData.map(c => (
                <td key={c.id} className="px-5 py-3.5 text-center"
                  style={{ borderLeft: c.flagged ? "2px solid #b4231833" : undefined }}>
                  {c.flagged
                    ? <span className="text-xs font-bold" style={{ color: "#b42318" }}>Yes ⚠</span>
                    : <span className="text-xs font-bold" style={{ color: "#067647" }}>No ✓</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recommendation row — the money moment */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e4e7ec" }}>
        <div className="px-5 py-3 text-xs font-bold uppercase tracking-widest"
          style={{ background: "#ffffff", color: "#8a93a3", borderBottom: "1px solid #eef1f5" }}>
          Recommendation
        </div>
        <div className="grid"
          style={{ gridTemplateColumns: `repeat(${compareData.length}, 1fr)`, background: "#f2f4f7" }}>
          {compareData.map(c => {
            const s = REC_STYLE[c.recommendation] ?? REC_STYLE.MAYBE;
            return (
              <div key={c.id} className="flex flex-col items-center gap-2 px-4 py-5"
                style={{ borderLeft: c.flagged ? "3px solid #b42318" : "none" }}>
                <div className="text-xs font-semibold" style={{ color: "#5a6472" }}>
                  {c.name.split(" ")[0]}
                </div>
                <span className="text-sm font-black px-4 py-2 rounded-xl"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {c.recommendation}
                </span>
                {c.flagged && (
                  <span className="text-xs" style={{ color: "#b42318" }}>
                    Score {c.total} — flagged
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#131722" }}>
      <div className="px-8 py-6 animate-pulse" style={{ background: "#f5f6f8", borderBottom: "1px solid #eef1f5" }}>
        <div className="w-24 h-3 rounded mb-5" style={{ background: "#eef1f5" }} />
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl shrink-0" style={{ background: "#eef1f5" }} />
          <div className="flex-1 space-y-2">
            <div className="w-48 h-6 rounded" style={{ background: "#eef1f5" }} />
            <div className="w-64 h-3 rounded" style={{ background: "#eef1f5" }} />
          </div>
        </div>
      </div>
      <main className="flex-1 px-8 py-6">
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "#ffffff", border: "1px solid #e4e7ec" }}>
              <div className="w-full h-3 rounded mb-2" style={{ background: "#eef1f5" }} />
              <div className="w-2/3 h-3 rounded" style={{ background: "#eef1f5" }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CandidateDetailPage() {
  const { candidateId } = useParams() as { candidateId: string };
  const [data, setData] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("results");

  useEffect(() => {
    if (!candidateId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/employer/candidates/${candidateId}`);
        if (res.status === 404) throw new Error("Candidate not found");
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json() as { data: CandidateDetail };
        setData(json.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load candidate");
      } finally {
        setLoading(false);
      }
    })();
  }, [candidateId]);

  if (loading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ color: "#5a6472" }}>
        <div className="text-4xl mb-4">🔍</div>
        <div className="text-lg font-bold text-[#131722] mb-2">
          {error ?? "Candidate not found"}
        </div>
        <Link href="/employer/dashboard" className="text-sm" style={{ color: "#4338ca" }}>
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const c = data;
  const ai = AI_META[c.authenticity.declaration] ?? AI_META.NO_AI_USED;
  const AiIcon = ai.icon;

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#131722" }}>

      {/* ── Header ── */}
      <header className="px-8 py-6" style={{ background: "#f5f6f8", borderBottom: "1px solid #eef1f5" }}>
        <Link href="/employer/dashboard"
          className="flex items-center gap-2 text-xs font-medium mb-5 w-fit transition-colors"
          style={{ color: "#8a93a3" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ffffff"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#8a93a3"}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black shrink-0"
              style={{ background: "#eef0fd", color: "#4338ca", border: "2px solid #c7c9f7" }}>
              {c.initials}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-black text-[#131722]">{c.name}</h1>
                {c.authenticity.flagged && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "#fef3f2", color: "#b42318", border: "1px solid #991b1b" }}>
                    <Flag size={11} /> Flagged
                  </span>
                )}
                {c.authenticity.mismatch && !c.authenticity.flagged && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "#fff8ec", color: "#b54708", border: "1px solid #78350f" }}>
                    <AlertTriangle size={11} /> Mismatch
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "#8a93a3" }}>
                  <Mail size={13} /> {c.email}
                </div>
                <a href={`https://github.com/${c.githubUsername}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm transition-colors" style={{ color: "#8a93a3" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ffffff"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#8a93a3"}>
                  <Github size={13} /> @{c.githubUsername} <ExternalLink size={11} />
                </a>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "#eef0fd", color: ai.color, border: `1px solid ${ai.color}33` }}>
                  <AiIcon size={11} /> {ai.label}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "#f2f4f7", color: "#5a6472", border: "1px solid #eef1f5" }}>
                  Auth: {c.authenticity.score}/100
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-6">
            <ScoreCircle score={c.scores.total} size={100} />
            <div className="flex flex-col gap-2 pt-1">
              <button className="px-4 py-2 rounded-lg text-sm font-semibold text-[#131722] transition-all"
                style={{ background: "linear-gradient(135deg, #4f46e5, #4338ca)" }}>
                Schedule Interview
              </button>
              <button className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: "#ffffff", border: "1px solid #e4e7ec", color: "#131722" }}>
                Add Note
              </button>
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "#f5f6f8", border: "1px solid #991b1b", color: "#b42318" }}>
                  Reject
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "#f5f6f8", border: "1px solid #e4e7ec", color: "#5a6472" }}>
                  <Download size={12} /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="px-8" style={{ background: "#f5f6f8", borderBottom: "1px solid #eef1f5" }}>
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-3.5 text-sm font-medium transition-colors relative"
              style={{ color: tab === t.id ? "#ffffff" : "#8a93a3" }}>
              {t.label}
              {tab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#4338ca" }} />
              )}
              {t.id === "behavior" && c.authenticity.flagged && (
                <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#fef3f2", color: "#b42318" }}>!</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <main className="flex-1 px-8 py-6">
        {tab === "results"   && <AssessmentTab c={c} />}
        {tab === "breakdown" && <ScoreBreakdownTab c={c} />}
        {tab === "behavior"  && <BehaviorTab c={c} />}
        {tab === "notes"     && <NotesTab c={c} />}
        {tab === "compare"   && <CompareTab currentId={candidateId} />}
      </main>
    </div>
  );
}
