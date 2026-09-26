import type React from "react"
import { Phone } from "lucide-react"
import { CYAN_L, SKY } from "@/constants/theme"
import { Modal, SecondaryBtn } from "@/components/shared"
import type { VerifyItem } from "./verifyTypes"

export default function InsufficientPaymentModal({
  insuffTarget,
  setInsuffTarget,
  insuffAmtPaid,
  setInsuffAmtPaid,
  setVerifyItems,
}: {
  insuffTarget: VerifyItem
  setInsuffTarget: (v: VerifyItem | null) => void
  insuffAmtPaid: string
  setInsuffAmtPaid: (v: string) => void
  setVerifyItems: React.Dispatch<React.SetStateAction<VerifyItem[]>>
}) {
  const paidAmt = Number(insuffAmtPaid) || 0
  const shortAmt = insuffTarget.amount - paidAmt
  const isValid = paidAmt > 0 && shortAmt > 0
  return (
    <Modal
      title="Mark as Insufficient Payment"
      onClose={() => setInsuffTarget(null)}
      width={460}
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
          }}
        >
          The buyer submitted payment for{" "}
          <strong>{insuffTarget.product}</strong> but the amount may
          be short of ₱{insuffTarget.amount.toLocaleString()}.
        </div>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                display: "block",
                marginBottom: 5,
              }}
            >
              Amount Due
            </label>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "#111827",
                padding: "9px 12px",
                background: "#F9FAFB",
                borderRadius: 7,
                border: "1px solid #E5E7EB",
                fontFamily: "'Josefin Sans',sans-serif",
              }}
            >
              ₱{insuffTarget.amount.toLocaleString()}
            </div>
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                display: "block",
                marginBottom: 5,
              }}
            >
              Amount Actually Paid{" "}
              <span style={{ color: "#E11D2E" }}>*</span>
            </label>
            <input
              type="number"
              value={insuffAmtPaid}
              onChange={(e) => setInsuffAmtPaid(e.target.value)}
              placeholder="e.g. 750"
              style={{
                width: "100%",
                fontSize: 13,
                border: `1.5px solid ${
                  insuffAmtPaid && !isValid ? "#EF4444" : "#E5E7EB"
                }`,
                borderRadius: 7,
                padding: "9px 12px",
                outline: "none",
                color: "#374151",
                fontFamily: "inherit",
                boxSizing: "border-box" as const,
              }}
            />
          </div>
        </div>
        {paidAmt > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: shortAmt > 0 ? "#FEF9C3" : "#D4F5EA",
              border: `1px solid ${
                shortAmt > 0 ? "#FCD34D" : "#6EE7B7"
              }`,
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: shortAmt > 0 ? "#92400E" : "#065F46",
              }}
            >
              {shortAmt > 0
                ? "Amount Short"
                : "No shortfall detected"}
            </span>
            {shortAmt > 0 && (
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#92400E",
                  fontFamily: "'Josefin Sans',sans-serif",
                }}
              >
                ₱{shortAmt.toLocaleString()}
              </span>
            )}
          </div>
        )}
        {isValid && (
          <div
            style={{
              background: CYAN_L,
              border: `1px solid ${SKY}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#0369A1",
            }}
          >
            <Phone
              size={13}
              aria-hidden="true"
              style={{
                display: "inline",
                verticalAlign: -2,
                marginRight: 5,
              }}
            />
            The buyer will be notified: "Your payment for{" "}
            <strong>{insuffTarget.product}</strong> is short by ₱
            {shortAmt.toLocaleString()}. Please send the remaining
            balance to avoid your reservation expiring."
          </div>
        )}
        <div className="flex gap-3">
          <SecondaryBtn
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
            }}
            onClick={() => setInsuffTarget(null)}
          >
            Cancel
          </SecondaryBtn>
          <button
            disabled={!isValid}
            onClick={() => {
              setVerifyItems((p) =>
                p.map((v) =>
                  v.id === insuffTarget.id
                    ? {
                        ...v,
                        status: "Pending" as const,
                        amountPaid: String(paidAmt),
                        rejectReason: `Short ₱${shortAmt.toLocaleString()} — buyer notified.`,
                      }
                    : v,
                ),
              )
              setInsuffTarget(null)
            }}
            style={{
              flex: 1,
              background: "#F59E0B",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Josefin Sans',sans-serif",
              opacity: !isValid ? 0.45 : 1,
              transition: "opacity 0.15s",
            }}
          >
            Notify Buyer
          </button>
        </div>
      </div>
    </Modal>
  )
}
