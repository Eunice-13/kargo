import { completedPayments } from "./paymentHistory"
import { useEffect, useState } from "react"
import type { ClaimStatus, PayHistRow, SharedState, ToPayRow } from "@/types"
import { TODAY } from "@/constants/theme"
import {
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  ProductThumb,
  StatusBadge,
  Countdown,
  PaymentSuccessToast,
} from "@/components/shared"
import TransactionDetailModal from "./TransactionDetailModal"
import SellerPaymentVerification from "./SellerPaymentVerification"
import PaymentSubmitModal, {
  type PaymentSubmissionDetails,
} from "./PaymentSubmitModal"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { kargoApi } from "@/services"
import { claimIsPayable, deadlineHasPassed } from "@/features/claims/claimExpiry"

export default function Payments({
  toPay,
  setToPay,
  payHistory,
  setPayHistory,
  claims,
  setClaims,
  role,
  user,
  refreshData,
}: SharedState) {
  const [txDetail, setTxDetail] = useState<PayHistRow | null>(null)
  const [payTarget, setPayTarget] = useState<ToPayRow | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const payableToPay = toPay.filter((item) => !deadlineHasPassed(item))
  const resolvedPayments = completedPayments(payHistory, claims)

  useEffect(() => {
    if (!isSupabaseConfigured || role !== "Buyer") return
    const refresh = () => void refreshData().catch(() => {})
    refresh()
    const refreshOnFocus = () => refresh()
    window.addEventListener("focus", refreshOnFocus)
    const channel = user.id && supabase
      ? supabase
          .channel(`buyer-payment-history-${user.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "payments", filter: `submitted_by=eq.${user.id}` },
            refresh,
          )
          .subscribe()
      : null
    return () => {
      window.removeEventListener("focus", refreshOnFocus)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [refreshData, role, user.id])

  useEffect(() => {
    if (payTarget && deadlineHasPassed(payTarget)) setPayTarget(null)
  }, [payTarget])

  useEffect(() => {
    if (!paymentSuccess) return
    const timer = window.setTimeout(() => setPaymentSuccess(false), 6000)
    return () => window.clearTimeout(timer)
  }, [paymentSuccess])

  const handlePayment = async (
    item: ToPayRow,
    method: string,
    referenceNumber: string,
    receipt: File | undefined,
    details: PaymentSubmissionDetails,
  ) => {
    const claim = claims.find(
      (candidate) => String(candidate.id) === String(item.orderId ?? item.id),
    )
    if (!claim || !claimIsPayable(claim) || deadlineHasPassed(item)) {
      setPayTarget(null)
      alert("This claim has expired or is no longer awaiting payment.")
      await refreshData()
      return false
    }

    if (isSupabaseConfigured) {
      try {
        await kargoApi.submitPayment({
          orderId: item.orderId ?? String(item.id),
          method,
          amount: details.amountPaid,
          referenceNumber,
          receipt,
          payerAccountName: details.payerAccountName,
          payerPhone: details.payerPhone,
          buyerContactUrl: details.buyerContactUrl,
        })
        await refreshData()
      } catch (error) {
        await refreshData()
        setPayTarget(null)
        alert(error instanceof Error ? error.message : "Unable to submit payment.")
        return false
      }
    } else {
      setPayHistory((history) => [
        {
          id: history.length + 1,
          orderId: String(item.orderId ?? item.id),
          product: item.product,
          batch: claim.batch,
          method,
          amount: details.amountPaid,
          date: TODAY,
          status: "Paid and Reserved" as ClaimStatus,
        },
        ...history,
      ])
      setClaims((current) =>
        current.map((candidate) =>
          candidate.id === claim.id
            ? { ...candidate, status: "Paid and Reserved" as ClaimStatus }
            : candidate,
        ),
      )
      setToPay((current) => current.filter((candidate) => candidate.id !== item.id))
    }

    setPayTarget(null)
    setPaymentSuccess(true)
    return true
  }

  if (role === "Seller")
    return <SellerPaymentVerification view="history" refreshData={refreshData} />

  return (
    <div className="p-6 space-y-6">
      <div>
        <SH title="Pending Payments" />
        <p style={{ marginTop: -8, marginBottom: 12, color: "#748391", fontSize: 12 }}>
          Submit payment before each reservation deadline.
        </p>
        <div className="space-y-3">
          {payableToPay.map((item) => (
            <Card key={item.id} className="flex items-center gap-4">
              <ProductThumb name={item.product} />
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  {item.product}
                  {item.qty && item.qty > 1 ? (
                    <span style={{ marginLeft: 6, color: "#6B7280", fontSize: 12 }}>
                      ×{item.qty}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{item.seller}</span>
                  <span style={{ color: "#D1D5DB" }}>·</span>
                  <Countdown hours={item.hours} expiresAt={item.expiresAt} />
                </div>
              </div>
              <div
                style={{
                  color: "#111827",
                  fontFamily: "'Josefin Sans',sans-serif",
                  fontSize: 15,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                ₱{item.amount.toLocaleString()}
              </div>
              <PrimaryBtn size="sm" onClick={() => setPayTarget(item)}>
                Pay Now
              </PrimaryBtn>
            </Card>
          ))}
          {payableToPay.length === 0 && (
            <Card>
              <div style={{ color: "#0B7A59", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                No pending payments.
              </div>
            </Card>
          )}
        </div>
      </div>
      <div>
        <SH title="Payment History" />
        <p style={{ marginTop: -8, marginBottom: 12, color: "#748391", fontSize: 12 }}>
          Completed payments, newest first.
        </p>
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-[13px]">
              <thead style={{ background: "#6892D5" }}>
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
                        color: "#fff",
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
                {resolvedPayments.map((p, i) => (
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
                          fontFamily: "'Josefin Sans',sans-serif",
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
                        {p.status === "Rejected" && p.rejectionDeadline && (
                          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, whiteSpace: "nowrap" }}>
                            Resubmit in <Countdown hours={0} id={`buyer-reject-${p.id}`} expiresAt={p.rejectionDeadline} />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <SecondaryBtn size="sm" onClick={() => setTxDetail(p)}>
                          View Details
                        </SecondaryBtn>
                      </td>
                    </tr>
                  ))}
                {resolvedPayments.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 28, textAlign: "center", color: "#748391", fontSize: 12 }}>
                      No resolved payments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {txDetail && (
        <TransactionDetailModal
          tx={txDetail}
          onClose={() => setTxDetail(null)}
        />
      )}
      {payTarget && (
        <PaymentSubmitModal
          item={payTarget}
          contactPrefill={user.fb || ""}
          onConfirm={(method, referenceNumber, receipt, details) =>
            handlePayment(payTarget, method, referenceNumber, receipt, details)
          }
          onClose={() => setPayTarget(null)}
        />
      )}
      {paymentSuccess && (
        <PaymentSuccessToast onClose={() => setPaymentSuccess(false)} />
      )}
    </div>
  )
}
