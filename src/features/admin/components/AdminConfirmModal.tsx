import { useState } from "react";
import { Check, ShieldAlert } from "lucide-react";

import { Modal } from "@/components/shared";
import AdminActionButton, {
  adminActionTone,
  type AdminActionKind,
  type AdminActionTone,
} from "./AdminActionButton";

// Destructive-action confirmation: consequence copy, a required reason, and an
// optional typed confirmation (for suspend/revoke/cancel/override). `tone`
// keeps non-destructive actions (restore/grant/verify) visually calm.
export default function AdminConfirmModal({
  title,
  consequence,
  confirmLabel = "Confirm",
  confirmWord,
  minReason = 8,
  tone = "danger",
  action,
  onConfirm,
  onClose,
}: {
  title: string;
  consequence: string;
  confirmLabel?: string;
  // When set, the admin must type this exactly (e.g. the target's name).
  confirmWord?: string;
  minReason?: number;
  tone?: AdminActionTone | "default";
  action?: AdminActionKind;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedTone = action
    ? adminActionTone(action)
    : tone === "default"
      ? "neutral"
      : tone;
  const destructive = resolvedTone === "danger";
  const reasonLength = reason.trim().length;
  const reasonOk = reasonLength >= minReason;
  const typedOk = !confirmWord || typed.trim() === confirmWord.trim();
  const typedStarted = typed.trim().length > 0;
  const valid = reasonOk && typedOk;

  return (
    <Modal
      title={title}
      variant={destructive ? "danger" : "confirm"}
      width={492}
      className="admin-modal admin-confirm-modal"
      overlayClassName="admin-modal-overlay admin-record-modal-overlay"
      onClose={onClose}
      footer={
        <div className="admin-modal-footer">
          <AdminActionButton action="dismiss" onClick={onClose} disabled={saving}>
            Cancel
          </AdminActionButton>
          <AdminActionButton
            action={action}
            tone={resolvedTone}
            disabled={!valid || saving}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onConfirm(reason.trim());
                onClose();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not complete the action. Please try again.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {confirmLabel}
          </AdminActionButton>
        </div>
      }
    >
      <div className="admin-confirm">
        <div className={`admin-callout admin-callout--${destructive ? "danger" : "info"}`}>
          <span className="admin-callout__icon" aria-hidden="true">
            {destructive ? <ShieldAlert size={18} /> : <Check size={18} />}
          </span>
          <p>{consequence}</p>
        </div>

        {minReason > 0 && (
          <div className="admin-field">
            <div className="admin-field__head">
              <label htmlFor="admin-confirm-reason">Reason</label>
              <span className={`admin-field__count${reasonOk ? " is-valid" : ""}`}>
                {reasonOk
                  ? "Ready"
                  : reasonLength === 0
                    ? `At least ${minReason}`
                    : `${minReason - reasonLength} more`}
              </span>
            </div>
            <textarea
              id="admin-confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="What happened, and why is this action needed?"
              aria-describedby="admin-confirm-reason-hint"
              aria-invalid={reason.length > 0 ? !reasonOk : undefined}
            />
            <p id="admin-confirm-reason-hint" className="admin-field__hint">
              Saved to the audit log with your name. At least {minReason} characters.
            </p>
          </div>
        )}

        {confirmWord && (
          <div className="admin-field">
            <label htmlFor="admin-confirm-word">
              Type <strong>{confirmWord}</strong> to confirm
            </label>
            <div className="admin-field__match">
              <input
                className="admin-field__match-control"
                id="admin-confirm-word"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={typedStarted && !typedOk}
              />
              {typedOk && typedStarted && (
                <Check className="admin-field__match-icon" size={16} aria-hidden="true" />
              )}
            </div>
            <p className="admin-field__hint">
              {typedOk
                ? "Matches. You can confirm."
                : typedStarted
                  ? "Doesn't match yet."
                  : "Prevents changes to the wrong record."}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="admin-form-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
