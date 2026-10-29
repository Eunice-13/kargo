import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, type LucideIcon } from "lucide-react";

export type SellerOrderMenuItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
};

// The one action control in a seller's Orders Received row. "Review" is always
// there and does what it always did. The other actions that apply to this
// order's stage (Contact Buyer, Add/Edit tracking) live in the menu beside it,
// so the narrow Actions column never has to fit several buttons at once.
//
// The menu is rendered in a portal with fixed positioning because the table
// sits in an overflow-hidden scroller that would clip an inline popover on the
// last rows.
export default function SellerOrderActions({
  onReview,
  items,
}: {
  onReview: () => void;
  items: SellerOrderMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  };

  // Place the menu under the caret, right-aligned to it, flipping above when
  // there is no room below. Measured after render so its real size is used.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const toggle = toggleRef.current;
    const menu = menuRef.current;
    if (!toggle || !menu) return;
    const anchor = toggle.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = Math.min(Math.max(8, anchor.right - width), window.innerWidth - width - 8);
    const below = anchor.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, anchor.top - 6 - height) : below;
    setPosition({ top, left });
  }, [open]);

  // Move focus into the menu once it is placed.
  useEffect(() => {
    if (position) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [position]);

  // Dismiss on an outside press, Escape, scroll or resize (the menu is fixed to
  // the viewport, so it would otherwise drift away from its row).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onViewportChange = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      entries[(next + entries.length) % entries.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(entries.length - 1);
    else if (event.key === "Tab") setOpen(false);
  };

  return (
    <div className="seller-orders-split">
      <button
        type="button"
        className={`seller-orders-review seller-orders-split__main${items.length ? "" : " is-alone"}`}
        onClick={onReview}
      >
        Review
      </button>
      {items.length > 0 && (
        <button
          ref={toggleRef}
          type="button"
          className="seller-orders-review seller-orders-split__toggle"
          aria-label="More order actions"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <ChevronDown size={14} aria-hidden="true" className={open ? "is-open" : ""} />
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Order actions"
            className="seller-orders-menu"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
            onKeyDown={onMenuKeyDown}
          >
            {items.map(({ key, label, icon: Icon, onSelect }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onSelect();
                }}
              >
                {Icon && <Icon size={15} aria-hidden="true" />}
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
