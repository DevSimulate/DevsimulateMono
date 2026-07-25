"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

interface ToastItem {
  id: number;
  message: string;
  tone: "default" | "good" | "bad";
}

interface ToastContextValue {
  show: (message: string, tone?: ToastItem["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const TONE_CLASS: Record<ToastItem["tone"], string> = {
  default: "bg-ink text-white",
  good: "bg-emerald text-white",
  bad: "bg-red text-white",
};

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastItem["tone"] = "default") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn("rounded px-4 py-2.5 text-sm font-medium shadow-overlay", TONE_CLASS[t.tone])}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
