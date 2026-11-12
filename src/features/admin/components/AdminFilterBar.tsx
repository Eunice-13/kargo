import { Children, isValidElement, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Search input + select filters that wrap on mobile. Selects are passed as
// children so each tab composes its own set.
export default function AdminFilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  className = "",
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`admin-filter-bar ${className}`.trim()}>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="admin-filter-control admin-filter-search"
      />
      {children}
    </div>
  );
}

// Shared select styling helper so every admin filter select matches.
export function AdminSelect({
  value,
  onChange,
  ariaLabel,
  className = "",
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = Children.toArray(children).filter(isValidElement) as ReactElement<{
    value?: string;
    children?: ReactNode;
  }>[];
  const selected = options.find((option) => option.props.value === value);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`admin-select ${className}`.trim()}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="admin-filter-control admin-select__trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.props.children ?? value}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="admin-select__options" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const optionValue = option.props.value ?? "";
            const active = optionValue === value;
            return (
              <button
                key={optionValue}
                type="button"
                role="option"
                aria-selected={active}
                className={active ? "is-selected" : undefined}
                onClick={() => {
                  onChange(optionValue);
                  setOpen(false);
                }}
              >
                {option.props.children}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
