import { useEffect, useState } from "react"
import type React from "react"
import {
  Card,
  Avatar,
  ProductThumb,
  Countdown,
  PaymentIcon,
  StatusBadge,
} from "@/components/shared"
import type { VerifyItem } from "./verifyTypes"
import SellerPaymentMethods from "./SellerPaymentMethods"
import ReviewSubmissionModal from "./ReviewSubmissionModal"
import InsufficientPaymentModal from "./InsufficientPaymentModal"
import RejectPaymentModal from "./RejectPaymentModal"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

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
      receipt: "bdo_receipt.pdf",
      phone: "0916-001-2109",
      amountPaid: "480",
      contact: "https://facebook.com/carla.reyes",
    },
  ]
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>(
    isSupabaseConfigured ? [] : VERIFY_SEED,
  )
  const [historyFilter, setHistoryFilter] =
    useState<"All" | "Paid and Reserved" | "Rejected">("All")
  const [reviewTarget, setReviewTarget] = useState<VerifyItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<VerifyItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectCustom, setRejectCustom] = useState("")
  const [insuffTarget, setInsuffTarget] = useState<VerifyItem | null>(null)
  const [insuffAmtPaid, setInsuffAmtPaid] = useState("")

  useEffect(() => {
    if (!isSupabaseConfigured) return
    kargoApi
      .loadSellerPaymentSubmissions()
      .then(setVerifyItems)
      .catch((error) =>
        alert(
          error instanceof Error ? error.message : "Unable to load payments.",
        ),
      )
  }, [])

  const updateVerifyItems: React.Dispatch<React.SetStateAction<VerifyItem[]>> =
    (action) => {
      setVerifyItems((previous) => {
        const next = typeof action === "function" ? action(previous) : action
        if (isSupabaseConfigured) {
          for (const item of next) {
            const before = previous.find(
              (candidate) => candidate.id === item.id,
            )
            if (!before) continue
            let decision: "verified" | "rejected" | null = null
            if (item.status !== before.status && item.status === "Verified")
              decision = "verified"
            if (item.status !== before.status && item.status === "Rejected")
              decision = "rejected"
            if (
              item.status === "Pending" &&
              item.rejectReason?.startsWith("Short") &&
              item.rejectReason !== before.rejectReason
            ) {
              decision = "verified"
            }
            if (decision) {
              const deadlineHours = item.rejectionDeadline
                ? Math.max(
                    0,
                    (new Date(item.rejectionDeadline).getTime() - Date.now()) /
                      3_600_000,
                  )
                : undefined
              void kargoApi
                .reviewPayment(
                  String(item.id),
                  decision,
                  item.rejectReason,
                  deadlineHours,
                )
                .catch((error) =>
                  alert(
                    error instanceof Error
                      ? error.message
                      : "Unable to review payment.",
                  ),
                )
            }
          }
        }
        return next
      })
    }

  const REJECT_REASONS = [
    "Wrong amount transferred",
    "Invalid proof of payment",
    "Payment method mismatch",
    "Duplicate submission",
    "Other",
  ]
  const pendingItems = verifyItems.filter((item) => item.status === "Pending")
  const historyItems = verifyItems.filter((item) => item.status !== "Pending")
  const filteredHistory = historyItems.filter(
    (item) =>
      historyFilter === "All" ||
      (historyFilter === "Paid and Reserved" && item.status === "Verified") ||
      (historyFilter === "Rejected" && item.status === "Rejected"),
  )
  const renderTable = (items: VerifyItem[], showAmountPaid: boolean) => (
    <Card className="!p-0 overflow-hidden">
      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-[13px]">
          <thead style={{ background: "#6892D5" }}>
            <tr>
              {[
                "Product",
                "Buyers",
                "Method",
                "Amount",
                ...(showAmountPaid ? ["Amount Paid"] : []),
                "Date",
                "Status",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 11,
                    padding: "10px 14px",
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const paidAmount =
                item.amountPaid == null ? null : Number(item.amountPaid)
              const isShort = paidAmount != null && paidAmount < item.amount
              const displayStatus =
                item.status === "Verified" ? "Paid and Reserved" : item.status
              return (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-gray-50"
                  style={{
                    borderTop: "1px solid #E5E7EB",
                    background: index % 2 ? "#FAFAFA" : "#fff",
                  }}
                >
                  <td style={{ padding: "12px 14px" }}>
                    <div className="flex items-center gap-2">
                      <ProductThumb name={item.product} />
                      <span style={{ color: "#374151" }}>{item.product}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={item.buyer} size={22} />
                      <span style={{ fontWeight: 500, color: "#111827" }}>
                        {item.buyer}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span className="inline-flex items-center gap-1 text-[12px]">
                      <PaymentIcon method={item.method} size={15} />
                      {item.method}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Josefin Sans',sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ₱{item.amount.toLocaleString()}
                  </td>
                  {showAmountPaid && (
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      {paidAmount == null ? (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      ) : (
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: isShort ? "#D97706" : "#111827",
                            }}
                          >
                            ₱{paidAmount.toLocaleString()}
                          </div>
                          {isShort && (
                            <div
                              style={{
                                marginTop: 2,
                                color: "#92400E",
                                fontSize: 10,
                              }}
                            >
                              Short ₱
                              {(item.amount - paidAmount).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  <td
                    style={{
                      padding: "12px 14px",
                      color: "#748391",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.date}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <StatusBadge
                      status={
                        displayStatus === "Pending" ? "Pending" : displayStatus
                      }
                    />
                    {item.status === "Pending" && isShort && (
                      <div
                        style={{
                          marginTop: 4,
                          color: "#92400E",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        Awaiting balance
                      </div>
                    )}
                    {item.status === "Rejected" && item.rejectReason && (
                      <div
                        style={{
                          marginTop: 3,
                          maxWidth: 160,
                          color: "#9CA3AF",
                          fontSize: 10,
                        }}
                      >
                        {item.rejectReason}
                      </div>
                    )}
                    {item.status === "Rejected" && item.rejectionDeadline && (
                      <div
                        style={{
                          marginTop: 4,
                          color: "#6B7280",
                          fontSize: 10,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Resubmit in{" "}
                        <Countdown
                          hours={0}
                          id={`seller-reject-${item.id}`}
                          expiresAt={item.rejectionDeadline}
                        />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      type="button"
                      onClick={() => setReviewTarget(item)}
                      style={{
                        border: "1px solid #D1D5DB",
                        borderRadius: 8,
                        background: "#fff",
                        color: "#374151",
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={showAmountPaid ? 8 : 7}
                  style={{
                    padding: "28px 12px",
                    color: "#748391",
                    textAlign: "center",
                    fontSize: 12,
                  }}
                >
                  {showAmountPaid
                    ? "No payments awaiting review."
                    : "No payment history for this status."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )

  return (
    <div className="p-6 space-y-8">
      <SellerPaymentMethods />

      <section>
        <div className="mb-4">
          <h2
            style={{
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Pending Review
          </h2>
          <p style={{ marginTop: 2, color: "#9CA3AF", fontSize: 13 }}>
            Review buyer submissions and update their payment status.
          </p>
        </div>
        {renderTable(pendingItems, true)}
      </section>

      <section>
        <h2
          className="mb-4"
          style={{
            fontFamily: "'Josefin Sans',sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Payment History
        </h2>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              marginRight: 2,
              color: "#374151",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Filter:
          </span>
          {(["All", "Paid and Reserved", "Rejected"] as const).map((filter) => {
            const count =
              filter === "All"
                ? historyItems.length
                : historyItems.filter((item) =>
                    filter === "Paid and Reserved"
                      ? item.status === "Verified"
                      : item.status === "Rejected",
                  ).length
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
                aria-pressed={historyFilter === filter}
                style={{
                  border: `1px solid ${
                    historyFilter === filter ? "#191BA9" : "#E5E7EB"
                  }`,
                  borderRadius: 999,
                  background: historyFilter === filter ? "#191BA9" : "#fff",
                  color: historyFilter === filter ? "#fff" : "#374151",
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {filter} ({count})
              </button>
            )
          })}
        </div>
        {renderTable(filteredHistory, false)}
      </section>

      {/* Review submission modal */}
      {reviewTarget && (
        <ReviewSubmissionModal
          reviewTarget={reviewTarget}
          setReviewTarget={setReviewTarget}
          setVerifyItems={updateVerifyItems}
          setRejectTarget={setRejectTarget}
          setRejectReason={setRejectReason}
          setRejectCustom={setRejectCustom}
          onNotifyBuyer={(item) => {
            setInsuffTarget(item)
            setInsuffAmtPaid(item.amountPaid || "")
            setReviewTarget(null)
          }}
          onMarkPaid={(item) => {
            updateVerifyItems((items) =>
              items.map((candidate) =>
                candidate.id === item.id
                  ? { ...candidate, status: "Verified" as const }
                  : candidate,
              ),
            )
            setReviewTarget(null)
          }}
        />
      )}

      {/* Insufficient Payment modal */}
      {insuffTarget && (
        <InsufficientPaymentModal
          insuffTarget={insuffTarget}
          setInsuffTarget={setInsuffTarget}
          insuffAmtPaid={insuffAmtPaid}
          setInsuffAmtPaid={setInsuffAmtPaid}
          setVerifyItems={updateVerifyItems}
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
          setVerifyItems={updateVerifyItems}
          REJECT_REASONS={REJECT_REASONS}
        />
      )}
    </div>
  )
}
