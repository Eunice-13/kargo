import { Modal, PaymentIcon, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { CREAM } from "@/constants/theme"
import type { PayMethod } from "./types"

type VerifyPaymentMethodModalProps = {
  verifyTarget: PayMethod
  setVerifyTarget: (m: PayMethod | null) => void
  pmLoading: boolean
  confirmVerify: () => void
}

export default function VerifyPaymentMethodModal({
  verifyTarget,
  setVerifyTarget,
  pmLoading,
  confirmVerify,
}: VerifyPaymentMethodModalProps) {
  return (
    <Modal
      title="Verify Payment Method"
      onClose={() => setVerifyTarget(null)}
      width={400}
    >
      <div className="space-y-4">
        <div
          style={{
            background: CREAM,
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 24 }}><PaymentIcon method={verifyTarget.name} size={24} /></span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {verifyTarget.name}
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>
              {verifyTarget.detail}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
          Kargo will send a small verification amount (₱1) to confirm
          ownership. Check your account to confirm you received it.
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => setVerifyTarget(null)}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={confirmVerify}
            loading={pmLoading}
          >
            Confirm Ownership
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
