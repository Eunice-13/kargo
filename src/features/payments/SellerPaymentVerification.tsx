import { useState } from "react"
import { CreditCard, Check, Megaphone } from "lucide-react"
import { INDIGO, CREAM } from "@/constants/theme"
import { Card, Avatar, ProductThumb } from "@/components/shared"
import type { VerifyItem } from "./verifyTypes"
import AddressSection from "./AddressSection"
import ReviewSubmissionModal from "./ReviewSubmissionModal"
import InsufficientPaymentModal from "./InsufficientPaymentModal"
import RejectPaymentModal from "./RejectPaymentModal"

export default function SellerPaymentVerification() {
  const VERIFY_SEED: VerifyItem[] = [
    {
      id: 1,
      buyer: "Anna Cruz",
      product: "Laneige Lip Mask",
      amount: 950,
      ref: "GC-20260910-3821",
      date: "Sep 10, 2026",
      status: "Pending",
      method: "GCash",
      acctName: "Anna C. Cruz",
      acctNum: "0917-823-4410",
      receipt: "receipt_gcash.jpg",
      phone: "0917-823-4410",
      amountPaid: "750",
      contact: "https://facebook.com/anna.cruz",
    },
    {
      id: 2,
      buyer: "Ben Santos",
      product: "SK-II Essence",
      amount: 4800,
      ref: "MAYA-2026-9942",
      date: "Sep 9, 2026",
      status: "Pending",
      method: "Maya",
      acctName: "Benedicto Santos",
      acctNum: "0918-554-2291",
      receipt: "maya_proof.png",
      phone: "0918-554-2291",
      amountPaid: "4800",
      contact: "https://facebook.com/ben.santos",
    },
    {
      id: 3,
      buyer: "Carla Reyes",
      product: "Tokyo Banana",
      amount: 480,
      ref: "BDO-TXN-1188",
      date: "Sep 8, 2026",
      status: "Verified",
      method: "Bank Transfer",
      acctName: "Carla M. Reyes",
      acctNum: "BDO-0044-2109",
      receipt: "bdo_receipt.pdf",
      phone: "0916-001-2109",
      amountPaid: "480",
      contact: "https://facebook.com/carla.reyes",
    },
  ]
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>(VERIFY_SEED)
  const [reviewTarget, setReviewTarget] = useState<VerifyItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<VerifyItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectCustom, setRejectCustom] = useState("")
  const [insuffTarget, setInsuffTarget] = useState<VerifyItem | null>(null)
  const [insuffAmtPaid, setInsuffAmtPaid] = useState("")

  const REJECT_REASONS = [
    "Wrong amount transferred",
    "Invalid proof of payment",
    "Payment method mismatch",
    "Duplicate submission",
    "Other",
  ]
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Payment Verification
            </h2>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>
              Review buyer submissions and confirm or reject each payment.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Pending", "Verified", "Rejected"] as const).map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 999,
                  background:
                    s === "Pending"
                      ? "#FEF3C7"
                      : s === "Verified"
                        ? "#D4F5EA"
                        : "#FEE2E2",
                  color:
                    s === "Pending"
                      ? "#92400E"
                      : s === "Verified"
                        ? "#0B7A59"
                        : "#991B1B",
                }}
              >
                {verifyItems.filter((v) => v.status === s).length} {s}
              </span>
            ))}
          </div>
        </div>
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: CREAM }}>
              <tr>
                {[
                  "Buyer",
                  "Product",
                  "Method",
                  "Amount",
                  "Amount Paid",
                  "Submitted",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      color: "#9CA3AF",
                      fontWeight: 600,
                      fontSize: 11,
                      padding: "10px 14px",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {verifyItems.map((item, i) => {
                const paidNum =
                  item.amountPaid != null ? Number(item.amountPaid) : null
                const isShort = paidNum != null && paidNum < item.amount
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderTop: "1px solid #F3F4F6",
                      background: i % 2 ? "#FAFAFA" : "#fff",
                    }}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div className="flex items-center gap-2">
                        <Avatar name={item.buyer} size={22} />
                        <span style={{ fontWeight: 500, color: "#111827" }}>
                          {item.buyer}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div className="flex items-center gap-2">
                        <ProductThumb name={item.product} />
                        <span style={{ color: "#374151" }}>{item.product}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <CreditCard size={13} aria-hidden="true" /> {item.method}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{item.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {paidNum != null ? (
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: isShort ? "#D97706" : "#111827",
                            }}
                          >
                            ₱{paidNum.toLocaleString()}
                          </div>
                          {isShort && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#92400E",
                                background: "#FFF7ED",
                                borderRadius: 999,
                                padding: "1px 7px",
                                marginTop: 2,
                                display: "inline-block",
                              }}
                            >
                              Short ₱{(item.amount - paidNum).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#9CA3AF",
                        fontSize: 12,
                      }}
                    >
                      {item.date}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {item.status === "Pending" && (
                        <div>
                          <span
                            style={{
                              background: "#FEF3C7",
                              color: "#92400E",
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 999,
                            }}
                          >
                            Pending
                          </span>
                          {isShort && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#92400E",
                                fontWeight: 600,
                                marginTop: 3,
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <span
                                style={{
                                  background: "#FCD34D",
                                  borderRadius: 999,
                                  width: 5,
                                  height: 5,
                                  display: "inline-block",
                                }}
                              />
                              Awaiting balance
                            </div>
                          )}
                        </div>
                      )}
                      {item.status === "Verified" && (
                        <span
                          style={{
                            background: "#D4F5EA",
                            color: "#0B7A59",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 999,
                          }}
                        >
                          Verified
                        </span>
                      )}
                      {item.status === "Rejected" && (
                        <div>
                          <span
                            style={{
                              background: "#FEE2E2",
                              color: "#991B1B",
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 999,
                            }}
                          >
                            Rejected
                          </span>
                          {item.rejectReason && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#9CA3AF",
                                marginTop: 3,
                                maxWidth: 160,
                              }}
                            >
                              {item.rejectReason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
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
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => setReviewTarget(item)}
                              style={{
                                ...btnBase,
                                background: "#fff",
                                color: "#374151",
                                borderColor: "#E5E7EB",
                              }}
                            >
                              Review
                            </button>
                            {item.status === "Pending" && isShort ? (
                              <>
                                {item.rejectReason?.includes(
                                  "buyer notified",
                                ) ? (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "#0B7A59",
                                      background: "#D4F5EA",
                                      border: "1px solid #6EE7B7",
                                      borderRadius: 6,
                                      padding: "5px 12px",
                                      whiteSpace: "nowrap" as const,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 5,
                                    }}
                                  >
                                    <Check size={12} aria-hidden="true" /> Notified
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setInsuffTarget(item)
                                      setInsuffAmtPaid(item.amountPaid || "")
                                    }}
                                    style={{
                                      ...btnBase,
                                      background: "#FEF3C7",
                                      color: "#92400E",
                                      borderColor: "#FCD34D",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 5,
                                    }}
                                  >
                                    <Megaphone size={12} aria-hidden="true" /> Notify Buyer
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    setVerifyItems((p) =>
                                      p.map((v) =>
                                        v.id === item.id
                                          ? {
                                              ...v,
                                              status: "Verified" as const,
                                            }
                                          : v,
                                      ),
                                    )
                                  }
                                  style={{
                                    ...btnBase,
                                    background: INDIGO,
                                    color: "#fff",
                                    borderColor: INDIGO,
                                  }}
                                >
                                  Mark Paid
                                </button>
                              </>
                            ) : (
                              item.status === "Pending" && (
                                <>
                                  <button
                                    onClick={() =>
                                      setVerifyItems((p) =>
                                        p.map((v) =>
                                          v.id === item.id
                                            ? {
                                                ...v,
                                                status: "Verified" as const,
                                              }
                                            : v,
                                        ),
                                      )
                                    }
                                    style={{
                                      ...btnBase,
                                      background: INDIGO,
                                      color: "#fff",
                                      borderColor: INDIGO,
                                    }}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectTarget(item)
                                      setRejectReason("")
                                      setRejectCustom("")
                                    }}
                                    style={{
                                      ...btnBase,
                                      background: "#fff",
                                      color: "#EF4444",
                                      borderColor: "#EF4444",
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </Card>

        <div style={{ marginTop: 24 }}>
          <AddressSection />
        </div>

        {/* Review submission modal */}
        {reviewTarget && (
          <ReviewSubmissionModal
            reviewTarget={reviewTarget}
            setReviewTarget={setReviewTarget}
            setVerifyItems={setVerifyItems}
            setRejectTarget={setRejectTarget}
            setRejectReason={setRejectReason}
            setRejectCustom={setRejectCustom}
          />
        )}

        {/* Insufficient Payment modal */}
        {insuffTarget && (
          <InsufficientPaymentModal
            insuffTarget={insuffTarget}
            setInsuffTarget={setInsuffTarget}
            insuffAmtPaid={insuffAmtPaid}
            setInsuffAmtPaid={setInsuffAmtPaid}
            setVerifyItems={setVerifyItems}
          />
        )}

        {/* Reject with reason modal */}
        {rejectTarget && (
          <RejectPaymentModal
            rejectTarget={rejectTarget}
            setRejectTarget={setRejectTarget}
            rejectReason={rejectReason}
            setRejectReason={setRejectReason}
            rejectCustom={rejectCustom}
            setRejectCustom={setRejectCustom}
            setInsuffTarget={setInsuffTarget}
            setInsuffAmtPaid={setInsuffAmtPaid}
            setVerifyItems={setVerifyItems}
            REJECT_REASONS={REJECT_REASONS}
          />
        )}
      </div>
    )
}
