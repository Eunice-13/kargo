import "./pillTrigger.css";
import type { LucideIcon } from "lucide-react";

// The pill that opens a list of things waiting on you, placed rightmost in a
// page's heading row: the buyer's "My Group Orders" and the seller's "Combined
// Delivery" both use it, so the two roles share one control.
//
// `prefix` is the optional lead-in word ("My") that drops away on narrow
// screens so the heading and the pill never fight for one line. `count` is the
// number of items that need attention; it is hidden at zero.
export default function PillTrigger({
  icon: Icon,
  label,
  prefix,
  count = 0,
  ariaLabel,
  loading = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  prefix?: string;
  count?: number;
  ariaLabel?: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="pill-trigger"
      aria-haspopup="dialog"
      aria-busy={loading || undefined}
      aria-label={ariaLabel ?? `${prefix ?? ""}${label}${count ? `, ${count} need attention` : ""}`}
      onClick={onClick}
    >
      <span className="pill-trigger__icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span>
        {prefix && <span className="pill-trigger__prefix">{prefix}</span>}
        {label}
      </span>
      {count > 0 && (
        <span className="pill-trigger__count" aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}
