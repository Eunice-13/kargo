import type React from "react";
import { useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogA11y } from "./Modal";
import "./batchActionDialog.css";

export default function BatchActionDialog({
  title,
  onClose,
  className = "",
  children,
}: {
  title: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useDialogA11y(onClose);
  const titleId = useId();

  return createPortal(
    <div
      className="batch-action-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`batch-action-dialog${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="batch-action-dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="batch-action-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="batch-action-dialog__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
