import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export default function PendingPaymentHint({
  waiting,
  children,
  sharedFeeSet = false,
}: {
  waiting: boolean;
  sharedFeeSet?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLSpanElement>(null);
  const descriptionId = useId();
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  if (!waiting) return <>{children}</>;
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <span
      className="pending-pay-help"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <span
        ref={trigger}
        className="pending-pay-help__trigger"
        tabIndex={0}
        role="button"
        aria-label="Why Pay Now is unavailable"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={descriptionId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
      >
        {children}
      </span>
      {open && (
        <span
          id={descriptionId}
          role="dialog"
          aria-labelledby={titleId}
          className="checkout-help__popover"
        >
          <span id={titleId} className="sr-only">
            {sharedFeeSet ? "Combined payment unavailable" : "Waiting for shipping fee"}
          </span>
          <span className="block">
            {sharedFeeSet
              ? "The shared shipping fee is set. Your payment deadline remains paused until combined payment is available."
              : "The seller needs to set the shipping fee before payment can proceed."}
          </span>
          <button type="button" onClick={close} className="pending-pay-help__close">
            Got it
          </button>
        </span>
      )}
    </span>
  );
}
