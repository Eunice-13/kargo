import { useState, useEffect, useMemo } from "react"

import {
  Package,
  PackagePlus,
  CreditCard,
  CalendarX2,
  ReceiptText,
  Clock3,
  CheckCircle2,
  Plane,
  ClipboardList,
  Maximize2,
  X,
  FileText,
} from "lucide-react"

import type { ClaimStatus, PayHistRow, Tab, SharedState } from "@/types"

import { navIntent } from "@/state/navIntent"

import { sortWaitlistUpcoming } from "@/data/waitlist"

import { INDIGO, CREAM, CYAN_L, GREEN, AMBER, TODAY } from "@/constants/theme"

import {
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  ProductThumb,
  StatusBadge,
  Countdown,
  BuyerProfileModal,
} from "@/components/shared"

import { BatchCheckoutModal, completedPayments } from "@/features/payments"

import type { PaymentSubmissionDetails } from "@/features/payments"

import {
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentBoard,
} from "@/features/fulfillment"
import { OrderDetailsModal } from "@/features/orders"
import SalesReportModal from "./SalesReportModal"

import WaitlistModal from "./WaitlistModal"

import SellerWaitlistCard from "./SellerWaitlistCard"

import PopularBatchesCard from "./PopularBatchesCard"

import { isSupabaseConfigured } from "@/lib/supabase"

import { kargoApi } from "@/services"

import {
  claimIsPayable,
  deadlineHasPassed,
} from "@/features/claims/claimExpiry"

