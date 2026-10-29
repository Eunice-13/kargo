import { completedPayments } from "./paymentHistory"
import { useEffect, useState } from "react"
import type { PayHistRow, SharedState } from "@/types"
import {
  Card,
  SH,
  SecondaryBtn,
  ProductThumb,
  StatusBadge,
  Countdown,
  Modal,
  useRecordFocus,
  recordKeys,
} from "@/components/shared"
import { productImageUrl } from "@/components/shared/ProductThumb"
import TransactionDetailModal from "./TransactionDetailModal"
import SellerPaymentVerification from "./SellerPaymentVerification"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { Search } from "lucide-react"

export default function Payments({
  payHistory,
  claims,
  role,
  user,
  refreshData,
}: SharedState) {
  const [txDetail, setTxDetail] = useState<PayHistRow | null>(null)
  const [photoPreview, setPhotoPreview] = useState<{
    name: string
    imageUrl?: string
  } | null>(null)
  const [searchName, setSearchName] = useState("")
  const [dateOrder, setDateOrder] = useState<"newest" | "oldest">("newest")
  // A notification can open a payment that the search box is hiding.
  useRecordFocus("Payments", () => setSearchName(""))
  const resolvedPayments = completedPayments(payHistory, claims)
  const filteredPayments = resolvedPayments
    .filter((payment) => {
      const query = searchName.trim().toLocaleLowerCase()
      const searchableDetails = [
        payment.seller,
        payment.sellerShopName,
        payment.product,
        payment.batch,
        payment.method,
        payment.amount,
        payment.date,
        payment.status,
        payment.referenceNumber,
        payment.payerAccountName,
        payment.payerPhone,
        payment.orderId,
        payment.id,
      ]
        .filter((detail) => detail != null)
        .join(" ")
        .toLocaleLowerCase()
      return !query || searchableDetails.includes(query)
    })
    .sort((left, right) => {
      const leftTime = left.submittedAt
        ? new Date(left.submittedAt).getTime()
        : new Date(left.date).getTime()
      const rightTime = right.submittedAt
        ? new Date(right.submittedAt).getTime()
        : new Date(right.date).getTime()
      const safeLeft = Number.isFinite(leftTime) ? leftTime : Number(left.id) || 0
      const safeRight = Number.isFinite(rightTime) ? rightTime : Number(right.id) || 0
      return dateOrder === "newest" ? safeRight - safeLeft : safeLeft - safeRight
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
    return <SellerPaymentVerification view="history" refreshData={refreshData} />

  return (
    <div className="p-6 space-y-6 payments-page mobile-data-page">
      <div>
        <SH title="Payment History" />
        <p style={{ marginTop: -8, marginBottom: 12, color: "#748391", fontSize: 12 }}>
          Completed payments. Search by seller, shop, or order details and sort by transaction date.
        </p>
        <div className="payment-history-controls">
          <label className="payment-history-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
              placeholder="Search seller, shop, or order details"
              aria-label="Search payment history by seller, shop, or order details"
            />
          </label>
          <select
            className="payment-history-date-sort"
            value={dateOrder}
            onChange={(event) => setDateOrder(event.target.value as "newest" | "oldest")}
            aria-label="Sort transactions by date"
          >
            <option value="newest">Latest transactions</option>
            <option value="oldest">Oldest transactions</option>
          </select>
        </div>
        <Card className="!p-0 overflow-hidden payment-history-table">
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-[13px]">
              <thead style={{ background: "#6892D5" }}>
                <tr>
                  {[
                    "Product",
                    "Batch",
                    "Seller",
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
                {filteredPayments.map((p, i) => (
                    <tr
                      key={p.id}
                      data-record-keys={recordKeys({
                        paymentId: p.id,
                        orderId: p.orderId,
                        combinedGroupId: p.combinedDeliveryGroupId,
                      })}
                      style={{
                        borderTop: "1px solid #F3F4F6",
                        background: i % 2 ? "#FAFAFA" : "#fff",
                      }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPhotoPreview({ name: p.product, imageUrl: p.imageUrl })
                            }
                            aria-label={`Enlarge photo of ${p.product}`}
                            title="Enlarge product photo"
                            style={{
                              display: "inline-flex",
                              flex: "0 0 auto",
                              padding: 0,
                              border: 0,
                              borderRadius: 8,
                              background: "transparent",
                              cursor: "zoom-in",
                            }}
                          >
                            <ProductThumb name={p.product} imageUrl={p.imageUrl} />
                          </button>
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
                      <td style={{ padding: "10px 14px", color: "#374151", fontSize: 12 }}>
                        {(() => {
                          return p.seller ? (
                            <div>
                              <div style={{ color: "#111827", fontWeight: 600 }}>
                                {p.seller}
                              </div>
                              {p.sellerShopName && (
                                <div style={{ marginTop: 2, color: "#748391", fontSize: 11 }}>
                                  {p.sellerShopName}
                                </div>
                              )}
                            </div>
                          ) : "—"
                        })()}
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
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 28, textAlign: "center", color: "#748391", fontSize: 12 }}>
                      {resolvedPayments.length === 0
                        ? "No resolved payments yet."
                        : "No payments match your search."}
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
      {photoPreview && (
        <Modal
          title={photoPreview.name}
          onClose={() => setPhotoPreview(null)}
          width={720}
          showTitleIcon={false}
        >
          <img
            src={productImageUrl(photoPreview.name, 1000, photoPreview.imageUrl)}
            alt={photoPreview.name}
            style={{
              display: "block",
              width: "100%",
              maxHeight: "72dvh",
              objectFit: "contain",
              borderRadius: 10,
              background: "#f8fafc",
            }}
          />
        </Modal>
      )}
    </div>
  )
}
