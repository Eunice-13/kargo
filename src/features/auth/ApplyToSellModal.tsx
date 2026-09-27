import { useState } from "react"

import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"


export default function ApplyToSellModal({ onEnableSeller, onClose }: {
  onEnableSeller: () => void | Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  return (
    <Modal title="Start Selling on KARGO" onClose={onClose} width={500}>
      <div className="space-y-4">
        <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.55, margin: 0 }}>
          Open your seller workspace and start creating pasabuy batches.
        </p>

        <div className="flex gap-3">
          <SecondaryBtn style={{ flex: 1, display: "flex", justifyContent: "center" }} onClick={onClose}>Cancel</SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              try {
                await onEnableSeller()
                onClose()
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unable to enable selling.")
              } finally {
                setLoading(false)
              }
            }}
          >
            {loading ? "Enabling…" : "Enable Selling"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
