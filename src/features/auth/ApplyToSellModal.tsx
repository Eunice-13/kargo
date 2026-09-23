import { useState } from "react"
import type { BirState } from "@/types"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import BirVerifier from "./BirVerifier"

export default function ApplyToSellModal({ birState, onBirState, onEnableSeller, onClose }: {
  birState: BirState
  onBirState: (state: BirState) => void
  onEnableSeller: () => void | Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  return (
    <Modal title="Start Selling on KARGO" onClose={onClose} width={500}>
      <div className="space-y-4">
        <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.55, margin: 0 }}>
          Open your seller workspace now. BIR verification is optional, but a verified badge can help buyers trust your shop.
        </p>
        <BirVerifier birState={birState} setBirState={onBirState} />
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
