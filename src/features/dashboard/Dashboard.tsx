import { useState, useEffect, useMemo } from "react"
import { Package, CreditCard, Clock3, CheckCircle2, Plane, ClipboardList, Maximize2, X, FileText } from "lucide-react"
import type { ClaimStatus, PayHistRow, Tab, SharedState } from "@/types"
import { navIntent } from "@/state/navIntent"
import { sortWaitlistUpcoming } from "@/data/waitlist"
import { CREAM, CYAN_L, GREEN, AMBER, TODAY } from "@/constants/theme"
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
  KANBAN_COLS,
  PRIOR_FULFILLED,
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentDetails,
} from "@/features/fulfillment"
import SalesReportModal from "./SalesReportModal"
import WaitlistModal from "./WaitlistModal"

type MetricTier = "critical" | "active" | "quiet"
const EMERALD = "#10B981"

type MetricCardProps = {
  label: string
  value: string
  icon: typeof Package
  sub: string
  tier: MetricTier
  actionLabel: string
  onActivate: () => void
  animationDelay: number
}

type MetricDefinition = Omit<MetricCardProps, "onActivate" | "animationDelay">

function MetricCard({
  label,
  value,
  icon: Icon,
  sub,
  tier,
  actionLabel,
  onActivate,
  animationDelay,
}: MetricCardProps) {
  const tierStyles = {
    critical: {
      accent: "#E1503A",
      background: "#FFF8F4",
      shadow: "0 10px 28px rgba(225,80,58,0.18)",
      icon: "#E1503A",
      affordance: "#E1503A",
    },
    active: {
      accent: label === "Waitlist Position" ? "#3268D8" : EMERALD,
      background: "#F7F8FF",
      shadow: label === "Waitlist Position"
        ? "0 5px 16px rgba(50,104,216,0.1)"
        : "0 5px 16px rgba(16,185,129,0.14)",
      icon: label === "Waitlist Position" ? "#3268D8" : EMERALD,
      affordance: label === "Waitlist Position" ? "#3268D8" : EMERALD,
    },
    quiet: {
      accent: "transparent",
      background: "#F6F5FA",
      shadow: "none",
      icon: "#7A7890",
      affordance: "#7A7890",
    },
  }[tier]
  const hoverClass =
    tier === "critical"
      ? "hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(225,80,58,0.24)]"
      : tier === "active"
        ? label === "Waitlist Position"
          ? "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(50,104,216,0.2)]"
          : "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(16,185,129,0.22)]"
        : "hover:bg-white hover:shadow-[0_6px_18px_rgba(16,185,129,0.1)]"

  return (
    <div className="fi" style={{ animationDelay: `${animationDelay}ms` }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}: ${value}. ${actionLabel}`}
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onActivate()
          }
        }}
        className={`group relative min-h-[142px] cursor-pointer overflow-hidden rounded-[10px] border border-[#E5E7EB] p-[18px_20px] transition-all duration-200 ${hoverClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
        style={{
          background: tierStyles.background,
          boxShadow: tierStyles.shadow,
        }}
      >
        {tier !== "quiet" && (
          <div
            aria-hidden="true"
            style={{ background: tierStyles.accent }}
            className="absolute inset-x-0 top-0 h-1"
          />
        )}
        <div className="mb-3 flex items-start justify-between">
          <Icon size={20} aria-hidden="true" style={{ color: tierStyles.icon }} />
          {tier === "critical" && (
            <span
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#B33B2B]"
              style={{ animation: "pulseRed 1.4s ease-in-out infinite" }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E1503A] opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E1503A]" />
              </span>
              Action needed
            </span>
          )}
        </div>
        <div className="mb-1 font-['Manrope'] text-[26px] font-extrabold leading-none tracking-[-0.04em] text-[#111827]">
          {value}
        </div>
        <div className="text-xs font-medium text-[#6B7280]">{label}</div>
        <div className="mt-1 text-[11px] font-semibold" style={{ color: tierStyles.icon }}>
          {sub}
        </div>
        <span
          className="absolute bottom-3 right-4 translate-y-2 text-[11px] font-bold opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none"
          style={{ color: tierStyles.affordance }}
        >
          {actionLabel} →
        </span>
      </div>
    </div>
  )
}

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
  user,
}: SharedState) {
  const [showPayAll, setShowPayAll] = useState(false)
  const [buyerProfile, setBuyerProfile] = useState<string | null>(null)
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
  const recentClaims = activeClaims.slice(0, 5)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentClaimCount = claims.filter((claim) => {
    const createdAt = claim.createdAt
      ? Date.parse(claim.createdAt)
      : typeof claim.id === "number" && claim.id > weekAgo
        ? claim.id
        : NaN
    return Number.isFinite(createdAt) && createdAt >= weekAgo
  }).length
  const closestPendingClaim = activeClaims
    .filter((claim) => claim.hours > 0)
    .reduce<typeof activeClaims[number] | null>(
      (closest, claim) => (!closest || claim.hours < closest.hours ? claim : closest),
      null,
    )
  const pendingTotal = toPay.reduce((s, t) => s + t.amount, 0)

  const buyerStats: MetricDefinition[] = [
    {
      label: "Active Claims",
      value: String(activeClaims.length),
      icon: Package,
      sub: recentClaimCount > 0 ? `+${recentClaimCount} this week` : "All caught up",
      tier: "active",
      actionLabel: "View all",
    },
    {
      label: "Pending Payments",
      value: `₱${pendingTotal.toLocaleString()}`,
      icon: CreditCard,
      sub: closestPendingClaim
        ? `Next one due in ${Math.ceil(closestPendingClaim.hours)}h`
        : "All caught up",
      tier: "critical",
      actionLabel: "Pay now",
    },
    {
      label: "Waitlist Position",
      value: closestWaitlist ? `#${closestWaitlist.position}` : "—",
      icon: Clock3,
      sub: "Up 2 spots today",
      tier: "active",
      actionLabel: "Track",
    },
    {
      label: "Completed Orders",
      value: "47",
      icon: CheckCircle2,
      sub: "All-time total",
      tier: "quiet",
      actionLabel: "History",
    },
  ]
  const sellerStats: MetricDefinition[] = [
    {
      label: "Active Batches",
      value: String(batches.filter((b) => b.live).length),
      icon: Plane,
      sub: "(open + scheduled)",
      tier: "active",
      actionLabel: "View all",
    },
    {
      label: "Awaiting Verification",
      value: "3",
      icon: ClipboardList,
      sub: "Payment proofs to review",
      tier: "critical",
      actionLabel: "Review",
    },
    {
      label: "Extension Requests",
      value: "2",
      icon: Clock3,
      sub: "Awaiting your approval",
      tier: "active",
      actionLabel: "Review",
    },
    {
      label: "Orders Fulfilled",
      value: String(
        PRIOR_FULFILLED + fulfillment.filter((o) => o.col === "Completed").length,
      ),
      icon: CheckCircle2,
      sub: "Completed this quarter",
      tier: "quiet",
      actionLabel: "History",
    },
  ]
  const stats: MetricDefinition[] = role === "Seller" ? sellerStats : buyerStats
  const upcoming = useMemo(
    () => [...toPay].sort((a, b) => a.hours - b.hours).slice(0, 4),
    [toPay],
  )

  const handleBatchPayment = (item: (typeof toPay)[number], method: string) => {
    setPayHistory((history) => [
      {
        id: history.length + 1,
        product: item.product,
        batch: "",
        method,
        amount: item.amount,
        date: TODAY,
        status: "Paid and Reserved" as ClaimStatus,
      },
      ...history,
    ])
    setClaims((prev) =>
      prev.map((c) =>
        c.id === item.id && c.status === "Pending"
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    setToPay((items) => items.filter((candidate) => candidate.id !== item.id))
  }

  // Kanban columns for the seller Fulfillment Board. Rendered both inside the
  // embedded dashboard card and inside the full-screen expanded overlay; the
  // `expanded` flag simply gives each column more room.
  const renderBoardColumns = (expanded: boolean) =>
    KANBAN_COLS.map((col) => {
      const colColors: Record<string, string> = {
        Claimed: "#EEF0FF",
        "Pending Payment": "#FFF7ED",
        "Payment Confirmed": CYAN_L,
        Preparing: "#F0FDF4",
        Completed: "#D4F5EA",
        Cancelled: "#FEE2E2",
      }
      const colOrders = fulfillment.filter((o) => o.col === col)
      return (
        <div
          key={col}
          style={{
            minWidth: expanded ? 260 : 180,
            width: expanded ? 260 : undefined,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: colColors[col] || CREAM,
              borderRadius: "8px 8px 0 0",
              padding: "8px 12px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
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
          <div className="space-y-2">
            {colOrders.map((o) => {
              const isExpanded = board.expandedId === o.id
              return (
                <div
                  key={o.id}
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
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
                          setBuyerProfile(o.buyer)
                        }}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: EMERALD,
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
                        color: EMERALD,
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

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <MetricCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            sub={s.sub}
            tier={s.tier}
            actionLabel={s.actionLabel}
            animationDelay={i * 60}
            onActivate={
              s.label === "Active Claims"
                ? () => setTab("My Claims")
                : s.label === "Waitlist Position"
                  ? openWaitlist
                  : s.label === "Pending Payments" || s.label === "Awaiting Verification"
                    ? () => setTab("Payments")
                    : s.label === "Active Batches" || s.label === "Extension Requests"
                      ? () => setTab("Batches")
                      : () => setTab("Orders")
            }
          />
        ))}
      </div>
      {role === "Seller" && (
        <div
          className="grid gap-5"
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
                        <Countdown hours={c.hours} id={c.id} />
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
                  count: 3,
                  tab: "Payments" as Tab,
                },
                {
                  icon: Clock3,
                  label: "Extension Requests",
                  count: 2,
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
                    color: EMERALD,
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
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
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "1fr 340px" }}
        >
          <Card>
            <SH
              title="Recent Claims"
              action={
                <SecondaryBtn onClick={() => setTab("My Claims")}>
                  View All
                </SecondaryBtn>
              }
            />
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {[
                    "Product",
                    "Batch",
                    "Seller",
                    "Amount",
                    "Status",
                    "Deadline",
                  ].map((h) => (
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
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentClaims.map((c) => {
                  return (
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
                          <span style={{ color: "#6B7280", fontSize: 12 }}>
                            {c.batch}
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
                          <Countdown hours={c.hours} id={c.id} />
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
          </Card>
          <Card style={{ background: "#FFFBF5", border: "1px solid #FCE4C8" }}>
            <SH title="Upcoming Deadlines" />
            <div className="space-y-3">
              {upcoming.map((d, i) => (
                <div
                  key={i}
                  style={{
                    background:
                      d.hours < 6
                        ? "#FFF7ED"
                        : d.hours < 24
                          ? "#FFFBF0"
                          : "#fff",
                    borderRadius: 8,
                    border: `1px solid ${d.hours < 6
                      ? "#FED7AA"
                      : d.hours < 24
                        ? "#FDE68A"
                        : "#F3F4F6"
                      }`,
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
                    <Countdown hours={d.hours} id={d.id} />
                  </div>
                </div>
              ))}
              {toPay.length > 0 ? (
                <PrimaryBtn
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 4,
                  }}
                  onClick={() => setShowPayAll(true)}
                >
                  Batch Checkout
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
          items={toPay}
          contactPrefill={user.fb || ""}
          onSubmit={handleBatchPayment}
          onClose={() => setShowPayAll(false)}
        />
      )}
      {buyerProfile && (
        <BuyerProfileModal
          buyer={buyerProfile}
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