export default function Dashboard({
  batches,

  claims,

  setClaims,

  toPay,

  setToPay,

  payHistory,

  setPayHistory,

  setTab,

  role,

  orders,

  fulfillment,

  setFulfillment,

  waitlist,

  setWaitlist,

  sellerWaitlist,

  user,

  setUser,

  refreshData,
}: SharedState) {
  const [showPayAll, setShowPayAll] = useState(false)

  const [buyerProfile, setBuyerProfile] = useState<{
    name: string
    contactUrl?: string
    socialLinks?: Record<string, string>
    orderCounts: { completed: number; cancelled: number; incomplete: number }
  } | null>(null)
  const [boardExpanded, setBoardExpanded] = useState(false)

  const [showSalesReport, setShowSalesReport] = useState(false)

  const [showWaitlist, setShowWaitlist] = useState(false)
  const [buyerOrderDetailsId, setBuyerOrderDetailsId] = useState<string | null>(
    null,
  )
  const [activeWaitlistId, setActiveWaitlistId] = useState<string | null>(null)

  const board = useFulfillmentBoard(setFulfillment)

  const openBuyerProfile = (
    name: string,
    contactUrl?: string,
    socialLinks?: Record<string, string>,
  ) => {
    const buyerOrders = claims.filter((claim) => claim.buyer === name)
    setBuyerProfile({
      name,
      contactUrl,
      socialLinks,
      orderCounts: {
        completed: buyerOrders.filter(
          (claim) =>
            claim.orderStatus === "completed" ||
            claim.fulfillmentStage === "delivered",
        ).length,
        cancelled: buyerOrders.filter(
          (claim) =>
            claim.orderStatus === "cancelled" ||
            (!claim.orderStatus && claim.status === "Cancelled"),
        ).length,
        incomplete: buyerOrders.filter(
          (claim) =>
            ["incomplete", "expired"].includes(claim.orderStatus ?? "") ||
            (!claim.orderStatus && claim.status === "Expired"),
        ).length,
      },
    })
  }

  const waitlistSorted = useMemo(
    () => sortWaitlistUpcoming(waitlist),

    [waitlist],
  )

  const closestWaitlist = waitlistSorted[0] ?? null

  const openWaitlist = () => {
    setActiveWaitlistId(closestWaitlist?.id ?? null)

    setShowWaitlist(true)
  }

  // Close the expanded board with Escape.

  useEffect(() => {
    if (!boardExpanded) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBoardExpanded(false)
    }

    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [boardExpanded])

  const activeClaims = claims

    .filter((c) => c.status === "Pending")

    .sort((a, b) => Number(b.id) - Number(a.id))

  // Recent Claims preview: a fixed number of the most recent claims, shown in

  // full with NO internal scroll. Anything beyond this is reached via "View

  // All", matching the Seller Dashboard's Recent Orders preview pattern.

  const RECENT_CLAIMS_PREVIEW = 7

  const recentClaims = claims

    .slice()

    .sort((a, b) => Number(b.id) - Number(a.id))

    .slice(0, RECENT_CLAIMS_PREVIEW)

  const payableToPay = toPay.filter(
    (item) =>
      !item.deadlinePausedAt &&
      item.shippingState !== "waiting_for_seller" &&
      item.shippingState !== "correction_requested" &&
      !deadlineHasPassed(item),
  )

  const pendingTotal = payableToPay.reduce((s, t) => s + t.amount, 0)

  const completedOrders = completedPayments(payHistory, claims)

  // ─── Seller stat sources (derived from live data, not hardcoded) ───────────

  // Scope to the signed-in seller's own batches.

  const myLiveBatches = batches.filter((b) => b.live && b.seller === user.name)

  const mySellerOrders = claims.filter((claim) => claim.seller === user.name)

  // Only submitted proofs await seller verification. `payment_pending` means

  // the buyer has not paid yet, so it must not inflate this seller metric.

  const paymentsToVerify = mySellerOrders.filter(
    (claim) => claim.status === "Awaiting Verification",
  )

  // Match the seller's Orders Received > Pending filter, which is based on

  // claims and their payment history rather than the recent fulfillment board.

  const pendingReceivedOrders = mySellerOrders.filter((claim) => {
    if (claim.status === "Paid and Reserved") return false

    if (claim.status === "Insufficient Payment") return true

    return claim.status === "Pending"
  })

  const shippingFeesToSet = mySellerOrders.filter(
    (claim) =>
      claim.status === "Pending" &&
      claim.shippingApplies &&
      (claim.shippingState === "waiting_for_seller" ||
        claim.shippingState === "correction_requested"),
  )

  // Extension requests awaiting this seller's approval: claims on their orders

  // that requested an extension and are still pending a decision.

  const pendingExtensions = claims.filter(
    (c) =>
      c.extensionRequested && c.status === "Pending" && c.seller === user.name,
  )

  // Orders fulfilled = orders moved to the board's "Delivered" column.

  const ordersFulfilled = fulfillment.filter((o) => o.col === "Delivered")

  const waitlistSub = closestWaitlist
    ? closestWaitlist.product && closestWaitlist.product !== "Product"
      ? `${closestWaitlist.product}${
          closestWaitlist.batch ? ` — ${closestWaitlist.batch}` : ""
        }`
      : closestWaitlist.batch || "Waitlisted item"
    : "No waitlisted items"

  const buyerStats = [
    {
      label: "Active Claims",

      value: String(activeClaims.length),

      icon: PackagePlus,

      sub:
        activeClaims.length === 0
          ? "No active claims"
          : `${activeClaims.length} awaiting payment or reservation`,

      sc: GREEN,

      bg: "#E8F9F3",
    },

    {
      label: "Pending Payment",

      value: `₱${pendingTotal.toLocaleString()}`,

      icon: CreditCard,

      sub: `${payableToPay.length} items due soon`,

      sc: AMBER,

      bg: "#FFF8E8",
    },

    {
      label: "Waitlist Position",

      value: closestWaitlist ? `#${closestWaitlist.position}` : "—",

      icon: CalendarX2,

      sub: waitlistSub,

      sc: "#EF4444",

      bg: "#FDECEC",
    },

    {
      label: "Completed Orders",

      value: String(completedOrders.length),

      icon: ReceiptText,

      sub: "Completed payments",

      sc: "#6B7280",

      bg: "#FFFFFF",
    },
  ]

  const sellerStats = [
    {
      label: "Active Batches",

      value: String(myLiveBatches.length),

      icon: Plane,

      sub: "Open + Scheduled",

      sc: "#64E894",

      bg: "#ECFFF4",
    },

    {
      label: "Awaiting Verification",

      value: String(paymentsToVerify.length),

      icon: Clock3,

      sub: "Payment proofs to review",

      sc: "#F4D85D",

      bg: "#FFFBE3",
    },

    {
      label: "Extension Requests",

      value: String(pendingExtensions.length),

      icon: ClipboardList,

      sub: "Awaiting your approval",

      sc: "#E62B48",

      bg: "#FFF0F2",
    },

    {
      label: "Orders Fulfilled",

      value: String(ordersFulfilled.length),

      icon: CheckCircle2,

      sub: "Completed this quarter",

      sc: "#6B7280",

      bg: "#FFFFFF",
    },
  ]

  const stats = role === "Seller" ? sellerStats : buyerStats

  // Upcoming Deadlines is driven by the buyer's real pending, still-payable

  // claims — the SAME "Waiting for payment" rows shown in Recent Claims — so

  // the panel never renders empty when there are outstanding payments. Sorted

  // soonest-first and capped to a short preview.

  const upcoming = useMemo(
    () =>
      activeClaims

        .filter((c) => claimIsPayable(c))

        .sort((a, b) => a.hours - b.hours)

        .slice(0, 4),

    [activeClaims],
  )

  const handleBatchPayment = async (
    item: typeof toPay[number],

    method: string,

    referenceNumber: string,

    receipt: File | undefined,

    details: PaymentSubmissionDetails,
  ) => {
    const claim = claims.find(
      (candidate) => String(candidate.id) === String(item.orderId ?? item.id),
    )

    if (!claim || !claimIsPayable(claim) || deadlineHasPassed(item)) {
      alert("This claim has expired and can no longer be paid.")

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
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to submit payment."

        if (message === "Order is not payable") {
          await refreshData()

          alert(
            "This order already has a submitted payment or is no longer payable. Your payment data has been refreshed.",
          )

          return false
        }

        alert(message)

        return false
      }

      await refreshData()

      return true
    }

    setPayHistory((history) => [
      {
        id: history.length + 1,

        product: item.product,

        batch: "",

        method,

        amount: details.amountPaid,

        date: TODAY,

        status: (isSupabaseConfigured
          ? "Pending"
          : "Paid and Reserved") as ClaimStatus,
      },

      ...history,
    ])

    if (!isSupabaseConfigured)
      setClaims((prev) =>
        prev.map((c) =>
          c.id === item.id && c.status === "Pending"
            ? { ...c, status: "Paid and Reserved" as ClaimStatus }
            : c,
        ),
      )

    if (!isSupabaseConfigured)
      setToPay((items) => items.filter((candidate) => candidate.id !== item.id))

    return true
  }

  if (String(role) === "Seller") {
    return (
      <div className="seller-dashboard">
        <section className="seller-stats" aria-label="Seller summary">
          {sellerStats.map((stat, index) => (
            <article
              key={stat.label}
              className={`seller-stat seller-stat--${index + 1} fi`}
              role="button"
              tabIndex={0}
              aria-label={`Open ${stat.label}`}
              onClick={() => {
                if (stat.label === "Active Batches") setTab("Batches")

                if (stat.label === "Awaiting Verification") {
                  navIntent.orderFilter = "Pending"

                  setTab("My Claims")
                }

                if (stat.label === "Extension Requests") {
                  navIntent.openExtensionRequests = true

                  setTab("Batches")
                }

                if (stat.label === "Orders Fulfilled") setTab("Payments")
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()

                  event.currentTarget.click()
                }
              }}
              style={{
                animationDelay: `${index * 60}ms`,

                background: stat.bg,

                cursor: "pointer",
              }}
            >
              <stat.icon
                size={20}
                aria-hidden="true"
                style={{ color: stat.sc }}
              />
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
              <small style={{ color: stat.sc }}>{stat.sub}</small>
            </article>
          ))}
        </section>

        <div className="seller-orders-layout">
          <section className="seller-recent-orders">
            <div className="seller-section-heading">
              <h2>Recent Orders</h2>
              <button type="button" onClick={() => setTab("My Claims")}>
                View All
              </button>
            </div>
            <div className="seller-orders-table-wrap">
              <table className="seller-orders-table">
                <thead>
                  <tr>
                    {[
                      "Products",

                      "Batch",

                      "Buyer",

                      "Amount",

                      "Status",

                      "Deadline",
                    ].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mySellerOrders.slice(0, 7).map((claim, index) => {
                    const buyerName = claim.buyer || claim.seller

                    return (
                      <tr key={claim.id} onClick={() => setTab("My Claims")}>
                        <td>
                          <div className="seller-product-cell">
                            <ProductThumb name={claim.product} />
                            <span>{claim.product}</span>
                          </div>
                        </td>
                        <td>{claim.batch}</td>
                        <td>
                          <div className="seller-buyer-cell">
                            <Avatar name={buyerName} size={21} />
                            <span>{buyerName}</span>
                          </div>
                        </td>
                        <td className="seller-order-amount">
                          ₱{claim.amount.toLocaleString()}
                        </td>
                        <td>
                          <StatusBadge status={claim.status} />
                        </td>
                        <td
                          className={
                            claim.hours > 0 && claim.hours < 6
                              ? "is-urgent"
                              : index === 1
                                ? "is-warning"
                                : ""
                          }
                        >
                          {claim.status === "Pending" && claim.hours > 0 ? (
                            <Countdown
                              hours={claim.hours}
                              id={claim.id}
                              expiresAt={claim.expiresAt}
                              paused={Boolean(claim.deadlinePausedAt)}
                            />
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="seller-dashboard-sidebar">
            <section className="seller-side-card seller-pending-actions">
              <h2>Pending Actions</h2>
              {[
                {
                  icon: Clock3,

                  label: "Payments to Verify",

                  count: pendingReceivedOrders.length,

                  tab: "My Claims" as Tab,
                },

                {
                  icon: ClipboardList,

                  label: "Extension Requests",

                  count: pendingExtensions.length,

                  tab: "Batches" as Tab,
                },

                {
                  icon: Package,

                  label: "Shipping Fees to Set",

                  count: shippingFeesToSet.length,

                  tab: "My Claims" as Tab,
                },
              ].map((action) => (
                <div className="seller-action-row" key={action.label}>
                  <action.icon size={19} aria-hidden="true" />
                  <div>
                    <strong>{action.label}</strong>
                    <small>{action.count} Pending</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (action.label === "Payments to Verify")
                        navIntent.orderFilter = "Pending"

                      if (action.label === "Shipping Fees to Set")
                        navIntent.orderFilter = "Pending"

                      if (action.label === "Extension Requests")
                        navIntent.openExtensionRequests = true

                      setTab(action.tab)
                    }}
                  >
                    View All
                  </button>
                </div>
              ))}
            </section>

            <PopularBatchesCard
              batches={batches}
              sellerName={user.name}
              onOpenBatch={(batch) => {
                navIntent.batchId = batch.id
                setTab("Batches")
              }}
            />

            <SellerWaitlistCard groups={sellerWaitlist} />
          </aside>
        </div>

        <section className="seller-fulfillment-section">
          <div className="seller-section-heading seller-board-heading">
            <h2>Fulfillment Board</h2>
            <div>
              <button type="button" onClick={() => setShowSalesReport(true)}>
                <FileText size={14} aria-hidden="true" />
                Sales Report
              </button>
              <button type="button" onClick={() => setBoardExpanded(true)}>
                <Maximize2 size={14} aria-hidden="true" />
                Expand
              </button>
            </div>
          </div>
          <div className="seller-board-preview">
            <FulfillmentBoard
              fulfillment={fulfillment}
              role="seller"
              board={board}
              onExpand={() => setBoardExpanded(true)}
              onOpenProfile={(order) =>
                openBuyerProfile(
                  order.buyer,
                  order.buyerFb,
                  order.buyerSocialLinks,
                )
              }
            />
          </div>
          <FulfillmentLiveRegion text={board.announcement} />
        </section>

        {boardExpanded && (
          <div
            className="seller-board-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Fulfillment Board — expanded view"
          >
            <header>
              <div>
                <button type="button" onClick={() => setBoardExpanded(false)}>
                  <X size={16} aria-hidden="true" /> Back to Dashboard
                </button>
                <h2>Fulfillment Board</h2>
              </div>
              <span>Track all orders across fulfillment stages</span>
            </header>
            <div className="seller-board-dialog__body">
              <div className="seller-board-dialog__columns">
                <FulfillmentBoard
                  fulfillment={fulfillment}
                  role="seller"
                  board={board}
                  expanded
                  onOpenProfile={(order) =>
                    openBuyerProfile(
                      order.buyer,
                      order.buyerFb,
                      order.buyerSocialLinks,
                    )
                  }
                />
              </div>
            </div>
            <FulfillmentLiveRegion text={board.announcement} />
          </div>
        )}

        {buyerProfile && (
          <BuyerProfileModal
            buyer={buyerProfile.name}
            contactUrl={buyerProfile.contactUrl}
            socialLinks={buyerProfile.socialLinks}
            orderCounts={buyerProfile.orderCounts}
            onClose={() => setBuyerProfile(null)}
          />
        )}
        {showSalesReport && (
          <SalesReportModal
            batches={batches}
            fulfillment={fulfillment}
            shopName={user?.name || "My Shop"}
            onClose={() => setShowSalesReport(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="bdash">
      <div className="bdash-stats">
        {stats.map((s, i) => {
          const openCard = () => {
            if (s.label === "Waitlist Position") openWaitlist()
            else if (s.label === "Completed Orders") setTab("Payments")
            else {
              navIntent.openBatchCheckout = s.label === "Pending Payment"

              setTab("My Claims")
            }
          }

          return (
            <div
              key={s.label}
              className={`bdash-stat bdash-stat--${i + 1} fi bdash-stat--interactive`}
              style={{ background: s.bg, animationDelay: `${i * 60}ms` }}
              role="button"
              tabIndex={0}
              aria-label={`Open ${
                s.label === "Completed Orders"
                  ? "Payment History"
                  : s.label === "Pending Payment"
                    ? "Batch Checkout"
                    : s.label === "Active Claims"
                      ? "My Claims To Pay"
                      : "full waitlist"
              }`}
              onClick={openCard}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()

                  openCard()
                }
              }}
            >
              <div className="bdash-stat__icon" style={{ color: s.sc }}>
                <s.icon size={22} aria-hidden="true" />
              </div>
              <div className="bdash-stat__value">{s.value}</div>
              <div className="bdash-stat__label">{s.label}</div>
              <div className="bdash-stat__sub" style={{ color: s.sc }}>
                {s.sub}
              </div>
            </div>
          )
        })}
      </div>
      {role === "Seller" && (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: "1fr 340px" }}
        >
          <Card>
            <SH
              title="Recent Orders"
              action={
                <SecondaryBtn onClick={() => setTab("My Claims")}>
                  View All
                </SecondaryBtn>
              }
            />
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {["Product", "Buyer", "Amount", "Status", "Deadline"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          color: "#9CA3AF",

                          fontWeight: 600,

                          fontSize: 11,

                          paddingBottom: 8,

                          textAlign: "left",

                          paddingRight: 12,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {claims.slice(0, 5).map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: "1px solid #F9FAFB" }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setTab("My Claims")}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <ProductThumb name={c.product} />
                        <span style={{ color: "#111827", fontWeight: 500 }}>
                          {c.product}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={c.seller} size={20} />
                        <span style={{ color: "#374151", fontSize: 12 }}>
                          {c.seller}
                        </span>
                      </div>
                    </td>
                    <td
                      className="py-2.5 pr-3"
                      style={{
                        color: "#111827",

                        fontWeight: 700,

                        fontFamily: "'Josefin Sans',sans-serif",
                      }}
                    >
                      ₱{c.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5">
                      {c.status === "Pending" && c.hours > 0 ? (
                        <Countdown
                          hours={c.hours}
                          id={c.id}
                          expiresAt={c.expiresAt}
                          paused={Boolean(c.deadlinePausedAt)}
                        />
                      ) : (
                        <span style={{ color: "#D1D5DB", fontSize: 12 }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card style={{ background: "#FFFBF5", border: "1px solid #FCE4C8" }}>
            <SH title="Pending Actions" />
            <div className="space-y-3">
              {[
                {
                  icon: ClipboardList,

                  label: "Payments to Verify",

                  count: paymentsToVerify.length,

                  tab: "Payments" as Tab,
                },

                {
                  icon: Clock3,

                  label: "Extension Requests",

                  count: pendingExtensions.length,

                  tab: "Batches" as Tab,
                },

                {
                  icon: Package,

                  label: "Shipping Fees to Set",

                  count: shippingFeesToSet.length,

                  tab: "My Claims" as Tab,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "#fff",

                    borderRadius: 8,

                    border: "1px solid #E5E7EB",

                    padding: "10px 14px",

                    display: "flex",

                    alignItems: "center",

                    gap: 10,
                  }}
                >
                  <item.icon
                    size={18}
                    aria-hidden="true"
                    style={{ color: "#9CA3AF", flexShrink: 0 }}
                  />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 13,

                        fontWeight: 600,

                        color: "#111827",
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}
                    >
                      {item.count} pending
                    </div>
                  </div>
                  <SecondaryBtn
                    onClick={() => {
                      if (item.label === "Shipping Fees to Set")
                        navIntent.orderFilter = "Pending"

                      setTab(item.tab)
                    }}
                  >
                    View All
                  </SecondaryBtn>
                </div>
              ))}
              <div
                style={{
                  background: "#D4F5EA",

                  borderRadius: 8,

                  padding: "10px 14px",

                  fontSize: 12,

                  color: "#065F46",

                  fontWeight: 600,

                  textAlign: "center",
                }}
              >
                <CheckCircle2
                  size={13}
                  aria-hidden="true"
                  style={{
                    display: "inline",

                    verticalAlign: -2,

                    marginRight: 4,
                  }}
                />
                No "Pay All Pending" needed — sellers verify, not pay.
              </div>
            </div>
          </Card>
        </div>
      )}
      {role !== "Seller" && (
        <div className="bdash-main">
          <div className="bdash-card">
            <div className="bdash-section-head">
              <h2>Recent Claims</h2>
              <button
                type="button"
                className="bdash-viewall"
                onClick={() => setTab("My Claims")}
              >
                View All
              </button>
            </div>
            <div className="bdash-table-wrap">
              <table className="bdash-table">
                <thead>
                  <tr>
                    {[
                      "Products",

                      "Batch",

                      "Seller",

                      "Amount",

                      "Status",

                      "Deadline",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentClaims.map((c) => (
                    <tr
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => setTab("My Claims")}
                    >
                      <td>
                        <div className="bdash-cell-product">
                          <ProductThumb name={c.product} />
                          <span>{c.product}</span>
                        </div>
                      </td>
                      <td>
                        <span className="bdash-cell-batch">{c.batch}</span>
                      </td>
                      <td>
                        <div className="bdash-cell-seller">
                          <Avatar name={c.seller} size={20} />
                          <span>{c.seller}</span>
                        </div>
                      </td>
                      <td>
                        <span className="bdash-cell-amount">
                          ₱{c.amount.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        {c.status === "Pending" && c.hours > 0 ? (
                          <Countdown
                            hours={c.hours}
                            id={c.id}
                            expiresAt={c.expiresAt}
                          />
                        ) : (
                          <span style={{ color: "#D1D5DB", fontSize: 12 }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recentClaims.length === 0 && (
              <div className="bdash-empty">No recent claims.</div>
            )}
          </div>

          <aside className="bdash-side">
            <h2>Upcoming Deadlines</h2>
            {upcoming.map((d, i) => (
              <div
                key={i}
                className={`bdash-deadline${
                  d.hours < 6 ? " bdash-deadline--urgent" : ""
                }`}
              >
                <div>
                  <div className="bdash-deadline__name">{d.product}</div>
                  <div className="bdash-deadline__seller">{d.seller}</div>
                </div>
                <div>
                  <div className="bdash-deadline__amount">
                    ₱{d.amount.toLocaleString()}
                  </div>
                  <div className="bdash-deadline__time">
                    <Countdown
                      hours={d.hours}
                      id={d.id}
                      expiresAt={d.expiresAt}
                    />
                  </div>
                </div>
              </div>
            ))}
            {upcoming.length > 0 ? (
              <button
                type="button"
                className="bdash-payall"
                onClick={() => setShowPayAll(true)}
              >
                Pay All Pending
              </button>
            ) : (
              <div className="bdash-cleared">
                <CheckCircle2
                  size={13}
                  aria-hidden="true"
                  style={{
                    display: "inline",

                    verticalAlign: -2,

                    marginRight: 4,
                  }}
                />
                No upcoming deadlines!
              </div>
            )}
          </aside>
        </div>
      )}
      <section className="buyer-fulfillment-section">
        <div className="seller-section-heading seller-board-heading">
          <h2>Fulfillment Board</h2>
          <button type="button" onClick={() => setBoardExpanded(true)}>
            <Maximize2 size={14} aria-hidden="true" />
            Expand
          </button>
        </div>
        <FulfillmentBoard
          fulfillment={fulfillment}
          role="buyer"
          board={board}
          onExpand={() => setBoardExpanded(true)}
          onViewOrder={(order) =>
            setBuyerOrderDetailsId(order.dbId || order.id)
          }
        />
        <FulfillmentLiveRegion text={board.announcement} />
      </section>
      {boardExpanded && (
        <div
          className="seller-board-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Fulfillment Board — expanded view"
        >
          <header>
            <div>
              <button type="button" onClick={() => setBoardExpanded(false)}>
                <X size={16} aria-hidden="true" /> Back to Dashboard
              </button>
              <h2>Fulfillment Board</h2>
            </div>
            <span>Track all orders across fulfillment stages</span>
          </header>
          <div className="seller-board-dialog__body">
            <div className="seller-board-dialog__columns">
              <FulfillmentBoard
                fulfillment={fulfillment}
                role="buyer"
                board={board}
                expanded
                onViewOrder={(order) =>
                  setBuyerOrderDetailsId(order.dbId || order.id)
                }
              />
            </div>
          </div>
        </div>
      )}
      {buyerOrderDetailsId &&
        (() => {
          const order = orders.find(
            (candidate) =>
              candidate.dbId === buyerOrderDetailsId ||
              candidate.id === buyerOrderDetailsId,
          )
          return order ? (
            <OrderDetailsModal
              order={order}
              payHistory={payHistory}
              onClose={() => setBuyerOrderDetailsId(null)}
            />
          ) : null
        })()}
      {showPayAll && (
        <BatchCheckoutModal
          items={payableToPay}
          contactPrefill={user.fb || ""}
          onSubmit={handleBatchPayment}
          onClose={() => setShowPayAll(false)}
        />
      )}
      {buyerProfile && (
        <BuyerProfileModal
          buyer={buyerProfile.name}
          contactUrl={buyerProfile.contactUrl}
          socialLinks={buyerProfile.socialLinks}
          orderCounts={buyerProfile.orderCounts}
          onClose={() => setBuyerProfile(null)}
        />
      )}
      {showSalesReport && (
        <SalesReportModal
          batches={batches}
          fulfillment={fulfillment}
          shopName={user?.name || "My Shop"}
          onClose={() => setShowSalesReport(false)}
        />
      )}
      {showWaitlist && (
        <WaitlistModal
          entries={waitlist}
          activeId={activeWaitlistId}
          onSelect={setActiveWaitlistId}
          onClose={() => setShowWaitlist(false)}
          onViewBatch={(batchId) => {
            navIntent.batchId = batchId

            setShowWaitlist(false)

            setTab("Batches")
          }}
        />
      )}
    </div>
  )
}
