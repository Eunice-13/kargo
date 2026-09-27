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
  const [histFilter, setHistFilter] =
    useState<"All" | "Paid and Reserved" | "Rejected" | "Cancelled">("All")
  const [dateFilter2, setDateFilter2] = useState("All")
  const [txDetail, setTxDetail] = useState<PayHistRow | null>(null)

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

  if (role === "Seller") return <SellerPaymentVerification />

  return (
    <div className="p-6 space-y-6">
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
          {(["All", "Paid and Reserved", "Rejected", "Cancelled"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setHistFilter(f)}
                style={{
                  background: histFilter === f ? "#191BA9" : "#fff",
                  color: histFilter === f ? "#fff" : "#6B7280",
                  border: `1px solid ${histFilter === f ? "#191BA9" : "#E5E7EB"
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