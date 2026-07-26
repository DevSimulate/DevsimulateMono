"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LevelMeter } from "./LevelMeter";
import { useAudioLevel } from "./useAudioLevel";

const DEVICE_KEY = "ds_mic_device";
const TEST_SECONDS = 5;

/**
 * Verbal-defence pre-flight. Most "the mic didn't pick up my voice" cases are
 * the browser using the wrong input device, so this makes the candidate:
 *   1. pick their audio input (persisted for the session),
 *   2. record a 5-second clip, hear it played back, AND see the transcript the
 *      same STT path produced ("we heard: …"),
 *   3. confirm they heard themselves clearly — before the timed defence starts.
 *
 * The test is unlimited and never counts against the candidate; the clip is
 * discarded immediately (object URL revoked) and the server is told not to
 * persist its confidence (?preflight=true). Repeated garbled tests fire
 * `onRepeatedFailure` — the hook Part 2 uses to offer the typed fallback.
 */
export function PreflightCheck({
  apiUrl,
  token,
  submissionId,
  onPassed,
  onRepeatedFailure,
  maxFails = 3,
}: {
  apiUrl: string;
  token: string;
  submissionId: string;
  /** Called with the chosen deviceId once the candidate confirms audio is good. */
  onPassed: (deviceId: string | null) => void;
  /** Fired once the test has come back garbled `maxFails` times (Part 2 trigger a). */
  onRepeatedFailure?: () => void;
  maxFails?: number;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "review">("idle");
  const [countdown, setCountdown] = useState(TEST_SECONDS);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [permError, setPermError] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const level = useAudioLevel(stream);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // (Re)open a live audio stream for the chosen device. Labels only populate
  // after permission is granted, so we getUserMedia first, then enumerate.
  const openStream = useCallback(
    async (deviceId?: string) => {
      setPermError(false);
      stopStream();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        streamRef.current = s;
        setStream(s);
        const active = s.getAudioTracks()[0]?.getSettings().deviceId ?? "";
        const list = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "audioinput"
        );
        setDevices(list);
        const chosen = deviceId ?? active ?? list[0]?.deviceId ?? "";
        setSelectedId(chosen);
        if (chosen && typeof window !== "undefined") sessionStorage.setItem(DEVICE_KEY, chosen);
      } catch {
        setPermError(true);
      }
    },
    [stopStream]
  );

  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(DEVICE_KEY) : null;
    void openStream(saved ?? undefined);
    return () => {
      stopStream();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function revokeClip() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
  }

  function changeDevice(id: string) {
    setPhase("idle");
    setTranscript(null);
    revokeClip();
    void openStream(id);
  }

  function startTest() {
    if (!streamRef.current) return;
    revokeClip();
    setTranscript(null);
    chunksRef.current = [];

    const audioStream = new MediaStream(streamRef.current.getAudioTracks());
    let mime = "";
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("audio/webm")) mime = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";
    }
    const rec = mime
      ? new MediaRecorder(audioStream, { mimeType: mime })
      : new MediaRecorder(audioStream);
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => void finishTest(rec.mimeType || "audio/webm");
    recorderRef.current = rec;
    rec.start();

    setPhase("recording");
    setCountdown(TEST_SECONDS);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          try {
            if (rec.state !== "inactive") rec.stop();
          } catch {
            /* already stopped */
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function finishTest(type: string) {
    const blob = new Blob(chunksRef.current, { type });
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioUrl(url);
    setPhase("review");
    setBusy(true);
    try {
      // ?preflight=true → server transcribes but does NOT persist confidence:
      // the test must never influence the real answer's scoring.
      const r = await fetch(
        `${apiUrl}/submissions/${submissionId}/verbal-transcribe?preflight=true`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": type },
          body: blob,
        }
      );
      const d = await r.json().catch(() => ({}));
      const text = (r.ok && d.data?.transcript ? (d.data.transcript as string) : "").trim();
      setTranscript(text);
      if (text.split(/\s+/).filter(Boolean).length < 2) {
        setFailCount((n) => n + 1);
      }
      // The SERVER counts garbled clips and decides when typed mode is granted
      // (authoritative — the client can't fake it). Honour its signal.
      if (d.data?.typedGranted) onRepeatedFailure?.();
    } catch {
      setTranscript("");
    } finally {
      setBusy(false);
    }
  }

  const garbled = transcript !== null && transcript.split(/\s+/).filter(Boolean).length < 2;

  function confirm() {
    stopStream();
    revokeClip();
    onPassed(selectedId || null);
  }

  const deviceLabel = (d: MediaDeviceInfo, i: number) =>
    d.label || `Microphone ${i + 1}`;

  return (
    <div className="rounded border border-hairline bg-paper p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
        Microphone check
      </div>
      <p className="text-sm leading-relaxed text-ink mb-4">
        Before the timed defence starts, let&apos;s make sure we can hear you. Record a short test,
        play it back, and confirm it sounds right.
      </p>

      {permError ? (
        <div className="text-xs mb-4 rounded border border-amber bg-amber-weak px-3 py-2 text-amber">
          We couldn&apos;t access your microphone. Allow mic permission in your browser, then{" "}
          <button className="underline font-semibold" onClick={() => void openStream(selectedId || undefined)}>
            try again
          </button>
          .
        </div>
      ) : (
        <>
          {/* Device picker */}
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">
            Input device
          </label>
          <select
            value={selectedId}
            onChange={(e) => changeDevice(e.target.value)}
            disabled={phase === "recording"}
            className="w-full mb-4 rounded border border-hairline bg-surface px-3 py-2 text-sm text-ink"
          >
            {devices.length === 0 && <option value="">Default microphone</option>}
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {deviceLabel(d, i)}
              </option>
            ))}
          </select>

          {/* Live level — silent capture is visible immediately, not after answering */}
          <div className="rounded border border-hairline px-4 py-3 mb-4 flex items-center justify-between text-xs text-muted">
            <span>Live input level</span>
            <LevelMeter level={level} />
          </div>

          {phase === "idle" && (
            <>
              <div className="rounded border border-dashed border-hairline px-4 py-3 mb-4 text-xs text-muted">
                Say out loud: <span className="font-semibold text-ink">&ldquo;I&apos;m ready to begin.&rdquo;</span>
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={startTest}>
                Record {TEST_SECONDS}-second test →
              </Button>
            </>
          )}

          {phase === "recording" && (
            <div className="rounded border border-hairline px-4 py-3 text-sm text-ink flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red animate-pulse shrink-0" />
                Recording — say &ldquo;I&apos;m ready to begin.&rdquo;
              </span>
              <span className="font-mono font-semibold">{countdown}s</span>
            </div>
          )}

          {phase === "review" && (
            <>
              {audioUrl && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                    Play it back
                  </div>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio src={audioUrl} controls className="w-full" />
                </div>
              )}

              <div className="rounded border border-hairline bg-surface p-3 mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                  We heard
                </div>
                {busy ? (
                  <p className="text-sm text-muted">Transcribing…</p>
                ) : garbled ? (
                  <p className="text-sm text-amber leading-relaxed">
                    We couldn&apos;t make out clear words. Try a different device above, move closer
                    to the mic, or reduce background noise — then retest.
                  </p>
                ) : (
                  <p className="text-sm text-ink leading-relaxed">&ldquo;{transcript}&rdquo;</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  onClick={confirm}
                  disabled={busy}
                >
                  I could hear myself clearly →
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={startTest}
                  disabled={busy}
                >
                  Retest
                </Button>
              </div>
              {failCount >= maxFails && (
                <p className="text-xs text-muted mt-3 leading-relaxed">
                  Still no luck after {failCount} tries? If you can hear yourself on playback you can
                  continue anyway — otherwise a typed alternative will be offered so a mic problem
                  never blocks you.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
