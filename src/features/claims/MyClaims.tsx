import { useEffect, useState } from "react"
import { List, LayoutGrid, AlertTriangle, Link2 } from "lucide-react"
import type { ClaimRow, OrderRow, PayHistRow, ClaimStatus, SharedState } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import {
  Modal,
  Card,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  ProductThumb,
  StatusBadge,
  Countdown,
  TrackOrderModal,
  BuyerProfileModal,
  ExtensionRequestModal,
  PaymentSuccessToast,
} from "@/components/shared"
import { PaymentSubmitModal, type PaymentSubmissionDetails } from "@/features/payments"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import { claimIsPayable } from "./claimExpiry"

type OrderReceivedStatus = "Pending" | "Verified" | "Expired" | "Rejected" | "Cancelled"
type OrderReceivedFilter = OrderReceivedStatus | "All"

function orderReceivedStatus(claim: ClaimRow, payHistory: PayHistRow[]): OrderReceivedStatus {
  if (claim.status === "Paid and Reserved") return "Verified"
  if (claim.status === "Insufficient Payment") return "Pending"
  const rejectedPayment = payHistory.some(
    (payment) =>
      payment.product === claim.product &&
      payment.batch === claim.batch &&
      payment.status === "Rejected",
  )
  if (rejectedPayment) return "Rejected"
  if (claim.status === "Pending" || claim.status === "Expired" || claim.status === "Cancelled") {
    return claim.status
  }
  return "Pending"
}

