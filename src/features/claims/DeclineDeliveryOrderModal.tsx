import { useState } from "react"
import { ExternalLink } from "lucide-react"

import type { ClaimRow } from "@/types"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

export default function DeclineDeliveryOrderModal({
  claim,
  onConfirm,
  onContactBuyer,
  onClose,
}: {
  claim: ClaimRow
  onConfirm: (reason: string) => void | Promise<void>
  onContactBuyer: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  return (
    <Modal title="Decline delivery order" onClose={onClose} width={480}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-gray-600">
          Declining releases the reserved quantity and permanently closes this
          order. The buyer must reserve again to continue.
        </p>
        <label className="block text-xs font-semibold text-gray-700">
          Reason <span className="text-red-600">*</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Explain why this delivery order cannot proceed"
          />
        </label>
        <SecondaryBtn onClick={onContactBuyer}>
          <span className="inline-flex items-center gap-2">
            <ExternalLink size={14} aria-hidden="true" /> Contact buyer
          </span>
        </SecondaryBtn>
        <div className="flex justify-end gap-3 max-[480px]:flex-col-reverse">
          <SecondaryBtn onClick={onClose} disabled={saving}>
            Keep order
          </SecondaryBtn>
          <PrimaryBtn
            disabled={!reason.trim() || saving}
            loading={saving}
            style={{ background: "#DC2626" }}
            onClick={async () => {
              setSaving(true)
              try {
                await onConfirm(reason.trim())
              } finally {
                setSaving(false)
              }
            }}
          >
            Decline order
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
