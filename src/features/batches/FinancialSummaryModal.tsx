import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, Printer, X } from "lucide-react"
import type { BatchType, BatchExpenses, ExpenseItem, ExpenseMode } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import type { FinancialSummary } from "@/services"

// In-memory fallback store (demo mode): per-batch expenses persist across modal
// opens within the session. Keyed by the batch's local id. Exported so the
// Sales Report's kita calc can read recorded expenses in demo mode too.
export const localExpenseStore = new Map<number, BatchExpenses>()

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `x-${Date.now()}-${Math.random().toString(36).slice(2)}`
const blankExpenses = (): BatchExpenses => ({ mode: "single", total: 0, items: [] })

export default function FinancialSummaryModal({
  batch,
  onClose,
}: {
  batch: BatchType
  onClose: () => void
}) {
  const localTotalOrders = batch.products.reduce((s, p) => s + p.price * p.claimed, 0)
  const [tax, setTax] = useState("")
  const [summary, setSummary] = useState<FinancialSummary | null>(null)

  // ── Recorded expenses (single / itemized) ──────────────────────────────────
  const [mode, setMode] = useState<ExpenseMode>("single")
  const [singleTotal, setSingleTotal] = useState("")
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [expLoading, setExpLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)

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

  // Load recorded expenses (Supabase or in-memory fallback).
  useEffect(() => {
    let active = true
    const apply = (e: BatchExpenses | null) => {
      if (!active) return
      const v = e ?? blankExpenses()
      setMode(v.mode)
      setSingleTotal(v.mode === "single" && v.total ? String(v.total) : "")
      setItems(v.items ?? [])
      setExpLoading(false)
    }
    if (isSupabaseConfigured && batch.dbId) {
      kargoApi
        .loadBatchExpenses(batch.dbId)
        .then(apply)
        .catch((err) => {
          alert(err instanceof Error ? err.message : "Unable to load expenses.")
          setExpLoading(false)
        })
    } else {
      apply(localExpenseStore.get(batch.id) ?? null)
    }
    return () => {
      active = false
    }
  }, [batch.dbId, batch.id])

  const itemizedTotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [items],
  )
  const recordedExpenses = mode === "itemized" ? itemizedTotal : Number(singleTotal) || 0

  const totalOrders = isSupabaseConfigured ? summary?.gross_sales ?? 0 : localTotalOrders
  const profit = totalOrders - recordedExpenses - (Number(tax) || 0)

  const addItem = () =>
    setItems((prev) => [...prev, { id: uid(), label: "", amount: 0, category: "", date: "" }])
  const updateItem = (id: string, key: keyof ExpenseItem, value: string) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, [key]: key === "amount" ? Number(value) || 0 : value } : it,
      ),
    )
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id))

  const handleSaveExpenses = async () => {
    const value: BatchExpenses = {
      mode,
      total: mode === "single" ? Number(singleTotal) || 0 : itemizedTotal,
      items: mode === "itemized" ? items.filter((i) => i.label.trim() || i.amount) : [],
    }
    setSaving(true)
    try {
      if (isSupabaseConfigured && batch.dbId) {
        await kargoApi.saveBatchExpenses(batch.dbId, value)
      } else {
        localExpenseStore.set(batch.id, value)
      }
      setSavedNote(true)
      setTimeout(() => setSavedNote(false), 2200)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to save expenses.")
    } finally {
      setSaving(false)
    }
  }

  const handlePrintReceipt = () => {
    document.body.classList.add("printing-receipt")
    const cleanup = () => {
      document.body.classList.remove("printing-receipt")
      window.removeEventListener("afterprint", cleanup)
    }
    window.addEventListener("afterprint", cleanup)
    window.print()
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

  if (showReceipt) {
    return (
      <ExpenseReceipt
        batch={batch}
        mode={mode}
        total={recordedExpenses}
        items={items}
        onBack={() => setShowReceipt(false)}
        onPrint={handlePrintReceipt}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal title="Batch Financial Summary" onClose={onClose} width={460}>
      <div className="space-y-4">
        <div style={{ background: CREAM, borderRadius: 8, padding: "12px 14px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 13, color: "#374151" }}>Total Orders Amount</span>
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
            {isSupabaseConfigured
              ? "Realized sales for this batch"
              : "Based on current claims × item prices"}
          </div>
        </div>

        {/* ── Expenses (bookkeeping) ─────────────────────────────────────────── */}
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
              Expenses
            </span>
            <span style={{ fontSize: 11, color: "#9CA3AF" }}>
              Private bookkeeping · not shown to buyers
            </span>
          </div>

          {expLoading ? (
            <div style={{ fontSize: 13, color: "#9CA3AF", padding: "10px 0" }}>Loading…</div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "inline-flex", gap: 6 }}>
                  {(["single", "itemized"] as ExpenseMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      aria-pressed={mode === m}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 12px",
                        borderRadius: 7,
                        cursor: "pointer",
                        border: mode === m ? `1px solid ${INDIGO}` : "1px solid #E5E7EB",
                        background: mode === m ? "#EEF0FF" : "#fff",
                        color: mode === m ? INDIGO : "#6B7280",
                      }}
                    >
                      {m === "single" ? "Enter a total" : "Itemize expenses"}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "single" ? (
                <div>
                  <label style={label}>Total Expenses (₱)</label>
                  <input
                    type="number"
                    value={singleTotal}
                    placeholder="0"
                    onChange={(e) => setSingleTotal(e.target.value)}
                    style={field}
                  />
                </div>
              ) : (
                <div>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 90px 34px",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <input
                            value={it.label}
                            placeholder="Label (e.g. Shipping)"
                            onChange={(e) => updateItem(it.id, "label", e.target.value)}
                            style={{ ...field, padding: "7px 10px" }}
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              value={it.category ?? ""}
                              placeholder="Category (optional)"
                              onChange={(e) => updateItem(it.id, "category", e.target.value)}
                              style={{ ...field, padding: "6px 10px", fontSize: 12 }}
                            />
                            <input
                              type="date"
                              value={it.date ?? ""}
                              onChange={(e) => updateItem(it.id, "date", e.target.value)}
                              style={{ ...field, padding: "6px 10px", fontSize: 12 }}
                            />
                          </div>
                        </div>
                        <input
                          type="number"
                          value={it.amount || ""}
                          placeholder="0"
                          onChange={(e) => updateItem(it.id, "amount", e.target.value)}
                          style={{ ...field, padding: "7px 10px" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          aria-label="Remove line item"
                          style={{
                            border: "1px solid #FCA5A5",
                            background: "#FEF2F2",
                            color: "#B91C1C",
                            borderRadius: 7,
                            height: 34,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <SecondaryBtn
                    size="sm"
                    onClick={addItem}
                    style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Plus size={14} aria-hidden="true" /> Add line item
                  </SecondaryBtn>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 10,
                  fontSize: 12,
                  color: "#6B7280",
                }}
              >
                <span>Recorded expenses</span>
                <span style={{ fontWeight: 700, color: "#374151" }}>
                  ₱{recordedExpenses.toLocaleString()}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <SecondaryBtn
                  size="sm"
                  onClick={() => setShowReceipt(true)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                >
                  <Printer size={14} aria-hidden="true" /> Receipt
                </SecondaryBtn>
                <PrimaryBtn
                  size="sm"
                  onClick={handleSaveExpenses}
                  disabled={saving}
                  style={{ flex: 1, display: "flex", justifyContent: "center" }}
                >
                  {saving ? "Saving…" : "Save Expenses"}
                </PrimaryBtn>
              </div>
              {savedNote && (
                <div
                  className="fi"
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#065F46",
                    background: "#D4F5EA",
                    borderRadius: 6,
                    padding: "6px 10px",
                  }}
                >
                  Expenses saved.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Profit estimate ────────────────────────────────────────────────── */}
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14 }}>
          <label style={label}>Estimated Tax (₱)</label>
          <input
            type="number"
            value={tax}
            placeholder="0"
            onChange={(e) => setTax(e.target.value)}
            style={field}
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
            style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? "#065F46" : "#991B1B" }}
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

        <p style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic", lineHeight: 1.5, margin: 0 }}>
          This is a prediction/estimate based on current claims, item prices, and your
          recorded expenses — actual results may change once all items are paid, shipped,
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

// ─── Printable expense receipt (internal bookkeeping) ─────────────────────────
function ExpenseReceipt({
  batch,
  mode,
  total,
  items,
  onBack,
  onPrint,
  onClose,
}: {
  batch: BatchType
  mode: ExpenseMode
  total: number
  items: ExpenseItem[]
  onBack: () => void
  onPrint: () => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Expense receipt"
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
        className="expense-receipt-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
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
              Expense Receipt
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
              {batch.title} · {batch.seller}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              Generated {TODAY} · Internal bookkeeping document
            </div>
          </div>
          <button
            type="button"
            className="no-print"
            onClick={onClose}
            aria-label="Close receipt"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4 }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {mode === "itemized" && items.length > 0 ? (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                <th style={{ textAlign: "left", padding: "6px 4px", color: "#9CA3AF", fontWeight: 600 }}>Item</th>
                <th style={{ textAlign: "left", padding: "6px 4px", color: "#9CA3AF", fontWeight: 600 }}>Category</th>
                <th style={{ textAlign: "left", padding: "6px 4px", color: "#9CA3AF", fontWeight: 600 }}>Date</th>
                <th style={{ textAlign: "right", padding: "6px 4px", color: "#9CA3AF", fontWeight: 600 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "7px 4px", color: "#374151" }}>{it.label || "—"}</td>
                  <td style={{ padding: "7px 4px", color: "#6B7280" }}>{it.category || "—"}</td>
                  <td style={{ padding: "7px 4px", color: "#6B7280" }}>{it.date || "—"}</td>
                  <td
                    style={{
                      padding: "7px 4px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    ₱{(Number(it.amount) || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 14 }}>
            {mode === "single"
              ? "Total expenses entered as a single amount."
              : "No line items recorded."}
          </div>
        )}

        <div
          style={{
            background: CREAM,
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Total Expenses</span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#111827",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            ₱{total.toLocaleString()}
          </span>
        </div>
        <p style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic", margin: "0 0 4px" }}>
          For internal seller records only. Not shared with buyers.
        </p>

        <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <SecondaryBtn onClick={onBack} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            Back
          </SecondaryBtn>
          <PrimaryBtn
            onClick={onPrint}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            <Printer size={16} aria-hidden="true" /> Print
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}
