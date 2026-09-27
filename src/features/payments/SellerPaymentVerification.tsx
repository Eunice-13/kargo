import { useEffect, useState } from "react"
import type React from "react"
import { INDIGO } from "@/constants/theme"
import { Card, Avatar, ProductThumb, Countdown, PaymentIcon, StatusBadge, SecondaryBtn } from "@/components/shared"
import type { VerifyItem } from "./verifyTypes"
import AddressSection from "./AddressSection"
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
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>(isSupabaseConfigured ? [] : VERIFY_SEED)
  const [statusFilter, setStatusFilter] = useState<VerifyItem["status"] | "All">("All")
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
      .catch((error) => alert(error instanceof Error ? error.message : "Unable to load payments."))
  }, [])

  const updateVerifyItems: React.Dispatch<React.SetStateAction<VerifyItem[]>> = (action) => {
    setVerifyItems((previous) => {
      const next = typeof action === "function" ? action(previous) : action
      if (isSupabaseConfigured) {
        for (const item of next) {
          const before = previous.find((candidate) => candidate.id === item.id)
          if (!before) continue
          let decision: "verified" | "rejected" | null = null
          if (item.status !== before.status && item.status === "Verified") decision = "verified"
          if (item.status !== before.status && item.status === "Rejected") decision = "rejected"
          if (item.status === "Pending" && item.rejectReason?.startsWith("Short") && item.rejectReason !== before.rejectReason) {
            decision = "verified"
          }
          if (decision) {
            const deadlineHours = item.rejectionDeadline
              ? Math.max(0, (new Date(item.rejectionDeadline).getTime() - Date.now()) / 3_600_000)
              : undefined
            void kargoApi.reviewPayment(String(item.id), decision, item.rejectReason, deadlineHours).catch((error) =>
              alert(error instanceof Error ? error.message : "Unable to review payment."),
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
  const filteredItems = statusFilter === "All"
    ? verifyItems
    : verifyItems.filter((item) => item.status === statusFilter)
  return (
    <div className="p-6 space-y-6">
      <SellerPaymentMethods />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            style={{
              fontFamily: "'Josefin Sans',sans-serif",
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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-[#526170]">Filter:</span>
        {(["All", "Pending", "Verified", "Rejected"] as const).map((filter) => {
          const selected = statusFilter === filter
          const count = filter === "All"
            ? verifyItems.length
            : verifyItems.filter((item) => item.status === filter).length
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={selected}
              onClick={() => setStatusFilter(filter)}
              className="rounded-full border px-3 py-1 text-[10px] font-semibold transition-colors"
              style={{
                background: selected ? INDIGO : "#fff",
                borderColor: selected ? INDIGO : "#E5E7EB",
                color: selected ? "#fff" : "#6B7280",
              }}
            >
              {filter} <span className="ml-1 opacity-75">{count}</span>
            </button>
          )
        })}
      </div>
      <Card className="!p-0 overflow-hidden">
        <div style={{ overflowX: "auto" }}>
          <table className="seller-payment-history w-full text-[12px]">
            <thead style={{ background: "#5D87D1" }}>
              <tr>
                {[
                  "Product",
                  "Buyers",
                  "Method",
                  "Amount",
                  "Date",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 10,
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const paidNum =
                  item.amountPaid != null ? Number(item.amountPaid) : null
                const isShort = paidNum != null && paidNum < item.amount
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <ProductThumb name={item.product} />
                        <span style={{ color: "#111827", fontWeight: 600 }}>{item.product}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={item.buyer} size={18} />
                        <span style={{ fontSize: 11, color: "#526170" }}>{item.buyer}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <PaymentIcon method={item.method} size={15} /> {item.method}
                      </span>
                    </td>
                    <td>
                      <div className="whitespace-nowrap font-bold text-[#111827]">
                        ₱{item.amount.toLocaleString()}
                      </div>
                      {paidNum != null && (
                        <div className={`mt-0.5 whitespace-nowrap text-[10px] ${isShort ? "text-[#B45309]" : "text-[#748391]"}`}>
                          Paid ₱{paidNum.toLocaleString()}
                          {isShort ? ` · short ₱${(item.amount - paidNum).toLocaleString()}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-[#748391]">
                      {item.date}
                    </td>
                    <td>
                      <StatusBadge status={item.status === "Verified" ? "Paid and Reserved" : item.status} />
                      {item.status === "Pending" && isShort && (
                        <div className="mt-1 text-[10px] font-semibold text-[#92400E]">Awaiting balance</div>
                      )}
                      {item.status === "Rejected" && (
                        <div>
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
                          {item.rejectionDeadline && (
                            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, whiteSpace: "nowrap" }}>
                              Resubmit in <Countdown hours={0} id={`seller-reject-${item.id}`} expiresAt={item.rejectionDeadline} />
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <SecondaryBtn size="sm" onClick={() => setReviewTarget(item)}>
                        Review
                      </SecondaryBtn>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6">
        <AddressSection />
      </div>

      {/* Review submission modal */}
      {reviewTarget && (
        <ReviewSubmissionModal
          reviewTarget={reviewTarget}
          setReviewTarget={setReviewTarget}
          setVerifyItems={updateVerifyItems}
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
