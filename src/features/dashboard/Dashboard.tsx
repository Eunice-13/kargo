import { useState, useEffect, useMemo } from "react"
import { Package, CreditCard, Clock3, CheckCircle2, Plane, ClipboardList, Maximize2, X, FileText } from "lucide-react"
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
  PayModal,
  BuyerProfileModal,
} from "@/components/shared"
import {
  KANBAN_COLS,
  PRIOR_FULFILLED,
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentDetails,
} from "@/features/fulfillment"
import SalesReportModal from "./SalesReportModal"
import WaitlistModal from "./WaitlistModal"

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
  const pending = claims.filter((c) => c.status === "Pending")
  const pendingTotal = toPay.reduce((s, t) => s + t.amount, 0)

  const buyerStats = [
    {
      label: "Active Claims",
      value: String(claims.filter((c) => c.status === "Pending").length),
      icon: Package,
      sub: "+3 this week",
      sc: GREEN,
      bg: "#E8F9F3",
    },
    {
      label: "Pending Payments",
      value: `₱${pendingTotal.toLocaleString()}`,
      icon: CreditCard,
      sub: `${toPay.length} items due soon`,
      sc: AMBER,
      bg: "#FFF8E8",
    },
    {
      label: "Waitlist Position",
      value: closestWaitlist ? `#${closestWaitlist.position}` : "—",
      icon: Clock3,
      sub: closestWaitlist ? closestWaitlist.product : "No waitlisted items",
      sc: "#6B7280",
      bg: CYAN_L,
    },
    {
      label: "Completed Orders",
      value: "47",
      icon: CheckCircle2,
      sub: "All time",
      sc: "#6B7280",
      bg: "#F0EEFF",
    },
  ]
  const sellerStats = [
    {
      label: "Active Batches",
      value: String(batches.filter((b) => b.live).length),
      icon: Plane,
      sub: "(open + scheduled)",
      sc: GREEN,
      bg: CREAM,
    },
    {
      label: "Awaiting Verification",
      value: "3",
      icon: ClipboardList,
      sub: "Payment proofs to review",
      sc: AMBER,
      bg: CYAN_L,
    },
    {
      label: "Extension Requests",
      value: "2",
      icon: Clock3,
      sub: "Awaiting your approval",
      sc: "#6B7280",
      bg: "#FFF7ED",
    },
    {
      label: "Orders Fulfilled",
      value: String(
        PRIOR_FULFILLED + fulfillment.filter((o) => o.col === "Completed").length,
      ),
      icon: CheckCircle2,
      sub: "Completed this quarter",
      sc: "#6B7280",
      bg: "#F0FDF4",
    },
  ]
  const stats = role === "Seller" ? sellerStats : buyerStats
  const upcoming = toPay.slice(0, 4)

  const handlePayAll = (method: string) => {
    const newHist: PayHistRow[] = toPay.map((t, i) => ({
      id: payHistory.length + i + 1,
      product: t.product,
      batch: "",
      method,
      amount: t.amount,
      date: TODAY,
      status: "Paid and Reserved" as ClaimStatus,
    }))
    setPayHistory((h) => [...newHist, ...h])
    setClaims((prev) =>
      prev.map((c) =>
        toPay.some((t) => t.product === c.product) && c.status === "Pending"
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    setToPay([])
    setShowPayAll(false)
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
                        color: INDIGO,
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
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const isWaitlist = s.label === "Waitlist Position"
          return (
          <div
            key={s.label}
            className="fi"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              role={isWaitlist ? "button" : undefined}
              tabIndex={isWaitlist ? 0 : undefined}
              aria-label={isWaitlist ? "Open full waitlist" : undefined}
              onClick={isWaitlist ? openWaitlist : undefined}
              onKeyDown={
                isWaitlist
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        openWaitlist()
                      }
                    }
                  : undefined
              }
              style={{
                background: s.bg,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                cursor: isWaitlist ? "pointer" : undefined,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <s.icon size={20} aria-hidden="true" style={{ color: s.sc }} />
              </div>
              <div
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1,
                }}
                className="mb-1"
              >
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: s.sc,
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {s.sub}
              </div>
            </div>
          </div>
        )})}
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
                        <Countdown hours={c.hours} />
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
                {claims.slice(0, 5).map((c) => {
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
                          <Countdown hours={c.hours} />
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
                    border: `1px solid ${
                      d.hours < 6
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
                    <Countdown hours={d.hours} />
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
        <PayModal
          items={toPay.map((t) => ({ product: t.product, amount: t.amount }))}
          onConfirm={handlePayAll}
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
