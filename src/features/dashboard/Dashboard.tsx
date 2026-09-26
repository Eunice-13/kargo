import { useState, useEffect, useMemo } from "react"
import { Package, CreditCard, Clock3, CheckCircle2, Plane, ClipboardList, Maximize2, X, FileText } from "lucide-react"
import type { ClaimStatus, PayHistRow, Tab, SharedState } from "@/types"
import { navIntent } from "@/state/navIntent"
import { sortWaitlistUpcoming } from "@/data/waitlist"
import {
  INDIGO,
  CREAM,
  CYAN_L,
  GREEN,
  AMBER,
  TODAY,
  STAT_GREEN_BG,
  STAT_GREEN_FG,
  STAT_AMBER_BG,
  STAT_AMBER_FG,
  STAT_CORAL_BG,
  STAT_CORAL_FG,
  STAT_NEUTRAL_BG,
  STAT_NEUTRAL_FG,
  STAT_GREEN_EDGE,
  STAT_AMBER_EDGE,
  STAT_CORAL_EDGE,
  STAT_NEUTRAL_EDGE,
  SIDEBAR_PANEL,
  TABLE_HEADER_BLUE,
} from "@/constants/theme"
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
import BatchCheckoutModal from "@/features/payments/BatchCheckoutModal"
import {
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentDetails,
} from "@/features/fulfillment"
import SalesReportModal from "./SalesReportModal"
import StatCard from "./StatCard"
import WaitlistModal from "./WaitlistModal"
import SellerWaitlistCard from "./SellerWaitlistCard"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import { claimIsPayable, deadlineHasPassed } from "@/features/claims/claimExpiry"

