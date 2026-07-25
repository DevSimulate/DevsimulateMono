"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Use for genuinely destructive/high-stakes confirmations (e.g. manual finalize). */
  tone?: "default" | "destructive";
}

/**
 * The one place in the system that uses a real shadow — modals are true
 * overlays floating above the page, everywhere else uses hairline borders.
 */
export function Modal({ open, onClose, title, description, children, footer, tone = "default" }: ModalProps): React.ReactElement | null {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(16,24,43,0.4)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded bg-surface border border-hairline shadow-overlay p-6 outline-none"
      >
        <h2
          id="modal-title"
          className={cn("font-display text-lg font-semibold mb-1", tone === "destructive" && "text-red")}
        >
          {title}
        </h2>
        {description && <p className="text-sm text-muted mb-4 leading-relaxed">{description}</p>}
        {children}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
