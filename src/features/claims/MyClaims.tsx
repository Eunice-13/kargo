import { useEffect, useRef, useState, type SetStateAction } from "react"
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
  BuyerProfileModal,
  ExtensionRequestModal,
  PaymentSuccessToast,
} from "@/components/shared"
import {
  BatchCheckoutModal,
  PaymentSubmitModal,
  InsufficientPaymentModal,
  RejectPaymentModal,
  ReviewSubmissionModal,
  type VerifyItem,
  type PaymentSubmissionDetails,
} from "@/features/payments"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { kargoApi } from "@/services"
import { claimIsPayable } from "./claimExpiry"
import { reconcileRejectedClaim } from "./claimPaymentState"
import { navIntent } from "@/state/navIntent"

type OrderReceivedStatus = "Pending" | "Awaiting Verification" | "Verified" | "Expired" | "Cancelled"
type OrderReceivedFilter = OrderReceivedStatus | "All"

function paymentMatchesClaim(payment: PayHistRow, claim: ClaimRow) {
  return payment.orderId
    ? String(payment.orderId) === String(claim.id)
    : payment.product === claim.product && payment.batch === claim.batch
}

function orderReceivedStatus(claim: ClaimRow, payHistory: PayHistRow[]): OrderReceivedStatus {
  if (claim.status === "Paid and Reserved") return "Verified"
  if (claim.status === "Insufficient Payment") return "Pending"
  if (claim.status === "Awaiting Verification") return "Awaiting Verification"
  if (claim.status === "Pending" || claim.status === "Expired" || claim.status === "Cancelled") {
    return claim.status
  }
  return "Pending"
}

function newestFirst<T extends { id: string | number; createdAt?: string }>(
  left: T,
  right: T,
) {
  const leftTime = left.createdAt
    ? new Date(left.createdAt).getTime()
    : Number(left.id) || 0
  const rightTime = right.createdAt
    ? new Date(right.createdAt).getTime()
    : Number(right.id) || 0
  return rightTime - leftTime
}

function paidAt(claim: ClaimRow, payHistory: PayHistRow[]) {
  if (claim.status !== "Paid and Reserved") return undefined
  return payHistory
    .filter(
      (payment) =>
        paymentMatchesClaim(payment, claim) &&
        payment.status === "Paid and Reserved" &&
        payment.submittedAt,
    )
    .reduce((latest, payment) => {
      const timestamp = new Date(payment.submittedAt as string).getTime()
      return timestamp > latest ? timestamp : latest
    }, 0)
}

