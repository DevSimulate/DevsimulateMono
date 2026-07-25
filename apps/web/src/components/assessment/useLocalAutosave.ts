"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Debounced localStorage save of in-progress answers, keyed by a stable id
 * (the ticket id). Purely a client-side safety net against an accidental
 * refresh or tab close — it never touches the API, so it changes no
 * contract and no scoring behavior. Returns the last-saved time (mono
 * "Saved · HH:MM:SS" display) and a restore function to call once on mount.
 */
export function useLocalAutosave<T>(key: string | null, value: T, delayMs = 1500): Date | null {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!key) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(`ds-autosave-${key}`, JSON.stringify(value));
        setSavedAt(new Date());
      } catch { /* storage unavailable — not worth surfacing an error for a safety net */ }
    }, delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, JSON.stringify(value)]);

  return savedAt;
}

export function readLocalAutosave<T>(key: string | null): T | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(`ds-autosave-${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearLocalAutosave(key: string | null): void {
  if (!key) return;
  try { window.localStorage.removeItem(`ds-autosave-${key}`); } catch { /* ignore */ }
}
