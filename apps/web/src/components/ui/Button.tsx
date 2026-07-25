import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white border border-brand hover:brightness-110 disabled:hover:brightness-100",
  secondary: "bg-surface text-ink border border-hairline hover:bg-paper",
  quiet: "bg-transparent text-ink border border-transparent hover:bg-paper",
  destructive: "bg-transparent text-red border border-[rgba(179,55,47,0.4)] hover:bg-[rgba(179,55,47,0.05)]",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "text-xs px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-3.5 py-2 gap-2",
  lg: "text-base px-5 py-2.5 gap-2",
};

/**
 * primary = brand indigo fill (the logo's color — the one action accent,
 *   used with intent, never more than one per view). Emerald/"good" is
 *   reserved for verification and passing states — see Badge.
 * secondary = hairline outline.
 * quiet = text-only, for tertiary actions ("request human review", cancel).
 * destructive = outlined red, reserved for genuinely destructive actions.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", loading, disabled, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded font-semibold transition-colors duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...rest}
    >
      {loading ? <span className="font-mono">…</span> : children}
    </button>
  )
);
Button.displayName = "Button";
