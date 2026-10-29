import { OrderDetailsModal } from "@/features/orders"
import { BuyerCombinedDelivery, SellerCombinedDelivery } from "@/features/combined-delivery"

import { useEffect, useRef, useState, type SetStateAction } from "react"

import {
  List,
  LayoutGrid,
  AlertTriangle,
  Link2,
  MessageCircle,
  Truck,
} from "lucide-react"

import type {
  ClaimRow,
  OrderRow,
  PayHistRow,
  ClaimStatus,
  FulfillmentOrder,
  SharedState,
} from "@/types"

import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import { productImageUrl } from "@/components/shared/ProductThumb"

import {
  Modal,
  Card,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  ProductThumb,
  StatusBadge,
  Countdown,
  SH,
  BuyerProfileModal,
  ExtensionRequestModal,
  PaymentSuccessToast,
  LocationPinPicker,
  recordKeys,
  useRecordFocus,
  type LocationPinValue,
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

import {
  reconcileRejectedClaim,
  sellerOrderReceivedStatus,
  type SellerOrderReceivedStatus,
} from "./claimPaymentState"

import { navIntent } from "@/state/navIntent"

import { GroupOrdersLauncher } from "@/features/dashboard"

import SellerOrderActions from "./SellerOrderActions"

import SetShippingFeeModal from "./SetShippingFeeModal"
import PendingPaymentHint from "./PendingPaymentHint"

import RequestLocationCorrectionModal from "./RequestLocationCorrectionModal"

import DeclineDeliveryOrderModal from "./DeclineDeliveryOrderModal"

import {
  TrackingDetailsModal,
  type TrackingDetailsInput,
} from "@/features/fulfillment"

type OrderReceivedFilter = SellerOrderReceivedStatus | "All"

function paymentMatchesClaim(payment: PayHistRow, claim: ClaimRow) {
  return payment.orderId
    ? String(payment.orderId) === String(claim.id)
    : payment.product === claim.product && payment.batch === claim.batch
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

// A delivery order is waiting on the seller to set (or re-set) the shipping
// fee. Its payment timer is paused until they do.
function needsShippingFee(claim: ClaimRow) {
  return (
    Boolean(claim.shippingApplies) &&
    claim.status === "Pending" &&
    (claim.shippingState === "waiting_for_seller" ||
      claim.shippingState === "correction_requested")
  )
}

function hasOrderDeadline(claim: ClaimRow) {
  if (claim.deadlinePausedAt) return true
  if (claim.expiresAt && Number.isFinite(new Date(claim.expiresAt).getTime())) return true
  return Number.isFinite(claim.hours) && claim.hours > 0
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

  setFulfillment,

  user,

  role,

  setTab,

  refreshData,
}: SharedState) {
  const [showBatchCheckout, setShowBatchCheckout] = useState(
    navIntent.openBatchCheckout,
  )

  useEffect(() => {
    navIntent.openBatchCheckout = false
  }, [])

  const [filter, setFilter] = useState<ClaimStatus | "All">("All")

  const [payTarget, setPayTarget] = useState<ClaimRow | null>(null)

  const [cancelTarget, setCancelTarget] = useState<ClaimRow | null>(null)

  const [cancelling, setCancelling] = useState(false)

  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null)

  const [itemPreview, setItemPreview] = useState<ClaimRow | null>(null)

  const [extTarget, setExtTarget] = useState<ClaimRow | null>(null)

  const [contact, setContact] = useState<ClaimRow | null>(null)

  const [orderFilter, setOrderFilter] = useState<OrderReceivedFilter>(() => {
    const requestedFilter = navIntent.orderFilter ?? "All"

    navIntent.orderFilter = null

    return requestedFilter
  })

  const [buyerProfile, setBuyerProfile] = useState<{
    name: string
    contactUrl?: string
    socialLinks?: Record<string, string>
    orderCounts: { completed: number; cancelled: number; incomplete: number }
  } | null>(null)

  const openBuyerProfile = (claim: ClaimRow) => {
    const buyerName = claim.buyer || "Buyer"
    const buyerOrders = claims.filter((item) => item.buyer === buyerName)

    setBuyerProfile({
      name: buyerName,
      contactUrl: claim.buyerFb,
      socialLinks: claim.buyerSocialLinks,
      orderCounts: {
        completed: buyerOrders.filter(
          (item) =>
            item.orderStatus === "completed" ||
            item.fulfillmentStage === "delivered",
        ).length,
        cancelled: buyerOrders.filter(
          (item) =>
            item.orderStatus === "cancelled" ||
            (!item.orderStatus && item.status === "Cancelled"),
        ).length,
        incomplete: buyerOrders.filter(
          (item) =>
            ["incomplete", "expired"].includes(item.orderStatus ?? "") ||
            (!item.orderStatus && item.status === "Expired"),
        ).length,
      },
    })
  }

  const [orderDetailTarget, setOrderDetailTarget] = useState<ClaimRow | null>(
    null,
  )

  const [sellerPayments, setSellerPayments] = useState<VerifyItem[]>([])

  const [paymentReviewTarget, setPaymentReviewTarget] =
    useState<VerifyItem | null>(null)

  const [paymentRejectTarget, setPaymentRejectTarget] =
    useState<VerifyItem | null>(null)

  const [paymentRejectReason, setPaymentRejectReason] = useState("")

  const [paymentRejectCustom, setPaymentRejectCustom] = useState("")

  const [insufficientTarget, setInsufficientTarget] =
    useState<VerifyItem | null>(null)

  const [insufficientAmount, setInsufficientAmount] = useState("")

  const [viewMode, setViewMode] = useState<"table" | "card">("table")

  const [isMobile, setIsMobile] = useState(false)

  const [showAllPendingPayments, setShowAllPendingPayments] = useState(false)

  const [shippingTarget, setShippingTarget] = useState<ClaimRow | null>(null)

  const [correctionTarget, setCorrectionTarget] = useState<ClaimRow | null>(
    null,
  )

  const [declineTarget, setDeclineTarget] = useState<ClaimRow | null>(null)

  const [trackingTarget, setTrackingTarget] = useState<ClaimRow | null>(null)

  const [pinTarget, setPinTarget] = useState<ClaimRow | null>(null)

  const [pinDraft, setPinDraft] = useState<LocationPinValue>({})

  useEffect(() => {
    const query = window.matchMedia("(max-width: 620px)")

    const sync = () => setIsMobile(query.matches)

    sync()

    query.addEventListener("change", sync)

    return () => query.removeEventListener("change", sync)
  }, [])

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
        alert(
          error instanceof Error
            ? error.message
            : "Unable to load payment submissions.",
        ),
      )
  }, [role])

  // New buyer submissions — including resubmissions after a rejection —

  // show up without a manual reload, so reviewing a repeat submission works

  // exactly like the first one.

  useEffect(() => {
    if (!isSupabaseConfigured || role !== "Seller" || !supabase || !user.id)
      return

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
    if (!isSupabaseConfigured || role !== "Buyer" || !supabase || !user.id)
      return

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

        void (item.groupOrderId
          ? kargoApi.reviewGroupPayment(
              String(item.id),
              item.status === "Verified" ? "verified" : "rejected",
              item.rejectReason,
              deadlineHours,
            )
          : kargoApi.reviewPayment(
            String(item.id),

            item.status === "Verified" ? "verified" : "rejected",

            item.rejectReason,

            deadlineHours,
          ))

          .then(
            () => {
              void refreshData().catch(() => {})

              kargoApi

                .loadSellerPaymentSubmissions()

                .then(setSellerPayments)

                .catch(() => {})
            },

            (error) => {
              alert(
                error instanceof Error
                  ? error.message
                  : "Unable to review payment.",
              )

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

  // Payable claims (fresh "Pending" or "Insufficient Payment") are highlighted

  // in the upper "My Claims To Pay" table and remain visible in the complete

  // My Claims list below.

  const reconciledClaims = claims.map((claim) =>
    reconcileRejectedClaim(claim, payHistory),
  )

  const belongsToPendingPayments = (claim: ClaimRow) =>
    claimIsPayable(claim) ||
    claim.shippingState === "waiting_for_seller" ||
    claim.shippingState === "correction_requested"

  const claimsToPay = reconciledClaims

    .filter(belongsToPendingPayments)

    .sort((left, right) => {
      const leftPaused = Boolean(left.deadlinePausedAt)
      const rightPaused = Boolean(right.deadlinePausedAt)
      if (leftPaused !== rightPaused) return leftPaused ? 1 : -1

      const deadlineTime = (claim: ClaimRow) => {
        const parsedDeadline = claim.expiresAt
          ? new Date(claim.expiresAt).getTime()
          : NaN
        return Number.isFinite(parsedDeadline)
          ? parsedDeadline
          : Date.now() + Math.max(0, claim.hours) * 3_600_000
      }

      return deadlineTime(left) - deadlineTime(right) || newestFirst(left, right)
    })

  const pendingPaymentLimit = isMobile ? 3 : 5
  const visiblePendingPayments = showAllPendingPayments
    ? claimsToPay
    : claimsToPay.slice(0, pendingPaymentLimit)

  const payableClaims = claimsToPay.filter(claimIsPayable)
  const totalDue = payableClaims.reduce((sum, item) => sum + item.amount, 0)

  const itemPreviewBatch = itemPreview
    ? batches.find(
        (candidate) =>
          candidate.title === itemPreview.batch &&
          candidate.seller === itemPreview.seller,
      )
    : undefined
  const itemPreviewProduct = itemPreviewBatch?.products.find((product) =>
    itemPreview?.productId
      ? product.dbId === itemPreview.productId
      : product.name === itemPreview?.product,
  )

  // Payable claims (fresh "Pending" / "Insufficient Payment") live ONLY in the
  // upper "My Claims To Pay" table. Exclude them here so the lower "My Claims"
  // list — and every filter (All, Awaiting Verification, Paid and Reserved,
  // Expired, Cancelled) — never repeats a payable row.
  const claimsForList = reconciledClaims
    .filter((c) => !belongsToPendingPayments(c))
    .sort((left, right) => {
      // "Awaiting Verification" — proof submitted, awaiting the seller's

      // decision — stays pinned at the top of the list (newest first among

      // themselves) so the buyer always sees where their payment stands.

      const leftAwaiting = left.status === "Awaiting Verification"

      const rightAwaiting = right.status === "Awaiting Verification"

      if (leftAwaiting && !rightAwaiting) return -1

      if (rightAwaiting && !leftAwaiting) return 1

      const leftPaidAt = paidAt(left, payHistory)

      const rightPaidAt = paidAt(right, payHistory)

      const leftTime =
        leftPaidAt ||
        (left.createdAt
          ? new Date(left.createdAt).getTime()
          : Number(left.id) || 0)

      const rightTime =
        rightPaidAt ||
        (right.createdAt
          ? new Date(right.createdAt).getTime()
          : Number(right.id) || 0)

      return rightTime - leftTime
    })

  const filtered =
    filter === "All"
      ? claimsForList
      : claimsForList.filter((c) => c.status === filter)

  const [fbToast, setFbToast] = useState<string | null>(null)

  const contactBuyer = (claim: ClaimRow) => {
    const buyerName = claim.buyer || claim.seller

    if (claim.buyerFb) {
      setFbToast(buyerName)

      window.setTimeout(() => {
        window.open(claim.buyerFb, "_blank", "noopener,noreferrer")

        setFbToast(null)
      }, 1200)

      return
    }

    openBuyerProfile(claim)
  }

  const asFulfillmentOrder = (claim: ClaimRow): FulfillmentOrder => ({
    id: String(claim.id),

    dbId: isSupabaseConfigured ? String(claim.id) : undefined,
    col: claim.fulfillmentStage === "shipped" ? "Shipped" : "Preparing",
    perspective: "seller",
    buyer: claim.buyer || "Buyer",

    buyerFb: claim.buyerFb,
    buyerSocialLinks: claim.buyerSocialLinks,
    product: claim.product,

    qty: claim.qty,

    amount: claim.amount,

    fulfillmentStage: claim.fulfillmentStage,

    courierCompany: claim.courierCompany,

    riderName: claim.riderName,

    riderContact: claim.riderContact,

    trackingNumber: claim.trackingNumber,

    eta: claim.eta,

    trackingUrl: claim.trackingUrl,

    deliveryPinLat: claim.deliveryPinLat,

    deliveryPinLng: claim.deliveryPinLng,

    deliveryPinUrl: claim.deliveryPinUrl,

    deliveryPinAddress: claim.deliveryPinAddress,
  })

  const handleCancelClaim = async () => {
    if (!cancelTarget || cancelling) return

    const currentClaim = claims.find((claim) => claim.id === cancelTarget.id)

    if (!currentClaim || currentClaim.status !== "Pending") {
      setCancelTarget(null)

      if (isSupabaseConfigured) await refreshData()

      alert("This claim is no longer pending and cannot be cancelled.")

      return
    }

    if (currentClaim.groupOrderId) {
      alert("This item belongs to a Group Order and cannot be cancelled individually.")
      setCancelTarget(null)
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

  // A notification deep link scrolls to its record. If a filter or the
  // five-row pending limit is hiding the row, clear them so it can show.
  useRecordFocus("My Claims", () => {
    setFilter("All")
    setOrderFilter("All")
    setShowAllPendingPayments(true)
  })

  if (role === "Seller") {
    const paymentForOrder = (claim: ClaimRow) =>
      sellerPayments.find(
        (payment) => String(payment.orderId) === String(claim.id),
      )

    const statusForOrder = (claim: ClaimRow): SellerOrderReceivedStatus => {
      const payment = paymentForOrder(claim)

      return sellerOrderReceivedStatus(claim.status, payment?.status)
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

      const leftTime =
        leftPaymentTime ||
        (left.createdAt
          ? new Date(left.createdAt).getTime()
          : Number(left.id) || 0)

      const rightTime =
        rightPaymentTime ||
        (right.createdAt
          ? new Date(right.createdAt).getTime()
          : Number(right.id) || 0)

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
      <div className="seller-orders-page mobile-data-page">
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
            <Link2 size={15} aria-hidden="true" /> Opening {fbToast}'s Facebook
            profile…
          </div>
        )}
        <header className="seller-orders-heading">
          <h1>Orders Received</h1>
          <p>Manage orders from your buyers</p>
        </header>
        <SellerCombinedDelivery key={user.id ?? user.email} sellerId={user.id} onRecovered={refreshData} />
        <div
          className="seller-orders-filters"
          role="group"
          aria-label="Filter orders by status"
        >
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
                <col className="seller-orders-col-ordered" />
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

                    "ORDER DATE",

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

                  const amountPaid =
                    submission?.amountPaid && submission.status !== "Rejected"
                      ? Number(submission.amountPaid)
                      : status === "Verified"
                        ? c.amount
                        : 0

                  const underpaid = amountPaid > 0 && amountPaid < c.amount

                  const isCashOnMeetup = submission?.method === "Cash on Meetup"

                  const statusStyles: Record<SellerOrderReceivedStatus, {
                    background: string

                    color: string

                    dot: string

                    borderColor: string
                  }> = {
                    Pending: {
                      background: "#fff5cc",

                      color: "#c98f00",

                      dot: "#f0b400",

                      borderColor: "#f0b400",
                    },

                    "Awaiting Verification": {
                      background: "#e0e7ff",

                      color: "#3730a3",

                      dot: "#6366f1",

                      borderColor: "#6366f1",
                    },

                    Verified: {
                      background: "#c8f5e4",

                      color: "#0a8f6a",

                      dot: "#2cc9a0",

                      borderColor: "#2cc9a0",
                    },

                    Expired: {
                      background: "#ffe4e8",

                      color: "#d9273f",

                      dot: "#d9273f",

                      borderColor: "#d9273f",
                    },

                    Cancelled: {
                      background: "#ccc",

                      color: "#555",

                      dot: "#777",

                      borderColor: "#777",
                    },
                  }

                  const badge = statusStyles[status]

                  return (
                    <tr
                      key={c.id}
                      data-record-keys={recordKeys({
                        orderId: c.id,
                        groupOrderId: c.groupOrderId,
                      })}
                      className={
                        i % 2
                          ? "seller-orders-row seller-orders-row--alt"
                          : "seller-orders-row"
                      }
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={c.buyer || c.seller} size={22} />
                          <button
                            onClick={() => openBuyerProfile(c)}
                            className="seller-orders-buyer"
                          >
                            {c.buyer || c.seller}
                          </button>
                        </div>
                      </td>
                      <td className="seller-orders-ordered">
                        {c.createdAt && Number.isFinite(new Date(c.createdAt).getTime())
                          ? new Date(c.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <ProductThumb name={c.product} />
                          <span>
                            {c.product}
                            {c.groupOrderId && (
                              <small className="seller-orders-group-meta">
                                {c.groupMemberCount} members ┬╖ Code {c.groupOrderCode}
                                {c.groupDiscountAmount
                                  ? ` ┬╖ Discount Γé▒${c.groupDiscountAmount.toLocaleString()}`
                                  : ""}
                              </small>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="seller-orders-method">
                        {submission?.method || "ΓÇö"}
                      </td>
                      <td className="seller-orders-amount">
                        Γé▒{c.amount.toLocaleString()}
                      </td>
                      <td className="seller-orders-paid">
                        {isCashOnMeetup ? (
                          <span className="seller-orders-dash">ΓÇö</span>
                        ) : amountPaid > 0 ? (
                          <>
                            <span
                              className={
                                underpaid ? "seller-orders-paid--short" : ""
                              }
                            >
                              Γé▒{amountPaid.toLocaleString()}
                            </span>
                            {underpaid && (
                              <small>
                                Short Γé▒
                                {(c.amount - amountPaid).toLocaleString()}
                              </small>
                            )}
                          </>
                        ) : (
                          <span className="seller-orders-dash">ΓÇö</span>
                        )}
                      </td>
                      <td className="seller-orders-deadline">
                        {c.status === "Expired" ? (
                          <span className="seller-orders-dash">Expired</span>
                        ) : needsShippingFee(c) ? (
                          // The timer is paused until the fee is set, so the
                          // action replaces the "Paused" text here.
                          <div className="seller-orders-deadline__fee">
                            <button
                              className="seller-orders-review seller-orders-fee-action"
                              onClick={() => setShippingTarget(c)}
                            >
                              Set shipping fee
                            </button>
                          </div>
                        ) : c.status === "Pending" && hasOrderDeadline(c) ? (
                          <Countdown
                            hours={c.hours}
                            expiresAt={c.expiresAt}
                            paused={Boolean(c.deadlinePausedAt)}
                          />
                        ) : (
                          <span className="seller-orders-dash">ΓÇö</span>
                        )}
                      </td>
                      <td className="seller-orders-status-cell">
                        <span
                          className="seller-orders-status"
                          style={{
                            background: badge.background,

                            color: badge.color,

                            borderColor: badge.borderColor,
                          }}
                        >
                          <span style={{ background: badge.dot }} />
                          {status}
                        </span>
                        {status === "Pending" && underpaid && (
                          <small>Awaiting balance</small>
                        )}
                      </td>
                      <td>
                        <div className="seller-orders-actions">
                          <SellerOrderActions
                            onReview={() =>
                              submission
                                ? setPaymentReviewTarget(submission)
                                : setOrderDetailTarget(c)
                            }
                            // Only what applies to this order's stage:
                            // tracking once it is shipped (or has a number),
                            // contacting the buyer while payment is pending.
                            items={[
                              ...(c.fulfillmentStage === "shipped" ||
                              c.trackingNumber
                                ? [
                                    {
                                      key: "tracking",
                                      label: c.trackingNumber
                                        ? "Edit tracking"
                                        : "Add tracking",
                                      icon: Truck,
                                      onSelect: () => setTrackingTarget(c),
                                    },
                                  ]
                                : []),
                              ...(status === "Pending"
                                ? [
                                    {
                                      key: "contact",
                                      label: "Contact Buyer",
                                      icon: MessageCircle,
                                      onSelect: () => contactBuyer(c),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {ordFiltered.length === 0 && (
            <div className="seller-orders-empty">No orders found.</div>
          )}
        </div>
        {buyerProfile && (
          <BuyerProfileModal
            buyer={buyerProfile.name}
            contactUrl={buyerProfile.contactUrl}
            socialLinks={buyerProfile.socialLinks}
            orderCounts={buyerProfile.orderCounts}
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
                <div>
                  <dt>Buyer</dt>
                  <dd>{orderDetailTarget.buyer || orderDetailTarget.seller}</dd>
                </div>
                <div>
                  <dt>Quantity</dt>
                  <dd>{orderDetailTarget.qty}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>₱{orderDetailTarget.amount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{statusForOrder(orderDetailTarget)}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>
                    {orderDetailTarget.status === "Pending" &&
                    orderDetailTarget.hours > 0
                      ? `${orderDetailTarget.hours}h`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="kargo-modal-actions">
              <SecondaryBtn onClick={() => setOrderDetailTarget(null)}>
                Close
              </SecondaryBtn>
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
        {shippingTarget && (
          <SetShippingFeeModal
            claim={shippingTarget}
            onClose={() => setShippingTarget(null)}
            onRequestCorrection={() => {
              setCorrectionTarget(shippingTarget)

              setShippingTarget(null)
            }}
            onDecline={() => {
              setDeclineTarget(shippingTarget)

              setShippingTarget(null)
            }}
            onSave={async (fee) => {
              if (isSupabaseConfigured) {
                if (shippingTarget.groupOrderId) {
                  await kargoApi.setGroupOrderShippingFee(
                    shippingTarget.groupOrderId,
                    fee,
                  )
                } else {
                  await kargoApi.setOrderShippingFee(
                    String(shippingTarget.id),
                    fee,
                  )
                }

                await refreshData()
              } else {
                const previousFee = shippingTarget.shippingFee ?? 0

                const update = {
                  shippingFee: fee,

                  shippingState: "fee_set" as const,

                  deadlinePausedAt: undefined,

                  expiresAt: new Date(
                    Date.now() + Math.max(shippingTarget.hours, 1) * 3_600_000,
                  ).toISOString(),

                  amount: shippingTarget.amount - previousFee + fee,
                }

                setClaims((current) =>
                  current.map((claim) =>
                    claim.id === shippingTarget.id
                      ? { ...claim, ...update }
                      : claim,
                  ),
                )

                setToPay((current) =>
                  current.map((payment) =>
                    String(payment.orderId ?? payment.id) ===
                    String(shippingTarget.id)
                      ? { ...payment, ...update }
                      : payment,
                  ),
                )
              }

              setShippingTarget(null)
            }}
          />
        )}
        {correctionTarget && (
          <RequestLocationCorrectionModal
            claim={correctionTarget}
            onClose={() => setCorrectionTarget(null)}
            onConfirm={async () => {
              if (isSupabaseConfigured) {
                if (correctionTarget.groupOrderId) {
                  await kargoApi.requestGroupLocationCorrection(
                    correctionTarget.groupOrderId,
                  )
                } else {
                  await kargoApi.requestLocationCorrection(
                    String(correctionTarget.id),
                  )
                }

                await refreshData()
              } else {
                setClaims((current) =>
                  current.map((claim) =>
                    claim.id === correctionTarget.id
                      ? {
                          ...claim,

                          shippingState: "correction_requested",

                          deadlinePausedAt:
                            claim.deadlinePausedAt ?? new Date().toISOString(),
                        }
                      : claim,
                  ),
                )
              }

              setCorrectionTarget(null)
            }}
          />
        )}
        {declineTarget && (
          <DeclineDeliveryOrderModal
            claim={declineTarget}
            onClose={() => setDeclineTarget(null)}
            onContactBuyer={() => contactBuyer(declineTarget)}
            onConfirm={async (reason) => {
              if (isSupabaseConfigured) {
                if (declineTarget.groupOrderId) {
                  await kargoApi.declineGroupDeliveryOrder(
                    declineTarget.groupOrderId,
                    reason,
                  )
                } else {
                  await kargoApi.declineDeliveryOrder(
                    String(declineTarget.id),
                    reason,
                  )
                }

                await refreshData()
              } else {
                setClaims((current) =>
                  current.map((claim) =>
                    claim.id === declineTarget.id
                      ? {
                          ...claim,

                          status: "Cancelled",

                          shippingState: "declined",

                          shippingDeclineReason: reason,

                          deadlinePausedAt: undefined,
                        }
                      : claim,
                  ),
                )

                setToPay((current) =>
                  current.filter(
                    (payment) =>
                      String(payment.orderId ?? payment.id) !==
                      String(declineTarget.id),
                  ),
                )

                setBatches((current) =>
                  current.map((batch) =>
                    batch.title !== declineTarget.batch
                      ? batch
                      : {
                          ...batch,

                          claimed: Math.max(
                            0,

                            batch.claimed - declineTarget.qty,
                          ),

                          products: batch.products.map((product) => {
                            const matches = declineTarget.productId
                              ? product.dbId === declineTarget.productId
                              : product.name === declineTarget.product

                            return matches
                              ? {
                                  ...product,

                                  claimed: Math.max(
                                    0,

                                    product.claimed - declineTarget.qty,
                                  ),
                                }
                              : product
                          }),
                        },
                  ),
                )
              }

              setDeclineTarget(null)
            }}
          />
        )}
        {trackingTarget && (
          <TrackingDetailsModal
            order={asFulfillmentOrder(trackingTarget)}
            onClose={() => setTrackingTarget(null)}
            onSave={async (details: TrackingDetailsInput) => {
              if (isSupabaseConfigured) {
                await kargoApi.setOrderTracking(
                  String(trackingTarget.id),

                  details,
                )

                await refreshData()
              } else {
                const update = {
                  fulfillmentStage: "shipped",

                  courierCompany: details.courier,

                  riderName: details.riderName,

                  riderContact: details.riderContact,

                  trackingNumber: details.trackingNumber,

                  eta: details.eta,

                  trackingUrl: details.trackingUrl,
                }

                setClaims((current) =>
                  current.map((claim) =>
                    claim.id === trackingTarget.id
                      ? { ...claim, ...update }
                      : claim,
                  ),
                )

                setFulfillment((current) =>
                  current.map((order) =>
                    String(order.dbId ?? order.id) === String(trackingTarget.id)
                      ? { ...order, ...update, col: "Shipped" }
                      : order,
                  ),
                )
              }

              setTrackingTarget(null)
            }}
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
        const paymentInput = {

          method,

          amount: details.amountPaid,

          referenceNumber: refNo,

          receipt,

          payerAccountName: details.payerAccountName,

          payerPhone: details.payerPhone,

          buyerContactUrl: details.buyerContactUrl,
        }

        if (target.groupOrderId) {
          await kargoApi.submitGroupPayment({
            ...paymentInput,
            groupOrderId: target.groupOrderId,
          })
        } else {
          await kargoApi.submitPayment({
            ...paymentInput,
            orderId: String(target.id),
          })
        }
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

    if (!isSupabaseConfigured)
      setClaims((prev) =>
        prev.map((c) =>
          c.id === target.id
            ? { ...c, status: "Paid and Reserved" as ClaimStatus }
            : c,
        ),
      )

    if (!isSupabaseConfigured)
      setToPay((prev) => prev.filter((t) => t.product !== target.product))

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
    <div className="p-6 buyer-claims-page mobile-data-page">
      <div className="mb-6">
        <SH
          title="My Claims To Pay"
          action={
            // Groups the buyer leads or joined: the buyer-side counterpart of
            // the seller's Extension Requests button, on the same row as the
            // heading, rightmost.
            <GroupOrdersLauncher
              buyerId={user.id}
              batches={batches}
              onUpdated={refreshData}
              onBrowse={() => setTab("Batches")}
            />
          }
        />
        <div className="claims-to-pay-table-card">
          <div className="claims-to-pay-table-header" role="row">
            <span role="columnheader">Product</span>
            <span role="columnheader">Seller</span>
            <span role="columnheader">Deadline</span>
            <span role="columnheader">Amount</span>
            <span role="columnheader">Actions</span>
          </div>
          <div className="claims-to-pay-flow">
            <BuyerCombinedDelivery
              key={user.id ?? user.email}
              buyerId={user.id}
              claims={reconciledClaims}
              onRecovered={refreshData}
              imageForOrder={(id) => {
                const productId = reconciledClaims.find(
                  (claim) => String(claim.id) === id,
                )?.productId
                return productId
                  ? batches
                      .flatMap((batch) => batch.products)
                      .find((product) => product.dbId === productId)?.imageUrl
                  : undefined
              }}
            >
              {({ requestForOrder, openRequest, combinedPaymentOrder }) => (
                <>
                  <table className="claims-to-pay-table">
                    <thead className="sr-only">
                      <tr>
                        <th>Product</th>
                        <th>Seller</th>
                        <th>Deadline</th>
                        <th>Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePendingPayments
                        .filter(
                          (item) => !combinedPaymentOrder(String(item.id)),
                        )
                        .map((item) => {
                          const deliveryRequest = requestForOrder(String(item.id))
                          const imageUrl = item.productId
                            ? batches
                                .flatMap((batch) => batch.products)
                                .find(
                                  (product) => product.dbId === item.productId,
                                )?.imageUrl
                            : undefined

                          return (
                            <tr
                              key={item.id}
                              data-record-keys={recordKeys({
                                orderId: item.id,
                                groupOrderId: item.groupOrderId,
                                combinedGroupId: deliveryRequest?.id,
                              })}
                            >
                              <td>
                                <div className="claims-to-pay-product">
                                  <button
                                    type="button"
                                    className="buyer-claim-item-preview-trigger"
                                    aria-label={`Enlarge photo of ${item.product}`}
                                    onClick={() => setItemPreview(item)}
                                  >
                                    <ProductThumb
                                      name={item.product}
                                      imageUrl={imageUrl}
                                    />
                                  </button>
                                  <div className="claims-to-pay-product__copy">
                                    <div className="claims-to-pay-product__name">
                                      {item.product}
                                      {item.qty > 1 && (
                                        <span className="claims-to-pay-quantity">
                                          ×{item.qty}
                                        </span>
                                      )}
                                    </div>
                                    <div className="claims-to-pay-product__links">
                                      {item.shippingState ===
                                        "correction_requested" && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPinDraft({
                                              lat: item.deliveryPinLat,
                                              lng: item.deliveryPinLng,
                                              url: item.deliveryPinUrl,
                                              address: item.deliveryPinAddress,
                                            })
                                            setPinTarget(item)
                                          }}
                                        >
                                          Update location
                                        </button>
                                      )}
                                      {item.shippingState !==
                                        "correction_requested" &&
                                        deliveryRequest && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openRequest(deliveryRequest)
                                            }
                                          >
                                            View request
                                          </button>
                                        )}
                                      {(item.extensionRequested ||
                                        item.extensionStatus === "pending") && (
                                        <span>Extension requested</span>
                                      )}
                                      {item.extensionStatus === "approved" && (
                                        <span>Extension approved</span>
                                      )}
                                      {item.extensionStatus === "denied" && (
                                        <span>Extension declined</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="claims-to-pay-seller">
                                  <Avatar name={item.seller} size={22} />
                                  <span>{item.seller}</span>
                                </div>
                              </td>
                              <td>
                                <div className="claims-to-pay-deadline">
                                  {item.shippingState ===
                                  "waiting_for_seller" ? (
                                    <span className="claims-to-pay-deadline--paused">
                                      Waiting for seller
                                    </span>
                                  ) : item.shippingState ===
                                    "correction_requested" ? (
                                    <span className="claims-to-pay-deadline--paused">
                                      Location update required
                                    </span>
                                  ) : (
                                    <>
                                      {item.status !== "Pending" && (
                                        <span className="claims-to-pay-deadline__status">
                                          {item.status}
                                        </span>
                                      )}
                                      <Countdown
                                        id={item.id}
                                        hours={item.hours}
                                        expiresAt={item.expiresAt}
                                        paused={Boolean(item.deadlinePausedAt)}
                                      />
                                    </>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="claims-to-pay-amount">
                                  ₱{item.amount.toLocaleString()}
                                  {deliveryRequest?.status ===
                                  "shipping_fee_set" ? (
                                    <span>
                                      Item subtotal · shared fee in request
                                    </span>
                                  ) : item.shippingState ===
                                    "waiting_for_seller" ? (
                                    <span>Shipping fee pending</span>
                                  ) : item.shippingFee !== undefined ? (
                                    <span>
                                      Includes ₱
                                      {item.shippingFee.toLocaleString()} shipping
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td>
                                <div className="claims-to-pay-actions">
                                  <PendingPaymentHint
                                    waiting={
                                      item.shippingState === "waiting_for_seller"
                                    }
                                    sharedFeeSet={
                                      deliveryRequest?.status ===
                                      "shipping_fee_set"
                                    }
                                  >
                                    <PrimaryBtn
                                      size="sm"
                                      disabled={!claimIsPayable(item)}
                                      onClick={() =>
                                        claimIsPayable(item) && setPayTarget(item)
                                      }
                                    >
                                      Pay Now
                                    </PrimaryBtn>
                                  </PendingPaymentHint>
                                  {claimIsPayable(item) &&
                                    !item.extensionRequested &&
                                    item.extensionStatus !== "pending" && (
                                      <SecondaryBtn
                                        size="sm"
                                        onClick={() => setExtTarget(item)}
                                      >
                                        Request Extension
                                      </SecondaryBtn>
                                    )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      {claimsToPay.length === 0 && (
                        <tr className="claims-to-pay-empty-row">
                          <td colSpan={5}>No pending payments.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {claimsToPay.length > pendingPaymentLimit && (
                    <button
                      type="button"
                      className="claims-to-pay-toggle"
                      onClick={() =>
                        setShowAllPendingPayments((showing) => !showing)
                      }
                      aria-expanded={showAllPendingPayments}
                    >
                      {showAllPendingPayments
                        ? "Show fewer pendings"
                        : `Show all ${claimsToPay.length} pendings`}
                    </button>
                  )}
                </>
              )}
            </BuyerCombinedDelivery>
          </div>
        </div>
        <div className="claims-to-pay-total-bar">
          <div className="claims-to-pay-total">
            <span>Total Due:</span>
            <strong>₱{totalDue.toLocaleString()}</strong>
          </div>
          <PrimaryBtn
            disabled={payableClaims.length === 0}
            onClick={() => setShowBatchCheckout(true)}
          >
            Batch Checkout
          </PrimaryBtn>
        </div>
      </div>

      <SH title="My Claims" />

      <div className="claims-filter-row flex items-center gap-2 mb-5 flex-wrap">
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
          className="claims-view-toggle"
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
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                {m === "table" ? (
                  <>
                    <List size={13} aria-hidden="true" /> Table
                  </>
                ) : (
                  <>
                    <LayoutGrid size={13} aria-hidden="true" /> Cards
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isMobile || viewMode === "card" ? (
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
            className="grid gap-4 claims-card-grid"
            style={{ gridTemplateColumns: "repeat(2,1fr)" }}
          >
            {filtered.map((c) => (
              <Card
                key={c.id}
                recordKeys={recordKeys({ orderId: c.id, groupOrderId: c.groupOrderId })}
              >
                <div className="claims-card__summary flex items-start gap-3">
                  <button
                    type="button"
                    className="buyer-claim-item-preview-trigger"
                    aria-label={`View ${c.product} details`}
                    onClick={() => setItemPreview(c)}
                  >
                    <ProductThumb name={c.product} />
                  </button>
                  <div className="claims-card__info min-w-0 flex-1">
                    <div
                      style={{
                        fontSize: 13,

                        fontWeight: 700,

                        color: "#111827",

                        fontFamily: "'Josefin Sans',sans-serif",
                      }}
                    >
                      <button
                        type="button"
                        className="buyer-claim-item-preview-name"
                        onClick={() => setItemPreview(c)}
                      >
                        {c.product}
                      </button>
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}
                    >
                      {c.batch}
                    </div>
                    <div
                      className="claims-card__seller"
                      style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}
                    >
                      Seller: {c.seller}
                    </div>
                  </div>
                  <div className="claims-card__status">
                    <StatusBadge status={c.status} />
                  </div>
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
                    <Countdown
                      hours={c.hours}
                      expiresAt={c.expiresAt}
                      paused={Boolean(c.deadlinePausedAt)}
                    />
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
                      <PrimaryBtn
                        size="sm"
                        onClick={() => claimIsPayable(c) && setPayTarget(c)}
                      >
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
                          const o = orders.find((o) =>
                            o.dbId
                              ? o.dbId === String(c.id)
                              : o.id === String(c.id) ||
                                (!isSupabaseConfigured &&
                                  o.product === c.product &&
                                  o.batch === c.batch &&
                                  o.seller === c.seller),
                          ) || {
                            id: String(c.id),

                            dbId: isSupabaseConfigured
                              ? String(c.id)
                              : undefined,

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
        <Card className="!p-0 overflow-hidden claims-history-table">
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
                    data-record-keys={recordKeys({
                      orderId: c.id,
                      groupOrderId: c.groupOrderId,
                    })}
                    style={{
                      borderTop: "1px solid #F3F4F6",

                      background: i % 2 ? "#FAFAFA" : "#fff",
                    }}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          className="buyer-claim-item-preview-trigger"
                          aria-label={`View ${c.product} details`}
                          onClick={() => setItemPreview(c)}
                        >
                          <ProductThumb name={c.product} />
                        </button>
                        <button
                          type="button"
                          className="buyer-claim-item-preview-name"
                          onClick={() => setItemPreview(c)}
                        >
                          {c.product}
                        </button>
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
                        <Countdown
                          hours={c.hours}
                          expiresAt={c.expiresAt}
                          paused={Boolean(c.deadlinePausedAt)}
                        />
                      ) : (
                        <span style={{ color: "#D1D5DB" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div
                        className={`flex items-center gap-1.5 flex-wrap ${
                          c.status === "Pending" ? "justify-end" : ""
                        }`}
                      >
                        {claimIsPayable(c) && (
                          <PrimaryBtn
                            size="sm"
                            onClick={() => claimIsPayable(c) && setPayTarget(c)}
                          >
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
                              const o = orders.find((o) =>
                                o.dbId
                                  ? o.dbId === String(c.id)
                                  : o.id === String(c.id) ||
                                    (!isSupabaseConfigured &&
                                      o.product === c.product &&
                                      o.batch === c.batch &&
                                      o.seller === c.seller),
                              ) || {
                                id: String(c.id),

                                dbId: isSupabaseConfigured
                                  ? String(c.id)
                                  : undefined,

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
          items={payableClaims.map((claim) => ({
            ...claim,
            orderId: String(claim.id),
          }))}
          contactPrefill={user.fb || ""}
          onSubmit={async (item, method, refNo, receipt, details) => {
            const claim = claimsToPay.find(
              (candidate) =>
                candidate.id === item.id && claimIsPayable(candidate),
            )

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

            groupOrderId: payTarget.groupOrderId,

            product: payTarget.product,

            seller: payTarget.seller,

            sellerId: payTarget.sellerId,

            qty: payTarget.qty,

            amount: payTarget.amount,

            hours: payTarget.hours,

            reservedPaymentMethod: payTarget.reservedPaymentMethod,

            shippingApplies: payTarget.shippingApplies,

            shippingFee: payTarget.shippingFee,

            shippingState: payTarget.shippingState,
          }}
          imageUrl={
            batches
              .find(
                (candidate) =>
                  candidate.title === payTarget.batch &&
                  candidate.seller === payTarget.seller,
              )
              ?.products.find((product) =>
                payTarget.productId
                  ? product.dbId === payTarget.productId
                  : product.name === payTarget.product,
              )?.imageUrl
          }
          contactPrefill={user.fb || ""}
          onConfirm={(method, refNo, receipt, details) =>
            handlePay(payTarget, method, refNo, receipt, details)
          }
          onClose={() => setPayTarget(null)}
        />
      )}
      {itemPreview && (
        <Modal
          title={itemPreview.product}
          variant="detail"
          showTitleIcon={false}
          width={760}
          onClose={() => setItemPreview(null)}
        >
          <div className="buyer-claim-item-preview">
            <div className="buyer-claim-item-preview__photo">
              <img
                src={
                  itemPreviewProduct?.imageUrl ??
                  productImageUrl(itemPreview.product, 900)
                }
                alt={itemPreview.product}
              />
            </div>
            <div className="buyer-claim-item-preview__details">
              <h2>{itemPreview.product}</h2>
              <p>Batch: {itemPreview.batch}</p>
              <p>Seller: {itemPreview.seller}</p>
              {itemPreviewProduct && (
                <>
                  <strong>
                    ₱{itemPreviewProduct.price.toLocaleString()} / {itemPreviewProduct.sellingUnit ?? "piece"}
                  </strong>
                  {itemPreviewProduct.sellingUnit === "box" && (
                    <p>{itemPreviewProduct.piecesPerBox ?? 1} pieces per box</p>
                  )}
                </>
              )}
              <p>Claim quantity: {itemPreview.qty}</p>
              <p>Claim total: ₱{itemPreview.amount.toLocaleString()}</p>
            </div>
          </div>
        </Modal>
      )}

      {viewOrder && (
        <OrderDetailsModal
          order={orders.find((order) => order.id === viewOrder.id) ?? viewOrder}
          payHistory={payHistory}
          onClose={() => setViewOrder(null)}
        />
      )}
      {cancelTarget && (
        <Modal
          title={cancelTarget.groupOrderId ? "Group Order item" : "Cancel this claim?"}
          onClose={() => !cancelling && setCancelTarget(null)}
          width={420}
        >
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            {cancelTarget.groupOrderId ? "This item belongs to a Group Order and cannot be cancelled individually." : <>
            Cancel your claim for <strong>{cancelTarget.product}</strong>? This
            cannot be undone, and the quantity will become available to other buyers.
            </>}
          </p>
          <div className="kargo-modal-actions">
            <SecondaryBtn
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              {cancelTarget.groupOrderId ? "Close" : "Keep Claim"}
            </SecondaryBtn>
            <PrimaryBtn
              onClick={handleCancelClaim}
              disabled={cancelling || Boolean(cancelTarget.groupOrderId)}
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
                await kargoApi.requestOrderExtension(
                  String(extTarget.id),

                  hours,

                  reason,
                )
              } catch (error) {
                alert(
                  error instanceof Error
                    ? error.message
                    : "Unable to request extension.",
                )

                return
              }
            }

            setClaims((prev) =>
              prev.map((c) =>
                c.id === extTarget.id
                  ? { ...c, extensionRequested: true, extensionStatus: "pending", extensionRequestedHours: hours }
                  : c,
              ),
            )

            setExtTarget(null)
          }}
          onClose={() => setExtTarget(null)}
        />
      )}
      {pinTarget && (
        <Modal
          title="Update delivery location"
          onClose={() => setPinTarget(null)}
          width={560}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-gray-600">
              Move the pin or paste a corrected Google Maps link. Your payment
              timer stays paused until the seller confirms the location and sets
              the shipping fee.
            </p>
            <LocationPinPicker value={pinDraft} onChange={setPinDraft} />
            <div className="flex justify-end gap-3 max-[480px]:flex-col-reverse">
              <SecondaryBtn onClick={() => setPinTarget(null)}>
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                disabled={
                  !pinDraft.url &&
                  (pinDraft.lat === undefined || pinDraft.lng === undefined)
                }
                onClick={async () => {
                  if (isSupabaseConfigured) {
                    if (pinTarget.groupOrderId) {
                      await kargoApi.updateGroupDeliveryPin(
                        pinTarget.groupOrderId,
                        pinDraft,
                      )
                    } else {
                      await kargoApi.updateOrderDeliveryPin(
                        String(pinTarget.id),
                        pinDraft,
                      )
                    }

                    await refreshData()
                  } else {
                    const update = {
                      deliveryPinLat: pinDraft.lat,

                      deliveryPinLng: pinDraft.lng,

                      deliveryPinUrl: pinDraft.url,

                      deliveryPinAddress: pinDraft.address,

                      shippingState: "waiting_for_seller" as const,
                    }

                    setClaims((current) =>
                      current.map((claim) =>
                        claim.id === pinTarget.id
                          ? { ...claim, ...update }
                          : claim,
                      ),
                    )

                    setToPay((current) =>
                      current.map((payment) =>
                        String(payment.orderId ?? payment.id) ===
                        String(pinTarget.id)
                          ? { ...payment, ...update }
                          : payment,
                      ),
                    )
                  }

                  setPinTarget(null)
                }}
              >
                Save corrected location
              </PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}
      {paymentSuccess && (
        <PaymentSuccessToast onClose={() => setPaymentSuccess(false)} />
      )}
    </div>
  )
}
