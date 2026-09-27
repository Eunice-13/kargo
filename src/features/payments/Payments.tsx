import { useEffect, useState } from "react"
import type { PayHistRow, SharedState } from "@/types"
import {
  Card,
  SH,
  SecondaryBtn,
  ProductThumb,
  StatusBadge,
  Countdown,
} from "@/components/shared"
import TransactionDetailModal from "./TransactionDetailModal"
import SellerPaymentVerification from "./SellerPaymentVerification"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export default function Payments({
  payHistory,
  role,
  user,
  refreshData,
}: SharedState) {
  const [txDetail, setTxDetail] = useState<PayHistRow | null>(null)
  const resolvedPayments = payHistory
    .filter(
      (payment) =>
        payment.status === "Paid and Reserved",
    )
    .sort((left, right) => {
      const leftTime = left.submittedAt
        ? new Date(left.submittedAt).getTime()
        : Number(left.id) || 0
      const rightTime = right.submittedAt
        ? new Date(right.submittedAt).getTime()
        : Number(right.id) || 0
      return rightTime - leftTime
    })

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

  if (role === "Seller")
    return <SellerPaymentVerification view="history" />

  return (
    <div className="p-6 space-y-6">
      <div>
        <SH title="Payment History" />
        <p style={{ marginTop: -8, marginBottom: 12, color: "#748391", fontSize: 12 }}>
          Completed and rejected submissions, newest first.
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
    </div>
  )
}
