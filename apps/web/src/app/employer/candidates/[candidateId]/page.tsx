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
  JUNIOR: { bg: "#052e16", color: "#4ade80" },
  MID:    { bg: "#451a03", color: "#fbbf24" },
  SENIOR: { bg: "#450a0a", color: "#f87171" },
};

const AI_META: Record<AIDeclaration, { label: string; icon: React.ElementType; color: string }> = {
  NO_AI_USED:                { label: "No AI used",       icon: UserCheck,     color: "#4ade80" },
  AI_USED_FOR_PHRASING:      { label: "AI for phrasing",  icon: MessageSquare, color: "#818cf8" },
  AI_USED_FOR_UNDERSTANDING: { label: "AI to understand", icon: BookOpen,      color: "#38bdf8" },
  AI_USED_FOR_ANSWER:        { label: "AI wrote answer",  icon: Bot,           color: "#f87171" },
};

const PATTERN_COLOR: Record<QuestionBehavior["patternType"], { bg: string; color: string; border: string }> = {
  genuine:    { bg: "#052e16", color: "#4ade80", border: "#166534" },
  research:   { bg: "#0c1a2e", color: "#38bdf8", border: "#0369a1" },
  paste:      { bg: "#450a0a", color: "#f87171", border: "#991b1b" },
  suspicious: { bg: "#451a03", color: "#fbbf24", border: "#78350f" },
};

function scoreColor(s: number) {
  return s >= 80 ? "#4ade80" : s >= 60 ? "#fbbf24" : s >= 40 ? "#fb923c" : "#f87171";
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#222222" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black text-white" style={{ fontSize: size * 0.28 }}>{score}</span>
        <span className="text-xs" style={{ color: "#555555" }}>/100</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const color = scoreColor(pct);
  return (
    <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "#888888" }}>{label}</span>
        <span className="text-base font-black" style={{ color }}>{value}<span className="text-xs font-normal" style={{ color: "#444444" }}>/{max}</span></span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-xs mt-1.5" style={{ color: "#444444" }}>{pct}%</div>
    </div>
  );
}

