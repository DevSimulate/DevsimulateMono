import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Flat hairline card — no shadow, 6px radius. Shadow is reserved for true overlays (Modal). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn("rounded border border-hairline bg-surface", className)} {...rest} />;
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn("px-5 py-4 border-b border-hairline", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn("px-5 py-4", className)} {...rest} />;
}
