import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function SellerBatchFilterSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLabel = (option: string) =>
    option === "All"
      ? label === "Category"
        ? "All categories"
        : "All months"
      : option;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="seller-batch-select-wrap seller-batch-select-wrap--custom">
      <button
        type="button"
        className="seller-batch-filter-select seller-batch-filter-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedLabel(value)}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="seller-batch-filter-options" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={value === option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {selectedLabel(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
