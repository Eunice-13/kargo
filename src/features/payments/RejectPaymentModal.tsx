import { useState } from "react"
import type React from "react"
import { AlertTriangle } from "lucide-react"
import { INDIGO } from "@/constants/theme"
import { Modal, SecondaryBtn } from "@/components/shared"
import type { VerifyItem } from "./verifyTypes"

export default function RejectPaymentModal({
  rejectTarget,
  setRejectTarget,
  rejectReason,
  setRejectReason,
  rejectCustom,
  setRejectCustom,
  setInsuffTarget,
  setInsuffAmtPaid,
  setVerifyItems,
  REJECT_REASONS,
}: {
  rejectTarget: VerifyItem
  setRejectTarget: (v: VerifyItem | null) => void
  rejectReason: string
  setRejectReason: (v: string) => void
  rejectCustom: string
  setRejectCustom: (v: string) => void
  setInsuffTarget: (v: VerifyItem | null) => void
  setInsuffAmtPaid: (v: string) => void
  setVerifyItems: React.Dispatch<React.SetStateAction<VerifyItem[]>>
  REJECT_REASONS: string[]
}) {
  const [deadlineHours, setDeadlineHours] = useState("24")
  const parsedDeadlineHours = Number(deadlineHours)
  const isWrongAmt = rejectReason === "Wrong amount transferred"
  const isOther = rejectReason === "Other"
  const deadlineValid = Number.isFinite(parsedDeadlineHours) && parsedDeadlineHours > 0
  const canProceed =
    !!rejectReason && (!isOther || rejectCustom.trim().length > 0) && (isWrongAmt || deadlineValid)
  return (
    <Modal
      title="Reject Payment"
      onClose={() => setRejectTarget(null)}
      width={480}
    >
      <div className="space-y-4">
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#991B1B",
          }}
        >
          You are reviewing <strong>{rejectTarget.buyer}</strong>'s
          payment for <strong>{rejectTarget.product}</strong>. Select
          a reason.
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 8,
            }}
          >
            Reason <span style={{ color: "#E11D2E" }}>*</span>
          </label>
          <div className="space-y-2">
            {REJECT_REASONS.map((r) => (
              <label
                key={r}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: "pointer",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1.5px solid ${
                    rejectReason === r
                      ? r === "Wrong amount transferred"
                        ? "#FCD34D"
                        : INDIGO
                      : "#E5E7EB"
                  }`,
                  background:
                    rejectReason === r
                      ? r === "Wrong amount transferred"
                        ? "#FFF7ED"
                        : "#EEF0FF"
                      : "#fff",
                  transition: "all 0.15s",
                }}
              >
                <input
                  type="radio"
                  name="rejectReason"
                  value={r}
                  checked={rejectReason === r}
                  onChange={() => setRejectReason(r)}
                  style={{ marginTop: 2, accentColor: INDIGO }}
                />
                <div>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#374151",
                      fontWeight: rejectReason === r ? 600 : 400,
                    }}
                  >
                    {r}
                  </span>
                  {r === "Wrong amount transferred" && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#92400E",
                        marginTop: 1,
                      }}
                    >
                      This will open the shortfall flow instead of
                      outright rejecting.
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
        {isOther && (
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
              Details <span style={{ color: "#E11D2E" }}>*</span>
            </label>
            <textarea
              rows={3}
              value={rejectCustom}
              onChange={(e) => setRejectCustom(e.target.value)}
              placeholder="Describe the issue so the buyer can resubmit correctly…"
              style={{
                width: "100%",
                fontSize: 13,
                border: "1px solid #E5E7EB",
                borderRadius: 7,
                padding: "9px 12px",
                outline: "none",
                resize: "none",
                color: "#374151",
                fontFamily: "inherit",
                boxSizing: "border-box" as const,
              }}
              className="placeholder:text-gray-400"
            />
          </div>
        )}
        {!isWrongAmt && (
          <div>
            <label
              htmlFor="rejection-deadline-hours"
              style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}
            >
              Resubmission deadline <span style={{ color: "#E11D2E" }}>*</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="rejection-deadline-hours"
                type="number"
                min="0"
                step="0.25"
                value={deadlineHours}
                onChange={(event) => setDeadlineHours(event.target.value)}
                aria-invalid={!deadlineValid}
                style={{
                  width: 110,
                  fontSize: 13,
                  border: `1.5px solid ${deadlineValid ? "#E5E7EB" : "#EF4444"}`,
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                }}
              />
              <span style={{ fontSize: 12, color: "#6B7280" }}>hours</span>
            </div>
            {!deadlineValid && (
              <div role="alert" style={{ fontSize: 11, color: "#DC2626", marginTop: 5 }}>
                Enter a deadline greater than 0 hours.
              </div>
            )}
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>
              The buyer must submit a replacement proof before this window closes.
            </div>
          </div>
        )}
        {isWrongAmt && rejectReason && (
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
            <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Selecting this won't reject the payment — instead,
            you'll enter the shortfall amount and the buyer will be
            notified to complete their payment.</span>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <SecondaryBtn
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
            }}
            onClick={() => setRejectTarget(null)}
          >
            Cancel
          </SecondaryBtn>
          <button
            disabled={!canProceed}
            onClick={() => {
              if (isWrongAmt) {
                const item = rejectTarget
                setRejectTarget(null)
                setInsuffTarget(item)
                setInsuffAmtPaid(item.amountPaid || "")
              } else {
                const finalReason = isOther
                  ? rejectCustom.trim()
                  : rejectReason
                setVerifyItems((p) =>
                  p.map((v) =>
                    v.id === rejectTarget.id
                      ? {
                          ...v,
                          status: "Rejected" as const,
                          rejectReason: finalReason,
                          rejectionDeadline: new Date(Date.now() + parsedDeadlineHours * 3_600_000).toISOString(),
                        }
                      : v,
                  ),
                )
                setRejectTarget(null)
              }
            }}
            style={{
              flex: 1,
              background: isWrongAmt ? "#F59E0B" : "#EF4444",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Josefin Sans',sans-serif",
              opacity: !canProceed ? 0.45 : 1,
              transition: "all 0.15s",
            }}
          >
            {isWrongAmt
              ? "Enter Shortfall Details →"
              : "Send Rejection"}
          </button>
        </div>
      </div>
    </Modal>
  )
}
