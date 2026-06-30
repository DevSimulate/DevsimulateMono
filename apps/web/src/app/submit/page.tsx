"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken, storeToken, clearToken } from "@/lib/auth";
import Logo from "@/components/Logo";
import clsx from "clsx";

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

const DIFFICULTY_COLOR: Record<string, string> = {
  JUNIOR: "bg-[#CCFBF1] text-[#0D9488]",
  MID:    "bg-[#FEF3C7] text-[#D97706]",
  SENIOR: "bg-[#FCE7F3] text-[#BE185D]",
};

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
  | "scoring"
  | "score"
  | "upgrade";

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

function ScoreBar({ label, value, max }: { label: string; value: number | null; max: number }) {
  const pct = value !== null ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-xs shrink-0" style={{ color: "#6B6B6B" }}>{label}</div>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#E4E2DD" }}>
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-xs text-right font-bold shrink-0" style={{ color: "#1A1A1A" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}


function SubmitPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const ticketId   = params.get("ticketId")   ?? "";
  const prUrl      = params.get("prUrl")      ?? "";
  const branchName = params.get("branchName") ?? "";

  // When the extension opens this page it appends ?token=JWT so the session
  // works regardless of which browser the OS picks as the default.
  const urlToken = params.get("token");
  if (urlToken) storeToken(urlToken);

  const [stage,        setStage]        = useState<Stage>("loading");
  const [ticket,       setTicket]       = useState<Ticket | null>(null);
  const [description,  setDescription]  = useState("");
  const [designDoc,    setDesignDoc]    = useState("");
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
  const [blurCount,    setBlurCount]    = useState(0);
  const [username,     setUsername]     = useState<string>("");
  const [writeTimeLeft, setWriteTimeLeft] = useState(0);
  // Verbal explanation step (camera on for presence; live text via Web Speech, or
  // record→Whisper as a fallback when Web Speech isn't available)
  const [verbalQuestion, setVerbalQuestion] = useState("");
  const [verbalReady,    setVerbalReady]    = useState(false); // true after camera+mic granted
  const [verbalTimeLeft, setVerbalTimeLeft] = useState(120);
  const [verbalBusy,     setVerbalBusy]     = useState(false);
  const [scoringMsg,     setScoringMsg]     = useState("Calculating your score…");
  const VERBAL_SECONDS = 120;
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const verbalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const writeRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Paste check temporarily DISABLED. AI use is allowed, the block is trivially
  // bypassable, and it over-flags honest candidates — judgment is measured by the
  // rubric + follow-up instead. To re-enable, restore the body below.
  function handleAnswerPaste(_e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // e.preventDefault();
    // setPasteCount((n) => n + 1);
    // setPasteWarn(true);
    // setTimeout(() => setPasteWarn(false), 4000);
  }


  // Auth check + ticket fetch
  useEffect(() => {
    const token = getToken();
    if (!token) {
      localStorage.setItem("ds_submit_return", window.location.href);
      window.location.href = GITHUB_AUTH_URL;
      return;
    }
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
        if (data.data) {
          setTicket(data.data);
          setStage(data.data.stack === "SYSTEM_DESIGN" ? "sd_write" : "describe");
        } else {
          setStage("describe");
        }
      })
      .catch(() => setStage("describe"));
  }, [ticketId, router]);

  // Fetch the candidate's GitHub username for the integrity watermark
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.data?.githubUsername) setUsername(j.data.githubUsername); })
      .catch(() => null);
  }, []);

  // Tab-switch / focus-loss counter — active while writing or answering.
  // Leaving the tab during a timed assessment is recorded as an integrity signal
  // (e.g. switching to an AI tool or to take a screenshot).
  useEffect(() => {
    const watched = ["describe", "sd_write", "q1", "q2"];
    if (!watched.includes(stage)) return;
    const onHidden = () => { if (document.hidden) setBlurCount((n) => n + 1); };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [stage]);

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
      setError(err instanceof Error ? err.message : "Submission failed — please try again.");
      setStage("describe");
    }
  }

  async function handleDesignSubmit() {
    const token = getToken();
    if (!token) return;
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
    const sseOk = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 8 * 60 * 1000);

      fetch(`${API_URL}/submissions/${sid}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (response) => {
          if (!response.body) { clearTimeout(timeout); resolve(false); return; }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) { clearTimeout(timeout); resolve(false); return; }
            if (decoder.decode(value, { stream: true }).includes("reviewed")) {
              clearTimeout(timeout);
              resolve(true);
              return;
            }
          }
        })
        .catch(() => { clearTimeout(timeout); resolve(false); });
    });

    if (sseOk) return;

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
          if (data.data?.status === "VOID") throw new Error("Review failed on the server. Please try again.");
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
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // Triggered by the "Start" button. Requests camera+mic permission FIRST (one
  // combined prompt) and only starts the timer + recording AFTER it's granted — so
  // the candidate never speaks before the mic is live.
  async function beginVerbal() {
    setError(null);
    chunksRef.current = [];

    // Ask for camera AND mic up front in one prompt.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

    setVerbalReady(true);
    setVerbalTimeLeft(VERBAL_SECONDS);
    verbalTimerRef.current = setInterval(() => {
      setVerbalTimeLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
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

  async function handleVerbalSubmit() {
    if (verbalBusy) return;
    setVerbalBusy(true);

    const audio = await stopAndGetAudio();
    stopVerbalMedia();
    setScoringMsg("Transcribing your explanation…");
    setStage("scoring"); // score is only finalised AFTER the spoken explanation

    const token = getToken();
    try {
      const url = `${API_URL}/submissions/${submissionId}/verbal-audio?question=${encodeURIComponent(verbalQuestion)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": audio.type || "audio/webm" },
        body: audio,
      });
      const d = await r.json().catch(() => ({}));

      // The verbal step is REQUIRED. A failure (server/config error, or no speech
      // captured) must NOT silently award the score — send them back to explain again.
      if (!r.ok || !d.data) {
        setVerbalBusy(false);
        setError("Couldn't process your explanation — check your microphone and try again. Your score is finalised only after the spoken explanation.");
        setStage("verbal");
        return;
      }
      if (d.data.score === null || d.data.score === undefined) {
        setVerbalBusy(false);
        setError("We couldn't hear your spoken answer — check your microphone and explain again.");
        setStage("verbal");
        return;
      }
      setResult((prev) => prev ? {
        ...prev,
        scoreTotal:    d.data.newScoreTotal ?? prev.scoreTotal,
        verbalNote:    d.data.note,
        verbalScore:   d.data.score,
        verbalPenalty: d.data.penalty ?? 0,
      } : prev);
    } catch {
      setVerbalBusy(false);
      setError("Couldn't reach the server to process your explanation — please try again.");
      setStage("verbal");
      return;
    }
    setVerbalBusy(false);
    setError(null);
    setStage("score");
  }

  // On entering the verbal stage, wait for the candidate to click Start (which asks
  // for camera+mic) — don't auto-start, so the timer never runs during the prompt.
  useEffect(() => {
    if (stage !== "verbal") return;
    setVerbalReady(false);
    return () => stopVerbalMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Auto-submit when the timer runs out (only once recording has started).
  useEffect(() => {
    if (stage === "verbal" && verbalReady && verbalTimeLeft === 0 && !verbalBusy) handleVerbalSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verbalTimeLeft, stage, verbalReady]);

  const mins      = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs      = (timeLeft % 60).toString().padStart(2, "0");
  const si         = stepIndex(stage);
  const isDesign   = ticket?.stack === "SYSTEM_DESIGN";
  const STEP_LABELS = isDesign ? STEP_LABELS_DESIGN : STEP_LABELS_CODE;

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center text-sm" style={{ color: "#6B6B6B" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">

      {/* Header */}
      <header className="nav-glass sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <Link href="/"><Logo variant="horizontal" size={32} /></Link>
        <Link href="/dashboard" className="text-sm font-medium transition-colors" style={{ color: "#6B6B6B" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6B6B6B")}>
          Dashboard →
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Step indicator */}
        <div className="flex items-center mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  i < si  ? "bg-[#0D9488] text-white" :
                  i === si ? "bg-[#5B5BD6] text-white" :
                             "bg-[#E4E2DD] text-[#6B6B6B]"
                )}>
                  {i < si ? "✓" : i + 1}
                </div>
                <span className={clsx(
                  "text-xs font-medium hidden sm:block",
                  i <= si ? "text-[#1A1A1A]" : "text-[#6B6B6B]"
                )}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className="flex-1 h-px mx-2" style={{ background: i < si ? "#0D9488" : "#E4E2DD" }} />
              )}
            </div>
          ))}
        </div>

        {/* Ticket info bar */}
        {ticket && stage !== "score" && (
          <div className="card p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate mb-0.5" style={{ color: "#1A1A1A" }}>{ticket.title}</div>
                {!isDesign && prUrl && (
                  <a href={prUrl} target="_blank" rel="noreferrer"
                    className="text-xs font-mono truncate block hover:underline" style={{ color: "#5B5BD6" }}>
                    {prUrl}
                  </a>
                )}
                {isDesign && (
                  <span className="text-xs font-medium" style={{ color: "#5B5BD6" }}>
                    System Design Challenge · {ticket.expectedMinutes} min
                  </span>
                )}
              </div>
              <span className={clsx("text-xs font-bold rounded-full px-3 py-1 shrink-0", DIFFICULTY_COLOR[ticket.difficulty])}>
                {ticket.difficulty}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 px-4 py-3 mb-6 text-sm"
            style={{ background: "#FFF5F5", color: "#DC2626" }}>
            {error}
          </div>
        )}

        {/* ── Stage: Describe ── */}
        {stage === "describe" && (
          <div className="card p-6 fade-in-up">
            <div className="section-label mb-1">Your Approach</div>
            <p className="text-sm mb-5" style={{ color: "#6B6B6B" }}>
              Explain your fix — root cause, how you found it, why you chose this solution.
              Be specific. This is what Claude scores.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onPaste={handleAnswerPaste}
              placeholder={"## What was the root cause?\n\n## How did you investigate?\n\n## Why did you choose this solution?\n\n## How do you know it works?"}
              rows={12}
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none resize-none mb-3 font-mono"
              style={{ borderColor: pasteWarn ? "#DC2626" : "#E4E2DD", background: "#F7F6F3", color: "#1A1A1A", lineHeight: 1.7 }}
            />
            {pasteWarn && (
              <div className="rounded-lg px-3 py-2 mb-3 text-xs font-semibold"
                style={{ background: "#FFF5F5", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                Pasting is disabled. Write your own explanation — paste attempts are recorded and lower your integrity score.
              </div>
            )}
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-medium" style={{ color: description.length < 100 ? "#D97706" : "#0D9488" }}>
                {description.length} chars
                {description.length < 100 ? ` — need ${100 - description.length} more` : " — ready"}
              </span>
              <span className="text-xs" style={{ color: "#6B6B6B" }}>Est. {ticket?.expectedMinutes ?? "—"} min ticket</span>
            </div>
            <button onClick={handleDescriptionSubmit} disabled={description.trim().length < 100}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
              Submit for Review →
            </button>
          </div>
        )}

        {/* ── Stage: System Design Write ── */}
        {stage === "sd_write" && ticket && (
          <div className="space-y-4 fade-in-up">
            {/* Write timer */}
            <div className="card p-4 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "#6B6B6B" }}>Time remaining to write your design</span>
              <span className="text-sm font-mono font-bold tabular-nums" style={{
                color: writeTimeLeft < 120 ? "#DC2626" : writeTimeLeft < 300 ? "#D97706" : "#1A1A1A",
              }}>
                ⏱ {Math.floor(writeTimeLeft / 60).toString().padStart(2, "0")}:{(writeTimeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>


            <div className="card p-6 relative overflow-hidden">
              <Watermark text={username} />
              <div className="relative" style={{ zIndex: 1 }}>
                <div className="section-label mb-1">The Problem</div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#6B6B6B" }}>
                  {ticket.description}
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="section-label mb-1">Your Design</div>
              <p className="text-sm mb-4" style={{ color: "#6B6B6B" }}>
                Write your complete system design answer. Cover all required components.
                Be specific — name technologies, describe data flows, justify your choices.
              </p>
              <textarea
                value={designDoc}
                onChange={(e) => setDesignDoc(e.target.value)}
                onPaste={handleAnswerPaste}
                placeholder={"## Requirements & Scale\n\n## Architecture Overview\n\n## API Design\n\n## Data Model & Storage\n\n## Key Trade-offs\n\n## Scaling Strategy"}
                rows={20}
                className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none resize-none mb-3 font-mono"
                style={{ borderColor: pasteWarn ? "#DC2626" : "#E4E2DD", background: "#F7F6F3", color: "#1A1A1A", lineHeight: 1.7 }}
              />
              {pasteWarn && (
                <div className="rounded-lg px-3 py-2 mb-3 text-xs font-semibold"
                  style={{ background: "#FFF5F5", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                  Pasting is disabled. Write your own design — paste attempts are recorded and lower your integrity score.
                </div>
              )}
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-medium" style={{ color: designDoc.length < 300 ? "#D97706" : "#0D9488" }}>
                  {designDoc.length} chars
                  {designDoc.length < 300 ? ` — need ${300 - designDoc.length} more` : " — ready"}
                </span>
                <span className="text-xs" style={{ color: "#6B6B6B" }}>Est. {ticket.expectedMinutes} min</span>
              </div>
              <button
                onClick={handleDesignSubmit}
                disabled={designDoc.trim().length < 300}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                Submit for Review →
              </button>
            </div>
          </div>
        )}

        {/* ── Stage: Analysing ── */}
        {stage === "analysing" && (
          <div className="card p-10 text-center fade-in-up">
            <div className="inline-block w-12 h-12 rounded-full border-4 border-[#5B5BD6] border-t-transparent animate-spin mb-5" />
            <div className="font-bold text-base mb-2" style={{ color: "#1A1A1A" }}>
              {isDesign ? "Reviewing your design…" : "Analysing your PR…"}
            </div>
            <div className="text-sm mb-1" style={{ color: "#6B6B6B" }}>
              {isDesign
                ? "Claude is evaluating your architecture and generating a follow-up question. Usually 30–60 seconds."
                : "Claude is reading your diff and generating a question. Usually 60–90 seconds."}
            </div>
            <div className="text-xs font-mono mb-8" style={{ color: elapsed > 90 ? "#D97706" : "#6B6B6B" }}>
              {Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")} elapsed
            </div>
            <div className="rounded-xl p-5 text-left space-y-3" style={{ background: "#F7F6F3", border: "1px solid #E4E2DD" }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#6B6B6B" }}>What to expect</div>
              {(isDesign ? [
                "Q1 targets a specific decision in your design — a trade-off, a component choice",
                "After you answer Q1, Q2 is generated from your actual answer",
                "You have 15 minutes total across both questions",
                "Final score = design review (100 pts) + follow-up answers",
              ] : [
                "Q1 is specific to your actual code changes — exact variables and functions",
                "After you answer Q1, Q2 is generated from your answer",
                "You have 15 minutes total across both questions",
                "Your answers verify you understand your own fix — they confirm the score, not inflate it",
              ]).map((tip) => (
                <div key={tip} className="flex items-start gap-2 text-xs" style={{ color: "#6B6B6B" }}>
                  <span className="shrink-0 mt-0.5" style={{ color: "#5B5BD6" }}>→</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stage: Q1 ── */}
        {stage === "q1" && (
          <div className="card p-6 fade-in-up">
            <div className="flex items-center justify-between mb-5">
              <div className="section-label">Question 1 of 2</div>
              <span className={clsx(
                "text-sm font-mono font-bold tabular-nums",
                timeLeft < 120 ? "text-red-500" : timeLeft < 300 ? "text-[#D97706]" : "text-[#6B6B6B]"
              )}>
                ⏱ {mins}:{secs}
              </span>
            </div>

            <div className="rounded-xl p-4 mb-2 relative overflow-hidden" style={{ background: "#F7F6F3", border: "1px solid #E4E2DD" }}>
              <Watermark text={username} />
              <p className="text-sm font-semibold leading-relaxed relative" style={{ color: "#1A1A1A", zIndex: 1 }}>{question1}</p>
            </div>
            <div className="mb-3" />

            <textarea
              value={answer1}
              onChange={(e) => setAnswer1(e.target.value)}
              onPaste={handleAnswerPaste}
              placeholder="Type your answer — pasting is disabled…"
              rows={6}
              disabled={timeLeft === 0}
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none resize-none mb-2 disabled:opacity-50"
              style={{ borderColor: pasteWarn ? "#DC2626" : "#E4E2DD", background: "#F7F6F3", color: "#1A1A1A" }}
            />
            {pasteWarn && (
              <div className="rounded-lg px-3 py-2 mb-3 text-xs font-semibold"
                style={{ background: "#FFF5F5", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                Pasting is disabled. Write your own understanding — paste attempts are recorded and lower your integrity score.
              </div>
            )}
            <div className="mb-3" />

            <div className="rounded-xl border px-4 py-3 mb-5 text-xs" style={{ borderColor: "#E4E2DD", background: "#EBEBFF", color: "#5B5BD6" }}>
              After you submit this answer, Q2 will be generated based on what you wrote.
            </div>

            <button onClick={handleA1Submit} disabled={!answer1.trim() || timeLeft === 0}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
              {timeLeft === 0 ? "Time expired" : "Submit Answer → Get Q2"}
            </button>
          </div>
        )}

        {/* ── Stage: Loading Q2 ── */}
        {stage === "loading_q2" && (
          <div className="card p-10 text-center fade-in-up">
            <div className="inline-block w-12 h-12 rounded-full border-4 border-[#5B5BD6] border-t-transparent animate-spin mb-5" />
            <div className="font-bold text-base mb-2" style={{ color: "#1A1A1A" }}>Generating Q2…</div>
            <div className="text-sm" style={{ color: "#6B6B6B" }}>
              Reading your answer and generating a follow-up question. ~5 seconds.
            </div>
          </div>
        )}

        {/* ── Stage: Q2 ── */}
        {stage === "q2" && (
          <div className="card p-6 fade-in-up">
            <div className="flex items-center justify-between mb-5">
              <div className="section-label">Question 2 of 2</div>
              <span className={clsx(
                "text-sm font-mono font-bold tabular-nums",
                timeLeft < 120 ? "text-red-500" : timeLeft < 300 ? "text-[#D97706]" : "text-[#6B6B6B]"
              )}>
                ⏱ {mins}:{secs}
              </span>
            </div>

            <div className="rounded-xl p-4 mb-5 relative overflow-hidden" style={{ background: "#F7F6F3", border: "1px solid #E4E2DD" }}>
              <Watermark text={username} />
              <p className="text-sm font-semibold leading-relaxed relative" style={{ color: "#1A1A1A", zIndex: 1 }}>{question2}</p>
            </div>

            <textarea
              value={answer2}
              onChange={(e) => setAnswer2(e.target.value)}
              onPaste={handleAnswerPaste}
              placeholder="Type your answer — pasting is disabled…"
              rows={6}
              disabled={timeLeft === 0}
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none resize-none mb-2 disabled:opacity-50"
              style={{ borderColor: pasteWarn ? "#DC2626" : "#E4E2DD", background: "#F7F6F3", color: "#1A1A1A" }}
            />
            {pasteWarn && (
              <div className="rounded-lg px-3 py-2 mb-3 text-xs font-semibold"
                style={{ background: "#FFF5F5", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                Pasting is disabled. Write your own understanding — paste attempts are recorded and lower your integrity score.
              </div>
            )}
            <div className="mb-3" />

            <div className="rounded-xl border p-4 mb-5 space-y-2" style={{ borderColor: "#E4E2DD", background: "white" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#6B6B6B" }}>
                How did you answer these questions?
              </p>
              {AI_OPTIONS.map((opt) => (
                <label key={opt.value} className={clsx(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  declaration === opt.value ? "border-[#5B5BD6] bg-[#EBEBFF]" : "border-[#E4E2DD] hover:border-[#C4C2DB]"
                )}>
                  <input type="radio" name="aiDeclaration" value={opt.value}
                    checked={declaration === opt.value} onChange={() => setDeclaration(opt.value)}
                    className="mt-0.5 shrink-0" style={{ accentColor: "#5B5BD6" }} />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{opt.label}</div>
                    <div className="text-xs" style={{ color: "#6B6B6B" }}>{opt.sub}</div>
                  </div>
                </label>
              ))}
            </div>

            <button onClick={handleFinalSubmit} disabled={!answer2.trim() || !declaration || timeLeft === 0}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
              {timeLeft === 0 ? "Time expired" : !declaration ? "Select how you answered to continue" : "Get My Score →"}
            </button>
          </div>
        )}

        {/* ── Stage: Verbal explanation ── */}
        {stage === "verbal" && (
          <div className="card rounded-2xl p-6 fade-in-up">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>Explain it out loud</h2>
              {verbalReady && (
                <span className="text-sm font-mono font-bold rounded-full px-3 py-1"
                  style={{ background: verbalTimeLeft <= 20 ? "#FEE2E2" : "#EEF2FF", color: verbalTimeLeft <= 20 ? "#DC2626" : "#4F46E5" }}>
                  {Math.floor(verbalTimeLeft / 60)}:{(verbalTimeLeft % 60).toString().padStart(2, "0")}
                </span>
              )}
            </div>
            <p className="text-xs mb-4" style={{ color: "#6B6B6B" }}>
              Answer in your own words — your speech is transcribed and checked against your written answers. The video is <span className="font-semibold">not recorded</span>; only the text is kept. <span className="font-semibold">Your score is finalised after this.</span>
            </p>
            {error && (
              <div className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: "#FEF3C7", color: "#D97706" }}>{error}</div>
            )}

            {!verbalReady ? (
              <>
                <div className="rounded-xl p-4 mb-4" style={{ background: "#F7F6F3", border: "1px solid #E4E2DD" }}>
                  <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#5B5BD6" }}>You'll answer aloud</div>
                  <p className="text-sm font-semibold leading-relaxed" style={{ color: "#1A1A1A" }}>{verbalQuestion}</p>
                </div>
                <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                  When you click Start, your browser will ask for <span className="font-semibold">camera &amp; microphone</span>. Allow both. The <span className="font-semibold">2-minute timer begins only after</span> you start — so take your time here, then speak.
                </div>
                <button onClick={beginVerbal} className="btn-primary w-full">
                  Start — allow camera &amp; mic →
                </button>
              </>
            ) : (
              <>
                <div className="flex gap-4 mb-4 items-start">
                  <video ref={videoRef} muted autoPlay playsInline
                    className="rounded-xl shrink-0" style={{ width: 160, height: 120, objectFit: "cover", background: "#000", transform: "scaleX(-1)" }} />
                  <div className="flex-1 rounded-xl p-4" style={{ background: "#F7F6F3", border: "1px solid #E4E2DD" }}>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#5B5BD6" }}>Answer aloud</div>
                    <p className="text-sm font-semibold leading-relaxed" style={{ color: "#1A1A1A" }}>{verbalQuestion}</p>
                  </div>
                </div>

                <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm"
                  style={{ background: "#FFFFFF", border: "1px solid #E4E2DD", color: "#6B6B6B" }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ background: "#DC2626" }} />
                  Recording — speak your answer now. Click <span className="font-semibold">Submit</span> when done (it transcribes after you submit).
                </div>

                <button onClick={handleVerbalSubmit} disabled={verbalBusy}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
                  {verbalBusy ? "Submitting…" : "Submit explanation →"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Stage: Upgrade ── */}
        {stage === "upgrade" && (
          <div className="card rounded-2xl p-10 text-center fade-in-up">
            <div className="text-4xl mb-4">🚀</div>
            <h2 className="text-2xl font-black mb-2" style={{ color: "#1A1A1A" }}>
              Free plan limit reached
            </h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "#6B6B6B" }}>
              You have used your 2 free submissions this month.<br />
              Upgrade to Pro for <strong style={{ color: "#1A1A1A" }}>unlimited tickets</strong> at $9/month.
            </p>
            <div className="space-y-3 max-w-xs mx-auto">
              <a href="/pricing" className="btn-primary w-full text-center block">
                Upgrade to Pro — $9/month →
              </a>
              <a href="/dashboard" className="btn-outline w-full text-center block">
                Back to Dashboard
              </a>
            </div>
            <p className="text-xs mt-4" style={{ color: "#9CA3AF" }}>
              Your limit resets on the 1st of every month.
            </p>
          </div>
        )}

        {/* ── Stage: Scoring ── */}
        {stage === "scoring" && (
          <div className="card p-10 text-center fade-in-up">
            <div className="inline-block w-12 h-12 rounded-full border-4 border-[#0D9488] border-t-transparent animate-spin mb-5" />
            <div className="font-bold text-base mb-2" style={{ color: "#1A1A1A" }}>{scoringMsg}</div>
            <div className="text-sm" style={{ color: "#6B6B6B" }}>
              Almost done.
            </div>
          </div>
        )}

        {/* ── Stage: Score ── */}
        {stage === "score" && result && (
          <div className="space-y-5 fade-in-up">

            {ticket && (
              <div className="text-center mb-2">
                <div className="text-sm font-semibold" style={{ color: "#6B6B6B" }}>{ticket.title}</div>
              </div>
            )}

            <div className="card shine p-8 text-center">
              <div className="text-6xl font-black gradient-text leading-none mb-1">{result.scoreTotal}</div>
              <div className="text-sm font-semibold mb-3" style={{ color: "#6B6B6B" }}>/100</div>
              {(() => {
                const prBase = (result.scoreDiagnosis ?? 0) + (result.scoreDesign ?? 0) +
                               (result.scoreCommunication ?? 0) + (result.scoreExecution ?? 0);
                const gap = prBase - result.scoreTotal;
                return gap > 10 ? (
                  <div className="text-xs mb-3" style={{ color: "#6B6B6B" }}>
                    PR score <span className="font-bold" style={{ color: "#1A1A1A" }}>{prBase}</span>
                    {" → "}
                    final <span className="font-bold" style={{ color: "#DC2626" }}>{result.scoreTotal}</span>
                    {"  "}
                    <span style={{ color: "#D97706" }}>({gap} pts deducted)</span>
                  </div>
                ) : null;
              })()}
              {result.verbalNote && (() => {
                const penalised = (result.verbalPenalty ?? 0) > 0;
                const notCaptured = result.verbalScore === null || result.verbalScore === undefined;
                const bg = penalised ? "#FEE2E2" : notCaptured ? "#FEF3C7" : "#CCFBF1";
                const fg = penalised ? "#DC2626" : notCaptured ? "#D97706" : "#0D9488";
                const msg = penalised
                  ? `couldn't back your written answer aloud (−${result.verbalPenalty} pts).`
                  : notCaptured
                    ? "no spoken answer captured — flagged for review."
                    : "matched your written answer — understanding confirmed.";
                return (
                  <div className="text-xs mb-3 rounded-lg px-3 py-2 text-left inline-block" style={{ background: bg, color: fg }}>
                    <span className="font-bold">Spoken explanation: </span>{msg}
                  </div>
                );
              })()}
              {/* Honest label only. The follow-up is a probe, not proof — we cannot
                  assert "understanding verified" from text answers (a careful AI user
                  passes it too). Surface completion; leave the judgment to the reviewer. */}
              <div className="inline-block text-xs font-bold rounded-full px-4 py-1"
                style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                ✓ Follow-up completed
              </div>
            </div>

            <div className="card p-6">
              <div className="section-label mb-4">Score Breakdown</div>
              <div className="space-y-3">
                <ScoreBar label={isDesign ? "Requirements (40)" : "Diagnosis (40)"}    value={result.scoreDiagnosis}     max={40} />
                <ScoreBar label={isDesign ? "Architecture (30)" : "Design (30)"}       value={result.scoreDesign}        max={30} />
                <ScoreBar label="Communication (20)"                                   value={result.scoreCommunication} max={20} />
                <ScoreBar label={isDesign ? "Completeness (10)" : "Execution (10)"}   value={result.scoreExecution}     max={10} />
              </div>
            </div>

            {result.claudeReview && (
              <div className="card p-6">
                <div className="section-label mb-4">Claude&rsquo;s Feedback</div>
                <p className="text-sm italic leading-relaxed mb-5" style={{ color: "#6B6B6B" }}>
                  &ldquo;{result.claudeReview.summary}&rdquo;
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl p-4" style={{ background: "#CCFBF1", border: "1px solid #A7F3D0" }}>
                    <div className="text-xs font-bold mb-2" style={{ color: "#0D9488" }}>Top strength</div>
                    <div className="text-sm" style={{ color: "#1A1A1A" }}>{result.claudeReview.topStrength}</div>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                    <div className="text-xs font-bold mb-2" style={{ color: "#D97706" }}>Top improvement</div>
                    <div className="text-sm" style={{ color: "#1A1A1A" }}>{result.claudeReview.topImprovement}</div>
                  </div>
                </div>
              </div>
            )}

            {result.declarationMismatch && (
              <div className="rounded-xl px-5 py-4 text-sm leading-relaxed"
                style={{ background: "#FFF5F5", border: "1px solid #FCA5A5" }}>
                <div className="font-bold mb-1" style={{ color: "#DC2626" }}>
                  Declaration Mismatch — {result.mismatchPenalty} pts penalty applied
                </div>
                <div style={{ color: "#1A1A1A" }}>
                  Your answers show signs of AI generation but you declared little or no AI use.
                  {result.mismatchPenalty} points were deducted because your answers did not match your declaration.
                  Honest declarations always give better long-term results.
                </div>
              </div>
            )}

            {result.bonusNote && !result.declarationMismatch && (
              <div className="rounded-xl px-5 py-4 text-sm leading-relaxed"
                style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <span className="font-bold" style={{ color: "#D97706" }}>AI Usage: </span>
                <span style={{ color: "#1A1A1A" }}>{result.bonusNote}</span>
              </div>
            )}

            {result.followUpFeedback && (
              <div className="rounded-xl px-5 py-4 text-sm leading-relaxed"
                style={{ background: "#EBEBFF", border: "1px solid #C4C2DB" }}>
                <span className="font-bold" style={{ color: "#5B5BD6" }}>Assessment: </span>
                <span style={{ color: "#1A1A1A" }}>{result.followUpFeedback}</span>
              </div>
            )}

            <Link href="/dashboard" className="btn-primary w-full text-center block">
              Back to Dashboard →
            </Link>

            {/* Feedback */}
            {!feedbackSent ? (
              <div className="card p-6">
                <div className="section-label mb-1">Quick Feedback</div>
                <p className="text-xs mb-4" style={{ color: "#6B6B6B" }}>
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
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="What worked well? What was confusing? Anything you want added?"
                  rows={3}
                  className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none resize-none mb-3"
                  style={{ borderColor: "#E4E2DD", background: "#F7F6F3", color: "#1A1A1A" }}
                />
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={feedbackRating === 0 || !feedbackText.trim()}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  Send Feedback
                </button>
              </div>
            ) : (
              <div className="rounded-2xl p-5 text-center text-sm font-semibold"
                style={{ background: "#DCFCE7", color: "#16a34a" }}>
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
      <div className="min-h-screen bg-grid flex items-center justify-center text-sm" style={{ color: "#6B6B6B" }}>
        Loading…
      </div>
    }>
      <SubmitPageInner />
    </Suspense>
  );
}
