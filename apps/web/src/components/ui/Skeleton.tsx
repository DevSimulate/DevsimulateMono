import { cn } from "@/lib/cn";

/** Loading placeholder — prevents layout shift on every data surface. */
export function Skeleton({ className }: { className?: string }): React.ReactElement {
  return <div className={cn("animate-pulse rounded bg-[rgba(216,218,211,0.6)]", className)} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }): React.ReactElement {
  return (
    <div className="flex gap-4 px-4 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}
