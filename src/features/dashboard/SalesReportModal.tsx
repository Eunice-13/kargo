import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Printer, X } from "lucide-react"
import type { BatchType, FulfillmentOrder } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import type { PeriodOrder } from "@/services"
import { localExpenseStore } from "@/features/batches/expenseStore"

type Period = "Day" | "Week" | "Month" | "Year"

const MS_DAY = 86_400_000

function parseToday(): Date {
  const d = new Date(TODAY)
  return isNaN(d.getTime()) ? new Date() : d
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export default function SalesReportModal({
  batches,
  fulfillment,
  shopName,
  onClose,
}: {
  batches: BatchType[]
  fulfillment: FulfillmentOrder[]
  shopName: string
  onClose: () => void
}) {
  const today = useMemo(parseToday, [])
  const [period, setPeriod] = useState<Period>("Month")
  const [anchorDay, setAnchorDay] = useState(() => today.toISOString().slice(0, 10))
  const [anchorMonth, setAnchorMonth] = useState(() => today.toISOString().slice(0, 7))
  const [anchorYear, setAnchorYear] = useState(() => String(today.getFullYear()))

  const [dbOrders, setDbOrders] = useState<PeriodOrder[]>([])
  const [dbExpenses, setDbExpenses] = useState(0)
  const [loading, setLoading] = useState(false)

  // Resolve the selected period into a [from, to) range + a printed label.
  const { from, to, periodLabel } = useMemo(() => {
    if (period === "Day") {
      const f = new Date(`${anchorDay}T00:00:00`)
      return { from: f, to: new Date(f.getTime() + MS_DAY), periodLabel: fmtDate(f) }
    }
    if (period === "Week") {
      const f = startOfWeek(new Date(`${anchorDay}T00:00:00`))
      const t = new Date(f.getTime() + 7 * MS_DAY)
      return { from: f, to: t, periodLabel: `${fmtDate(f)} – ${fmtDate(new Date(t.getTime() - MS_DAY))}` }
    }
    if (period === "Month") {
      const [y, m] = anchorMonth.split("-").map(Number)
      return {
        from: new Date(y, m - 1, 1),
        to: new Date(y, m, 1),
        periodLabel: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      }
    }
    const y = Number(anchorYear)
    return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), periodLabel: String(y) }
  }, [period, anchorDay, anchorMonth, anchorYear])

  // Supabase mode: fetch the period's orders + recorded expenses.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    setLoading(true)
    Promise.all([
      kargoApi.getPeriodOrders(from, to),
      kargoApi.getRecordedExpensesForPeriod(from, to),
    ])
      .then(([orders, expenses]) => {
        setDbOrders(orders)
        setDbExpenses(expenses)
      })
      .catch((error) => {
        setDbOrders([])
        setDbExpenses(0)
        alert(error instanceof Error ? error.message : "Unable to load sales report.")
      })
      .finally(() => setLoading(false))
  }, [from, to])

  // Demo mode: current board orders + recorded expenses from the local store.
  const demoOrders = useMemo(() => {
    if (isSupabaseConfigured) return []
    return fulfillment
      .filter((o) => o.col === "Completed" || o.col === "Payment Confirmed" || o.col === "Preparing")
      .map((o) => ({ id: o.id, buyer: o.buyer, purchase: o.product, qty: o.qty, amount: o.amount }))
  }, [fulfillment])
  const demoExpenses = useMemo(() => {
    if (isSupabaseConfigured) return 0
    let sum = 0
    for (const b of batches) sum += localExpenseStore.get(b.id)?.total ?? 0
    return sum
  }, [batches])

  const orders = isSupabaseConfigured ? dbOrders : demoOrders
  const revenue = orders.reduce((s, o) => s + o.amount, 0)
  const expenses = isSupabaseConfigured ? dbExpenses : demoExpenses
  const kita = revenue - expenses

  const handlePrint = () => {
    document.body.classList.add("printing-report")
    const cleanup = () => {
      document.body.classList.remove("printing-report")
      window.removeEventListener("afterprint", cleanup)
    }
    window.addEventListener("afterprint", cleanup)
    window.print()
    setTimeout(cleanup, 1500)
  }

  const label = { fontSize: 12, fontWeight: 600 as const, color: "#374151", display: "block" as const, marginBottom: 5 }
  const field = {
    width: "100%",
    fontSize: 13,
    border: "1px solid #E5E7EB",
    borderRadius: 7,
    padding: "9px 12px",
    outline: "none",
    color: "#374151",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  }
  const dashed = "1px dashed #D1D5DB"

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sales Report"
      style={{
        position: "fixed",
        top: 56,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: "rgba(17,24,39,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        className="sales-report-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "calc(100dvh - 88px)",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        {/* Controls — not printed */}
        <div
          className="no-print"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "flex-end",
            padding: 20,
            borderBottom: "1px solid #F3F4F6",
          }}
        >
          <div>
            <label style={label}>Period</label>
            <div style={{ display: "inline-flex", gap: 4 }}>
              {(["Day", "Week", "Month", "Year"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "7px 12px",
                    borderRadius: 7,
                    cursor: "pointer",
                    border: period === p ? `1px solid ${INDIGO}` : "1px solid #E5E7EB",
                    background: period === p ? "#EEF0FF" : "#fff",
                    color: period === p ? INDIGO : "#6B7280",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={label}>
              {period === "Year" ? "Year" : period === "Month" ? "Month" : "Date"}
            </label>
            {period === "Year" ? (
              <input type="number" value={anchorYear} onChange={(e) => setAnchorYear(e.target.value)} style={field} />
            ) : period === "Month" ? (
              <input type="month" value={anchorMonth} onChange={(e) => setAnchorMonth(e.target.value)} style={field} />
            ) : (
              <input type="date" value={anchorDay} onChange={(e) => setAnchorDay(e.target.value)} style={field} />
            )}
          </div>
        </div>

        {/* Receipt body */}
        <div style={{ padding: "22px 24px" }}>
          {/* Receipt header */}
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "#111827",
                fontFamily: "'Josefin Sans',sans-serif",
                letterSpacing: 0.5,
              }}
            >
              {shopName}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Sales Report</div>
            <div style={{ fontSize: 12, color: "#374151", fontWeight: 600, marginTop: 2 }}>
              {period} · {periodLabel}
            </div>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
              Generated {fmtDate(today)}
            </div>
          </div>

          <div style={{ borderTop: dashed, margin: "14px 0" }} />

          {/* Column header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              fontWeight: 700,
              color: "#9CA3AF",
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            <span>Buyer</span>
            <span>Purchase</span>
          </div>

          {/* Order rows (Buyer | Purchase) */}
          {loading ? (
            <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "18px 0" }}>
              Loading…
            </div>
          ) : orders.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                textAlign: "center",
                padding: "18px 0",
                fontStyle: "italic",
              }}
            >
              No orders in this period.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {orders.map((o) => (
                <div
                  key={o.id}
                  style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}
                >
                  <span style={{ color: "#111827", fontWeight: 600 }}>{o.buyer}</span>
                  <span style={{ color: "#374151", textAlign: "right" }}>
                    {o.purchase}
                    {o.qty > 1 ? ` ×${o.qty}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: dashed, margin: "14px 0" }} />

          {/* Revenue / expenses breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "#6B7280" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Revenue ({orders.length} order{orders.length === 1 ? "" : "s"})</span>
              <span style={{ color: "#374151", fontWeight: 600 }}>₱{revenue.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Less: Recorded Expenses</span>
              <span style={{ color: "#374151", fontWeight: 600 }}>−₱{expenses.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ borderTop: "2px solid #111827", margin: "12px 0 10px" }} />

          {/* KITA total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: kita >= 0 ? "#D4F5EA" : "#FEE2E2",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: kita >= 0 ? "#065F46" : "#991B1B" }}>
              KITA
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: kita >= 0 ? "#065F46" : "#991B1B",
                fontFamily: "'Josefin Sans',sans-serif",
              }}
            >
              ₱{kita.toLocaleString()}
            </span>
          </div>

          <p style={{ fontSize: 10, color: "#9CA3AF", fontStyle: "italic", textAlign: "center", margin: "12px 0 0" }}>
            Net earnings = revenue in period − expenses recorded in period.
          </p>
        </div>

        {/* Actions — not printed */}
        <div className="no-print" style={{ display: "flex", gap: 10, padding: "0 24px 20px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              background: "#F3F4F6",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "10px 12px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: INDIGO,
              border: "none",
              borderRadius: 8,
              padding: "10px 12px",
              cursor: "pointer",
            }}
          >
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
        </div>

        {/* Close (X) top-right for parity — not printed */}
        <button
          type="button"
          className="no-print"
          onClick={onClose}
          aria-label="Close sales report"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#9CA3AF",
            padding: 4,
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
