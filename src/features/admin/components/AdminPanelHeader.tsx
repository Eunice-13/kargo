import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

// One panel header for every admin card: title, optional one-line explanation,
// and either a "View all" link or a custom action on the right.
export default function AdminPanelHeader({
  title,
  hint,
  actionLabel,
  onAction,
  action,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="admin-panel-head">
      <div className="admin-panel-head__text">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      {action ??
        (actionLabel && onAction ? (
          <button type="button" className="admin-panel-link" onClick={onAction}>
            {actionLabel} <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ) : null)}
    </header>
  );
}
