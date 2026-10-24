import { useState } from "react"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

// Destructive-action confirmation: consequence copy, required reason, and an
// optional typed-name confirmation (for suspend/revoke/cancel/override).
export default function AdminConfirmModal({
  title,
  consequence,
  confirmLabel = "Confirm",
  confirmWord,
  minReason = 8,
  onConfirm,
  onClose,
}: {
  title: string
  consequence: string
  confirmLabel?: string
  // When set, the admin must type this exactly (e.g. the target's name).
  confirmWord?: string
  minReason?: number
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
}) {
  const [reason, setReason] = useState("")
  const [typed, setTyped] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reasonOk = reason.trim().length >= minReason
  const typedOk = !confirmWord || typed.trim() === confirmWord.trim()
  const valid = reasonOk && typedOk

  return (
    <Modal title={title} variant="danger" width={480} onClose={onClose}>
      <div className="space-y-4">
        <p style={{ color: "#475467", fontSize: 13, lineHeight: 1.5 }}>{consequence}</p>

        <label className="block text-xs font-semibold text-gray-700">
          Reason (recorded in the audit log)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={`At least ${minReason} characters`}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        {confirmWord && (
          <label className="block text-xs font-semibold text-gray-700">
            Type <span style={{ color: "#B42318" }}>{confirmWord}</span> to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="kargo-modal-actions">
          <SecondaryBtn onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            disabled={!valid || saving}
            loading={saving}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                await onConfirm(reason.trim())
                onClose()
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not complete the action. Please try again.",
                )
              } finally {
                setSaving(false)
              }
            }}
          >
            {confirmLabel}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
