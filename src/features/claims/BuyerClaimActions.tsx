import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CreditCard, Clock, XCircle, type LucideIcon } from "lucide-react";

export type BuyerClaimMenuItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** When true the item appears greyed out and ignores clicks. */
  disabled?: boolean;
  /** Optional wrapper rendered around the item button (e.g. PendingPaymentHint). */
  wrapper?: (children: React.ReactNode) => React.ReactNode;
};

// A "Manage ▾" split button for the buyer's claims-to-pay row.
// "Manage" opens the menu; the menu houses Pay Now / Request Extension / Cancel.
// The menu is portaled to <body> so the overflow-hidden table scroller won't
// clip it.
export default function BuyerClaimActions({ items }: { items: BuyerClaimMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  };

  // Place the menu under the button, right-aligned, flipping above if it would
  // overflow the viewport.
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
    const top =
      below + height > window.innerHeight - 8 ? Math.max(8, anchor.top - 6 - height) : below;
    setPosition({ top, left });
  }, [open]);

  // Move focus into the first item once the menu is placed.
  useEffect(() => {
    if (position) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [position]);

  // Dismiss on outside pointer-down, Escape, scroll or resize.
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
        close(true);
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
    <div className="claim-actions-split">
      <button
        ref={toggleRef}
        type="button"
        className="claim-actions-manage"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        Manage
        <ChevronDown size={13} aria-hidden="true" className={open ? "is-open" : ""} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Claim actions"
            className="claim-actions-menu"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
            onKeyDown={onMenuKeyDown}
          >
            {items.map(({ key, label, icon: Icon, onSelect, disabled, wrapper }) => {
              const btn = (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  aria-disabled={disabled}
                  className={disabled ? "is-disabled" : ""}
                  onClick={() => {
                    if (disabled) return;
                    close();
                    onSelect();
                  }}
                >
                  {Icon && <Icon size={15} aria-hidden="true" />}
                  {label}
                </button>
              );
              return wrapper ? (
                <div key={key} className="claim-actions-menu__item-wrap">
                  {wrapper(btn)}
                </div>
              ) : (
                btn
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

// Convenience factory so the call-site in MyClaims stays concise.
export function buildClaimMenuItems({
  payable,
  waitingForShipping,
  sharedFeeSet,
  showExtension,
  showCancel,
  onPay,
  onExtend,
  onCancel,
}: {
  payable: boolean;
  waitingForShipping: boolean;
  sharedFeeSet: boolean;
  showExtension: boolean;
  showCancel: boolean;
  onPay: () => void;
  onExtend: () => void;
  onCancel: () => void;
}): BuyerClaimMenuItem[] {
  const items: BuyerClaimMenuItem[] = [];

  const payDisabled = !payable || waitingForShipping || sharedFeeSet;

  // Pay Now is always in the menu; disabled with an aria-disabled hint when
  // the payment is blocked (shipping fee not set, shared fee pending, etc.).
  items.push({
    key: "pay",
    label: "Pay Now",
    icon: CreditCard,
    disabled: payDisabled,
    onSelect: onPay,
  });

  if (showExtension) {
    items.push({
      key: "extend",
      label: "Request Extension",
      icon: Clock,
      onSelect: onExtend,
    });
  }

  if (showCancel) {
    items.push({
      key: "cancel",
      label: "Cancel",
      icon: XCircle,
      onSelect: onCancel,
    });
  }

  return items;
}
