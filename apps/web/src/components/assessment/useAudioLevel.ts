"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live mic input level (0-1) from an existing MediaStream — pure
 * visualization of audio already being captured, no new data collection.
 * Lets the candidate SEE their mic is live during the pre-flight check
 * instead of just hoping it is.
 */
export function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
      setLevel(Math.min(1, avg / 128));
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream]);

  return level;
}