function hasRejectedPayment(claim: ClaimRow, payHistory: PayHistRow[]) {
  return payHistory.some(
    (payment) =>
      paymentMatchesClaim(payment, claim) &&
      payment.status === "Rejected",
  )
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
  const [showBatchCheckout, setShowBatchCheckout] = useState(navIntent.openBatchCheckout)
  useEffect(() => { navIntent.openBatchCheckout = false }, [])
  const [filter, setFilter] = useState<ClaimStatus | "All">("All")
  const [payTarget, setPayTarget] = useState<ClaimRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ClaimRow | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null)
  const [extTarget, setExtTarget] = useState<ClaimRow | null>(null)
  const [contact, setContact] = useState<ClaimRow | null>(null)
  const [orderFilter, setOrderFilter] = useState<OrderReceivedFilter>(() => {
    const requestedFilter = navIntent.orderFilter ?? "All"
    navIntent.orderFilter = null
    return requestedFilter
  })
  const [buyerProfile, setBuyerProfile] = useState<string | null>(null)
  const [orderDetailTarget, setOrderDetailTarget] = useState<ClaimRow | null>(null)
  const [sellerPayments, setSellerPayments] = useState<VerifyItem[]>([])
  const [paymentReviewTarget, setPaymentReviewTarget] = useState<VerifyItem | null>(null)
  const [paymentRejectTarget, setPaymentRejectTarget] = useState<VerifyItem | null>(null)
  const [paymentRejectReason, setPaymentRejectReason] = useState("")
  const [paymentRejectCustom, setPaymentRejectCustom] = useState("")
  const [insufficientTarget, setInsufficientTarget] = useState<VerifyItem | null>(null)
  const [insufficientAmount, setInsufficientAmount] = useState("")
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
    const effective = current
      ? reconcileRejectedClaim(current, payHistory)
      : undefined
    if (!effective || !claimIsPayable(effective)) setPayTarget(null)
  }, [claims, payHistory, payTarget])
  useEffect(() => {
    setClaims((current) => {
      let changed = false
      const next = current.map((claim) => {
        const reconciled = reconcileRejectedClaim(claim, payHistory)
        if (reconciled !== claim) changed = true
        return reconciled
      })
      return changed ? next : current
    })
  }, [payHistory, setClaims])
  useEffect(() => {
    if (role !== "Seller") return
    kargoApi
      .loadSellerPaymentSubmissions()
      .then(setSellerPayments)
      .catch((error) =>
        alert(error instanceof Error ? error.message : "Unable to load payment submissions."),
      )
  }, [role])

  // New buyer submissions — including resubmissions after a rejection —
  // show up without a manual reload, so reviewing a repeat submission works
  // exactly like the first one.
  useEffect(() => {
    if (!isSupabaseConfigured || role !== "Seller" || !supabase || !user.id) return
    const channel = supabase
      .channel(`seller-payment-submissions-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payments" },
        () => {
          kargoApi
            .loadSellerPaymentSubmissions()
            .then(setSellerPayments)
            .catch(() => {})
        },
      )
      .subscribe()
    return () => {
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [role, user.id, isSupabaseConfigured, supabase])

  // Buyers live-sync when the seller acts on a payment: rejection flips the
  // order back to "Pending" (payable again) and adds a "Rejected" row to the
  // payment history. Both must appear without a manual refresh, and a mount
  // refresh covers rejections that landed while another tab was open.
  useEffect(() => {
    if (!isSupabaseConfigured || role !== "Buyer" || !supabase || !user.id) return
    const refresh = () => void refreshData().catch(() => {})
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    refresh()
    const channel = supabase
      .channel(`buyer-claims-payments-${user.id}`)
      .on(
        "postgres_changes",
        // RLS already limits buyers to their own order payments. Avoid a WAL
        // column filter here: depending on replica identity it can miss an
        // UPDATE that only changes review fields such as status/reason.
        { event: "UPDATE", schema: "public", table: "payments" },
        refresh,
      )
      .subscribe()
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refreshWhenVisible)
    const fallbackTimer = window.setInterval(refreshWhenVisible, 15_000)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
      window.clearInterval(fallbackTimer)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [refreshData, role, user.id, isSupabaseConfigured, supabase])

  const sellerPaymentsRef = useRef<VerifyItem[]>(sellerPayments)
  sellerPaymentsRef.current = sellerPayments

  const updateSellerPayments = (action: SetStateAction<VerifyItem[]>) => {
    // Diff against the current list OUTSIDE the state updater: the updater
    // must stay pure (React may invoke it more than once), and the review
    // RPC must never fire from inside it.
    const previous = sellerPaymentsRef.current
    const next = typeof action === "function" ? action(previous) : action
    if (isSupabaseConfigured) {
      for (const item of next) {
        const before = previous.find((candidate) => candidate.id === item.id)
        if (!before || before.status === item.status) continue
        if (item.status !== "Verified" && item.status !== "Rejected") continue
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
            item.status === "Verified" ? "verified" : "rejected",
            item.rejectReason,
            deadlineHours,
          )
          .then(
            () => {
              void refreshData().catch(() => {})
              kargoApi
                .loadSellerPaymentSubmissions()
                .then(setSellerPayments)
                .catch(() => {})
            },
            (error) => {
              alert(error instanceof Error ? error.message : "Unable to review payment.")
              // Roll back the optimistic update so the list matches the server.
              setSellerPayments((current) =>
                current.map((candidate) =>
                  candidate.id === item.id ? before : candidate,
                ),
              )
            },
          )
      }
    }
    sellerPaymentsRef.current = next
    setSellerPayments(next)
  }
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
  const reconciledClaims = claims.map((claim) =>
    reconcileRejectedClaim(claim, payHistory),
  )
  const claimsToPay = reconciledClaims.filter(claimIsPayable).sort(newestFirst)

  const nonPayableClaims = reconciledClaims.filter((c) => !claimIsPayable(c)).sort((left, right) => {
    // "Awaiting Verification" — proof submitted, awaiting the seller's
    // decision — stays pinned at the top of the list (newest first among
    // themselves) so the buyer always sees where their payment stands.
    const leftAwaiting = left.status === "Awaiting Verification"
    const rightAwaiting = right.status === "Awaiting Verification"
    if (leftAwaiting && !rightAwaiting) return -1
    if (rightAwaiting && !leftAwaiting) return 1
    const leftPaidAt = paidAt(left, payHistory)
    const rightPaidAt = paidAt(right, payHistory)
    const leftTime = leftPaidAt || (left.createdAt ? new Date(left.createdAt).getTime() : Number(left.id) || 0)
    const rightTime = rightPaidAt || (right.createdAt ? new Date(right.createdAt).getTime() : Number(right.id) || 0)
    return rightTime - leftTime
  })
  const filtered =
    filter === "All"
      ? nonPayableClaims
      : nonPayableClaims.filter((c) => c.status === filter)

  const [fbToast, setFbToast] = useState<string | null>(null)

  const handleCancelClaim = async () => {
    if (!cancelTarget || cancelling) return

    const currentClaim = claims.find((claim) => claim.id === cancelTarget.id)
    if (!currentClaim || currentClaim.status !== "Pending") {
      setCancelTarget(null)
      if (isSupabaseConfigured) await refreshData()
      alert("This claim is no longer pending and cannot be cancelled.")
      return
    }

    setCancelling(true)
    try {
      if (isSupabaseConfigured) {
        await kargoApi.cancelOrder(String(currentClaim.id))
        await refreshData()
      } else {
        setClaims((previous) =>
          previous.map((claim) =>
            claim.id === currentClaim.id
              ? { ...claim, status: "Cancelled" as ClaimStatus }
              : claim,
          ),
        )
        setToPay((previous) =>
          previous.filter((payment) => {
            const sameOrder =
              String(payment.orderId ?? payment.id) === String(currentClaim.id)
            const sameLegacyClaim =
              !payment.orderId &&
              payment.product === currentClaim.product &&
              payment.seller === currentClaim.seller
            return !sameOrder && !sameLegacyClaim
          }),
        )
        setBatches((previous) =>
          previous.map((batch) => {
            if (batch.title !== currentClaim.batch) return batch

            return {
              ...batch,
              claimed: Math.max(0, batch.claimed - currentClaim.qty),
              products: batch.products.map((product) => {
                const matchesProduct = currentClaim.productId
                  ? product.dbId === currentClaim.productId
                  : product.name === currentClaim.product

                return matchesProduct
                  ? {
                      ...product,
                      claimed: Math.max(0, product.claimed - currentClaim.qty),
                    }
                  : product
              }),
            }
          }),
        )
      }
      setCancelTarget(null)
    } catch (error) {
      await refreshData()
      alert(error instanceof Error ? error.message : "Unable to cancel claim.")
    } finally {
      setCancelling(false)
    }
  }

  if (role === "Seller") {
    const paymentForOrder = (claim: ClaimRow) =>
      sellerPayments.find((payment) => String(payment.orderId) === String(claim.id))
    const statusForOrder = (claim: ClaimRow): OrderReceivedStatus => {
      const payment = paymentForOrder(claim)
      if (payment?.status === "Verified") return "Verified"
      if (payment?.status === "Pending") return "Awaiting Verification"
      // A rejection closes that proof, not the order. The order immediately
      // returns to the buyer's payable queue and remains pending for the seller.
      if (payment?.status === "Rejected") return "Pending"
      return orderReceivedStatus(claim, payHistory)
    }
    const orderReceivedSort = (left: ClaimRow, right: ClaimRow) => {
      const leftStatus = statusForOrder(left)
      const rightStatus = statusForOrder(right)
      if (leftStatus === "Pending" && rightStatus !== "Pending") return -1
      if (rightStatus === "Pending" && leftStatus !== "Pending") return 1
      const leftPaymentTime = paymentForOrder(left)?.submittedAt
        ? new Date(paymentForOrder(left)!.submittedAt!).getTime()
        : 0
      const rightPaymentTime = paymentForOrder(right)?.submittedAt
        ? new Date(paymentForOrder(right)!.submittedAt!).getTime()
        : 0
      const leftTime = leftPaymentTime || (left.createdAt ? new Date(left.createdAt).getTime() : Number(left.id) || 0)
      const rightTime = rightPaymentTime || (right.createdAt ? new Date(right.createdAt).getTime() : Number(right.id) || 0)
      return rightTime - leftTime
    }
    const ordFiltered =
      orderFilter === "All"
        ? [...claims].sort(orderReceivedSort)
        : claims
            .filter((claim) => statusForOrder(claim) === orderFilter)
            .sort(orderReceivedSort)
    const orderFilters: OrderReceivedFilter[] = [
      "All",
      "Pending",
      "Awaiting Verification",
      "Verified",
      "Expired",
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
                const submission = paymentForOrder(c)
                const status = statusForOrder(c)
                const amountPaid = submission?.amountPaid
                  && submission.status !== "Rejected"
                  ? Number(submission.amountPaid)
                  : status === "Verified"
                    ? c.amount
                    : 0
                const underpaid = amountPaid > 0 && amountPaid < c.amount
                const isCashOnMeetup = submission?.method === "Cash on Meetup"
                const statusStyles: Record<OrderReceivedStatus, { background: string; color: string; dot: string; borderColor: string }> = {
                  Pending: { background: "#fff5cc", color: "#c98f00", dot: "#f0b400", borderColor: "#f0b400" },
                  "Awaiting Verification": { background: "#e0e7ff", color: "#3730a3", dot: "#6366f1", borderColor: "#6366f1" },
                  Verified: { background: "#c8f5e4", color: "#0a8f6a", dot: "#2cc9a0", borderColor: "#2cc9a0" },
                  Expired: { background: "#ffe4e8", color: "#d9273f", dot: "#d9273f", borderColor: "#d9273f" },
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
                  <td className="seller-orders-method">{submission?.method || "—"}</td>
                  <td className="seller-orders-amount">
                    ₱{c.amount.toLocaleString()}
                  </td>
                  <td className="seller-orders-paid">
                    {isCashOnMeetup ? (
                      <span className="seller-orders-dash">—</span>
                    ) : amountPaid > 0 ? (
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
                      <button
                        className="seller-orders-review"
                        onClick={() =>
                          submission
                            ? setPaymentReviewTarget(submission)
                            : setOrderDetailTarget(c)
                        }
                      >Review</button>
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
        {orderDetailTarget && (
          <Modal
            title="Order details"
            onClose={() => setOrderDetailTarget(null)}
            width={420}
          >
            <div className="seller-order-details">
              <strong>{orderDetailTarget.product}</strong>
              <span>{orderDetailTarget.batch}</span>
              <dl>
                <div><dt>Buyer</dt><dd>{orderDetailTarget.buyer || orderDetailTarget.seller}</dd></div>
                <div><dt>Quantity</dt><dd>{orderDetailTarget.qty}</dd></div>
                <div><dt>Amount</dt><dd>₱{orderDetailTarget.amount.toLocaleString()}</dd></div>
                <div><dt>Status</dt><dd>{statusForOrder(orderDetailTarget)}</dd></div>
                <div><dt>Deadline</dt><dd>{orderDetailTarget.status === "Pending" && orderDetailTarget.hours > 0 ? `${orderDetailTarget.hours}h` : "—"}</dd></div>
              </dl>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <SecondaryBtn onClick={() => setOrderDetailTarget(null)}>Close</SecondaryBtn>
            </div>
          </Modal>
        )}
        {paymentReviewTarget && (
          <ReviewSubmissionModal
            reviewTarget={paymentReviewTarget}
            setReviewTarget={setPaymentReviewTarget}
            setVerifyItems={updateSellerPayments}
            setRejectTarget={setPaymentRejectTarget}
            setRejectReason={setPaymentRejectReason}
            setRejectCustom={setPaymentRejectCustom}
            onNotifyBuyer={async (item) => {
              if (item.status === "Rejected") {
                if (isSupabaseConfigured) {
                  await kargoApi.notifyPaymentResubmission(String(item.id))
                }
                setSellerPayments((items) =>
                  items.map((candidate) =>
                    candidate.id === item.id
                      ? { ...candidate, buyerNotified: true }
                      : candidate,
                  ),
                )
                setPaymentReviewTarget((current) =>
                  current?.id === item.id
                    ? { ...current, buyerNotified: true }
                    : current,
                )
                return
              }
              setInsufficientTarget(item)
              setInsufficientAmount(item.amountPaid || "")
              setPaymentReviewTarget(null)
            }}
            onMarkPaid={(item) => {
              updateSellerPayments((items) =>
                items.map((candidate) =>
                  candidate.id === item.id
                    ? { ...candidate, status: "Verified" as const }
                    : candidate,
                ),
              )
              setPaymentReviewTarget(null)
            }}
          />
        )}
        {insufficientTarget && (
          <InsufficientPaymentModal
            insuffTarget={insufficientTarget}
            setInsuffTarget={setInsufficientTarget}
            insuffAmtPaid={insufficientAmount}
            setInsuffAmtPaid={setInsufficientAmount}
            setVerifyItems={updateSellerPayments}
          />
        )}
        {paymentRejectTarget && (
          <RejectPaymentModal
            rejectTarget={paymentRejectTarget}
            setRejectTarget={setPaymentRejectTarget}
            rejectReason={paymentRejectReason}
            setRejectReason={setPaymentRejectReason}
            rejectCustom={paymentRejectCustom}
            setRejectCustom={setPaymentRejectCustom}
            setInsuffTarget={setInsufficientTarget}
            setInsuffAmtPaid={setInsufficientAmount}
            setVerifyItems={updateSellerPayments}
            REJECT_REASONS={[
              "Receipt is invalid or unreadable",
              "Reference number does not match",
              "Wrong amount transferred",
              "Payment was not received",
              "Other",
            ]}
          />
        )}
      </div>
    )
  }

  const handlePay = async (
    target: ClaimRow,
    method: string,
    refNo: string,
    receipt: File | undefined,
    details: PaymentSubmissionDetails,
  ) => {
    const currentClaim = claims.find((claim) => claim.id === target.id)
    if (!currentClaim || !claimIsPayable(currentClaim)) {
      setPayTarget(null)
      alert("This claim has expired and can no longer be paid.")
      return
    }
    if (isSupabaseConfigured) {
      try {
        await kargoApi.submitPayment({
          orderId: String(target.id),
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
      return true
    }
    const newHist: PayHistRow = {
      id: payHistory.length + 1,
      orderId: String(target.id),
      submittedAt: new Date().toISOString(),
      product: target.product,
      batch: target.batch,
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
        c.id === target.id
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    if (!isSupabaseConfigured) setToPay((prev) => prev.filter((t) => t.product !== target.product))
    const newOrder: OrderRow = {
      id: `ORD-2026-${String(orders.length + 60).padStart(4, "0")}`,
      product: target.product,
      batch: target.batch,
      seller: target.seller,
      amount: target.amount,
      step: 3,
    }
    if (!isSupabaseConfigured) setOrders((prev) => [newOrder, ...prev])
    setPayTarget(null)
    setPaymentSuccess(true)
    return true
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
                        <div className="flex items-center gap-2">
                          <PrimaryBtn
                            size="sm"
                            onClick={() => setPayTarget(t)}
                          >
                            Pay Now
                          </PrimaryBtn>
                          {t.status === "Pending" && (
                            <>
                              <SecondaryBtn
                                size="sm"
                                onClick={() => setCancelTarget(t)}
                                style={{
                                  color: "#DC2626",
                                  borderColor: "#FCA5A5",
                                  background: "#FEF2F2",
                                }}
                              >
                                Cancel
                              </SecondaryBtn>
                              {hasRejectedPayment(t, payHistory) && (
                                <span
                                  style={{
                                    padding: "3px 7px",
                                    borderRadius: 999,
                                    background: "#FEF2F2",
                                    border: "1px solid #FECACA",
                                    color: "#B91C1C",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Payment Rejected
                                </span>
                              )}
                            </>
                          )}
                        </div>
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
            <PrimaryBtn size="sm" onClick={() => setShowBatchCheckout(true)}>Batch Checkout</PrimaryBtn>
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
      {showBatchCheckout && (
        <BatchCheckoutModal
          items={claimsToPay.map((claim) => ({ ...claim, orderId: String(claim.id) }))}
          contactPrefill={user.fb || ""}
          onSubmit={async (item, method, refNo, receipt, details) => {
            const claim = claimsToPay.find((candidate) => candidate.id === item.id)
            if (!claim) return false
            return handlePay(claim, method, refNo, receipt, details)
          }}
          onClose={() => setShowBatchCheckout(false)}
        />
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
          onConfirm={(method, refNo, receipt, details) => handlePay(payTarget, method, refNo, receipt, details)}
          onClose={() => setPayTarget(null)}
        />
      )}
      {cancelTarget && (
        <Modal
          title="Cancel this claim?"
          onClose={() => !cancelling && setCancelTarget(null)}
          width={420}
        >
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            Cancel your claim for <strong>{cancelTarget.product}</strong>? This
            cannot be undone, and the quantity will become available to other
            buyers.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 20,
            }}
          >
            <SecondaryBtn
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Keep Claim
            </SecondaryBtn>
            <PrimaryBtn
              onClick={handleCancelClaim}
              disabled={cancelling}
              style={{ background: "#DC2626" }}
            >
              {cancelling ? "Cancelling…" : "Cancel Claim"}
            </PrimaryBtn>
          </div>
        </Modal>
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
