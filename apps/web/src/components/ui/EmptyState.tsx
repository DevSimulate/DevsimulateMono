import { Button } from "./Button";

/** Empty states read as invitations, never as dead ends — per the writing rules. */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-hairline rounded">
      <h3 className="font-display text-base font-semibold text-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-muted max-w-sm mb-5">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
