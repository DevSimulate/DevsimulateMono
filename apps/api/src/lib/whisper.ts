import { confidenceFromSegments, proxyConfidence, WhisperSegment } from "../services/transcript-confidence";

export interface Transcription {
  text: string;
  /**
   * 0-1 estimate of how much to trust the transcript, or null when no signal
   * was available. Low values mean bad AUDIO, never a bad answer.
   */
  confidence: number | null;
  /** Where the confidence came from — useful when triaging a flagged case. */
  source: "segments" | "proxy" | "none";
}

/**
 * Transcribes an audio clip with OpenAI Whisper. STT only — the resulting text
 * is then judged by Claude (scoreVerbalAnswer). Reads OPENAI_API_KEY from env.
 *
 * Requests verbose_json so we get per-segment avg_logprob / no_speech_prob and
 * can tell "the candidate answered badly" apart from "we couldn't hear them".
 */
export async function transcribeAudio(audio: Buffer, mime = "audio/webm"): Promise<Transcription> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), "audio.webm");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!resp.ok) {
    throw new Error(`Whisper failed (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  }

  const json = (await resp.json()) as {
    text?: string;
    duration?: number;
    segments?: WhisperSegment[];
  };
  const text = (json.text ?? "").trim();

  const fromSegments = json.segments?.length ? confidenceFromSegments(json.segments) : null;
  if (fromSegments !== null) return { text, confidence: fromSegments, source: "segments" };

  // verbose_json not honoured (or no segments) — fall back to the heuristic.
  if (!text) return { text, confidence: 0, source: "proxy" };
  return { text, confidence: proxyConfidence(text, json.duration), source: "proxy" };
}