export default function MyClaims({
  claims,
  setClaims,
  toPay,
  setToPay,
  payHistory,
  setPayHistory,
  orders,
  setOrders,
  batches,
  setBatches,
  user,
  role,
  setTab,
  refreshData,
}: SharedState) {
  const [filter, setFilter] = useState<ClaimStatus | "All">("All")
  const [payTarget, setPayTarget] = useState<ClaimRow | null>(null)
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null)
  const [extTarget, setExtTarget] = useState<ClaimRow | null>(null)
  const [contact, setContact] = useState<ClaimRow | null>(null)
  const [orderFilter, setOrderFilter] = useState<OrderReceivedFilter>("All")
  const [buyerProfile, setBuyerProfile] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<ClaimRow | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  useEffect(() => {
    if (!paymentSuccess) return
    const timer = window.setTimeout(() => setPaymentSuccess(false), 6000)
    return () => window.clearTimeout(timer)
  }, [paymentSuccess])
  useEffect(() => {
    if (!payTarget) return
    const current = claims.find((claim) => claim.id === payTarget.id)
    if (!current || !claimIsPayable(current)) setPayTarget(null)
  }, [claims, payTarget])
  const filters: (ClaimStatus | "All")[] = [
    "All",
    "Awaiting Verification",
    "Paid and Reserved",
    "Expired",
    "Cancelled",
  ]
  // Payable claims (fresh "Pending" or "Insufficient Payment") live ONLY in the
  // upper "My Claims To Pay" table. The filtered table below never shows a
  // payable row, so there's exactly one place to pay from.
  const claimsToPay = claims.filter(claimIsPayable)

  const nonPayableClaims = claims.filter((c) => !claimIsPayable(c))
  const filtered =
    filter === "All"
      ? nonPayableClaims
      : nonPayableClaims.filter((c) => c.status === filter)

  const [fbToast, setFbToast] = useState<string | null>(null)

  if (role === "Seller") {
    const ordFiltered =
      orderFilter === "All"
        ? claims
        : claims.filter((claim) => orderReceivedStatus(claim, payHistory) === orderFilter)
    const orderFilters: OrderReceivedFilter[] = [
      "All",
      "Pending",
      "Verified",
      "Expired",
      "Rejected",
      "Cancelled",
    ]
    return (
      <div className="seller-orders-page">
        {fbToast && (
          <div
            className="fi"
            style={{
              position: "fixed",
              top: 72,
              right: 20,
              zIndex: 9999,
              background: "#111827",
              color: "#fff",
              borderRadius: 9,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 500,
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Link2 size={15} aria-hidden="true" /> Opening {fbToast}'s Facebook profile…
          </div>
        )}
        <button
          type="button"
          onClick={() => setTab("Dashboard")}
          className="seller-orders-back"
        >
          Back to Dashboard
        </button>
        <header className="seller-orders-heading">
          <h1>Orders Received</h1>
          <p>Manage orders from your buyers</p>
        </header>
        <div className="seller-orders-filters" role="group" aria-label="Filter orders by status">
          {orderFilters.map((f) => (
            <button
              key={f}
              onClick={() => setOrderFilter(f)}
              aria-pressed={orderFilter === f}
              style={{
                background: orderFilter === f ? INDIGO : "#fff",
                color: orderFilter === f ? "#fff" : "#6B7280",
                border: `1px solid ${orderFilter === f ? INDIGO : "#E5E7EB"}`,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 14px",
                transition: "all 0.15s",
                fontFamily: "'Quicksand',sans-serif",
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="seller-orders-table-wrap">
          <div className="seller-orders-table-scroll">
          <table className="seller-orders-table">
            <colgroup>
              <col className="seller-orders-col-buyer" />
              <col className="seller-orders-col-product" />
              <col className="seller-orders-col-method" />
              <col className="seller-orders-col-amount" />
              <col className="seller-orders-col-paid" />
              <col className="seller-orders-col-deadline" />
              <col className="seller-orders-col-status" />
              <col className="seller-orders-col-actions" />
            </colgroup>
            <thead>
              <tr>
                {[
                  "BUYER",
                  "PRODUCT",
                  "METHOD",
                  "AMOUNT",
                  "AMOUNT PAID",
                  "DEADLINE",
                  "STATUS",
                  "ACTIONS",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordFiltered.map((c, i) => {
                const status = orderReceivedStatus(c, payHistory)
                const payment = payHistory.find(
                  (entry) =>
                    entry.product === c.product &&
                    entry.batch === c.batch &&
                    (entry.status === c.status ||
                      (c.status === "Pending" &&
                        (entry.status === "Insufficient Payment" || entry.status === "Rejected"))),
                )
                const amountPaid = status === "Verified"
                  ? c.amount
                  : status === "Pending" && payment && payment.status !== "Rejected" && payment.amount < c.amount
                    ? payment.amount
                    : 0
                const underpaid = amountPaid > 0 && amountPaid < c.amount
                const statusStyles: Record<OrderReceivedStatus, { background: string; color: string; dot: string; borderColor: string }> = {
                  Pending: { background: "#fff5cc", color: "#c98f00", dot: "#f0b400", borderColor: "#f0b400" },
                  Verified: { background: "#c8f5e4", color: "#0a8f6a", dot: "#2cc9a0", borderColor: "#2cc9a0" },
                  Expired: { background: "#ffe4e8", color: "#d9273f", dot: "#d9273f", borderColor: "#d9273f" },
                  Rejected: { background: "#ffe4e8", color: "#d9273f", dot: "#d9273f", borderColor: "#d9273f" },
                  Cancelled: { background: "#ccc", color: "#555", dot: "#777", borderColor: "#777" },
                }
                const badge = statusStyles[status]
                return (
                <tr
                  key={c.id}
                  className={i % 2 ? "seller-orders-row seller-orders-row--alt" : "seller-orders-row"}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={c.buyer || c.seller} size={22} />
                      <button
                        onClick={() => setBuyerProfile(c.buyer || c.seller)}
                        className="seller-orders-buyer"
                      >
                        {c.buyer || c.seller}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <ProductThumb name={c.product} />
                      <span>{c.product}</span>
                    </div>
                  </td>
                  <td className="seller-orders-method">{payment?.method || "—"}</td>
                  <td className="seller-orders-amount">
                    ₱{c.amount.toLocaleString()}
                  </td>
                  <td className="seller-orders-paid">
                    {amountPaid > 0 ? (
                      <>
                        <span className={underpaid ? "seller-orders-paid--short" : ""}>
                          ₱{amountPaid.toLocaleString()}
                        </span>
                        {underpaid && <small>Short ₱{(c.amount - amountPaid).toLocaleString()}</small>}
                      </>
                    ) : <span className="seller-orders-dash">—</span>}
                  </td>
                  <td className="seller-orders-deadline">
                    {c.status === "Pending" && c.hours > 0 ? (
                      <Countdown hours={c.hours} expiresAt={c.expiresAt} />
                    ) : (
                      <span className="seller-orders-dash">—</span>
                    )}
                  </td>
                  <td className="seller-orders-status-cell">
                    <span className="seller-orders-status" style={{ background: badge.background, color: badge.color, borderColor: badge.borderColor }}>
                      <span style={{ background: badge.dot }} />{status}
                    </span>
                    {status === "Pending" && underpaid && <small>Awaiting balance</small>}
                  </td>
                  <td>
                    <div className="seller-orders-actions">
                      <button className="seller-orders-review" onClick={() => setReviewTarget(c)}>Review</button>
                      {status === "Pending" && (
                        <button
                          className="seller-orders-contact"
                          onClick={() => {
                          const buyerName = c.buyer || c.seller
                          if (c.buyerFb) {
                            // Real contact link on file — open it.
                            setFbToast(buyerName)
                            setTimeout(() => {
                              window.open(
                                c.buyerFb,
                                "_blank",
                                "noopener,noreferrer",
                              )
                              setFbToast(null)
                            }, 1200)
                          } else {
                            // No contact link — open the buyer's profile instead
                            // of fabricating a Facebook URL.
                            setBuyerProfile(buyerName)
                          }
                          }}
                        >Contact Buyer</button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          </div>
          {ordFiltered.length === 0 && (
            <div className="seller-orders-empty">
              No orders found.
            </div>
          )}
        </div>
        {buyerProfile && (
          <BuyerProfileModal
            buyer={buyerProfile}
            onClose={() => setBuyerProfile(null)}
          />
        )}
        {reviewTarget && (
          <Modal
            title="Order details"
            onClose={() => setReviewTarget(null)}
            width={420}
          >
            <div className="seller-order-details">
              <strong>{reviewTarget.product}</strong>
              <span>{reviewTarget.batch}</span>
              <dl>
                <div><dt>Buyer</dt><dd>{reviewTarget.buyer || reviewTarget.seller}</dd></div>
                <div><dt>Quantity</dt><dd>{reviewTarget.qty}</dd></div>
                <div><dt>Amount</dt><dd>₱{reviewTarget.amount.toLocaleString()}</dd></div>
                <div><dt>Status</dt><dd>{orderReceivedStatus(reviewTarget, payHistory)}</dd></div>
                <div><dt>Deadline</dt><dd>{reviewTarget.status === "Pending" && reviewTarget.hours > 0 ? `${reviewTarget.hours}h` : "—"}</dd></div>
              </dl>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <SecondaryBtn onClick={() => setReviewTarget(null)}>Close</SecondaryBtn>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  const handlePay = async (
    method: string,
    refNo: string,
    receipt: File | undefined,
    details: PaymentSubmissionDetails,
  ) => {
    if (!payTarget) return
    const currentClaim = claims.find((claim) => claim.id === payTarget.id)
    if (!currentClaim || !claimIsPayable(currentClaim)) {
      setPayTarget(null)
      alert("This claim has expired and can no longer be paid.")
      return
    }
    if (isSupabaseConfigured) {
      try {
        await kargoApi.submitPayment({
          orderId: String(payTarget.id),
          method,
          amount: details.amountPaid,
          referenceNumber: refNo,
          receipt,
          payerAccountName: details.payerAccountName,
          payerPhone: details.payerPhone,
          buyerContactUrl: details.buyerContactUrl,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to submit payment."
        // Re-sync the client snapshot on ANY failure so a stale `claims`
        // snapshot can't send a second doomed submit. Without this refresh the
        // guard `claimIsPayable` keeps reading the pre-failure "Pending" row,
        // which is what made proof-of-payment fail "every other time".
        await refreshData()
        // Close the modal so the reused stale `payTarget` can't be resubmitted.
        setPayTarget(null)
        if (message === "Order is not payable") {
          alert(
            "This order already has a submitted payment or is no longer payable. Your payment data has been refreshed.",
          )
        } else {
          alert(message)
        }
        return
      }
      await refreshData()
      setPayTarget(null)
      setPaymentSuccess(true)
      return
    }
    const newHist: PayHistRow = {
      id: payHistory.length + 1,
      product: payTarget.product,
      batch: payTarget.batch,
      method,
      amount: details.amountPaid,
      date: TODAY,
      status: isSupabaseConfigured ? "Pending" : "Paid and Reserved",
      referenceNumber: refNo || undefined,
      payerAccountName: details.payerAccountName,
      payerPhone: details.payerPhone,
      buyerContactUrl: details.buyerContactUrl,
    }
    setPayHistory((h) => [newHist, ...h])
    if (!isSupabaseConfigured) setClaims((prev) =>
      prev.map((c) =>
        c.id === payTarget.id
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    if (!isSupabaseConfigured) setToPay((prev) => prev.filter((t) => t.product !== payTarget.product))
    const newOrder: OrderRow = {
      id: `ORD-2026-${String(orders.length + 60).padStart(4, "0")}`,
      product: payTarget.product,
      batch: payTarget.batch,
      seller: payTarget.seller,
      amount: payTarget.amount,
      step: 3,
      trackingNo: null,
      eta: "Est. Oct 2026",
    }
    if (!isSupabaseConfigured) setOrders((prev) => [newOrder, ...prev])
    setPayTarget(null)
    setPaymentSuccess(true)
  }

  return (
    <div className="p-6">
      {claimsToPay.length > 0 && (
        <>
          <h2
            style={{
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 20,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 14,
            }}
          >
            My Claims To Pay
          </h2>
          <Card className="!p-0 overflow-hidden mb-3">
            <div style={{ overflowX: "auto" }}>
              <table className="w-full text-[13px]">
                <thead style={{ background: "#6892D5" }}>
                  <tr>
                    {["Product", "Seller", "Deadline", "Amount", "Actions"].map((h) => (
                      <th
                        key={h}
                        style={{
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 11,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          padding: "12px 14px",
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
                  {claimsToPay.map((t, i) => (
                    <tr key={t.id} style={{ background: i % 2 ? "#FAFAFA" : "#fff" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex items-center gap-2.5">
                          <ProductThumb name={t.product} />
                          <span style={{ fontWeight: 700, color: "#111827" }}>{t.product}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex items-center gap-1.5">
                          <Avatar name={t.seller} size={20} />
                          <span style={{ fontSize: 12, color: "#374151" }}>{t.seller}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <Countdown hours={t.hours} expiresAt={t.expiresAt} />
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          fontWeight: 700,
                          color: "#111827",
                          fontFamily: "'Josefin Sans',sans-serif",
                        }}
                      >
                        ₱{t.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <PrimaryBtn
                          size="sm"
                          onClick={() => setPayTarget(t)}
                        >
                          Pay Now
                        </PrimaryBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div
            className="flex items-center justify-end gap-4 mb-6"
            style={{
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 4px 14px rgba(18,30,71,0.08)",
              padding: "14px 20px",
            }}
          >
            <strong style={{ color: INDIGO, fontSize: 13, fontWeight: 700, marginRight: "auto" }}>
              TOTAL DUE:
            </strong>
            <span
              style={{
                color: INDIGO,
                fontSize: 18,
                fontWeight: 800,
                fontFamily: "'Josefin Sans',sans-serif",
              }}
            >
              ₱{claimsToPay.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
            </span>
            <PrimaryBtn size="sm">Batch Checkout</PrimaryBtn>
          </div>
        </>
      )}

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? INDIGO : "#fff",
              color: filter === f ? "#fff" : "#6B7280",
              border: `1px solid ${filter === f ? INDIGO : "#E5E7EB"}`,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 14px",
              transition: "all 0.15s",
              fontFamily: "'Josefin Sans',sans-serif",
              cursor: "pointer",
            }}
          >
            {f}
            {f !== "All" && (
              <span
                style={{
                  marginLeft: 6,
                  background:
                    filter === f ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                  borderRadius: 999,
                  padding: "0 5px",
                  fontSize: 10,
                }}
              >
                {claims.filter((c) => c.status === f).length}
              </span>
            )}
          </button>
        ))}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 0,
            border: "1px solid #E5E7EB",
            borderRadius: 7,
            overflow: "hidden",
          }}
        >
          {(["table", "card"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: viewMode === m ? INDIGO : "#fff",
                color: viewMode === m ? "#fff" : "#6B7280",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {m === "table" ? (
                  <><List size={13} aria-hidden="true" /> Table</>
                ) : (
                  <><LayoutGrid size={13} aria-hidden="true" /> Cards</>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {viewMode === "card" ? (
        <>
          {filtered.length === 0 && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              No {filter.toLowerCase()} claims found.
            </div>
          )}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(2,1fr)" }}
          >
            {filtered.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start gap-3">
                  <ProductThumb name={c.product} />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Josefin Sans',sans-serif",
                      }}
                    >
                      {c.product}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}
                    >
                      {c.batch}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}
                    >
                      Seller: {c.seller}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                {c.status === "Pending" && c.hours > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 10px",
                      background: CREAM,
                      borderRadius: 7,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "#6B7280",
                        fontWeight: 500,
                      }}
                    >
                      Time remaining
                    </span>
                    <Countdown hours={c.hours} expiresAt={c.expiresAt} />
                  </div>
                )}
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#111827",
                      fontFamily: "'Josefin Sans',sans-serif",
                    }}
                  >
                    ₱{c.amount.toLocaleString()}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {claimIsPayable(c) && (
                      <PrimaryBtn size="sm" onClick={() => claimIsPayable(c) && setPayTarget(c)}>
                        Pay Now
                      </PrimaryBtn>
                    )}
                    {c.status === "Pending" && !c.extensionRequested && (
                      <SecondaryBtn size="sm" onClick={() => setExtTarget(c)}>
                        Extend
                      </SecondaryBtn>
                    )}
                    {c.extensionRequested && (
                      <span
                        style={{
                          fontSize: 10,
                          background: "#EEF0FF",
                          color: INDIGO,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 999,
                        }}
                      >
                        Extension Requested
                      </span>
                    )}
                    {c.status === "Paid and Reserved" && (
                      <SecondaryBtn
                        size="sm"
                        onClick={() => {
                          const o = orders.find(
                            (o) => o.product === c.product,
                          ) || {
                            id: `ORD-${c.id}`,
                            product: c.product,
                            batch: c.batch,
                            seller: c.seller,
                            amount: c.amount,
                            step: 3,
                            trackingNo: null,
                            eta: "Est. Oct 2026",
                            rated: false,
                          }
                          setViewOrder(o)
                        }}
                      >
                        View Order
                      </SecondaryBtn>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: "#6892D5" }}>
              <tr>
                {[
                  "Product",
                  "Batch",
                  "Seller",
                  "Qty",
                  "Amount",
                  "Status",
                  "Deadline",
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
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={c.id}
                  style={{
                    borderTop: "1px solid #F3F4F6",
                    background: i % 2 ? "#FAFAFA" : "#fff",
                  }}
                  className="hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-2.5">
                      <ProductThumb name={c.product} />
                      <span style={{ fontWeight: 500, color: "#111827" }}>
                        {c.product}
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
                    {c.batch}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-1.5">
                      <Avatar name={c.seller} size={20} />
                      <span style={{ fontSize: 12, color: "#374151" }}>
                        {c.seller}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#374151",
                      fontSize: 12,
                    }}
                  >
                    ×{c.qty}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Josefin Sans',sans-serif",
                    }}
                  >
                    ₱{c.amount.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {c.status === "Pending" && c.hours > 0 ? (
                      <Countdown hours={c.hours} expiresAt={c.expiresAt} />
                    ) : (
                      <span style={{ color: "#D1D5DB" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {claimIsPayable(c) && (
                        <PrimaryBtn size="sm" onClick={() => claimIsPayable(c) && setPayTarget(c)}>
                          Pay Now
                        </PrimaryBtn>
                      )}
                      {c.status === "Pending" &&
                        (c.extensionRequested ? (
                          <span
                            style={{
                              background: "#FEF3C7",
                              color: "#92400E",
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: 999,
                            }}
                          >
                            Requested
                          </span>
                        ) : (
                          <SecondaryBtn
                            size="sm"
                            onClick={() => setExtTarget(c)}
                          >
                            Request Extension
                          </SecondaryBtn>
                        ))}
                      {c.status === "Paid and Reserved" && (
                        <SecondaryBtn
                          size="sm"
                          onClick={() => {
                            const o = orders.find(
                              (o) => o.product === c.product,
                            ) || {
                              id: `ORD-${c.id}`,
                              product: c.product,
                              batch: c.batch,
                              seller: c.seller,
                              amount: c.amount,
                              step: 3,
                              trackingNo: null,
                              eta: "Est. Oct 2026",
                              rated: false,
                            }
                            setViewOrder(o)
                          }}
                        >
                          View Order
                        </SecondaryBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {filtered.length === 0 && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              No {filter.toLowerCase()} claims found.
            </div>
          )}
        </Card>
      )}
      {payTarget && (
        <PaymentSubmitModal
          item={{
            id: payTarget.id,
            orderId: String(payTarget.id),
            product: payTarget.product,
            seller: payTarget.seller,
            sellerId: payTarget.sellerId,
            qty: payTarget.qty,
            amount: payTarget.amount,
            hours: payTarget.hours,
          }}
          contactPrefill={user.fb || ""}
          onConfirm={(method, refNo, receipt, details) => handlePay(method, refNo, receipt, details)}
          onClose={() => setPayTarget(null)}
        />
      )}
      {viewOrder && (
        <TrackOrderModal order={viewOrder} onClose={() => setViewOrder(null)} />
      )}
      {extTarget && (
        <ExtensionRequestModal
          claim={extTarget}
          onSubmit={async (hours, reason) => {
            if (isSupabaseConfigured) {
              try {
                await kargoApi.requestOrderExtension(String(extTarget.id), hours, reason)
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unable to request extension.")
                return
              }
            }
            setClaims((prev) =>
              prev.map((c) =>
                c.id === extTarget.id ? { ...c, extensionRequested: true } : c,
              ),
            )
            setExtTarget(null)
          }}
          onClose={() => setExtTarget(null)}
        />
      )}
      {paymentSuccess && <PaymentSuccessToast onClose={() => setPaymentSuccess(false)} />}
    </div>
  )
}
