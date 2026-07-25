import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Composable table primitives for dense, sortable data (employer results,
 * campaign lists). Numeric/system columns should pass `numeric` to get
 * right-aligned mono — measurement speaks mono, per the type rule.
 */
export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded border border-hairline bg-surface">
      <table className={cn("w-full border-collapse text-sm", className)} {...rest} />
    </div>
  );
}

export function Thead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>): React.ReactElement {
  return <thead className={cn("bg-paper", className)} {...rest} />;
}

export function Th({
  numeric,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }): React.ReactElement {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted border-b border-hairline",
        numeric ? "text-right" : "text-left",
        className
      )}
      {...rest}
    />
  );
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>): React.ReactElement {
  return <tr className={cn("border-b border-hairline last:border-0 hover:bg-[rgba(16,24,43,0.03)]", className)} {...rest} />;
}

export function Td({
  numeric,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }): React.ReactElement {
  return (
    <td
      className={cn("px-4 py-3 text-ink", numeric && "text-right font-mono", className)}
      {...rest}
    />
  );
}
