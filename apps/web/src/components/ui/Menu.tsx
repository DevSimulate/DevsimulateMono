"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  /** Rendered last, below a divider, styled red — for delete/destructive actions. */
  destructiveItem?: MenuItem;
}

/**
 * The "⋯" overflow menu — every secondary row action lives here with a
 * label (never an icon alone), so a row reads as two visible actions
 * (the primary button + this menu) instead of a strip of unlabeled glyphs.
 */
export function Menu({ items, destructiveItem }: MenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
        className="w-8 h-8 rounded border border-hairline bg-surface flex items-center justify-center text-muted hover:bg-paper hover:text-ink transition-colors duration-150"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-60 rounded border border-hairline bg-surface shadow-overlay py-1">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-ink hover:bg-paper transition-colors duration-150 disabled:opacity-50"
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          {destructiveItem && (
            <>
              <div className="my-1 border-t border-hairline" />
              <button
                role="menuitem"
                type="button"
                disabled={destructiveItem.disabled}
                onClick={() => { setOpen(false); destructiveItem.onClick(); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-red hover:bg-red-weak transition-colors duration-150 disabled:opacity-50"
                )}
              >
                {destructiveItem.icon}
                {destructiveItem.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
