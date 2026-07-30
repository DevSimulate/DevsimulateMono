"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken, storeToken, clearToken } from "@/lib/auth";
import { QUOTA_REACHED_MESSAGE } from "@/lib/limits";
import Logo from "@/components/Logo";
import { EdgeBanner } from "@/components/EdgeBanner";
import { cn } from "@/lib/cn";
import { StageTracker } from "@/components/assessment/StageTracker";
import { ProgressNarrative } from "@/components/assessment/ProgressNarrative";
import { useAudioLevel } from "@/components/assessment/useAudioLevel";
import { LevelMeter } from "@/components/assessment/LevelMeter";
import { PreflightCheck } from "@/components/assessment/PreflightCheck";
import { useLocalAutosave } from "@/components/assessment/useLocalAutosave";
import { Button } from "@/components/ui/Button";
import { Textarea, Field } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScoreReceipt } from "@/components/ui/ScoreReceipt";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const GITHUB_AUTH_URL =
  `https://github.com/login/oauth/authorize` +
  `?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}` +
  `&scope=read:user,user:email,public_repo` +
  `&redirect_uri=${encodeURIComponent(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com") +
    "/auth/callback"
  )}`;

interface Ticket {
  id: string;
  title: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  stack: string;
  description: string;
  expectedMinutes: number;
}

interface ReviewResult {
  scoreTotal: number;
  scoreDiagnosis: number;
  scoreDesign: number;
  scoreCommunication: number;
  scoreExecution: number;
  claudeReview: {
    summary: string;
    topStrength: string;
    topImprovement: string;
  } | null;
  followUpFeedback: string | null;
  scoreBonus: number;
  declarationMismatch: boolean;
  mismatchPenalty: number;
  bonusNote: string | null;
  verbalNote?: string | null;
  verbalScore?: number;
  verbalPenalty?: number;
}

type AIDeclaration =
  | "NO_AI_USED"
  | "AI_USED_FOR_PHRASING"
  | "AI_USED_FOR_UNDERSTANDING"
  | "AI_USED_FOR_ANSWER";

const AI_OPTIONS: { value: AIDeclaration; label: string; sub: string }[] = [
  { value: "NO_AI_USED",                label: "I wrote my answers myself",            sub: "No AI tools used" },
  { value: "AI_USED_FOR_PHRASING",      label: "AI helped me phrase my answers",       sub: "Ideas are mine, AI polished the wording" },
  { value: "AI_USED_FOR_UNDERSTANDING", label: "AI helped me understand the concepts", sub: "Used AI to learn, answered in my own words" },
  { value: "AI_USED_FOR_ANSWER",        label: "AI wrote my answers",                  sub: "AI generated the answer text" },
];

type Stage =
  | "loading"
  | "describe"
  | "sd_write"
  | "analysing"
  | "q1"
  | "loading_q2"
  | "q2"
  | "verbal"
  | "verbal_review"
  | "verbal_typed"
  | "verbal_recover"
  | "scoring"
  | "score"
  | "upgrade";

// Shown when AI review exhausted its retries (sustained rate limit / outage).
// The work is safe — say that plainly instead of leaving them on a spinner.
const REVIEW_DELAYED_MSG =
  "Your submission is saved, but our review service is busy right now and couldn't finish. " +
  "Nothing you did is lost — we'll email you as soon as it completes.";

const STEP_LABELS_CODE   = ["Describe", "Review", "Q1", "Q2", "Speak", "Score"];
const STEP_LABELS_DESIGN = ["Write",    "Review", "Q1", "Q2", "Speak", "Score"];

function stepIndex(stage: Stage): number {
  const map: Record<Stage, number> = {
    loading:    0,
    describe:   0,
    sd_write:   0,
    analysing:  1,
    q1:         2,
    loading_q2: 3,
    q2:         3,
    verbal:     4,
    verbal_review: 4,
    verbal_typed: 4,
    verbal_recover: 4,
    scoring:    5,
    score:      5,
    upgrade:    0,
  };
  return map[stage];
}

// Faint tiled identity watermark over question text. Doesn't prevent a
// screenshot, but makes any leaked screenshot traceable to the candidate.
function Watermark({ text }: { text: string }) {
  if (!text) return null;
  const tile = `${text} · ${new Date().toLocaleDateString()}`;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      style={{ opacity: 0.05, zIndex: 0 }}>
      <div style={{ transform: "rotate(-20deg)", whiteSpace: "nowrap", lineHeight: "3.5rem", fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i}>{Array.from({ length: 8 }).map((__, j) => <span key={j} className="mr-8">{tile}</span>)}</div>
        ))}
      </div>
    </div>
  );
}

// The write-up is split into four explicit sections so candidates know exactly
// what each one is asking for, instead of guessing from a blank box. The four
// answers are composed back into one markdown PR description on submit.
const DESCRIBE_FIELDS = [
  {
    key: "rootCause",
    label: "1. Root cause",
    heading: "Root cause",
    help: "What was actually broken, and why did it happen? Name the specific cause — not the symptom.",
    placeholder: "e.g. The discount factor used the raw percentage instead of a fraction, so…",
  },
  {
    key: "investigation",
    label: "2. How you found it",
    heading: "How I found it",
    help: "How did you track it down? Mention what you read, ran, or tested to confirm it.",
    placeholder: "e.g. Traced the value from the API into the calculation and reproduced it by…",
  },
  {
    key: "whyFix",
    label: "3. Why this fix",
    heading: "Why this fix",
    help: "Why this approach over the alternatives? Note any trade-off you accepted.",
    placeholder: "e.g. Fixed it at the source rather than the caller because…",
  },
  {
    key: "verification",
    label: "4. How you verified it",
    heading: "How I verified it",
    help: "What did you run or observe that proves it works now? Be concrete.",
    placeholder: "e.g. Re-ran the scenario and confirmed the value is now…",
  },
] as const;

// Same idea for the system design answer — explicit sections so candidates know
// what each part is asking for. Composed back into one markdown design document.
const DESIGN_FIELDS = [
  {
    key: "requirements",
    label: "1. Requirements & scale",
    heading: "Requirements & Scale",
    help: "What is in scope, and what numbers are you designing for? State your assumptions (users, requests/sec, data volume) — don't leave them implicit.",
    placeholder: "e.g. ~50k daily users, 500 req/s peak, 2 TB of stored events. Out of scope: billing…",
  },
  {
    key: "architecture",
    label: "2. Architecture overview",
    heading: "Architecture Overview",
    help: "What are the main components and how does a request flow through them? Name the actual technologies.",
    placeholder: "e.g. Client → API gateway → service → Postgres, with Redis for caching and…",
  },
  {
    key: "api",
    label: "3. API design",
    heading: "API Design",
    help: "The key endpoints or interfaces: what they take, what they return, and why shaped that way.",
    placeholder: "e.g. POST /orders — takes …, returns …; paginated because…",
  },
  {
    key: "dataModel",
    label: "4. Data model & storage",
    heading: "Data Model & Storage",
    help: "The core entities, how they're stored, and why that store. Mention indexing or partitioning if it matters.",
    placeholder: "e.g. Orders keyed by (tenantId, orderId) in Postgres; indexed on … because…",
  },
  {
    key: "tradeoffs",
    label: "5. Key trade-offs",
    heading: "Key Trade-offs",
    help: "What did you deliberately choose against, and what does your choice cost you? This is the strongest signal in the whole answer.",
    placeholder: "e.g. Chose eventual consistency for reads, accepting stale data up to 2s, because…",
  },
  {
    key: "scaling",
    label: "6. Scaling & failure",
    heading: "Scaling Strategy",
    help: "What breaks first as load grows, and how do you handle it? Include the main failure mode and your mitigation.",
    placeholder: "e.g. The write path saturates first; shard by tenantId and add a queue for…",
  },
] as const;

function SubmitPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const ticketId   = params.get("ticketId")   ?? "";
  const prUrl      = params.get("prUrl")      ?? "";
  const branchName = params.get("branchName") ?? "";
  // Set when returning to an assessment that was reviewed but never finished —
  // typically from the "one step from complete" email after a mic failure.
  const resumeId   = params.get("resume")     ?? "";

  // Session is established from the URL in an effect below (handoff code → cookie
  // + token). `sessionReady` gates the auth-dependent effects until that's done.
  const [sessionReady, setSessionReady] = useState(false);

  const [stage,        setStage]        = useState<Stage>("loading");
  const [ticket,       setTicket]       = useState<Ticket | null>(null);
  const [description,  setDescription]  = useState("");
  // Per-section answers for the describe stage (composed into `description`).
  const [fields,       setFields]       = useState<Record<string, string>>({
    rootCause: "", investigation: "", whyFix: "", verification: "",
  });
  const [designDoc,    setDesignDoc]    = useState("");
  // Per-section answers for the system design stage (composed into `designDoc`).
  const [designFields, setDesignFields] = useState<Record<string, string>>({
    requirements: "", architecture: "", api: "", dataModel: "", tradeoffs: "", scaling: "",
  });
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [question1,    setQuestion1]    = useState("");
  const [question2,    setQuestion2]    = useState("");
  const [answer1,      setAnswer1]      = useState("");
  const [answer2,      setAnswer2]      = useState("");
  const [declaration,  setDeclaration]  = useState<AIDeclaration | null>(null);
  const [result,       setResult]       = useState<ReviewResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackText,   setFeedbackText]   = useState("");
  const [feedbackSent,   setFeedbackSent]   = useState(false);
  const [timeLeft,     setTimeLeft]     = useState(900);
  const [elapsed,      setElapsed]      = useState(0);
  const [pasteCount,   setPasteCount]   = useState(0);
  const [pasteWarn,    setPasteWarn]    = useState(false);
  const [pasteFlagged, setPasteFlagged] = useState(false);  // recorded for review, not a sanction
  const [pendingReview, setPendingReview] = useState<string | null>(null); // awaiting a human, no penalty
  // Proctoring policy — loaded from the ticket's campaign. Default strict until it loads.
  const [proctoring,   setProctoring]   = useState({ blockPaste: true, requireFullscreen: true });
  // Hiring candidates never see their score — only a generic "received" message.
  const [hideResults,  setHideResults]  = useState(false);
  const [hiringMeta,   setHiringMeta]   = useState<{ roleName: string; companyName: string } | null>(null);
  const [disqualified, setDisqualified] = useState(false);
  // "paste" is deliberately absent — paste attempts flag for review, they no
  // longer disqualify. Only repeated assessment-abandonment ends a run.
  const [dqCause,      setDqCause]      = useState<"leave" | "loaded" | null>(null);
  const [dqReason,     setDqReason]     = useState<string | null>(null);
  const [blurCount,    setBlurCount]    = useState(0);
  const [leaveCount,   setLeaveCount]   = useState(0);   // times they left the assessment (2 warns → disqualify)
  const [isFs,         setIsFs]         = useState(false);
  const [away,         setAway]         = useState(false);
  const submittingRef  = useRef(false);   // in-flight guard: one submit per attempt
  const isFsRef        = useRef(false);
  const enteredFsRef   = useRef(false);
  const lastLeaveRef   = useRef(0);
  const [username,     setUsername]     = useState<string>("");
  const [writeTimeLeft, setWriteTimeLeft] = useState(0);
  // Verbal explanation step (camera on for presence; live text via Web Speech, or
  // record→Whisper as a fallback when Web Speech isn't available)
  const [verbalQuestion, setVerbalQuestion] = useState("");
  const [verbalReady,    setVerbalReady]    = useState(false); // true after camera+mic granted
  const [preflightPassed, setPreflightPassed] = useState(false); // mic-check confirmed
  const [micDeviceId,    setMicDeviceId]    = useState<string | null>(null); // chosen input
  // Typed-defence fallback — only ever entered via a server-granted mic-failure
  // trigger (never a candidate choice). Same question, typed channel.
  const [typedReady,     setTypedReady]     = useState(false); // camera granted for typed mode
  const [typedAnswer,    setTypedAnswer]    = useState("");
  const [typedTimeLeft,  setTypedTimeLeft]  = useState(300);
  const typedTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const keyTimestampsRef = useRef<number[]>([]);
  const TYPED_SECONDS    = 300; // UX countdown; server owns the authoritative limit
  // Recovery chooser — shown at ANY defence failure (never as an upfront choice).
  const [recoverInfo,    setRecoverInfo]    = useState<{ headline: string; trigger: string } | null>(null);
  const [verbalTimeLeft, setVerbalTimeLeft] = useState(300);
  const [verbalBusy,     setVerbalBusy]     = useState(false);
  const [scoringMsg,     setScoringMsg]     = useState("Calculating your score…");
  const [liveCaption,      setLiveCaption]      = useState("");   // real-time captions while speaking
  const [reviewTranscript, setReviewTranscript] = useState("");   // Whisper text shown for confirmation
  const [verbalRetries,    setVerbalRetries]    = useState(2);    // re-records allowed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const captionsActiveRef = useRef(false); // true while captions should keep running
  const VERBAL_SECONDS = 300;
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const verbalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flaggedRef = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const writeRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hard stop: voids the submission and flags the account as disqualified
  // (server-side), then locks the UI. The lock stands even if the network call
  // fails — the client won't let them continue.
  // Only reached by repeated assessment-abandonment; paste attempts flag instead.
  async function disqualifyAndKick(cause: "leave") {
    setDisqualified(true);
    setDqCause(cause);
    [timerRef, elapsedRef, writeRef, verbalTimerRef].forEach((r) => {
      if (r.current) { clearInterval(r.current); r.current = null; }
    });
    const reason =
      "Repeatedly left the assessment (app/tab switching or exiting fullscreen) during the timed questions";
    try {
      if (submissionId) {
        await fetch(`${API_URL}/submissions/${submissionId}/disqualify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          credentials: "include",
          body: JSON.stringify({ reason }),
        });
      }
    } catch { /* UI is locked regardless of the network result */ }
  }

  // Records a proctoring concern server-side WITHOUT ending the assessment.
  // Fire-and-forget: a failed call must never interrupt the candidate.
  async function flagForReview(reason: string) {
    if (!submissionId || flaggedRef.current) return;
    flaggedRef.current = true;   // once per session — don't spam on every paste
    setPasteFlagged(true);
    try {
      await fetch(`${API_URL}/submissions/${submissionId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
    } catch { /* the candidate continues regardless */ }
  }

  // Pasting is blocked in the answer fields WHEN the campaign policy says so
  // (proctoring.blockPaste). Escalation:
  //   1st attempt  → warning
  //   2nd attempt  → stronger warning (recorded against integrity — advisory)
  //   3rd+ attempt → flagged for human review; the assessment CONTINUES
  //
  // Deliberately no auto-disqualification. Ctrl+V is muscle memory, and banning
  // an honest candidate for a reflex is a false positive we can't take back.
  // The paste is still blocked, still counted, and still raises the risk score.
  function handleAnswerPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!proctoring.blockPaste) return; // campaign allows paste — no-op
    e.preventDefault();
    const next = pasteCount + 1;
    setPasteCount(next);
    if (next >= 3) void flagForReview("paste attempts");
    setPasteWarn(true);
    setTimeout(() => setPasteWarn(false), 7000);
  }

  // Enters fullscreen for the assessment (needs a user gesture — the overlay button).
  function enterAssessmentFullscreen() {
    setAway(false);
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => { enteredFsRef.current = true; }).catch(() => { /* user declined — stays gated */ });
    } else {
      enteredFsRef.current = true; // fullscreen unsupported — don't hard-block
    }
  }


  // Establish the session from the URL before anything else. Prefer a one-time
  // handoff code (?code=) — exchanged server-side for a session (httpOnly cookie
  // + token) so the raw JWT never travels in the URL and the link works in any
  // browser. Falls back to a legacy ?token= for older extension builds.
  useEffect(() => {
    const code = params.get("code");
    const legacyToken = params.get("token");
    (async () => {
      if (code) {
        try {
          const res = await fetch(`${API_URL}/auth/handoff/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ code }),
          });
          const j = await res.json();
          if (j.data?.token) storeToken(j.data.token);
        } catch {
          /* fall through — the user may already have a stored session */
        }
      } else if (legacyToken) {
        storeToken(legacyToken);
      }
      // Strip auth params so they don't linger in browser history.
      if (code || legacyToken) {
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      }
      setSessionReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resuming an unfinished assessment: skip straight to the verbal step with a
  // freshly generated question. Safe to re-enter — the question is generated on
  // the spot, so returning never hands back one they already saw.
  useEffect(() => {
    if (!sessionReady || !resumeId) return;
    const token = getToken();
    if (!token) return; // the auth effect below redirects to sign-in

    (async () => {
      try {
        const r = await fetch(`${API_URL}/submissions/${resumeId}/resume`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (!r.ok || !j.data?.resumable) {
          setError(j.data?.reason ?? j.error ?? "This assessment can no longer be resumed.");
          setStage("describe");
          return;
        }

        setSubmissionId(resumeId);

        const vq = await fetch(`${API_URL}/submissions/${resumeId}/verbal-question`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        });
        const vqd = await vq.json();
        if (vq.ok && vqd.data?.question) {
          setVerbalQuestion(vqd.data.question);
          // Resume into whichever channel was active before the tab closed. A
          // candidate already committed to typed stays typed; otherwise the
          // defence was interrupted — open the recovery chooser (spec 3.1.d).
          if (j.data.defenceMode === "TYPED") enterTypedMode();
          else openRecovery("Your session was interrupted.", "resume");
        } else {
          setError("Couldn't load the final question. Please refresh, or contact the administrator.");
          setStage("describe");
        }
      } catch {
        setError("Couldn't reach the server to resume your assessment. Please try again.");
        setStage("describe");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, resumeId]);

  // Auth check + ticket fetch
  useEffect(() => {
    if (!sessionReady) return;
    const token = getToken();
    if (!token) {
      localStorage.setItem("ds_submit_return", window.location.href);
      window.location.href = GITHUB_AUTH_URL;
      return;
    }
    if (resumeId) return; // the resume effect above owns the stage
    if (!ticketId) {
      setError("Missing ticket information. Please re-submit from the VS Code extension.");
      setStage("describe");
      return;
    }
    fetch(`${API_URL}/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.proctoring) setProctoring(data.proctoring);
        setHideResults(!!data.hideResults);
        if (data.hideResults && data.campaign) setHiringMeta(data.campaign);
        if (data.data) {
          setTicket(data.data);
          setStage(data.data.stack === "SYSTEM_DESIGN" ? "sd_write" : "describe");
        } else {
          setStage("describe");
        }
      })
      .catch(() => setStage("describe"));
  }, [ticketId, router, sessionReady, resumeId]);

  // Fetch the candidate's GitHub username for the integrity watermark
  useEffect(() => {
    if (!sessionReady) return;
    const token = getToken();
    if (!token) return;
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.githubUsername) setUsername(j.data.githubUsername);
        // Persisted disqualification — re-lock on refresh instead of re-showing the assessment.
        if (j.data?.disqualifiedAt) {
          setDisqualified(true);
          setDqCause("loaded");
          setDqReason(j.data.disqualifiedReason ?? null);
        }
      })
      .catch(() => null);
  }, [sessionReady]);

  // Leave-guard — while writing/answering, the step runs in fullscreen. Switching
  // to another app (e.g. VS Code + an AI assistant), hiding the tab, or exiting
  // fullscreen is a "leave". 2 warnings, then the 3rd disqualifies (voids the
  // submission + blocks re-applying — same flow as pasting).
  // Compose the four section answers into the markdown PR description that gets
  // submitted and reviewed. Empty sections are omitted.
  useEffect(() => {
    const composed = DESCRIBE_FIELDS
      .filter((f) => fields[f.key]?.trim())
      .map((f) => `## ${f.heading}\n${fields[f.key].trim()}`)
      .join("\n\n");
    setDescription(composed);
  }, [fields]);

  // Same for the system design document.
  useEffect(() => {
    const composed = DESIGN_FIELDS
      .filter((f) => designFields[f.key]?.trim())
      .map((f) => `## ${f.heading}\n${designFields[f.key].trim()}`)
      .join("\n\n");
    setDesignDoc(composed);
  }, [designFields]);

  const WATCHED_STAGES = ["describe", "sd_write", "q1", "q2", "verbal_typed"];
  useEffect(() => {
    const active = proctoring.requireFullscreen && WATCHED_STAGES.includes(stage) && !disqualified;

    const recordLeave = () => {
      const now = Date.now();
      if (now - lastLeaveRef.current < 800) return; // dedupe blur+visibility for one switch
      lastLeaveRef.current = now;
      setBlurCount((n) => n + 1);   // keep advisory tab-switch count
      setAway(true);
      setLeaveCount((n) => n + 1);
    };
    const onFs = () => {
      const fs = !!document.fullscreenElement;
      isFsRef.current = fs;
      setIsFs(fs);
      if (active && !fs && enteredFsRef.current) recordLeave(); // exited fullscreen after entering
    };
    const onVis = () => { if (active && document.hidden && isFsRef.current) recordLeave(); };
    const onBlur = () => { if (active && isFsRef.current) recordLeave(); };

    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [stage, disqualified, proctoring.requireFullscreen]);

  // 3rd leave → disqualify + kick out (reuses the paste disqualification flow).
  useEffect(() => {
    if (leaveCount >= 3 && !disqualified) void disqualifyAndKick("leave");
  }, [leaveCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Elapsed timer — active during analysing stage
  useEffect(() => {
    if (stage === "analysing") {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [stage]);

  // 15-minute countdown — active during q1 and q2 stages
  useEffect(() => {
    if (stage === "q1") {
      setTimeLeft(900);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => { if (t <= 1) { clearInterval(timerRef.current!); return 0; } return t - 1; });
      }, 1000);
    } else if (stage !== "q2") {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  // System-design write timer — counts down the ticket's estimated minutes
  // while the candidate writes their design doc.
  useEffect(() => {
    if (stage === "sd_write" && ticket) {
      setWriteTimeLeft(ticket.expectedMinutes * 60);
      writeRef.current = setInterval(() => {
        setWriteTimeLeft((t) => { if (t <= 1) { clearInterval(writeRef.current!); return 0; } return t - 1; });
      }, 1000);
    } else {
      if (writeRef.current) clearInterval(writeRef.current);
    }
    return () => { if (writeRef.current) clearInterval(writeRef.current); };
  }, [stage, ticket]);

  async function handleDescriptionSubmit() {
    const token = getToken();
    if (!token) return;
    // A ref, not state: two clicks in the same tick both read stale state and
    // both fire. The server also de-dupes, but the request should never leave.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setStage("analysing");

    try {
      const r = await fetch(`${API_URL}/submissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, prUrl, prDescription: description, branchName }),
      });
      const data = await r.json();
      if (r.status === 402) { setStage("upgrade"); return; }
      if (r.status === 401) {
        // Stale/expired session — re-authenticate and return here afterwards
        // instead of stranding the candidate on a dead "invalid token" error.
        clearToken();
        localStorage.setItem("ds_submit_return", window.location.href);
        window.location.href = GITHUB_AUTH_URL;
        return;
      }
      if (!r.ok) throw new Error(data.error ?? "Submission failed");

      const sid: string = data.data.id;
      setSubmissionId(sid);
      await pollForQ1(sid, token);
    } catch (err) {
      submittingRef.current = false; // let them genuinely retry after a failure
      setError(err instanceof Error ? err.message : "Submission failed — please try again.");
      setStage("describe");
    }
  }

  async function handleDesignSubmit() {
    const token = getToken();
    if (!token) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setStage("analysing");

    try {
      const r = await fetch(`${API_URL}/submissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, designDoc }),
      });
      const data = await r.json();
      if (r.status === 402) { setStage("upgrade"); return; }
      if (r.status === 401) {
        // Stale/expired session — re-authenticate and return here afterwards
        // instead of stranding the candidate on a dead "invalid token" error.
        clearToken();
        localStorage.setItem("ds_submit_return", window.location.href);
        window.location.href = GITHUB_AUTH_URL;
        return;
      }
      if (!r.ok) throw new Error(data.error ?? "Submission failed");

      const sid: string = data.data.id;
      setSubmissionId(sid);
      await pollForQ1(sid, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed — please try again.");
      setStage("sd_write");
    }
  }

  async function pollForQ1(sid: string, token: string) {
    // Wait for the SSE "reviewed" event, then fetch Q1
    await waitForReviewSSE(sid, token);

    const qr = await fetch(`${API_URL}/submissions/${sid}/followup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (qr.ok) {
      const qdata = await qr.json();
      if (qdata.data?.question1) {
        setQuestion1(qdata.data.question1);
        setStage("q1");
        return;
      }
    }
    setError("Review completed but questions not available. Check your dashboard.");
    setStage("describe");
  }

  async function waitForReviewSSE(sid: string, token: string): Promise<void> {
    const deadline = Date.now() + 8 * 60 * 1000;

    // Attempt SSE first
    const sseResult = await new Promise<"reviewed" | "failed" | "closed">((resolve) => {
      const timeout = setTimeout(() => resolve("closed"), 8 * 60 * 1000);

      fetch(`${API_URL}/submissions/${sid}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (response) => {
          if (!response.body) { clearTimeout(timeout); resolve("closed"); return; }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) { clearTimeout(timeout); resolve("closed"); return; }
            const chunk = decoder.decode(value, { stream: true });
            // Check "failed" first — "reviewed" never appears in a failure frame,
            // but ordering makes the intent explicit.
            if (chunk.includes("failed"))   { clearTimeout(timeout); resolve("failed");   return; }
            if (chunk.includes("reviewed")) { clearTimeout(timeout); resolve("reviewed"); return; }
          }
        })
        .catch(() => { clearTimeout(timeout); resolve("closed"); });
    });

    if (sseResult === "reviewed") return;
    // The review gave up after every retry — usually a sustained rate limit.
    // Say so plainly rather than leaving them watching a spinner.
    if (sseResult === "failed") throw new Error(REVIEW_DELAYED_MSG);

    // SSE stream closed early (Railway nginx) — fall back to polling
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const r = await fetch(`${API_URL}/submissions/${sid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const data = await r.json();
          if (data.data?.status === "REVIEWED") return;
          if (data.data?.status === "VOID") throw new Error(REVIEW_DELAYED_MSG);
        }
      } catch (pollErr) {
        if (pollErr instanceof Error && pollErr.message.includes("Review failed")) throw pollErr;
        /* keep polling on transient errors */
      }
    }

    throw new Error("Review is taking longer than expected. Try again or check your dashboard.");
  }

  async function handleA1Submit() {
    if (!answer1.trim() || !submissionId) return;
    const token = getToken();
    if (!token) return;
    setStage("loading_q2");

    try {
      const r = await fetch(`${API_URL}/submissions/${submissionId}/followup/answer1`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answer1 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to generate Q2");
      setQuestion2(data.data.question2);
      setStage("q2");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate Q2 — please try again.");
      setStage("q1");
    }
  }

  function handleFeedbackSubmit() {
    if (!feedbackText.trim() || feedbackRating === 0) return;
    const token = getToken();
    if (!token) return;
    // Close immediately — fire and forget
    setFeedbackSent(true);
    fetch(`${API_URL}/feedback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: feedbackText,
        rating: feedbackRating,
        ticketTitle: ticket?.title ?? "",
        score: result?.scoreTotal ?? 0,
      }),
    }).catch(() => { /* silent — user already sees success */ });
  }

  async function handleFinalSubmit() {
    if (!answer2.trim() || !declaration || !submissionId) return;
    const token = getToken();
    if (!token) return;
    setScoringMsg("Analysing your answers…");
    setStage("scoring");

    try {
      const r = await fetch(`${API_URL}/submissions/${submissionId}/followup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answer1, answer2, aiDeclaration: declaration, pasteAttempts: pasteCount, tabSwitches: blurCount }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Scoring failed");

      const sr = await fetch(`${API_URL}/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sdata = await sr.json();
      const sub = sdata.data;

      setResult({
        scoreTotal:          sub.scoreTotal         ?? 0,
        scoreDiagnosis:      sub.scoreDiagnosis     ?? 0,
        scoreDesign:         sub.scoreDesign        ?? 0,
        scoreCommunication:  sub.scoreCommunication ?? 0,
        scoreExecution:      sub.scoreExecution     ?? 0,
        claudeReview:        sub.claudeReview       ?? null,
        followUpFeedback:    data.data.feedback     ?? null,
        scoreBonus:          data.data.scoreBonus   ?? 0,
        declarationMismatch: data.data.declarationMismatch ?? false,
        mismatchPenalty:     data.data.mismatchPenalty     ?? 0,
        bonusNote:           data.data.bonusNote           ?? null,
      });

      // Verbal explanation step — fetch the on-the-spot question; if anything fails
      // (no PR diff, generation error), skip straight to the score.
      try {
        const vq = await fetch(`${API_URL}/submissions/${submissionId}/verbal-question`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        });
        const vqd = await vq.json();
        if (vq.ok && vqd.data?.question) {
          setVerbalQuestion(vqd.data.question);
          setStage("verbal");
          return;
        }
      } catch { /* fall through */ }
      setStage("score");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed — please try again.");
      setStage("q2");
    }
  }

  function stopVerbalMedia() {
    if (verbalTimerRef.current) { clearInterval(verbalTimerRef.current); verbalTimerRef.current = null; }
    try { if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop(); } catch { /* ignore */ }
    recorderRef.current = null;
    captionsActiveRef.current = false; // stop before .stop() so onend doesn't restart it
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // Best-effort live captions via the browser's Web Speech API — shows the
  // candidate what's being heard in real time. Purely a confidence aid; the
  // Whisper transcript they confirm afterwards is what actually gets scored.
  function startLiveCaptions() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const W = window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any };
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) return; // unsupported — Whisper review still guarantees accuracy
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      let finalText = "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t + " ";
          else interim += t;
        }
        setLiveCaption((finalText + interim).trim());
      };
      rec.onerror = () => { /* ignore — captions are best-effort */ };
      // Web Speech frequently ends on its own (the first session right after the
      // mic prompt, or after a pause). Restart it while we're still recording so
      // captions appear reliably from the first attempt.
      rec.onend = () => {
        if (captionsActiveRef.current) {
          try { rec.start(); } catch { /* already running */ }
        }
      };
      captionsActiveRef.current = true;
      rec.start();
      recognitionRef.current = rec;
    } catch { /* ignore */ }
  }

  // Triggered by the "Start" button. Requests camera+mic permission FIRST (one
  // combined prompt) and only starts the timer + recording AFTER it's granted — so
  // the candidate never speaks before the mic is live.
  async function beginVerbal() {
    setError(null);
    chunksRef.current = [];

    // Ask for camera AND mic up front in one prompt. Use the input the
    // candidate validated in the pre-flight check, not the browser default.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
      });
    } catch {
      setError("Please allow camera and microphone access, then click Start.");
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }

    // Record the audio track → sent to Whisper on submit (accurate, all browsers).
    const audioStream = new MediaStream(stream.getAudioTracks());
    let mime = "";
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("audio/webm")) mime = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";
    }
    const rec = mime ? new MediaRecorder(audioStream, { mimeType: mime }) : new MediaRecorder(audioStream);
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start();
    recorderRef.current = rec;

    // Show live captions so the candidate sees what's being heard as they speak.
    setLiveCaption("");
    startLiveCaptions();

    setVerbalReady(true);
    setVerbalTimeLeft(VERBAL_SECONDS);
    verbalTimerRef.current = setInterval(() => {
      setVerbalTimeLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
  }

  // ── Typed-defence fallback ────────────────────────────────────────────────
  // Entered ONLY when the server has granted typed mode (mic failure). Same
  // question, typed answer channel, stricter conditions (timer + paste block +
  // fullscreen + camera). Scoring is identical to voice.
  function enterTypedMode() {
    stopVerbalMedia();
    setError(null);
    setPendingReview(null);
    setTypedAnswer("");
    keyTimestampsRef.current = [];
    setTypedReady(false);
    setStage("verbal_typed");
  }

  // ── Recovery chooser ──────────────────────────────────────────────────────
  // Opened at ANY defence failure: pre-flight garble (handled inline in
  // PreflightCheck), a low-confidence answer, a technical error, or an
  // admin-unlocked resume. The candidate picks voice-retry or typed — never an
  // upfront preference.
  function openRecovery(headline: string, trigger: string) {
    stopVerbalMedia();
    setError(null);
    setPendingReview(null);
    setRecoverInfo({ headline, trigger });
    setStage("verbal_recover");
  }

  // "Try again with voice" — record the choice, fetch a FRESH question, and
  // return to the pre-flight/start so a retry never reuses a prepared answer.
  async function recoverWithVoice(trigger: string) {
    if (verbalBusy) return;
    setVerbalBusy(true);
    const token = getToken();
    try {
      await fetch(`${API_URL}/submissions/${submissionId}/defence-choice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ choice: "voice", trigger }),
      }).catch(() => {});
      // Fresh question so retrying never helps content-wise (existing rule).
      try {
        const vq = await fetch(`${API_URL}/submissions/${submissionId}/verbal-question`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` },
        });
        const vqd = await vq.json();
        if (vq.ok && vqd.data?.question) setVerbalQuestion(vqd.data.question);
      } catch { /* keep the existing question if regeneration fails */ }
      setRecoverInfo(null);
      setReviewTranscript("");
      setLiveCaption("");
      setPreflightPassed(false); // re-run the mic check before the retry
      setVerbalReady(false);
      setVerbalBusy(false);
      setStage("verbal");
    } catch {
      setVerbalBusy(false);
      setError("Couldn't start a voice retry — please try again.");
    }
  }

  // "Switch to typed answers" — record the choice, then enter typed mode.
  async function recoverWithTyped(trigger: string) {
    if (verbalBusy) return;
    setVerbalBusy(true);
    const token = getToken();
    try {
      const r = await fetch(`${API_URL}/submissions/${submissionId}/defence-choice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ choice: "typed", trigger }),
      });
      if (!r.ok) {
        setVerbalBusy(false);
        setError("Couldn't switch to typed mode — please try again.");
        return;
      }
      setRecoverInfo(null);
      setVerbalBusy(false);
      enterTypedMode();
    } catch {
      setVerbalBusy(false);
      setError("Couldn't reach the server — please try again.");
    }
  }

  function stopTypedMedia() {
    if (typedTimerRef.current) { clearInterval(typedTimerRef.current); typedTimerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // Camera stays on for presence exactly as in voice mode (no mic — it failed).
  async function beginTypedDefence() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch {
      setError("Please allow camera access to continue — it stays on for presence, exactly as in voice mode.");
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
    keyTimestampsRef.current = [];
    setTypedReady(true);
    setTypedTimeLeft(TYPED_SECONDS);
    typedTimerRef.current = setInterval(() => {
      setTypedTimeLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
  }

  // Paste is ALWAYS blocked in typed mode — it's an integrity fallback, so the
  // campaign's paste policy doesn't relax it.
  function handleTypedPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const next = pasteCount + 1;
    setPasteCount(next);
    if (next >= 3) void flagForReview("paste attempts (typed defence)");
    setPasteWarn(true);
    setTimeout(() => setPasteWarn(false), 7000);
  }

  function recordKeystroke() {
    keyTimestampsRef.current.push(Date.now());
  }

  async function submitTypedAnswer() {
    if (verbalBusy) return;
    if (typedAnswer.trim().split(/\s+/).filter(Boolean).length < 2) {
      setError("Please type a fuller answer before submitting.");
      return;
    }
    setVerbalBusy(true);
    setScoringMsg("Scoring your typed defence…");
    const token = getToken();
    try {
      const r = await fetch(`${API_URL}/submissions/${submissionId}/typed-answer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          question: verbalQuestion,
          answer: typedAnswer,
          keyTimestamps: keyTimestampsRef.current,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.data) {
        setVerbalBusy(false);
        setError(d.error ?? "Couldn't score your answer — please try again.");
        return;
      }
      stopTypedMedia();
      const zero: ReviewResult = {
        scoreTotal: 0, scoreDiagnosis: 0, scoreDesign: 0, scoreCommunication: 0, scoreExecution: 0,
        claudeReview: null, followUpFeedback: null, scoreBonus: 0,
        declarationMismatch: false, mismatchPenalty: 0, bonusNote: null,
      };
      if (hideResults || d.data.hideResults) {
        setResult((prev) => prev ?? zero);
        setVerbalBusy(false);
        setError(null);
        setStage("score");
        return;
      }
      setResult((prev) => ({
        ...(prev ?? zero),
        scoreTotal:     d.data.newScoreTotal ?? prev?.scoreTotal ?? 0,
        scoreDiagnosis: d.data.scoreDiagnosis ?? prev?.scoreDiagnosis ?? 0,
        scoreDesign:    d.data.scoreDesign ?? prev?.scoreDesign ?? 0,
        verbalNote:     d.data.note,
        verbalScore:    d.data.score,
        verbalPenalty:  d.data.penalty ?? 0,
      }));
      setVerbalBusy(false);
      setError(null);
      setStage("score");
    } catch {
      setVerbalBusy(false);
      setError("Couldn't reach the server — please try again.");
    }
  }

  function stopAndGetAudio(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      const type = rec?.mimeType || "audio/webm";
      if (!rec || rec.state === "inactive") {
        resolve(new Blob(chunksRef.current, { type }));
        return;
      }
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type }));
      try { rec.stop(); } catch { resolve(new Blob(chunksRef.current, { type })); }
    });
  }

  // Step 1: stop recording, transcribe with Whisper, and show the text for
  // review — the candidate confirms exactly what will be scored.
  async function stopAndReview() {
    if (verbalBusy) return;
    setVerbalBusy(true);

    const audio = await stopAndGetAudio();
    const fallback = liveCaption.trim(); // live captions, used if Whisper is unavailable
    stopVerbalMedia();
    setScoringMsg("Transcribing your explanation…");
    setStage("scoring");

    const token = getToken();
    try {
      const url = `${API_URL}/submissions/${submissionId}/verbal-transcribe`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": audio.type || "audio/webm" },
        body: audio,
      });
      const d = await r.json().catch(() => ({}));
      const transcript = ((r.ok && d.data?.transcript) ? d.data.transcript : fallback).trim();

      if (!transcript) {
        // Nothing captured — a technical/audio failure. Open the recovery chooser.
        setVerbalBusy(false);
        openRecovery("We couldn't capture reliable audio for that answer.", "no_audio");
        return;
      }
      setReviewTranscript(transcript);
      setVerbalBusy(false);
      setError(null);
      setStage("verbal_review");
    } catch {
      // Whisper unreachable — fall back to the live captions if we have them,
      // otherwise treat it as a technical failure and open the recovery chooser.
      if (fallback) {
        setReviewTranscript(fallback);
        setVerbalBusy(false);
        setStage("verbal_review");
      } else {
        setVerbalBusy(false);
        openRecovery("Something went wrong capturing your answer.", "technical");
      }
    }
  }

  // Step 2: score the transcript the candidate reviewed and approved.
  async function confirmVerbal() {
    if (verbalBusy) return;
    setVerbalBusy(true);
    setScoringMsg("Scoring your explanation…");
    setStage("scoring");

    const token = getToken();
    try {
      const r = await fetch(`${API_URL}/submissions/${submissionId}/verbal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ question: verbalQuestion, transcript: reviewTranscript }),
      });
      const d = await r.json().catch(() => ({}));

      if (!r.ok || !d.data) {
        // Scoring call failed but the transcript is captured fine — let them
        // retry submitting it rather than discarding a good answer.
        setVerbalBusy(false);
        setError("Couldn't score your explanation — please try again.");
        setStage("verbal_review");
        return;
      }
      // Any capture failure (low-confidence audio, no audio) opens the recovery
      // chooser: retry with voice, or switch to typed. Checked before hiding so
      // a hiring candidate still gets to actually complete the defence.
      if (d.data.recovery) {
        setVerbalBusy(false);
        openRecovery("We couldn't capture reliable audio for that answer.", d.data.trigger ?? "low_confidence");
        return;
      }
      // Hiring candidates never see a score — the server returns only a
      // completion marker, so go straight to the received-state.
      if (hideResults || d.data.hideResults) {
        setVerbalBusy(false);
        setError(null);
        setStage("score");
        return;
      }
      if (d.data.score === null || d.data.score === undefined) {
        setVerbalBusy(false);
        setError("Your answer was too short to score — please re-record a fuller explanation.");
        setStage("verbal_review");
        return;
      }
      setResult((prev) => prev ? {
        ...prev,
        scoreTotal:     d.data.newScoreTotal ?? prev.scoreTotal,
        scoreDiagnosis: d.data.scoreDiagnosis ?? prev.scoreDiagnosis,
        scoreDesign:    d.data.scoreDesign ?? prev.scoreDesign,
        verbalNote:     d.data.note,
        verbalScore:    d.data.score,
        verbalPenalty:  d.data.penalty ?? 0,
      } : prev);
      setVerbalBusy(false);
      setError(null);
      setStage("score");
    } catch {
      setVerbalBusy(false);
      setError("Couldn't reach the server — please try again.");
      setStage("verbal_review");
    }
  }

  // Re-record — limited so it can't be gamed by retrying endlessly.
  function reRecordVerbal() {
    if (verbalRetries <= 0) return;
    setVerbalRetries((n) => n - 1);
    setReviewTranscript("");
    setLiveCaption("");
    setVerbalReady(false);
    setError(null);
    setStage("verbal");
  }

  // On entering the verbal stage, wait for the candidate to click Start (which asks
  // for camera+mic) — don't auto-start, so the timer never runs during the prompt.
  useEffect(() => {
    if (stage !== "verbal") return;
    setVerbalReady(false);
    return () => stopVerbalMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // When the timer runs out, stop and take them to the transcript review
  // (they still confirm before it's scored).
  useEffect(() => {
    if (stage === "verbal" && verbalReady && verbalTimeLeft === 0 && !verbalBusy) stopAndReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verbalTimeLeft, stage, verbalReady]);

  // Typed defence: the hard timer auto-submits whatever's typed at zero — the
  // timer is what keeps typed answers as spontaneous as spoken ones.
  useEffect(() => {
    if (stage === "verbal_typed" && typedReady && typedTimeLeft === 0 && !verbalBusy) void submitTypedAnswer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedTimeLeft, stage, typedReady]);

  // Clean up typed-mode media if the stage changes away.
  useEffect(() => {
    if (stage !== "verbal_typed") return;
    return () => stopTypedMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const mins      = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs      = (timeLeft % 60).toString().padStart(2, "0");
  const si         = stepIndex(stage);
  // Firm but neutral. No threat of disqualification — repeated attempts are
  // recorded for a human to look at, and the candidate carries on.
  const pasteNotice = pasteFlagged
    ? "Pasting is disabled during this phase. Your attempts have been recorded and will be reviewed — please continue in your own words."
    : "Pasting is disabled during this phase. Repeated attempts are recorded and reviewed.";
  const isDesign   = ticket?.stack === "SYSTEM_DESIGN";
  const STEP_LABELS = isDesign ? STEP_LABELS_DESIGN : STEP_LABELS_CODE;

  // ── Presentational-only additions below. Neither touches any existing
  // state, effect, or handler above — both are pure UI enhancements with no
  // effect on flow, scoring, or proctoring. ──────────────────────────────
  // Live mic level during the verbal pre-flight (visualizes the SAME stream
  // already captured for recording — no new data collection).
  const audioLevel = useAudioLevel(stage === "verbal" && verbalReady ? streamRef.current : null);
  // Local-only safety net against an accidental refresh/tab close. Never
  // touches the API — the actual submission is still only what's explicitly
  // submitted via the existing handlers below.
  const autosaveKey = ticketId ? `${ticketId}-${isDesign ? "design" : "describe"}` : null;
  const autosavedAt = useLocalAutosave(autosaveKey, isDesign ? designFields : fields);

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (disqualified) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded border border-red bg-surface p-8 text-center">
          <h1 className="font-display text-xl font-bold mb-2 text-red">
            Assessment ended — disqualified
          </h1>
          <p className="text-sm mb-4 text-ink leading-relaxed">
            {dqCause === "leave"
              ? "Leaving the assessment — switching to another app or tab, or exiting fullscreen — is not allowed during the timed questions. After two warnings, you left a third time, so this assessment has been voided and your entry disqualified. You will not be able to re-apply."
              : dqReason
              ? `You have been disqualified from this assessment: ${dqReason} You cannot re-take it on this account.`
              : "You have been disqualified from this assessment and cannot re-take it on this account."}
          </p>
          <p className="text-xs text-muted">
            If you believe this is a mistake, contact the administrator so it can be reviewed.
          </p>
        </div>
      </div>
    );
  }

  const showGuard = proctoring.requireFullscreen && WATCHED_STAGES.includes(stage) && !disqualified && (!isFs || away);
  const isWarned = leaveCount > 0;

  // Timer shown in the persistent stage rail — whichever is active for the current stage.
  const rail =
    stage === "sd_write" ? { time: `${Math.floor(writeTimeLeft / 60).toString().padStart(2, "0")}:${(writeTimeLeft % 60).toString().padStart(2, "0")}`, urgent: writeTimeLeft < 120 } :
    stage === "q1" || stage === "q2" ? { time: `${mins}:${secs}`, urgent: timeLeft < 120 } :
    stage === "verbal" && verbalReady ? { time: `${Math.floor(verbalTimeLeft / 60)}:${(verbalTimeLeft % 60).toString().padStart(2, "0")}`, urgent: verbalTimeLeft <= 20 } :
    null;

  return (
    <div className="min-h-screen bg-paper">

      {/* Stay-on-screen / fullscreen guard — blocks the timed steps unless focused.
          Calm, firm, neutral: amber for a warning, never a red flash. */}
      {showGuard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-[rgba(16,24,43,0.85)]">
          <div className={cn("max-w-md w-full rounded border bg-surface p-8 text-center", isWarned ? "border-amber" : "border-hairline")}>
            <h2 className={cn("font-display text-lg font-semibold mb-2", isWarned ? "text-amber" : "text-ink")}>
              {isWarned ? `Stay on the assessment — warning ${leaveCount} of 2` : "Fullscreen required"}
            </h2>
            <p className="text-sm mb-5 text-muted leading-relaxed">
              {isWarned
                ? "Leaving the assessment — switching apps or tabs, or exiting fullscreen — is not allowed during the timed questions. One more time and you will be disqualified and unable to re-apply."
                : "This step runs in fullscreen so you stay focused on the assessment. Do not switch to other apps (including your editor) while answering."}
            </p>
            <Button variant="primary" size="lg" onClick={enterAssessmentFullscreen} className="w-full">
              {isWarned ? "Return to assessment" : "Enter fullscreen & begin"}
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-hairline bg-surface px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={32} /></Link>
        <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink transition-colors">
          Dashboard →
        </Link>
      </header>

      {/* Persistent stage tracker — slim top rail, always visible */}
      <StageTracker labels={STEP_LABELS} currentIndex={si} timeRemaining={rail?.time} timeUrgent={rail?.urgent} />

      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Quiet proctoring status — ambient awareness, not a threat */}
        {WATCHED_STAGES.includes(stage) && (proctoring.requireFullscreen || proctoring.blockPaste) && (
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            Proctored session
            {proctoring.requireFullscreen && " · fullscreen required"}
            {proctoring.blockPaste && " · paste disabled"}
          </div>
        )}

        {/* Ticket info bar */}
        {ticket && stage !== "score" && (
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate mb-0.5 text-ink">{ticket.title}</div>
                {!isDesign && prUrl && (
                  <a href={prUrl} target="_blank" rel="noreferrer" className="text-xs font-mono truncate block hover:underline text-brand">
                    {prUrl}
                  </a>
                )}
                {isDesign && (
                  <span className="text-xs font-medium text-brand">
                    System Design Challenge · {ticket.expectedMinutes} min
                  </span>
                )}
              </div>
              <Badge tone="neutral" className="shrink-0">{ticket.difficulty}</Badge>
            </div>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="rounded border border-red bg-red-weak px-4 py-3 mb-6 text-sm text-red">
            {error}
          </div>
        )}

        {/* ── Stage: Describe ── */}
        {stage === "describe" && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-base font-semibold text-ink">Your approach</h2>
              {autosavedAt && (
                <span className="font-mono text-xs text-muted">
                  Saved · {autosavedAt.toLocaleTimeString([], { hour12: false })}
                </span>
              )}
            </div>
            <p className="text-sm mb-5 text-muted leading-relaxed">
              Answer each section below. <strong className="text-ink">Short and precise beats long — 2–4 sentences each.</strong>{" "}
              We score the quality of your reasoning, not the length. Vague or padded answers score lower than a tight, specific one.
            </p>

            {DESCRIBE_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} helper={f.help}>
                <Textarea
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  onPaste={handleAnswerPaste}
                  placeholder={f.placeholder}
                  rows={3}
                  error={pasteWarn}
                />
              </Field>
            ))}
            {pasteWarn && (
              <div className="rounded border border-amber bg-amber-weak px-3 py-2 mb-3 text-xs font-medium text-amber">
                {pasteNotice}
              </div>
            )}
            <div className="flex items-center justify-between mb-5">
              <span className={cn("text-xs font-medium", description.length < 100 ? "text-amber" : "text-emerald")}>
                {description.length} chars
                {description.length < 100 ? ` — need ${100 - description.length} more` : " — ready"}
              </span>
              <span className="text-xs text-muted">Est. {ticket?.expectedMinutes ?? "—"} min ticket</span>
            </div>
            <Button variant="primary" size="lg" className="w-full" onClick={handleDescriptionSubmit} disabled={description.trim().length < 100}>
              Submit for review →
            </Button>
          </Card>
        )}

        {/* ── Stage: System Design Write ── */}
        {stage === "sd_write" && ticket && (
          <div className="flex flex-col gap-4">
            <Card className="p-6 relative overflow-hidden">
              <Watermark text={username} />
              <div className="relative" style={{ zIndex: 1 }}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">The problem</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
                  {ticket.description}
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display text-base font-semibold text-ink">Your design</h2>
                {autosavedAt && (
                  <span className="font-mono text-xs text-muted">
                    Saved · {autosavedAt.toLocaleTimeString([], { hour12: false })}
                  </span>
                )}
              </div>
              <p className="text-sm mb-5 text-muted leading-relaxed">
                Answer each section below. <strong className="text-ink">Short and precise beats long — a few sentences or tight bullets each.</strong>{" "}
                Name actual technologies, state your assumptions, and justify your choices. We score the
                quality of your reasoning and trade-offs, not the length.
              </p>

              {DESIGN_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} helper={f.help}>
                  <Textarea
                    value={designFields[f.key] ?? ""}
                    onChange={(e) => setDesignFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    onPaste={handleAnswerPaste}
                    placeholder={f.placeholder}
                    rows={3}
                    error={pasteWarn}
                  />
                </Field>
              ))}
              {pasteWarn && (
                <div className="rounded border border-amber bg-amber-weak px-3 py-2 mb-3 text-xs font-medium text-amber">
                  {pasteNotice}
                </div>
              )}
              <div className="flex items-center justify-between mb-5">
                <span className={cn("text-xs font-medium", designDoc.length < 300 ? "text-amber" : "text-emerald")}>
                  {designDoc.length} chars
                  {designDoc.length < 300 ? ` — need ${300 - designDoc.length} more` : " — ready"}
                </span>
                <span className="text-xs text-muted">Est. {ticket.expectedMinutes} min</span>
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={handleDesignSubmit} disabled={designDoc.trim().length < 300}>
                Submit for review →
              </Button>
            </Card>
          </div>
        )}

        {/* ── Stage: Analysing ── */}
        {stage === "analysing" && (
          <Card className="p-10 text-center">
            <div className="font-display font-semibold text-base mb-1 text-ink">
              {isDesign ? "Reviewing your design" : "Analysing your PR"}
            </div>
            <div className="text-sm mb-6 text-muted">
              {isDesign
                ? "Evaluating your architecture and generating a follow-up question."
                : "Reading your diff and generating a question."}
            </div>
            <ProgressNarrative
              elapsedSeconds={elapsed}
              steps={isDesign ? [
                { label: "Reading your design document", doneAfter: 5 },
                { label: "Scoring (3 independent passes)", doneAfter: 30 },
                { label: "Preparing your follow-up question", doneAfter: 45 },
              ] : [
                { label: "Fetching your PR diff", doneAfter: 5 },
                { label: "Scoring (3 independent passes)", doneAfter: 45 },
                { label: "Preparing your follow-up question", doneAfter: 70 },
              ]}
            />
            <div className="font-mono text-xs mt-6 text-muted">
              {Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")} elapsed
            </div>
          </Card>
        )}

        {/* ── Stage: Q1 ── */}
        {stage === "q1" && (
          <Card className="p-6">
            <div className="mb-5">
              <h2 className="font-display text-base font-semibold text-ink">Question 1 of 2</h2>
            </div>

            <div className="rounded border border-hairline bg-paper p-4 mb-3 relative overflow-hidden">
              <Watermark text={username} />
              <p className="font-display text-lg font-semibold leading-relaxed relative text-ink" style={{ zIndex: 1 }}>{question1}</p>
            </div>

            <Textarea
              value={answer1}
              onChange={(e) => setAnswer1(e.target.value)}
              onPaste={handleAnswerPaste}
              placeholder={proctoring.blockPaste ? "Type your answer — pasting is disabled…" : "Type your answer…"}
              rows={6}
              disabled={timeLeft === 0}
              error={pasteWarn}
              className="mb-2"
            />
            {pasteWarn && (
              <div className="rounded border border-amber bg-amber-weak px-3 py-2 mb-3 text-xs font-medium text-amber">
                {pasteNotice}
              </div>
            )}

            <div className="rounded border border-hairline bg-paper px-4 py-3 mb-5 text-xs text-muted">
              After you submit this answer, Q2 will be generated based on what you wrote.
            </div>

            <Button variant="primary" size="lg" className="w-full" onClick={handleA1Submit} disabled={!answer1.trim() || timeLeft === 0}>
              {timeLeft === 0 ? "Time expired" : "Submit answer → get Q2"}
            </Button>
          </Card>
        )}

        {/* ── Stage: Loading Q2 ── */}
        {stage === "loading_q2" && (
          <Card className="p-10 text-center">
            <div className="font-display font-semibold text-base mb-4 text-ink">Generating Q2</div>
            <ProgressNarrative elapsedSeconds={elapsed} steps={[{ label: "Reading your answer and generating a follow-up", doneAfter: 100 }]} />
          </Card>
        )}

        {/* ── Stage: Q2 ── */}
        {stage === "q2" && (
          <Card className="p-6">
            <div className="mb-5">
              <h2 className="font-display text-base font-semibold text-ink">Question 2 of 2</h2>
            </div>

            <div className="rounded border border-hairline bg-paper p-4 mb-5 relative overflow-hidden">
              <Watermark text={username} />
              <p className="font-display text-lg font-semibold leading-relaxed relative text-ink" style={{ zIndex: 1 }}>{question2}</p>
            </div>

            <Textarea
              value={answer2}
              onChange={(e) => setAnswer2(e.target.value)}
              onPaste={handleAnswerPaste}
              placeholder={proctoring.blockPaste ? "Type your answer — pasting is disabled…" : "Type your answer…"}
              rows={6}
              disabled={timeLeft === 0}
              error={pasteWarn}
              className="mb-2"
            />
            {pasteWarn && (
              <div className="rounded border border-amber bg-amber-weak px-3 py-2 mb-3 text-xs font-medium text-amber">
                {pasteNotice}
              </div>
            )}

            <div className="rounded border border-hairline p-4 mb-5 flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                How did you answer these questions?
              </p>
              {AI_OPTIONS.map((opt) => (
                <label key={opt.value} className={cn(
                  "flex items-start gap-3 rounded border px-3 py-2.5 cursor-pointer transition-colors duration-150",
                  declaration === opt.value ? "border-brand bg-brand-weak" : "border-hairline hover:border-muted"
                )}>
                  <input type="radio" name="aiDeclaration" value={opt.value}
                    checked={declaration === opt.value} onChange={() => setDeclaration(opt.value)}
                    className="mt-0.5 shrink-0 accent-brand" />
                  <div>
                    <div className="text-xs font-semibold text-ink">{opt.label}</div>
                    <div className="text-xs text-muted">{opt.sub}</div>
                  </div>
                </label>
              ))}
              <p className="text-xs text-muted mt-1">Your declaration never changes your score.</p>
            </div>

            <Button variant="primary" size="lg" className="w-full" onClick={handleFinalSubmit} disabled={!answer2.trim() || !declaration || timeLeft === 0}>
              {timeLeft === 0 ? "Time expired" : !declaration ? "Select how you answered to continue" : "Get my score →"}
            </Button>
          </Card>
        )}

        {/* ── Stage: Verbal explanation ── */}
        {stage === "verbal" && (
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold mb-1 text-ink">Explain it out loud</h2>
            <p className="text-xs mb-4 text-muted leading-relaxed">
              Answer in your own words — your speech is transcribed and checked against your written answers.
              Audio is <span className="font-semibold text-ink">never stored</span> — transcript only, and the video is not recorded.{" "}
              <span className="font-semibold text-ink">Your score is finalised after this.</span>
            </p>
            {error && (
              <div className="text-xs mb-4 rounded border border-amber bg-amber-weak px-3 py-2 text-amber">{error}</div>
            )}

            {!verbalReady ? (
              !preflightPassed ? (
                <PreflightCheck
                  apiUrl={API_URL}
                  token={getToken() ?? ""}
                  submissionId={submissionId ?? ""}
                  onPassed={(id) => { setMicDeviceId(id); setPreflightPassed(true); }}
                  onSwitchToTyped={() => void recoverWithTyped("preflight_failed")}
                />
              ) : (
              <>
                <div className="rounded border border-emerald bg-emerald-weak px-4 py-3 mb-4 text-xs text-emerald">
                  Microphone check passed ✓ — you&apos;re set. The question appears when you start.
                </div>
                <div className="rounded border border-hairline bg-paper p-4 mb-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">On-the-spot question</div>
                  <p className="text-sm leading-relaxed text-ink">
                    The question stays hidden until you start. Once you click Start, it appears and the <span className="font-semibold">5-minute timer begins</span> — so answer it aloud straight away, in your own words.
                  </p>
                </div>
                <Button variant="primary" size="lg" className="w-full" onClick={beginVerbal}>
                  Start — reveal question &amp; begin →
                </Button>
              </>
              )
            ) : (
              <>
                <div className="flex gap-4 mb-4 items-start">
                  <video ref={videoRef} muted autoPlay playsInline
                    className="rounded shrink-0" style={{ width: 160, height: 120, objectFit: "cover", background: "#000", transform: "scaleX(-1)" }} />
                  <div className="flex-1 rounded border border-hairline bg-paper p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Answer aloud</span>
                      <span className={cn("font-mono text-sm font-semibold", verbalTimeLeft <= 20 ? "text-amber" : "text-muted")}>
                        {Math.floor(verbalTimeLeft / 60)}:{(verbalTimeLeft % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <p className="font-display text-base font-semibold leading-relaxed text-ink">{verbalQuestion}</p>
                  </div>
                </div>

                <div className="rounded border border-hairline px-4 py-3 mb-3 flex items-center justify-between text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red animate-pulse shrink-0" />
                    Recording — you&apos;ll <span className="font-semibold text-ink">review the transcript</span> before it&apos;s scored.
                  </span>
                  <LevelMeter level={audioLevel} />
                </div>

                {/* Live captions — what we're hearing, in real time */}
                <div className="rounded border border-dashed border-hairline px-4 py-3 mb-4 min-h-16">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">Live captions</div>
                  <p className={cn("text-sm leading-relaxed", liveCaption ? "text-ink" : "text-muted")}>
                    {liveCaption || "Your words will appear here as you speak…"}
                  </p>
                </div>

                <Button variant="primary" size="lg" className="w-full" onClick={stopAndReview} disabled={verbalBusy}>
                  {verbalBusy ? "Transcribing…" : "Stop & review my answer →"}
                </Button>
              </>
            )}
          </Card>
        )}

        {/* ── Stage: Verbal transcript review ── */}
        {stage === "verbal_review" && (
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold mb-1 text-ink">Review what we heard</h2>
            <p className="text-xs mb-4 text-muted leading-relaxed">
              This is the transcript of your spoken answer — <span className="font-semibold text-ink">exactly what will be scored</span>. If it captured you correctly, submit it. If a word came out wrong, you can re-record.
            </p>
            {error && (
              <div className="text-xs mb-4 rounded border border-amber bg-amber-weak px-3 py-2 text-amber">{error}</div>
            )}

            <div className="rounded border border-hairline bg-paper p-4 mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">Your explanation (transcribed)</div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{reviewTranscript}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="primary" size="lg" className="flex-1" onClick={confirmVerbal} disabled={verbalBusy}>
                {verbalBusy ? "Scoring…" : "Looks right — submit for scoring →"}
              </Button>
              <Button variant="secondary" size="lg" className="flex-1" onClick={reRecordVerbal} disabled={verbalBusy || verbalRetries <= 0}>
                {verbalRetries > 0 ? `Re-record (${verbalRetries} left)` : "No re-records left"}
              </Button>
            </div>
          </Card>
        )}

        {/* ── Stage: Typed defence (mic-failure fallback) ── */}
        {stage === "verbal_typed" && (
          <Card className="p-6">
            <div className="rounded border border-brand bg-brand-weak px-4 py-3 mb-4 text-xs text-brand leading-relaxed">
              <span className="font-semibold">You&apos;re completing the defence in typed mode.</span>{" "}
              Your microphone couldn&apos;t be used, so you&apos;ll type this answer instead.{" "}
              <span className="font-semibold">Scoring is identical.</span>
            </div>
            <h2 className="font-display text-lg font-semibold mb-1 text-ink">Explain it in writing</h2>
            <p className="text-xs mb-4 text-muted leading-relaxed">
              Same question, typed. There&apos;s a <span className="font-semibold text-ink">5-minute timer</span>,
              pasting is disabled, and your camera stays on — exactly the conditions of the spoken defence.
            </p>
            {error && (
              <div className="text-xs mb-4 rounded border border-amber bg-amber-weak px-3 py-2 text-amber">{error}</div>
            )}
            {pasteWarn && (
              <div className="text-xs mb-4 rounded border border-amber bg-amber-weak px-3 py-2 text-amber">
                Pasting is disabled in typed mode — please answer in your own words.
              </div>
            )}

            {!typedReady ? (
              <>
                <div className="rounded border border-hairline bg-paper p-4 mb-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">On-the-spot question</div>
                  <p className="text-sm leading-relaxed text-ink">
                    The question appears when you start, and the <span className="font-semibold">5-minute timer begins</span> — so answer straight away, in your own words.
                  </p>
                </div>
                <Button variant="primary" size="lg" className="w-full" onClick={beginTypedDefence}>
                  Start — reveal question &amp; allow camera →
                </Button>
              </>
            ) : (
              <>
                <div className="flex gap-4 mb-4 items-start">
                  <video ref={videoRef} muted autoPlay playsInline
                    className="rounded shrink-0" style={{ width: 160, height: 120, objectFit: "cover", background: "#000", transform: "scaleX(-1)" }} />
                  <div className="flex-1 rounded border border-hairline bg-paper p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Answer in writing</span>
                      <span className={cn("font-mono text-sm font-semibold", typedTimeLeft <= 30 ? "text-amber" : "text-muted")}>
                        {Math.floor(typedTimeLeft / 60)}:{(typedTimeLeft % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <p className="font-display text-base font-semibold leading-relaxed text-ink">{verbalQuestion}</p>
                  </div>
                </div>

                <Textarea
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onPaste={handleTypedPaste}
                  onKeyDown={recordKeystroke}
                  placeholder="Explain your fix and how you know it works…"
                  rows={8}
                  autoFocus
                  className="mb-4"
                />

                <Button variant="primary" size="lg" className="w-full" onClick={submitTypedAnswer} disabled={verbalBusy}>
                  {verbalBusy ? "Scoring…" : "Submit my defence →"}
                </Button>
              </>
            )}
          </Card>
        )}

        {/* ── Stage: Recovery chooser (any defence failure) ── */}
        {stage === "verbal_recover" && recoverInfo && (
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold mb-1 text-ink">Recover your defence</h2>
            <p className="text-sm mb-5 text-muted leading-relaxed">{recoverInfo.headline}</p>
            {error && (
              <div className="text-xs mb-4 rounded border border-amber bg-amber-weak px-3 py-2 text-amber">{error}</div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => void recoverWithVoice(recoverInfo.trigger)}
                disabled={verbalBusy}
              >
                Try again with voice
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => void recoverWithTyped(recoverInfo.trigger)}
                disabled={verbalBusy}
              >
                Switch to typed answers
              </Button>
            </div>
            <p className="text-xs text-center text-muted mt-3">Scoring is identical in both modes.</p>
          </Card>
        )}

        {/* ── Stage: Upgrade — a neutral platform limit, never a sales prompt ── */}
        {stage === "upgrade" && (
          <Card className="p-10 text-center">
            <h2 className="font-display text-xl font-bold mb-2 text-ink">
              Monthly limit reached
            </h2>
            <p className="text-sm mb-6 leading-relaxed text-muted">
              {QUOTA_REACHED_MESSAGE}
            </p>
            <Link href="/dashboard">
              <Button variant="secondary" size="lg" className="w-full max-w-xs mx-auto">
                Back to dashboard
              </Button>
            </Link>
          </Card>
        )}

        {/* ── Stage: Scoring ── */}
        {stage === "scoring" && (
          <Card className="p-10 text-center">
            <div className="font-display font-semibold text-base mb-4 text-ink">{scoringMsg}</div>
            <ProgressNarrative elapsedSeconds={elapsed} steps={[{ label: "Almost done", doneAfter: 100 }]} />
          </Card>
        )}

        {/* ── Stage: Score ── */}
        {stage === "score" && result && (
          <div className="flex flex-col gap-5">

            {pendingReview && (
              <div className="rounded border border-hairline bg-surface px-4 py-3 text-sm text-ink leading-relaxed">
                {pendingReview}
              </div>
            )}

            {ticket && (
              <div className="text-center mb-1">
                <div className="text-sm font-semibold text-muted">{ticket.title}</div>
              </div>
            )}

            {hideResults ? (
              <Card className="p-10 text-center">
                <div className="text-3xl mb-4">✓</div>
                <div className="font-display font-semibold text-lg mb-3 text-ink">
                  {hiringMeta
                    ? `Your assessment for ${hiringMeta.roleName} at ${hiringMeta.companyName} is complete and has been received.`
                    : "Your assessment is complete and has been received."}
                </div>
                <p className="text-sm leading-relaxed text-muted max-w-md mx-auto">
                  The hiring team is reviewing all candidates. You&apos;ll hear the outcome by email.
                </p>
              </Card>
            ) : (
              <>
                {(() => {
                  const prBase = (result.scoreDiagnosis ?? 0) + (result.scoreDesign ?? 0) +
                                 (result.scoreCommunication ?? 0) + (result.scoreExecution ?? 0);
                  const deductions: { label: string; amount: number; note?: string }[] = [];
                  if ((result.verbalPenalty ?? 0) > 0) {
                    deductions.push({ label: "Verbal defence", amount: result.verbalPenalty!, note: result.verbalNote ?? undefined });
                  }
                  if (result.declarationMismatch && result.mismatchPenalty > 0) {
                    deductions.push({
                      label: "Declaration mismatch",
                      amount: result.mismatchPenalty,
                      note: "Your answers show signs of AI generation but you declared little or no AI use.",
                    });
                  }
                  const dimLabel = (code: string, design: string) => (isDesign ? design : code);
                  return (
                    <ScoreReceipt
                      variant="full"
                      data={{
                        prBaseScore: prBase,
                        finalScore: result.scoreTotal,
                        lineItems: [
                          { label: dimLabel("Diagnosis", "Requirements"), weight: 40, score: result.scoreDiagnosis },
                          { label: dimLabel("Design", "Architecture"), weight: 30, score: result.scoreDesign },
                          { label: "Communication", weight: 20, score: result.scoreCommunication },
                          { label: dimLabel("Execution", "Completeness"), weight: 10, score: result.scoreExecution },
                        ],
                        deductions,
                      }}
                    />
                  );
                })()}

                {result.verbalNote && (() => {
                  const penalised = (result.verbalPenalty ?? 0) > 0;
                  const notCaptured = result.verbalScore === null || result.verbalScore === undefined;
                  const tone = penalised ? "bad" : notCaptured ? "warn" : "good";
                  const msg = penalised
                    ? "couldn't fully back your written answer aloud — reflected in the deduction above."
                    : notCaptured
                      ? "no spoken answer captured — flagged for review."
                      : "matched your written answer — understanding confirmed.";
                  return (
                    <div className={cn(
                      "text-xs rounded border px-3 py-2",
                      tone === "bad" ? "border-red bg-red-weak text-red" : tone === "warn" ? "border-amber bg-amber-weak text-amber" : "border-emerald bg-emerald-weak text-emerald"
                    )}>
                      <span className="font-semibold">Spoken explanation: </span>{msg}
                    </div>
                  );
                })()}

                {result.claudeReview && (
                  <Card className="p-6">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-4">Feedback</div>
                    <p className="text-sm italic leading-relaxed mb-5 text-muted">
                      &ldquo;{result.claudeReview.summary}&rdquo;
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded border border-emerald bg-emerald-weak p-4">
                        <div className="text-xs font-semibold mb-2 text-emerald">Top strength</div>
                        <div className="text-sm text-ink">{result.claudeReview.topStrength}</div>
                      </div>
                      <div className="rounded border border-amber bg-amber-weak p-4">
                        <div className="text-xs font-semibold mb-2 text-amber">Top improvement</div>
                        <div className="text-sm text-ink">{result.claudeReview.topImprovement}</div>
                      </div>
                    </div>
                  </Card>
                )}

                {result.bonusNote && !result.declarationMismatch && (
                  <div className="rounded border border-hairline px-5 py-4 text-sm leading-relaxed">
                    <span className="font-semibold text-ink">AI usage: </span>
                    <span className="text-muted">{result.bonusNote}</span>
                  </div>
                )}

                {result.followUpFeedback && (
                  <div className="rounded border border-hairline px-5 py-4 text-sm leading-relaxed">
                    <span className="font-semibold text-ink">Assessment: </span>
                    <span className="text-muted">{result.followUpFeedback}</span>
                  </div>
                )}
              </>
            )}

            <Link href="/dashboard">
              <Button variant="primary" size="lg" className="w-full">Back to dashboard →</Button>
            </Link>

            {/* Request human review — quiet action. For hiring candidates this
                moves to the employer's decision email (they don't see a result
                page), so it's shown here only when the result IS visible. */}
            {!hideResults && (
              <a href="mailto:ossama@devsimulate.com?subject=Requesting review of my assessment" className="text-center text-xs text-muted hover:text-ink underline underline-offset-2">
                Request human review
              </a>
            )}

            {/* Feedback */}
            {!feedbackSent ? (
              <Card className="p-6">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Quick feedback</div>
                <p className="text-xs mb-4 text-muted">
                  Help us improve — takes 30 seconds. Goes directly to the founder.
                </p>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setFeedbackRating(star)}
                      className="text-2xl transition-transform hover:scale-110"
                      style={{ opacity: feedbackRating >= star ? 1 : 0.3 }}>
                      ★
                    </button>
                  ))}
                </div>
                <Textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What worked well? What was confusing? Anything you want added?"
                  rows={3}
                  className="mb-3"
                />
                <Button
                  variant="primary" size="lg" className="w-full"
                  onClick={handleFeedbackSubmit}
                  disabled={feedbackRating === 0 || !feedbackText.trim()}
                >
                  Send feedback
                </Button>
              </Card>
            ) : (
              <div className="rounded border border-emerald bg-emerald-weak p-5 text-center text-sm font-semibold text-emerald">
                Thanks for the feedback! It goes straight to ossama@devsimulate.com
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}

export default function SubmitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-muted">
        Loading…
      </div>
    }>
      <EdgeBanner />
      <SubmitPageInner />
    </Suspense>
  );
}
