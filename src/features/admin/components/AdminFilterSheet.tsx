import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type FilterOption = { value: string; label: string; dot?: string };
export type FilterGroup = {
  key: string;
  label: string;
  value: string;
  defaultValue: string;
  options: FilterOption[];
  onChange: (value: string) => void;
};

// Mobile-only filter button + bottom sheet. Sits next to the search box in
// AdminFilterBar; the inline selects are hidden on mobile via CSS because every
// filter lives in this sheet instead. Hidden entirely on desktop.
export default function AdminFilterSheet({
  groups,
  count,
  noun,
}: {
  groups: FilterGroup[];
  /** Total results for the current filters, or null while unknown. */
  count: number | null;
  /** [singular, plural] used in the "Show N …" button. */
  noun: [string, string];
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const activeCount = groups.filter((g) => g.value !== g.defaultValue).length;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="admin-filter-sheet-btn"
        aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 7h16M7 12h10M10 17h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
        {activeCount > 0 && <span className="admin-filter-sheet-btn__badge">{activeCount}</span>}
      </button>

      {open &&
        createPortal(
          <div className="admin-sheet-overlay" onClick={close}>
            <div
              className="admin-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="admin-sheet__handle" aria-hidden="true" />
              <div className="admin-sheet__head">
                <h3 id={titleId}>Filters</h3>
                <button
                  type="button"
                  className="admin-sheet__clear"
                  disabled={activeCount === 0}
                  onClick={() => groups.forEach((g) => g.onChange(g.defaultValue))}
                >
                  Clear all
                </button>
                <button
                  ref={closeRef}
                  type="button"
                  className="admin-sheet__close"
                  aria-label="Close filters"
                  onClick={close}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <div className="admin-sheet__body">
                {groups.map((g) => (
                  <fieldset key={g.key} className="admin-sheet__group">
                    <legend>{g.label}</legend>
                    <div className="admin-sheet__chips">
                      {g.options.map((o) => {
                        const selected = g.value === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            aria-pressed={selected}
                            className={`admin-sheet__chip${selected ? " is-active" : ""}`}
                            onClick={() => g.onChange(o.value)}
                          >
                            {o.dot && (
                              <span
                                className="admin-sheet__dot"
                                aria-hidden="true"
                                style={selected ? undefined : { background: o.dot }}
                              />
                            )}
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>

              <button type="button" className="admin-sheet__show" onClick={close}>
                {count == null
                  ? "Show results"
                  : `Show ${count} ${count === 1 ? noun[0] : noun[1]}`}
              </button>
              <p className="admin-sheet__hint" aria-live="polite">
                Count updates as you pick filters
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
