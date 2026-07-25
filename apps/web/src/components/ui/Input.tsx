import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

const FIELD_BASE =
  "w-full rounded border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted " +
  "transition-colors duration-150 focus:border-emerald focus:outline-none focus:ring-2 focus:ring-[rgba(11,122,94,0.25)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(FIELD_BASE, error && "border-red focus:border-red focus:ring-[rgba(179,55,47,0.25)]", className)}
      {...rest}
    />
  )
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(FIELD_BASE, "resize-y min-h-24", error && "border-red focus:border-red focus:ring-[rgba(179,55,47,0.25)]", className)}
      {...rest}
    />
  )
);
Textarea.displayName = "Textarea";

/** Label + helper text wrapper, consistent spacing for every form field in the product. */
export function Field({
  label,
  helper,
  error,
  htmlFor,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink mb-1">
        {label}
      </label>
      {helper && !error && <p className="text-xs text-muted mb-2 leading-relaxed">{helper}</p>}
      {children}
      {error && <p className="text-xs text-red mt-1.5">{error}</p>}
    </div>
  );
}