const SELLER_BOARD_COLUMNS = [
  "Pending Payment",
  "Payment Confirmed",
  "Preparing",
  "Completed",
  "Cancelled",
] as const

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
  const [buyerProfile, setBuyerProfile] = useState<{ name: string; contactUrl?: string } | null>(null)
  const [boardExpanded, setBoardExpanded] = useState(false)
  const [showSalesReport, setShowSalesReport] = useState(false)
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [activeWaitlistId, setActiveWaitlistId] = useState<string | null>(null)
  const board = useFulfillmentBoard(setFulfillment)

  const waitlistSorted = useMemo(() => sortWaitlistUpcoming(waitlist), [waitlist])
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
  // Recent Claims (reference, Option B): show the buyer's most recent claims
  // regardless of status, newest first — the label matches the content.
  const recentClaims = [...claims].sort((a, b) => Number(b.id) - Number(a.id))
  // Completed orders come from real order state: an order reaches its final
  // step (5 = Delivered) when fulfilled. Per-account, since `orders` is the
  // current buyer's list. `.length` because the stat card renders a count.
  // NOTE: merge resolution — upstream also declared `completedOrders` as the
  // filtered array (no `.length`); kept the count form since its only consumer
  // is the "Completed Orders" stat value below (String(completedOrders)).
  const completedOrders = orders.filter((o) => o.step === 5).length
  const payableToPay = toPay.filter((item) => !deadlineHasPassed(item))
  const pendingTotal = payableToPay.reduce((s, t) => s + t.amount, 0)

  // ─── Seller stat sources (derived from live data, not hardcoded) ───────────
  // Scope to the signed-in seller's own batches.
  const myLiveBatches = batches.filter((b) => b.live && b.seller === user.name)
  // Payment proofs awaiting the seller's review = orders sitting in the
  // "Pending Payment" column of the fulfillment board.
  const paymentsToVerify = fulfillment.filter((o) => o.col === "Pending Payment")
  // Extension requests awaiting this seller's approval: claims on their orders
  // that requested an extension and are still pending a decision.
  const pendingExtensions = claims.filter(
    (c) => c.extensionRequested && c.status === "Pending" && c.seller === user.name,
  )
  // Orders fulfilled = orders moved to the board's "Completed" column.
  const ordersFulfilled = fulfillment.filter((o) => o.col === "Completed")

  const soonestPayableHours = payableToPay.length
    ? Math.max(0, Math.round(Math.min(...payableToPay.map((item) => item.hours))))
    : null
  const buyerStats = [
    {
      label: "Active Claims",
      value: String(activeClaims.length),
      icon: Package,
      sub: activeClaims.length > 0 ? `${activeClaims.length} awaiting action` : "All caught up",
      sc: STAT_GREEN_FG,
      bg: STAT_GREEN_BG,
      edge: STAT_GREEN_EDGE,
    },
    {
      label: "Pending Payment",
      value: `₱${pendingTotal.toLocaleString()}`,
      icon: CreditCard,
      sub: soonestPayableHours !== null ? `Next one due in ${soonestPayableHours}h` : "Nothing due",
      sc: STAT_AMBER_FG,
      bg: STAT_AMBER_BG,
      edge: STAT_AMBER_EDGE,
    },
    {
      label: "Waitlist Position",
      value: closestWaitlist ? `#${closestWaitlist.position}` : "—",
      icon: Clock3,
      sub: closestWaitlist ? closestWaitlist.product : "No waitlisted items",
      sc: STAT_CORAL_FG,
      bg: STAT_CORAL_BG,
      edge: STAT_CORAL_EDGE,
    },
    {
      label: "Completed Orders",
      value: String(completedOrders),
      icon: CheckCircle2,
      sub: "All caught up",
      sc: STAT_NEUTRAL_FG,
      bg: STAT_NEUTRAL_BG,
      edge: STAT_NEUTRAL_EDGE,
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
  // Upcoming Deadlines: only items due within the next 24 hours (scoped task),
  // soonest first, capped to keep the sidebar compact.
  const upcoming = useMemo(
    () =>
      payableToPay
        .filter((item) => item.hours < 24)
        .sort((a, b) => a.hours - b.hours)
        .slice(0, 4),
    [payableToPay],
  )

  const handleBatchPayment = async (item: (typeof toPay)[number], method: string, referenceNumber: string, receipt?: File) => {
    const claim = claims.find((candidate) => String(candidate.id) === String(item.orderId ?? item.id))
    if (!claim || !claimIsPayable(claim) || deadlineHasPassed(item)) {
      alert("This claim has expired and can no longer be paid.")
      return
    }
    if (isSupabaseConfigured) {
      try {
        await kargoApi.submitPayment({ orderId: item.orderId ?? String(item.id), method, amount: item.amount, referenceNumber, receipt })
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to submit payment.")
        return
      }
    }
    setPayHistory((history) => [
      {
        id: history.length + 1,
        product: item.product,
        batch: "",
        method,
        amount: item.amount,
        date: TODAY,
        status: (isSupabaseConfigured ? "Pending" : "Paid and Reserved") as ClaimStatus,
      },
      ...history,
    ])
    if (!isSupabaseConfigured) setClaims((prev) =>
      prev.map((c) =>
        c.id === item.id && c.status === "Pending"
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    if (!isSupabaseConfigured) setToPay((items) => items.filter((candidate) => candidate.id !== item.id))
  }

  // Kanban columns for the seller Fulfillment Board. Rendered both inside the
  // embedded dashboard card and inside the full-screen expanded overlay; the
  // `expanded` flag simply gives each column more room.
  const renderBoardColumns = (expanded: boolean) =>
    SELLER_BOARD_COLUMNS.map((col) => {
      const colColors: Record<string, string> = {
        Claimed: "#EEF0FF",
        "Pending Payment": "#FFF7ED",
        "Payment Confirmed": CYAN_L,
        Preparing: "#F0FDF4",
        Completed: "#D4F5EA",
        Cancelled: "#FEE2E2",
      }
      // "Claimed" is the existing pre-payment state. The reference combines
      // it with Pending Payment visually; the underlying status is untouched.
      const colOrders = fulfillment.filter((o) =>
        col === "Pending Payment"
          ? o.col === "Claimed" || o.col === "Pending Payment"
          : o.col === col,
      )
      const visibleOrders = expanded ? colOrders : colOrders.slice(0, 3)
      return (
        <div
          key={col}
          className="seller-board-column"
          style={{ minWidth: expanded ? 260 : undefined }}
        >
          <div
            className="seller-board-column__head"
            style={{ background: colColors[col] || CREAM }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#374151",
              }}
            >
              {col}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#6B7280",
                background: "rgba(255,255,255,0.6)",
                borderRadius: 999,
                padding: "1px 7px",
              }}
            >
              {colOrders.length}
            </span>
          </div>
          <div className="seller-board-column__cards space-y-2">
            {visibleOrders.map((o) => {
              const isExpanded = board.expandedId === o.id
              return (
                <div
                  key={o.id}
                  className="seller-board-card"
                >
                  <div
                    onClick={() => board.toggle(o.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} order for ${o.buyer} — ${o.product}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        board.toggle(o.id)
                      }
                    }}
                    style={{ padding: "9px 10px", cursor: "pointer" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar name={o.buyer} size={18} />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setBuyerProfile({ name: o.buyer, contactUrl: o.buyerFb })
                        }}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: INDIGO,
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        {o.buyer}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>
                      {o.product}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: GREEN,
                        marginTop: 4,
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{o.amount.toLocaleString()}
                    </div>
                  </div>
                  {isExpanded && (
                    <FulfillmentDetails order={o} onMove={board.move} />
                  )}
                </div>
              )
            })}
            {!expanded && colOrders.length > 3 && (
              <button
                type="button"
                className="seller-board-more"
                onClick={() => setBoardExpanded(true)}
                aria-label={`Show ${colOrders.length - 3} more ${col} orders`}
              >
                +{colOrders.length - 3} more
              </button>
            )}
            {colOrders.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: "#9CA3AF",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                —
              </div>
            )}
          </div>
        </div>
      )
    })

  if (String(role) === "Seller") {
    return (
      <div className="seller-dashboard">
        <section className="seller-stats" aria-label="Seller summary">
          {sellerStats.map((stat, index) => (
            <article
              key={stat.label}
              className={`seller-stat seller-stat--${index + 1} fi`}
              style={{ animationDelay: `${index * 60}ms`, background: stat.bg }}
            >
              <stat.icon size={20} aria-hidden="true" style={{ color: stat.sc }} />
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
                  {claims.slice(0, 7).map((claim, index) => {
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
                        <td><StatusBadge status={claim.status} /></td>
                        <td className={claim.hours > 0 && claim.hours < 6 ? "is-urgent" : index === 1 ? "is-warning" : ""}>
                          {claim.status === "Pending" && claim.hours > 0 ? (
                            <Countdown hours={claim.hours} id={claim.id} expiresAt={claim.expiresAt} />
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
                  count: paymentsToVerify.length,
                  tab: "Payments" as Tab,
                },
                {
                  icon: ClipboardList,
                  label: "Extension Requests",
                  count: pendingExtensions.length,
                  tab: "Batches" as Tab,
                },
              ].map((action) => (
                <div className="seller-action-row" key={action.label}>
                  <action.icon size={19} aria-hidden="true" />
                  <div>
                    <strong>{action.label}</strong>
                    <small>{action.count} Pending</small>
                  </div>
                  <button type="button" onClick={() => setTab(action.tab)}>
                    View All
                  </button>
                </div>
              ))}
            </section>

            <SellerWaitlistCard
              groups={sellerWaitlist}
              responseHours={user.waitlistResponseHours ?? 24}
              onSaveResponseHours={async (hours) => {
                if (isSupabaseConfigured) {
                  try {
                    await kargoApi.setWaitlistResponseHours(hours)
                  } catch (error) {
                    alert(error instanceof Error ? error.message : "Unable to save response window.")
                    return
                  }
                }
                setUser((current) => ({ ...current, waitlistResponseHours: hours }))
              }}
            />
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
            {renderBoardColumns(false)}
          </div>
          <FulfillmentLiveRegion text={board.announcement} />
        </section>

        {boardExpanded && (
          <div className="seller-board-dialog" role="dialog" aria-modal="true" aria-label="Fulfillment Board — expanded view">
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
                {renderBoardColumns(true)}
              </div>
            </div>
            <FulfillmentLiveRegion text={board.announcement} />
          </div>
        )}

        {buyerProfile && (
          <BuyerProfileModal
            buyer={buyerProfile.name}
            contactUrl={buyerProfile.contactUrl}
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
    <div className="p-8 space-y-8">
      <div className="buyer-stat-grid">
        {buyerStats.map((s) => (
          <StatCard
            key={s.label}
            value={s.value}
            label={s.label}
            sub={s.sub}
            accent={s.sc}
            bg={s.bg}
            edge={s.edge}
            icon={s.icon}
            onClick={s.label === "Waitlist Position" ? openWaitlist : undefined}
          />
        ))}
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
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{c.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5">
                      {c.status === "Pending" && c.hours > 0 ? (
                        <Countdown hours={c.hours} id={c.id} expiresAt={c.expiresAt} />
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
                  <item.icon size={18} aria-hidden="true" style={{ color: "#9CA3AF", flexShrink: 0 }} />
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
                  <SecondaryBtn onClick={() => setTab(item.tab)}>
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
                <CheckCircle2 size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
                No "Pay All Pending" needed — sellers verify, not pay.
              </div>
            </div>
          </Card>
        </div>
      )}
      {role === "Seller" && (
        <Card>
          <SH
            title="Fulfillment Board"
            action={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSalesReport(true)}
                  aria-label="Open sales report"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#374151",
                    background: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: 7,
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  <FileText size={14} />
                  Sales Report
                </button>
                <button
                  type="button"
                  onClick={() => setBoardExpanded(true)}
                  aria-label="Expand fulfillment board to full screen"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: INDIGO,
                    background: "#EEF0FF",
                    border: "1px solid #E0E3FF",
                    borderRadius: 7,
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  <Maximize2 size={14} />
                  Expand
                </button>
              </div>
            }
          />
          <div
            style={{
              display: "flex",
              gap: 16,
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {renderBoardColumns(false)}
          </div>
          <FulfillmentLiveRegion text={board.announcement} />
        </Card>
      )}
      {role === "Seller" && (
        <SellerWaitlistCard
          groups={sellerWaitlist}
          responseHours={user.waitlistResponseHours ?? 24}
          onSaveResponseHours={async (h) => {
            if (isSupabaseConfigured) {
              try {
                await kargoApi.setWaitlistResponseHours(h)
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unable to save response window.")
                return
              }
            }
            setUser((u) => ({ ...u, waitlistResponseHours: h }))
          }}
        />
      )}
      {boardExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fulfillment Board — expanded view"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "#F5F6FA",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: "#fff",
              borderBottom: "1px solid #E5E7EB",
              flexShrink: 0,
            }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBoardExpanded(false)}
                aria-label="Back to dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  background: "#F3F4F6",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  padding: "7px 12px",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
                Back to Dashboard
              </button>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                Fulfillment Board
              </h2>
            </div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              Track all orders across fulfillment stages
            </span>
          </div>
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
                minHeight: "100%",
              }}
            >
              {renderBoardColumns(true)}
            </div>
          </div>
          <FulfillmentLiveRegion text={board.announcement} />
        </div>
      )}
      {role !== "Seller" && (
        <div className="buyer-dashboard-layout grid gap-6">
          {/* Recent Claims: heading + View All sit ABOVE the card; the card
              (white surface) begins at the table's "Products" header row. */}
          <div className="buyer-claims-col">
            <div className="buyer-claims-head">
              <SH
                title="Recent Claims"
                action={
                  <PrimaryBtn size="sm" onClick={() => setTab("My Claims")}>
                    View All
                  </PrimaryBtn>
                }
              />
            </div>
            {/* No card behind the table (matches the seller "Recent Orders"):
                the table sits directly on the page with square corners. */}
            <div className="buyer-claims-table overflow-x-auto" style={{ maxHeight: 360, overflowY: "auto" }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: TABLE_HEADER_BLUE }}>
                  {[
                    "Products",
                    "Batch",
                    "Seller",
                    "Amount",
                    "Status",
                    "Deadline",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 11,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        padding: "10px 12px",
                        textAlign: "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentClaims.map((c, ri) => {
                  // Zebra striping matched to the seller orders table:
                  // odd rows #eeeeee, even rows white.
                  const stripe = ri % 2 === 1 ? "#EEEEEE" : "#fff"
                  return (
                    <tr
                      key={c.id}
                      style={{ background: stripe, borderBottom: "1px solid #F3F4F6" }}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setTab("My Claims")}
                    >
                      <td className="py-2.5" style={{ padding: "10px 12px" }}>
                        <div className="flex items-center gap-2">
                          <ProductThumb name={c.product} />
                          <span style={{ color: "#111827", fontWeight: 500 }}>
                            {c.product}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: "#6B7280", fontSize: 12 }}>
                            {c.batch}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div className="flex items-center gap-1.5">
                          <Avatar name={c.seller} size={20} />
                          <span style={{ color: "#374151", fontSize: 12 }}>
                            {c.seller}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          color: "#111827",
                          fontWeight: 700,
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                        }}
                      >
                        ₱{c.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <StatusBadge status={c.status} />
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {c.status === "Pending" && c.hours > 0 ? (
                          <Countdown hours={c.hours} id={c.id} expiresAt={c.expiresAt} />
                        ) : (
                          <span style={{ color: "#D1D5DB", fontSize: 12 }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {recentClaims.length === 0 && (
              <div style={{ padding: "24px 0", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                No claims yet.
              </div>
            )}
          </div>
          <Card style={{ background: SIDEBAR_PANEL, border: "none" }}>
            <SH title="Upcoming Deadlines" />
            <div className="space-y-3">
              {upcoming.map((d, i) => (
                <div
                  key={i}
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                  className="p-3 flex items-center justify-between"
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {d.product}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {d.seller}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{d.amount.toLocaleString()}
                    </div>
                    <Countdown hours={d.hours} id={d.id} expiresAt={d.expiresAt} />
                  </div>
                </div>
              ))}
              {payableToPay.length > 0 ? (
                <PrimaryBtn
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 4,
                  }}
                  onClick={() => setShowPayAll(true)}
                >
                  Pay All Pending
                </PrimaryBtn>
              ) : (
                <div
                  style={{
                    background: "#D4F5EA",
                    borderRadius: 8,
                    padding: "10px 14px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "#065F46",
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
                  All payments cleared!
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
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
          onRespond={async (entry, accept) => {
            if (isSupabaseConfigured) {
              try {
                await kargoApi.respondWaitlistOffer(String(entry.id), accept)
                // Server cascades (new order on accept, next-buyer offer on
                // decline) — re-pull the truth rather than guess locally.
                await refreshData()
                return
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unable to respond to offer.")
                return
              }
            }
            // Demo mode: reflect the decision locally.
            setWaitlist((prev) =>
              prev.map((e) =>
                e.id === entry.id
                  ? { ...e, status: accept ? "converted" : "cancelled", offerQuantity: undefined, offerExpiresAt: undefined }
                  : e,
              ),
            )
          }}
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
