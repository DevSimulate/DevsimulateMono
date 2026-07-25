"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

export function Tabs({ items, defaultKey }: { items: TabItem[]; defaultKey?: string }): React.ReactElement {
  const [active, setActive] = useState(defaultKey ?? items[0]?.key);
  const activeItem = items.find((i) => i.key === active);

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-hairline">
        {items.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={active === item.key}
            onClick={() => setActive(item.key)}
            className={cn(
              "px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150",
              active === item.key
                ? "border-brand text-ink"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-4">
        {activeItem?.content}
      </div>
    </div>
  );
}
