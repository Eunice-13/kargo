import { AlertTriangle } from "lucide-react"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import type { PayMethod } from "./paymentMethodTypes"

type RemovePaymentMethodModalProps = {
  removeTarget: PayMethod
  setRemoveTarget: (m: PayMethod | null) => void
  confirmRemove: () => void
  isLastMethod: boolean
}

export default function RemovePaymentMethodModal({
  removeTarget,
  setRemoveTarget,
  confirmRemove,
  isLastMethod,
}: RemovePaymentMethodModalProps) {
  if (isLastMethod) {
    return (
      <Modal
        title="Can't remove your last payment method"
        onClose={() => setRemoveTarget(null)}
        width={400}
      >
        <div className="space-y-4">
          <div
            style={{
              background: "#FFF7ED",
              border: "1px solid #FCD34D",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#92400E",
              display: "flex",
              gap: 8,
            }}
          >
            <AlertTriangle
              size={15}
              aria-hidden="true"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <span>
              You must keep at least one payment method active so buyers always
              have a way to pay. Add another method first, then remove this one.
            </span>
          </div>
          <PrimaryBtn
            style={{ width: "100%", display: "flex", justifyContent: "center" }}
            onClick={() => setRemoveTarget(null)}
          >
            Got it
          </PrimaryBtn>
        </div>
      </Modal>
    )
  }
  return (
    <Modal
      title="Delete this payment method?"
      onClose={() => setRemoveTarget(null)}
      width={400}
    >
      <div className="space-y-4">
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
          Delete{" "}
          <strong>
            {removeTarget.name} ({removeTarget.detail})
          </strong>
          ? Buyers won't be able to select it for future orders. This cannot be
          undone.
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => setRemoveTarget(null)}
          >
            Cancel
          </SecondaryBtn>
          <button
            onClick={confirmRemove}
            style={{
              flex: 1,
              background: "#EF4444",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            Delete Method
          </button>
        </div>
      </div>
    </Modal>
  )
}
