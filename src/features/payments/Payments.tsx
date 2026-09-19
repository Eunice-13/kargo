import { useState, useRef } from "react"
import { Phone } from "lucide-react"
import type { ToPayRow, PayHistRow, OrderRow, ClaimStatus, SharedState } from "@/types"
import { INDIGO, CREAM, CYAN_L, SKY, TODAY } from "@/constants/theme"
import {
  Modal,
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  ProductThumb,
  StatusBadge,
  Countdown,
  PaymentIcon,
  PayModal,
} from "@/components/shared"
import PaymentSubmitModal from "./PaymentSubmitModal"
import TransactionDetailModal from "./TransactionDetailModal"

export default function Payments({
  toPay,
  setToPay,
  payHistory,
  setPayHistory,
  claims,
  setClaims,
  orders,
  setOrders,
  role,
}: SharedState) {
  type VerifyItem = {
    id: number
    buyer: string
    product: string
    amount: number
    ref: string
    date: string
    status: "Pending" | "Verified" | "Rejected"
    method: string
    acctName: string
    acctNum: string
    receipt: string
    rejectReason?: string
    phone?: string
    amountPaid?: string
  }
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
    },
  ]
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>(VERIFY_SEED)
  const [reviewTarget, setReviewTarget] = useState<VerifyItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<VerifyItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectCustom, setRejectCustom] = useState("")
  const [insuffTarget, setInsuffTarget] = useState<VerifyItem | null>(null)
  const [insuffAmtPaid, setInsuffAmtPaid] = useState("")

  const [dragging, setDragging] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [payTarget, setPayTarget] = useState<ToPayRow | null>(null)
  const [payAll, setPayAll] = useState(false)
  const [histFilter, setHistFilter] =
    useState<"All" | "Paid and Reserved" | "Pending" | "Rejected">("All")
  const [dateFilter2, setDateFilter2] = useState("All")
  const [txDetail, setTxDetail] = useState<PayHistRow | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFilePick = (file: File) => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(file.name)
    }, 1200)
  }

  const handlePay = (item: ToPayRow | null, method: string) => {
    const targets = item ? [item] : toPay
    const newHist: PayHistRow[] = targets.map((t, i) => ({
      id: payHistory.length + i + 1,
      product: t.product,
      batch: "",
      method,
      amount: t.amount,
      date: TODAY,
      status: "Paid and Reserved" as ClaimStatus,
    }))
    setPayHistory((h) => [...newHist, ...h])
    setClaims((prev) =>
      prev.map((c) =>
        targets.some((t) => t.product === c.product) && c.status === "Pending"
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    const newOrders: OrderRow[] = targets.map((t, i) => ({
      id: `ORD-2026-${String(orders.length + 60 + i).padStart(4, "0")}`,
      product: t.product,
      batch: "",
      seller: t.seller,
      amount: t.amount,
      step: 3,
      trackingNo: null,
      eta: "Est. Oct 2026",
      rated: false,
    }))
    setOrders((prev) => [...newOrders, ...prev])
    setToPay((prev) => (item ? prev.filter((x) => x.id !== item.id) : []))
    setPayTarget(null)
    setPayAll(false)
  }

  const REJECT_REASONS = [
    "Wrong amount transferred",
    "Invalid proof of payment",
    "Payment method mismatch",
    "Duplicate submission",
    "Other",
  ]
  const methodIcon: Record<string, string> = {
    GCash: "",
    Maya: "",
    "Bank Transfer": "",
    "Cash on Meetup": "",
  }

  if (role === "Seller") {
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
                        {methodIcon[item.method] || "💳"} {item.method}
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
                                    }}
                                  >
                                    ✓ Notified
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
                                    }}
                                  >
                                    📢 Notify Buyer
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

        {/* Review submission modal */}
        {reviewTarget && (
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
                  [
                    "Payment Method",
                    `${methodIcon[reviewTarget.method] || "💳"} ${reviewTarget.method}`,
                  ],
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
                ] as [string, string][]).map(([k, v]) => (
                  <div
                    key={k}
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
                ))}
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
                      📎 {reviewTarget.receipt}
                    </span>
                    <button
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
                      View
                    </button>
                  </div>
                </div>
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
                          ✓ Confirm Payment
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
                          ✕ Reject
                        </button>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
          </Modal>
        )}

        {/* Insufficient Payment modal */}
        {insuffTarget &&
          (() => {
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
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
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
                            fontFamily: "'Plus Jakarta Sans',sans-serif",
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
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
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
          })()}

        {/* Reject with reason modal */}
        {rejectTarget &&
          (() => {
            const isWrongAmt = rejectReason === "Wrong amount transferred"
            const isOther = rejectReason === "Other"
            const canProceed =
              !!rejectReason && (!isOther || rejectCustom.trim().length > 0)
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
                  {isWrongAmt && rejectReason && (
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
                      ⚠️ Selecting this won't reject the payment — instead,
                      you'll enter the shortfall amount and the buyer will be
                      notified to complete their payment.
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
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
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
          })()}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <SH
          title="Payment Methods"
          action={<PrimaryBtn size="sm">+ Add Method</PrimaryBtn>}
        />
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              name: "GCash",
              icon: "",
              color: "#007AFF",
              desc: "09XX-XXX-8821",
              connected: true,
            },
            {
              name: "Maya",
              icon: "",
              color: "#6B21A8",
              desc: "09XX-XXX-5543",
              connected: true,
            },
            {
              name: "Bank Transfer",
              icon: "",
              color: "#065F46",
              desc: "BDO · •••• 4421",
              connected: true,
            },
            {
              name: "Cash on Meetup",
              icon: "",
              color: "#92400E",
              desc: "Coordinate with seller",
              connected: false,
            },
          ].map((m) => (
            <Card
              key={m.name}
              style={{ borderLeft: `4px solid ${m.color}` }}
              className="flex items-center gap-3"
            >
              <span className="text-2xl" style={{ color: m.color }}><PaymentIcon method={m.name} size={22} /></span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#111827",
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {m.desc}
                </div>
              </div>
              <div className="ml-auto">
                {m.connected ? (
                  <span
                    style={{
                      background: "#D4F5EA",
                      color: "#0B7A59",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 999,
                    }}
                  >
                    Connected
                  </span>
                ) : (
                  <span
                    style={{
                      background: "#F3F4F6",
                      color: "#9CA3AF",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 999,
                    }}
                  >
                    Manual
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <SH title="To Pay" />
          <div className="space-y-3">
            {toPay.map((t) => (
              <Card key={t.id} className="flex items-center gap-4">
                <ProductThumb name={t.product} />
                <div className="flex-1">
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}
                  >
                    {t.product}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {t.seller}
                    </span>
                    <span style={{ fontSize: 11, color: "#D1D5DB" }}>·</span>
                    <Countdown hours={t.hours} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#111827",
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  ₱{t.amount.toLocaleString()}
                </div>
                <PrimaryBtn size="sm" onClick={() => setPayTarget(t)}>
                  Pay Now
                </PrimaryBtn>
              </Card>
            ))}
            {toPay.length > 0 ? (
              <Card
                style={{ background: CREAM, border: "1px dashed #C7B8B8" }}
                className="flex items-center justify-between"
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}
                >
                  Total Due
                </span>
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: INDIGO,
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    ₱{toPay.reduce((s, t) => s + t.amount, 0).toLocaleString()}
                  </span>
                  <PrimaryBtn onClick={() => setPayAll(true)}>
                    Pay All
                  </PrimaryBtn>
                </div>
              </Card>
            ) : (
              <div
                style={{
                  background: "#D4F5EA",
                  borderRadius: 8,
                  padding: "14px 18px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#065F46",
                  fontWeight: 600,
                }}
              >
                ✅ All payments cleared!
              </div>
            )}
          </div>
        </div>
        <div>
          <SH title="Upload Proof of Payment" />
          <Card className="!p-0 overflow-hidden">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFilePick(f)
              }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload proof of payment"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  fileRef.current?.click()
                }
              }}
              style={{
                border: `2px dashed ${dragging ? INDIGO : "#D1D5DB"}`,
                background: dragging ? "#EEF0FF" : CREAM,
                borderRadius: 8,
                padding: 32,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                margin: 16,
                transform: dragging ? "scale(1.01)" : "scale(1)",
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFilePick(f)
                }}
              />
              {uploading ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: INDIGO }}
                    className="lsh"
                  >
                    Uploading…
                  </div>
                </>
              ) : uploaded ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}
                  >
                    {uploaded}
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    Click to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}
                  >
                    Drag & drop your receipt here
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                    or click to browse — JPG, PNG, PDF
                  </div>
                </>
              )}
            </div>
            {uploaded && !uploading && (
              <div className="px-4 pb-4">
                <select
                  style={{
                    width: "100%",
                    fontSize: 12,
                    border: "1px solid #E5E7EB",
                    borderRadius: 6,
                    padding: "7px 10px",
                    marginBottom: 8,
                    outline: "none",
                  }}
                >
                  <option>Select claim to attach…</option>
                  {toPay.map((t) => (
                    <option key={t.id}>
                      {t.product} — ₱{t.amount.toLocaleString()}
                    </option>
                  ))}
                </select>
                <PrimaryBtn
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  Submit Payment Proof
                </PrimaryBtn>
              </div>
            )}
          </Card>
        </div>
      </div>
      <div>
        <SH title="Payment History" />
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
            Filter:
          </span>
          {(["All", "Paid and Reserved", "Pending", "Rejected"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setHistFilter(f)}
                style={{
                  background: histFilter === f ? "#191BA9" : "#fff",
                  color: histFilter === f ? "#fff" : "#6B7280",
                  border: `1px solid ${
                    histFilter === f ? "#191BA9" : "#E5E7EB"
                  }`,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ),
          )}
          <div style={{ flex: 1 }} />
          <select
            value={dateFilter2}
            onChange={(e) => setDateFilter2(e.target.value)}
            style={{
              fontSize: 12,
              color: "#374151",
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              padding: "5px 8px",
              background: "#fff",
              outline: "none",
            }}
          >
            {["All", "Sep 2026", "Aug 2026", "Jul 2026", "Jun 2026"].map(
              (o) => (
                <option key={o}>{o}</option>
              ),
            )}
          </select>
        </div>
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: CREAM }}>
              <tr>
                {[
                  "Product",
                  "Batch",
                  "Method",
                  "Amount",
                  "Date",
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
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payHistory
                .filter((h) => {
                  if (histFilter !== "All" && h.status !== histFilter)
                    return false
                  if (
                    dateFilter2 !== "All" &&
                    !h.date.includes(dateFilter2.split(" ")[0])
                  )
                    return false
                  return true
                })
                .map((p, i) => (
                  <tr
                    key={p.id}
                    style={{
                      borderTop: "1px solid #F3F4F6",
                      background: i % 2 ? "#FAFAFA" : "#fff",
                    }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <div className="flex items-center gap-2">
                        <ProductThumb name={p.product} />
                        <span style={{ fontWeight: 500, color: "#111827" }}>
                          {p.product}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#6B7280",
                        fontSize: 12,
                      }}
                    >
                      {p.batch || "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "#374151",
                      }}
                    >
                      {p.method}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{p.amount.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#9CA3AF",
                        fontSize: 12,
                      }}
                    >
                      {p.date}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <SecondaryBtn size="sm" onClick={() => setTxDetail(p)}>
                        View Details
                      </SecondaryBtn>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
      {payTarget && (
        <PaymentSubmitModal
          item={payTarget}
          onConfirm={(method, refNo) => handlePay(payTarget, method)}
          onClose={() => setPayTarget(null)}
        />
      )}
      {payAll && (
        <PayModal
          items={toPay.map((t) => ({ product: t.product, amount: t.amount }))}
          onConfirm={(m) => handlePay(null, m)}
          onClose={() => setPayAll(false)}
        />
      )}
      {txDetail && (
        <TransactionDetailModal
          tx={txDetail}
          onClose={() => setTxDetail(null)}
        />
      )}
    </div>
  )
}