function BehaviorTimeline({ bq }: { bq: QuestionBehavior }) {
  const events: Array<{ label: string; color: string; time?: string }> = [];
  events.push({ label: "opened", color: "#555555" });
  if (bq.pasteEvents > 0) {
    events.push({ label: `+${bq.pasteChars}ch paste`, color: "#f87171", time: `${bq.timeToFirstKeySeconds}s` });
  } else {
    events.push({ label: "first key", color: "#818cf8", time: `${bq.timeToFirstKeySeconds}s` });
  }
  events.push({ label: "submitted", color: "#4ade80", time: fmt(bq.totalTimeSeconds - bq.timeToFirstKeySeconds) });
  const pStyle = PATTERN_COLOR[bq.patternType];

  return (
    <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
      <p className="text-xs font-semibold mb-3 leading-relaxed" style={{ color: "#888888" }}>
        Q: {bq.question}
      </p>
      <div className="flex items-center gap-0 mb-4 overflow-x-auto pb-1">
        {events.map((ev, i) => (
          <div key={i} className="flex items-center shrink-0">
            {i > 0 && (
              <div className="flex items-center">
                <div className="h-px w-8 sm:w-16" style={{ background: "#333333" }} />
                <span className="text-xs px-1.5" style={{ color: "#555555", whiteSpace: "nowrap" }}>{ev.time}</span>
                <div className="h-px w-8 sm:w-16" style={{ background: "#333333" }} />
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
        <div className="text-xs" style={{ color: "#555555" }}>
          <span style={{ color: bq.pasteEvents > 0 ? "#f87171" : "#4ade80" }}>●</span>
          {" "}Paste events: <strong style={{ color: bq.pasteEvents > 0 ? "#f87171" : "#888888" }}>{bq.pasteEvents}{bq.pasteChars > 0 ? ` (${bq.pasteChars} chars)` : ""}</strong>
        </div>
        <div className="text-xs" style={{ color: "#555555" }}>
          <span style={{ color: bq.tabSwitches > 1 ? "#fbbf24" : "#555555" }}>●</span>
          {" "}Tab switches: <strong style={{ color: "#888888" }}>{bq.tabSwitches}{bq.tabAwaySeconds > 0 ? ` (away ${bq.tabAwaySeconds}s)` : ""}</strong>
        </div>
        <div className="text-xs" style={{ color: "#555555" }}>
          Total time: <strong style={{ color: "#888888" }}>{fmt(bq.totalTimeSeconds)}</strong>
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
      <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-bold rounded px-2 py-0.5"
                style={{ background: diffStyle.bg, color: diffStyle.color }}>
                {ticket.code}
              </span>
              <span className="text-xs font-semibold rounded px-2 py-0.5"
                style={{ background: "#1e1b4b", color: "#818cf8" }}>
                {ticket.stack}
              </span>
              <span className="text-xs font-semibold rounded px-2 py-0.5"
                style={{ background: "#0d0d0d", color: "#555555", border: "1px solid #222222" }}>
                {ticket.difficulty}
              </span>
            </div>
            <h3 className="text-base font-bold text-white">{ticket.title}</h3>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "#555555" }}>
              <Calendar size={12} /> {new Date(ticket.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#555555" }}>
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
          style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
          <span className="text-sm font-semibold" style={{ color: "#888888" }}>Total Score</span>
          <span className="text-2xl font-black ml-auto" style={{ color: scoreColor(scores.total) }}>
            {scores.total}<span className="text-sm font-normal" style={{ color: "#444444" }}>/100</span>
          </span>
          {scores.bonus > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#1e1b4b", color: "#818cf8" }}>+{scores.bonus} bonus</span>
          )}
        </div>
      </div>

      {/* Claude review */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222222" }}>
        <button
          onClick={() => setReviewOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left"
          style={{ background: "#111111" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#161616"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#111111"}>
          <span className="text-sm font-bold text-white">Claude Review Summary</span>
          <span className="text-xs" style={{ color: "#555555" }}>{reviewOpen ? "collapse ▲" : "expand ▼"}</span>
        </button>

        {reviewOpen && (
          <div className="px-5 pb-5 space-y-4" style={{ background: "#0d0d0d" }}>
            <p className="text-sm leading-relaxed pt-4" style={{ color: "#aaaaaa", fontFamily: "ui-monospace, monospace" }}>
              &ldquo;{review.summary}&rdquo;
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Diagnosis",     text: review.diagnosis,     color: "#818cf8" },
                { label: "Design",        text: review.design,        color: "#38bdf8" },
                { label: "Communication", text: review.communication, color: "#fbbf24" },
                { label: "Execution",     text: review.execution,     color: "#4ade80" },
              ].map(({ label, text, color }) => (
                <div key={label} className="rounded-lg p-3" style={{ background: "#111111", border: "1px solid #1a1a1a" }}>
                  <div className="text-xs font-bold mb-1" style={{ color }}>{label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "#888888" }}>{text}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "#052e16", border: "1px solid #166534" }}>
                <div className="text-xs font-bold mb-1" style={{ color: "#4ade80" }}>Top Strength</div>
                <div className="text-xs leading-relaxed" style={{ color: "#86efac" }}>{review.topStrength}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#451a03", border: "1px solid #78350f" }}>
                <div className="text-xs font-bold mb-1" style={{ color: "#fbbf24" }}>Top Improvement</div>
                <div className="text-xs leading-relaxed" style={{ color: "#fcd34d" }}>{review.topImprovement}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PR details */}
      <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
        <div className="flex items-center gap-2 mb-4">
          <GitPullRequest size={15} style={{ color: "#818cf8" }} />
          <span className="text-sm font-bold text-white">PR Details</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Files changed",  value: ticket.filesChanged,           icon: FileCode },
            { label: "Lines added",    value: `+${ticket.linesAdded}`,   color: "#4ade80", icon: Plus },
            { label: "Lines removed",  value: `-${ticket.linesRemoved}`,  color: "#f87171", icon: ClipboardList },
            { label: "Time taken",     value: `${ticket.timeTakenMinutes}m`, icon: Clock },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-lg p-3 text-center" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <Icon size={14} style={{ color: "#555555", margin: "0 auto 6px" }} />
              <div className="text-base font-black" style={{ color: color ?? "#ffffff" }}>{value}</div>
              <div className="text-xs" style={{ color: "#555555" }}>{label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <code className="text-xs px-2 py-1 rounded" style={{ background: "#0d0d0d", color: "#888888", border: "1px solid #1a1a1a" }}>
            {ticket.branchName}
          </code>
          <a href={ticket.prUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
            style={{ color: "#6366f1" }}>
            View PR on GitHub <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Follow-up Q&A */}
      {followUp.questions.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222222" }}>
          <div className="px-5 py-4" style={{ background: "#111111", borderBottom: "1px solid #1a1a1a" }}>
            <span className="text-sm font-bold text-white">Follow-up Questions</span>
            {followUp.bonus > 0 && (
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#1e1b4b", color: "#818cf8" }}>
                +{followUp.bonus} bonus points
              </span>
            )}
          </div>
          <div className="divide-y" style={{ background: "#0d0d0d", borderColor: "#1a1a1a" }}>
            {followUp.questions.map((fq, i) => (
              <div key={i} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <p className="text-xs font-semibold" style={{ color: "#6366f1" }}>Q{i + 1}: {fq.q}</p>
                  <span className="text-xs font-black shrink-0" style={{ color: scoreColor(fq.score * 10) }}>
                    {fq.score}/10
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#888888", fontFamily: "ui-monospace, monospace" }}>
                  &ldquo;{fq.a}&rdquo;
                </p>
              </div>
            ))}
            {followUp.feedback && (
              <div className="px-5 py-3 text-xs leading-relaxed" style={{ color: "#666666" }}>
                <span className="font-semibold" style={{ color: "#818cf8" }}>AI Assessment: </span>
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
    { name: "This candidate", score: scores.total,      color: "#6366f1" },
    { name: "Ticket average", score: benchmark.average, color: "#555555" },
    { name: "Top 10%",        score: benchmark.top10,   color: "#22c55e" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
          <h3 className="text-sm font-bold text-white mb-4">Skill Radar</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#222222" />
              <PolarAngleAxis dataKey="dim" tick={{ fill: "#888888", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
          <h3 className="text-sm font-bold text-white mb-1">Benchmark Comparison</h3>
          <p className="text-xs mb-4" style={{ color: "#555555" }}>{c.ticket.code} · all candidates</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={benchmarkData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#444444", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#888888", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip cursor={{ fill: "#1a1a1a" }}
                contentStyle={{ background: "#111111", border: "1px solid #222222", borderRadius: 8, fontSize: 12, color: "white" }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {benchmarkData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 rounded-lg px-4 py-3 text-xs" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            This candidate scored better than{" "}
            <span className="font-black" style={{ color: scoreColor(percentile) }}>{percentile}%</span>
            {" "}of all developers who attempted {c.ticket.code}.
          </div>
        </div>
      </div>

      {scoreHistory.length > 1 && (
        <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
          <h3 className="text-sm font-bold text-white mb-4">Score History</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={scoreHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="date" tick={{ fill: "#555555", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#555555", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#111111", border: "1px solid #222222", borderRadius: 8, fontSize: 12, color: "white" }}
                formatter={(v) => [`${v}/100`, "Score"]} />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5}
                dot={{ fill: "#6366f1", stroke: "#0a0a0a", strokeWidth: 2, r: 4 }} />
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
      ? { bg: "#052e16", border: "#166534", color: "#4ade80", icon: CheckCircle, title: "No integrity concerns detected.", body: "Candidate demonstrated genuine understanding throughout. Declaration matches observed behavior." }
      : authenticity.score >= 50
      ? { bg: "#422006", border: "#92400e", color: "#fbbf24", icon: AlertTriangle, title: "Minor assisted patterns detected.", body: "Common in modern engineering practice. Review follow-up answers directly before deciding." }
      : { bg: "#450a0a", border: "#991b1b", color: "#f87171", icon: Flag, title: "Significant integrity concerns detected.", body: "Recommend direct technical interview before proceeding. Declaration mismatch flagged." };

  const OverallIcon = overallStyle.icon;

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #222222" }}>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#555555" }}>Authenticity Score</div>
            <div className="text-5xl font-black mb-1" style={{ color: scoreColor(authenticity.score) }}>
              {authenticity.score}
            </div>
            <div className="text-sm" style={{ color: "#666666" }}>/ 100</div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#555555" }}>AI Declaration</div>
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ai.color }}>
                <AiIcon size={15} />
                {ai.label}
              </div>
            </div>
            {authenticity.mismatch && (
              <div className="flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
                style={{ background: "#451a03", color: "#fbbf24", border: "1px solid #78350f" }}>
                <AlertTriangle size={11} /> Declaration mismatch
              </div>
            )}
            {authenticity.flagged && (
              <div className="flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1"
                style={{ background: "#450a0a", color: "#f87171", border: "1px solid #991b1b" }}>
                <Flag size={11} /> Integrity flag
              </div>
            )}
          </div>
        </div>
        {authenticity.employerSummary && (
          <div className="mt-4 pt-4 text-xs leading-relaxed" style={{ borderTop: "1px solid #1a1a1a", color: "#888888" }}>
            <span className="font-semibold" style={{ color: "#818cf8" }}>AI Assessment: </span>
            {authenticity.employerSummary}
          </div>
        )}
      </div>

      {authenticity.perQuestion.length > 0 && (
        <div>
          <div className="text-sm font-bold text-white mb-3">Per-Question Behavior</div>
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
      <div className="rounded-xl p-4" style={{ background: "#111111", border: "1px solid #222222" }}>
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#555555" }}>
          <Shield size={12} /> Internal notes — never visible to candidate ({c.name})
        </div>
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Add a note…" rows={3}
          className="w-full rounded-lg border px-3 py-2.5 text-sm resize-none focus:outline-none transition-colors"
          style={{ background: "#0d0d0d", borderColor: "#222222", color: "#e5e7eb" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#6366f1")}
          onBlur={e => (e.currentTarget.style.borderColor = "#222222")} />
        <div className="flex justify-end mt-2">
          <button onClick={addNote} disabled={!draft.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "#6366f1" }}>
            <Plus size={14} /> Add note
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {notes.map(n => (
          <div key={n.id} className="rounded-xl p-4" style={{ background: "#111111", border: "1px solid #222222" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "#1e1b4b", color: "#818cf8" }}>Y</div>
                <span className="text-xs font-semibold text-white">{n.author}</span>
              </div>
              <span className="text-xs" style={{ color: "#444444" }}>{n.ts}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#888888" }}>{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Compare Tab ──────────────────────────────────────────────────────────────

const REC_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "STRONG YES": { color: "#4ade80", bg: "#052e16", border: "#166534" },
  "YES":        { color: "#86efac", bg: "#052e16", border: "#166534" },
  "MAYBE":      { color: "#fbbf24", bg: "#451a03", border: "#78350f" },
  "NO":         { color: "#f87171", bg: "#450a0a", border: "#991b1b" },
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
      <div className="rounded-xl p-8 text-center animate-pulse" style={{ background: "#111111", border: "1px solid #222222" }}>
        <div className="w-32 h-4 rounded mx-auto mb-3" style={{ background: "#1a1a1a" }} />
        <div className="w-48 h-3 rounded mx-auto" style={{ background: "#1a1a1a" }} />
      </div>
    );
  }

  if (error || !compareData) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: "#111111", border: "1px solid #222222" }}>
        <p className="text-sm" style={{ color: "#f87171" }}>{error ?? "Could not load compare data"}</p>
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
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222222" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#111111", borderBottom: "1px solid #222222" }}>
              <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "#444444" }}>Dimension</th>
              {compareData.map(c => (
                <th key={c.id} className="px-5 py-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: c.id === currentId ? "#1e1b4b" : "#1a1a1a",
                        color: c.id === currentId ? "#818cf8" : "#555555",
                        border: c.id === currentId ? "2px solid #6366f1" : "1px solid #333333",
                      }}>
                      {c.initials}
                    </div>
                    <span className="text-xs font-semibold text-white">{c.name.split(" ")[0]}</span>
                    {c.flagged && <Flag size={10} style={{ color: "#ef4444" }} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ background: "#0d0d0d" }}>
            {rows.map((row, ri) => {
              const vals = compareData.map(c => c[row.key] as number);
              const best = row.isTime ? Math.min(...vals) : Math.max(...vals);

              return (
                <tr key={row.key as string}
                  style={{ borderBottom: ri < rows.length - 1 ? "1px solid #161616" : "none" }}>
                  <td className="px-5 py-3.5 text-xs font-semibold" style={{ color: "#666666" }}>{row.label}</td>
                  {compareData.map((c, ci) => {
                    const v = vals[ci];
                    const isBest = v === best;
                    return (
                      <td key={c.id} className="px-5 py-3.5 text-center"
                        style={{ borderLeft: c.flagged ? "2px solid #ef444433" : undefined }}>
                        <div className={`text-xs font-semibold ${isBest ? "rounded-lg px-2 py-0.5 inline-block" : ""}`}
                          style={isBest
                            ? { background: "#052e16", color: "#4ade80", border: "1px solid #166534" }
                            : { color: "#888888" }}>
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
            <tr style={{ borderBottom: "1px solid #161616" }}>
              <td className="px-5 py-3.5 text-xs font-semibold" style={{ color: "#666666" }}>Flagged</td>
              {compareData.map(c => (
                <td key={c.id} className="px-5 py-3.5 text-center"
                  style={{ borderLeft: c.flagged ? "2px solid #ef444433" : undefined }}>
                  {c.flagged
                    ? <span className="text-xs font-bold" style={{ color: "#f87171" }}>Yes ⚠</span>
                    : <span className="text-xs font-bold" style={{ color: "#4ade80" }}>No ✓</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recommendation row — the money moment */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #222222" }}>
        <div className="px-5 py-3 text-xs font-bold uppercase tracking-widest"
          style={{ background: "#111111", color: "#555555", borderBottom: "1px solid #1a1a1a" }}>
          Recommendation
        </div>
        <div className="grid"
          style={{ gridTemplateColumns: `repeat(${compareData.length}, 1fr)`, background: "#0d0d0d" }}>
          {compareData.map(c => {
            const s = REC_STYLE[c.recommendation] ?? REC_STYLE.MAYBE;
            return (
              <div key={c.id} className="flex flex-col items-center gap-2 px-4 py-5"
                style={{ borderLeft: c.flagged ? "3px solid #ef4444" : "none" }}>
                <div className="text-xs font-semibold" style={{ color: "#888888" }}>
                  {c.name.split(" ")[0]}
                </div>
                <span className="text-sm font-black px-4 py-2 rounded-xl"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {c.recommendation}
                </span>
                {c.flagged && (
                  <span className="text-xs" style={{ color: "#f87171" }}>
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
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>
      <div className="px-8 py-6 animate-pulse" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div className="w-24 h-3 rounded mb-5" style={{ background: "#1a1a1a" }} />
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl shrink-0" style={{ background: "#1a1a1a" }} />
          <div className="flex-1 space-y-2">
            <div className="w-48 h-6 rounded" style={{ background: "#1a1a1a" }} />
            <div className="w-64 h-3 rounded" style={{ background: "#1a1a1a" }} />
          </div>
        </div>
      </div>
      <main className="flex-1 px-8 py-6">
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "#111111", border: "1px solid #222222" }}>
              <div className="w-full h-3 rounded mb-2" style={{ background: "#1a1a1a" }} />
              <div className="w-2/3 h-3 rounded" style={{ background: "#1a1a1a" }} />
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
      <div className="flex flex-col items-center justify-center min-h-screen" style={{ color: "#888888" }}>
        <div className="text-4xl mb-4">🔍</div>
        <div className="text-lg font-bold text-white mb-2">
          {error ?? "Candidate not found"}
        </div>
        <Link href="/employer/dashboard" className="text-sm" style={{ color: "#6366f1" }}>
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const c = data;
  const ai = AI_META[c.authenticity.declaration] ?? AI_META.NO_AI_USED;
  const AiIcon = ai.icon;

  return (
    <div className="flex flex-col min-h-screen" style={{ color: "#e5e7eb" }}>

      {/* ── Header ── */}
      <header className="px-8 py-6" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <Link href="/employer/dashboard"
          className="flex items-center gap-2 text-xs font-medium mb-5 w-fit transition-colors"
          style={{ color: "#555555" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ffffff"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#555555"}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black shrink-0"
              style={{ background: "#1e1b4b", color: "#818cf8", border: "2px solid #312e81" }}>
              {c.initials}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-black text-white">{c.name}</h1>
                {c.authenticity.flagged && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "#450a0a", color: "#f87171", border: "1px solid #991b1b" }}>
                    <Flag size={11} /> Flagged
                  </span>
                )}
                {c.authenticity.mismatch && !c.authenticity.flagged && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "#451a03", color: "#fbbf24", border: "1px solid #78350f" }}>
                    <AlertTriangle size={11} /> Mismatch
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "#666666" }}>
                  <Mail size={13} /> {c.email}
                </div>
                <a href={`https://github.com/${c.githubUsername}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm transition-colors" style={{ color: "#666666" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ffffff"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#666666"}>
                  <Github size={13} /> @{c.githubUsername} <ExternalLink size={11} />
                </a>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "#0d0d1a", color: ai.color, border: `1px solid ${ai.color}33` }}>
                  <AiIcon size={11} /> {ai.label}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "#0d0d0d", color: "#888888", border: "1px solid #1a1a1a" }}>
                  Auth: {c.authenticity.score}/100
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-6">
            <ScoreCircle score={c.scores.total} size={100} />
            <div className="flex flex-col gap-2 pt-1">
              <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
                Schedule Interview
              </button>
              <button className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: "#111111", border: "1px solid #222222", color: "#e5e7eb" }}>
                Add Note
              </button>
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "#0a0a0a", border: "1px solid #991b1b", color: "#f87171" }}>
                  Reject
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "#0a0a0a", border: "1px solid #222222", color: "#888888" }}>
                  <Download size={12} /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="px-8" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-3.5 text-sm font-medium transition-colors relative"
              style={{ color: tab === t.id ? "#ffffff" : "#555555" }}>
              {t.label}
              {tab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#6366f1" }} />
              )}
              {t.id === "behavior" && c.authenticity.flagged && (
                <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#450a0a", color: "#f87171" }}>!</span>
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
