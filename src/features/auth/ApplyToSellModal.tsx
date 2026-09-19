import { CheckCircle2 } from "lucide-react"
import type { BirState } from "@/types"
import { Modal, PrimaryBtn } from "@/components/shared"
import BirVerifier from "./BirVerifier"

// Standalone "Apply to Become a Seller" flow for existing Buyer accounts.
// Reuses the same BIR upload + verification pipeline as Sign Up. On Verified,
// closing the modal leaves the account with birState = "Verified", which the app
// reads to unlock Seller access.
export default function ApplyToSellModal({
  birState,
  onBirState,
  onClose,
}: {
  birState: BirState
  onBirState: (s: BirState) => void
  onClose: () => void
}) {
  const verified = birState === "Verified"
  return (
    <Modal title="Apply to Become a Seller" onClose={onClose} width={480}>
      <div className="space-y-4">
        <p
          style={{
            fontSize: 13,
            color: "#6B7280",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Selling on KARGO requires a verified BIR Registration Seal Badge. Your
          badge is checked automatically — once verified, seller tools unlock
          right away.
        </p>

        <BirVerifier birState={birState} setBirState={onBirState} />

        {verified ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#065F46",
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            Seller access unlocked. You can close this window.
          </div>
        ) : null}

        <PrimaryBtn
          style={{ width: "100%", display: "flex", justifyContent: "center" }}
          onClick={onClose}
        >
          {verified ? "Start Selling" : "Done"}
        </PrimaryBtn>
      </div>
    </Modal>
  )
}
