/**
 * Transcribes an audio clip with OpenAI Whisper. STT only — the resulting text
 * is then judged by Claude (scoreVerbalAnswer). Reads OPENAI_API_KEY from env.
 */
export async function transcribeAudio(audio: Buffer, mime = "audio/webm"): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), "audio.webm");
  form.append("model", "whisper-1");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!resp.ok) {
    throw new Error(`Whisper failed (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  }
  const json = (await resp.json()) as { text?: string };
  return (json.text ?? "").trim();
}
