import { useEffect, useMemo, useState } from "react"
import { Printer, X } from "lucide-react"
import type { BatchType } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import type { FinancialSummary } from "@/services"

type Period = "Day" | "Week" | "Month" | "Year"

// One realized sale line. We synthesise a plausible date per batch-product so
// the Day/Week/Month/Year filter produces meaningful, varying figures — the
// prototype has no per-sale timestamps, so this keeps the report self-contained.
type SaleLine = {
  date: Date
  product: string
  category: string
  qty: number
  amount: number
}

const MS_DAY = 86_400_000

// Deterministic pseudo-random in [0,1) from a string seed (stable across renders).
function seededOffset(seed: string, span: number) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % span
}

function parseToday(): Date {
  const d = new Date(TODAY)
  return isNaN(d.getTime()) ? new Date() : d
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export default function SalesReportModal({
  batches,
  shopName,
  onClose,
}: {
  batches: BatchType[]
  shopName: string
  onClose: () => void
}) {
  const today = useMemo(parseToday, [])
  const [period, setPeriod] = useState<Period>("Month")
  // Anchor is a yyyy-mm-dd string for Day/Week, yyyy-mm for Month, yyyy for Year.
  const [anchorDay, setAnchorDay] = useState(() => today.toISOString().slice(0, 10))
  const [anchorMonth, setAnchorMonth] = useState(() => today.toISOString().slice(0, 7))
  const [anchorYear, setAnchorYear] = useState(() => String(today.getFullYear()))
  const [expenses, setExpenses] = useState("")
  const [tax, setTax] = useState("")
  const [databaseSummary, setDatabaseSummary] = useState<FinancialSummary | null>(null)

  // Build the full realized-sales ledger from claimed batch products.
  const ledger = useMemo<SaleLine[]>(() => {
    if (isSupabaseConfigured) return []
    const lines: SaleLine[] = []
    batches.forEach((b) => {
      b.products.forEach((p, pi) => {
        if (p.claimed <= 0) return
        const daysAgo = seededOffset(`${b.id}-${p.name}-${pi}`, 400)
        const date = new Date(today.getTime() - daysAgo * MS_DAY)
        lines.push({
          date,
          product: p.name,
          category: b.category,
          qty: p.claimed,
          amount: p.price * p.claimed,
        })
      })
    })
    return lines
  }, [batches, today])

  // Which lines fall inside the selected period.
  const { filtered, periodLabel } = useMemo(() => {
    let inRange: (d: Date) => boolean
    let label: string
    if (period === "Day") {
      const anchor = new Date(anchorDay)
      anchor.setHours(0, 0, 0, 0)
      const end = anchor.getTime() + MS_DAY
      inRange = (d) => d.getTime() >= anchor.getTime() && d.getTime() < end
      label = fmtDate(anchor)
    } else if (period === "Week") {
      const start = startOfWeek(new Date(anchorDay))
      const end = start.getTime() + 7 * MS_DAY
      inRange = (d) => d.getTime() >= start.getTime() && d.getTime() < end
      const endD = new Date(end - MS_DAY)
      label = `${fmtDate(start)} – ${fmtDate(endD)}`
    } else if (period === "Month") {
      const [y, m] = anchorMonth.split("-").map(Number)
      inRange = (d) => d.getFullYear() === y && d.getMonth() === m - 1
      label = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    } else {
      const y = Number(anchorYear)
      inRange = (d) => d.getFullYear() === y
      label = String(y)
    }
    return { filtered: ledger.filter((l) => inRange(l.date)), periodLabel: label }
  }, [period, anchorDay, anchorMonth, anchorYear, ledger])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let from: Date
    let to: Date
    if (period === "Day") {
      from = new Date(`${anchorDay}T00:00:00`)
      to = new Date(from.getTime() + MS_DAY)
    } else if (period === "Week") {
      from = startOfWeek(new Date(`${anchorDay}T00:00:00`))
      to = new Date(from.getTime() + 7 * MS_DAY)
    } else if (period === "Month") {
      const [year, month] = anchorMonth.split("-").map(Number)
      from = new Date(year, month - 1, 1)
      to = new Date(year, month, 1)
    } else {
      const year = Number(anchorYear)
      from = new Date(year, 0, 1)
      to = new Date(year + 1, 0, 1)
    }
    kargoApi
      .getFinancialSummary(from, to)
      .then(setDatabaseSummary)
      .catch((error) =>
        alert(error instanceof Error ? error.message : "Unable to load sales summary."),
      )
  }, [period, anchorDay, anchorMonth, anchorYear])

  const totalSales = isSupabaseConfigured
    ? (databaseSummary?.gross_sales ?? 0)
    : filtered.reduce((s, l) => s + l.amount, 0)
  const itemsSold = isSupabaseConfigured
    ? (databaseSummary?.items_sold ?? 0)
    : filtered.reduce((s, l) => s + l.qty, 0)
  const orderCount = isSupabaseConfigured
    ? (databaseSummary?.order_count ?? 0)
    : filtered.length
  const expenseAmount = isSupabaseConfigured
    ? (databaseSummary?.estimated_expenses ?? 0)
    : Number(expenses) || 0
  const profit = totalSales - expenseAmount - (Number(tax) || 0)

  // Sales grouped by product for the printable table.
  const byProduct = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>()
    filtered.forEach((l) => {
      const cur = map.get(l.product) || { qty: 0, amount: 0 }
      cur.qty += l.qty
      cur.amount += l.amount
      map.set(l.product, cur)
    })
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount)
  }, [filtered])

  const handlePrint = () => {
    document.body.classList.add("printing-report")
    const cleanup = () => {
      document.body.classList.remove("printing-report")
      window.removeEventListener("afterprint", cleanup)
    }
    window.addEventListener("afterprint", cleanup)
    window.print()
    // Fallback in browsers that don't fire afterprint reliably.
    setTimeout(cleanup, 1500)
  }

  const label = {
    fontSize: 12,
    fontWeight: 600 as const,
    color: "#374151",
    display: "block" as const,
    marginBottom: 5,
  }
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sales Report"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(17,24,39,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: "40px 16px",
      }}
      onClick={onClose}
    >
      <div
        className="sales-report-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 620,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          padding: 24,
        }}
      >
        {/* Header (shop + period) — printed */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#111827",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              {shopName}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
              Sales Report · {period} · {periodLabel}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              Generated {fmtDate(today)}
            </div>
          </div>
          <button
            type="button"
            className="no-print"
            onClick={onClose}
            aria-label="Close sales report"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9CA3AF",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Controls — not printed */}
        <div
          className="no-print"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "flex-end",
            marginBottom: 18,
            paddingBottom: 18,
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
                    border:
                      period === p
                        ? `1px solid ${INDIGO}`
                        : "1px solid #E5E7EB",
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
              {period === "Year"
                ? "Year"
                : period === "Month"
                  ? "Month"
                  : "Date"}
            </label>
            {period === "Year" ? (
              <input
                type="number"
                value={anchorYear}
                onChange={(e) => setAnchorYear(e.target.value)}
                style={field}
              />
            ) : period === "Month" ? (
              <input
                type="month"
                value={anchorMonth}
                onChange={(e) => setAnchorMonth(e.target.value)}
                style={field}
              />
            ) : (
              <input
                type="date"
                value={anchorDay}
                onChange={(e) => setAnchorDay(e.target.value)}
                style={field}
              />
            )}
          </div>
        </div>

        {/* Summary figures — printed */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {[
            { k: "Total Sales", v: `₱${totalSales.toLocaleString()}` },
            { k: "Completed Orders", v: String(orderCount) },
            { k: "Items Sold", v: String(itemsSold) },
          ].map((s) => (
            <div
              key={s.k}
              style={{ background: CREAM, borderRadius: 8, padding: "12px 14px" }}
            >
              <div style={{ fontSize: 11, color: "#6B7280" }}>{s.k}</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#111827",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  marginTop: 3,
                }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>

        {/* Breakdown by product — printed */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Sales by Product
          </div>
          {byProduct.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                padding: "14px 0",
                textAlign: "center",
              }}
            >
              No sales in this period.
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <th style={{ textAlign: "left", padding: "6px 4px", color: "#9CA3AF", fontWeight: 600 }}>
                    Product
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 4px", color: "#9CA3AF", fontWeight: 600 }}>
                    Qty
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 4px", color: "#9CA3AF", fontWeight: 600 }}>
                    Sales
                  </th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map(([name, agg]) => (
                  <tr key={name} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "7px 4px", color: "#374151" }}>{name}</td>
                    <td style={{ padding: "7px 4px", textAlign: "right", color: "#6B7280" }}>
                      {agg.qty}
                    </td>
                    <td
                      style={{
                        padding: "7px 4px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{agg.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Profit estimate (reuses the #2 financial-summary logic) — printed */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 10,
            }}
          >
            Profit Estimate
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Total Expenses (₱)</label>
              <input
                type="number"
                value={isSupabaseConfigured ? String(expenseAmount) : expenses}
                placeholder="0"
                onChange={(e) => setExpenses(e.target.value)}
                readOnly={isSupabaseConfigured}
                style={field}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Estimated Tax (₱)</label>
              <input
                type="number"
                value={tax}
                placeholder="0"
                onChange={(e) => setTax(e.target.value)}
                style={field}
              />
            </div>
          </div>
          {/* Printed read-out of the entered figures. */}
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
            Expenses: ₱{expenseAmount.toLocaleString()} · Tax: ₱
            {(Number(tax) || 0).toLocaleString()}
          </div>
          <div
            style={{
              background: profit >= 0 ? "#D4F5EA" : "#FEE2E2",
              borderRadius: 8,
              padding: "12px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: profit >= 0 ? "#065F46" : "#991B1B",
              }}
            >
              Estimated Profit
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: profit >= 0 ? "#065F46" : "#991B1B",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              ₱{profit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Disclaimer — printed */}
        <p
          style={{
            fontSize: 11,
            color: "#9CA3AF",
            fontStyle: "italic",
            lineHeight: 1.5,
            margin: "0 0 4px",
          }}
        >
          This is a prediction/estimate based on current claims and item prices —
          actual results may change once all items are paid, shipped, and
          finalized.
        </p>

        {/* Actions — not printed */}
        <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 16 }}>
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
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>
    </div>
  )
}
