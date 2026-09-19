import type React from "react"
import { useState } from "react"
import { CreditCard, Paperclip, Check, X, ExternalLink, Image as ImageIcon } from "lucide-react"
import { INDIGO, CREAM } from "@/constants/theme"
import { Modal, Avatar } from "@/components/shared"
import type { VerifyItem } from "./verifyTypes"

export default function ReviewSubmissionModal({
  reviewTarget,
  setReviewTarget,
  setVerifyItems,
  setRejectTarget,
  setRejectReason,
  setRejectCustom,
}: {
  reviewTarget: VerifyItem
  setReviewTarget: (v: VerifyItem | null) => void
  setVerifyItems: React.Dispatch<React.SetStateAction<VerifyItem[]>>
  setRejectTarget: (v: VerifyItem | null) => void
  setRejectReason: (v: string) => void
  setRejectCustom: (v: string) => void
}) {
  const [showReceipt, setShowReceipt] = useState(false)
  return (
    <Modal
      title="Payment Submission Details"
      onClose={() => setReviewTarget(null)}
      width={520}
    >
      <div className="space-y-4">
        {/* Buyer + product header */}
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            background: CREAM,
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <Avatar name={reviewTarget.buyer} size={40} />
          <div className="flex-1">
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              {reviewTarget.buyer}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
              {reviewTarget.product}
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: INDIGO,
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            ₱{reviewTarget.amount.toLocaleString()}
          </div>
        </div>

        {/* Submitted details grid */}
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: CREAM,
              padding: "8px 14px",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#374151",
                letterSpacing: 0.6,
              }}
            >
              BUYER SUBMISSION
            </span>
          </div>
          {([
            ["Reference ID", reviewTarget.ref],
            ["Account Name", reviewTarget.acctName],
            ["Account Number", reviewTarget.acctNum],
            ["Date Submitted", reviewTarget.date],
            ["Phone Number", reviewTarget.phone || "—"],
            [
              "Amount Paid",
              reviewTarget.amountPaid
                ? `₱${Number(reviewTarget.amountPaid).toLocaleString()}`
                : "—",
            ],
          ] as [string, string][]).map(([k, v], idx) => (
            <div key={k}>
              {idx === 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#9CA3AF",
                      fontWeight: 500,
                    }}
                  >
                    Payment Method
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#111827",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <CreditCard size={13} aria-hidden="true" />
                    {reviewTarget.method}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "#9CA3AF",
                    fontWeight: 500,
                  }}
                >
                  {k}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#111827",
                    fontFamily:
                      k === "Reference ID" ? "monospace" : "inherit",
                  }}
                >
                  {v}
                </span>
              </div>
            </div>
          ))}
          {/* Contact link row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderBottom: "1px solid #F3F4F6",
            }}
          >
            <span
              style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}
            >
              Contact Link
            </span>
            {reviewTarget.contact ? (
              <a
                href={reviewTarget.contact}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11,
                  color: "#fff",
                  background: INDIGO,
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <ExternalLink size={12} aria-hidden="true" /> Open Facebook profile
              </a>
            ) : (
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>
            )}
          </div>
          {/* Receipt row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
            }}
          >
            <span
              style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}
            >
              Receipt File
            </span>
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{ fontSize: 12, fontWeight: 600, color: INDIGO }}
              >
                <Paperclip size={12} aria-hidden="true" style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} />
                {reviewTarget.receipt}
              </span>
              <button
                onClick={() => setShowReceipt((v) => !v)}
                aria-expanded={showReceipt}
                style={{
                  fontSize: 11,
                  color: "#fff",
                  background: INDIGO,
                  border: "none",
                  borderRadius: 6,
                  padding: "3px 10px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                {showReceipt ? "Hide" : "View"}
              </button>
            </div>
          </div>
          {showReceipt && (
            <div
              className="fi"
              style={{
                marginTop: 10,
                border: "1px dashed #C7CCE5",
                borderRadius: 8,
                background: "#F7F8FF",
                padding: "22px 14px",
                textAlign: "center",
                color: "#6B7280",
              }}
            >
              <ImageIcon
                size={30}
                aria-hidden="true"
                style={{ color: INDIGO, display: "inline-block" }}
              />
              <div style={{ fontSize: 12, marginTop: 8, color: "#374151" }}>
                {reviewTarget.receipt}
              </div>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                Receipt preview — buyer-submitted proof of payment.
              </div>
            </div>
          )}
        </div>

        {/* Seller's own records reminder */}
        <div
          style={{
            background: "#EEF0FF",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#374151",
          }}
        >
          <strong>Your account:</strong>{" "}
          {reviewTarget.method === "Bank Transfer"
            ? "BDO •••• 4421"
            : reviewTarget.method === "GCash"
              ? "0917 •••• 8821"
              : reviewTarget.method === "Maya"
                ? "0917 •••• 5543"
                : "—"}{" "}
          — check that the reference ID and amount match what you
          received.
        </div>

        {(() => {
          const btnBase: React.CSSProperties = {
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid",
            cursor: "pointer",
            whiteSpace: "nowrap" as const,
          }
          return (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setReviewTarget(null)}
                style={{
                  ...btnBase,
                  flex: 1,
                  justifyContent: "center",
                  display: "flex",
                  background: "#fff",
                  color: "#374151",
                  borderColor: "#E5E7EB",
                }}
              >
                Close
              </button>
              {reviewTarget.status === "Pending" && (
                <>
                  <button
                    onClick={() => {
                      setVerifyItems((p) =>
                        p.map((v) =>
                          v.id === reviewTarget.id
                            ? { ...v, status: "Verified" as const }
                            : v,
                        ),
                      )
                      setReviewTarget(null)
                    }}
                    style={{
                      ...btnBase,
                      flex: 1,
                      justifyContent: "center",
                      display: "flex",
                      background: INDIGO,
                      color: "#fff",
                      borderColor: INDIGO,
                    }}
                  >
                    <Check size={13} aria-hidden="true" /> Confirm Payment
                  </button>
                  <button
                    onClick={() => {
                      setRejectTarget(reviewTarget)
                      setReviewTarget(null)
                      setRejectReason("")
                      setRejectCustom("")
                    }}
                    style={{
                      ...btnBase,
                      flex: 1,
                      justifyContent: "center",
                      display: "flex",
                      background: "#fff",
                      color: "#EF4444",
                      borderColor: "#EF4444",
                    }}
                  >
                    <X size={13} aria-hidden="true" /> Reject
                  </button>
                </>
              )}
            </div>
          )
        })()}
      </div>
    </Modal>
  )
}
