import { useEffect, useState } from "react"
import type { BatchType } from "@/types"
import { CREAM } from "@/constants/theme"
import { Modal, PrimaryBtn } from "@/components/shared"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import type { FinancialSummary } from "@/services"

export default function FinancialSummaryModal({
  batch,
  onClose,
}: {
  batch: BatchType
  onClose: () => void
}) {
  const localTotalOrders = batch.products.reduce(
    (s, p) => s + p.price * p.claimed,
    0,
  )
  const [expenses, setExpenses] = useState("")
  const [tax, setTax] = useState("")
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  useEffect(() => {
    if (!isSupabaseConfigured || !batch.dbId) return
    kargoApi
      .getFinancialSummary(
        new Date("2000-01-01T00:00:00Z"),
        new Date("2100-01-01T00:00:00Z"),
        batch.dbId,
      )
      .then(setSummary)
      .catch((error) =>
        alert(error instanceof Error ? error.message : "Unable to load financial summary."),
      )
  }, [batch.dbId])
  const totalOrders = isSupabaseConfigured ? (summary?.gross_sales ?? 0) : localTotalOrders
  const expenseAmount = isSupabaseConfigured
    ? (summary?.estimated_expenses ?? 0)
    : Number(expenses) || 0
  const profit = totalOrders - expenseAmount - (Number(tax) || 0)
  return (
    <Modal title="Batch Financial Summary" onClose={onClose} width={440}>
      <div className="space-y-4">
        <div
          style={{ background: CREAM, borderRadius: 8, padding: "12px 14px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 13, color: "#374151" }}>
              Total Orders Amount
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              ₱{totalOrders.toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
            Based on current claims × item prices
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Total Expenses (₱)
          </label>
          <input
            type="number"
            value={isSupabaseConfigured ? String(expenseAmount) : expenses}
            placeholder="0"
            onChange={(e) => setExpenses(e.target.value)}
            readOnly={isSupabaseConfigured}
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Estimated Tax (₱)
          </label>
          <input
            type="number"
            value={tax}
            placeholder="0"
            onChange={(e) => setTax(e.target.value)}
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
          />
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
        <p
          style={{
            fontSize: 11,
            color: "#9CA3AF",
            fontStyle: "italic",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          This is just a prediction/estimate based on current claims and item
          prices — actual results may change once all items are paid, shipped,
          and finalized.
        </p>
        <PrimaryBtn
          style={{ width: "100%", display: "flex", justifyContent: "center" }}
          onClick={onClose}
        >
          Close
        </PrimaryBtn>
      </div>
    </Modal>
  )
}

