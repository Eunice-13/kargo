import { Modal, SecondaryBtn } from "@/components/shared"
import type { PayMethod } from "./types"

type RemovePaymentMethodModalProps = {
  removeTarget: PayMethod
  setRemoveTarget: (m: PayMethod | null) => void
  confirmRemove: () => void
}

export default function RemovePaymentMethodModal({
  removeTarget,
  setRemoveTarget,
  confirmRemove,
}: RemovePaymentMethodModalProps) {
  return (
    <Modal
      title="Remove Payment Method"
      onClose={() => setRemoveTarget(null)}
      width={400}
    >
      <div className="space-y-4">
        <div style={{ fontSize: 13, color: "#374151" }}>
          Are you sure you want to remove{" "}
          <strong>
            {removeTarget.name} ({removeTarget.detail})
          </strong>
          ? This cannot be undone.
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
            Remove
          </button>
        </div>
      </div>
    </Modal>
  )
}
