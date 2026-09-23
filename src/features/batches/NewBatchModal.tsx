import { useState } from "react"
import type { BatchType } from "@/types"
import { INDIGO, CAT_GRAD } from "@/constants/theme"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

export type BatchProduct = {
  name: string
  basePrice: string
  markup: string
  qty: string
  // Optional per-buyer claim limit. Empty string = no limit.
  limit: string
}
export default function NewBatchModal({
  onCreate,
  onClose,
  sellerName,
}: {
  onCreate: (b: BatchType) => void
  onClose: () => void
  sellerName?: string
}) {
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [cat, setCat] = useState("Mixed")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [timerUnit, setTimerUnit] = useState<"hours" | "days">("hours")
  const [timerVal, setTimerVal] = useState("48")
  const [timerPreset, setTimerPreset] = useState("48h")
  const [products, setProducts] = useState<BatchProduct[]>([
    { name: "", basePrice: "", markup: "", qty: "", limit: "" },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const addProduct = () =>
    setProducts((p) => [...p, { name: "", basePrice: "", markup: "", qty: "", limit: "" }])
  const updateProduct = (i: number, k: keyof BatchProduct, v: string) =>
    setProducts((p) =>
      p.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)),
    )

  const formatDateRange = (s: string, e: string) => {
    if (!s) return "TBD"
    const start = new Date(s + "T00:00:00")
    const end = e ? new Date(e + "T00:00:00") : null
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]
    const sm = months[start.getMonth()]
    const sd = start.getDate()
    const sy = start.getFullYear()
    if (!end) return `${sm} ${sd}, ${sy}`
    const em = months[end.getMonth()]
    const ed = end.getDate()
    const ey = end.getFullYear()
    if (sm === em && sy === ey) return `${sm} ${sd}–${ed}, ${sy}`
    if (sy === ey) return `${sm} ${sd} – ${em} ${ed}, ${sy}`
    return `${sm} ${sd}, ${sy} – ${em} ${ed}, ${ey}`
  }

  const submit = async () => {
    const validProds = products.filter(
      (p) =>
        p.name.trim() &&
        Number(p.basePrice) + Number(p.markup) > 0 &&
        Number(p.qty) > 0,
    )
    if (!title.trim()) {
      setError("Add a batch title before publishing.")
      return
    }
    if (validProds.length === 0) {
      setError("Add at least one product with a name, price, and quantity.")
      return
    }
    if (isSupabaseConfigured && (!startDate || !endDate)) {
      setError("Choose both the start and end date before publishing.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const prods = validProds.map((p) => ({
              name: p.name.trim(),
              basePrice: Number(p.basePrice),
              markup: Number(p.markup),
              price: Number(p.basePrice) + Number(p.markup),
              qty: Number(p.qty),
              claimed: 0,
              waitlist: 0,
              locked: false,
              limitPerUser: Number(p.limit) > 0 ? Number(p.limit) : undefined,
            }))
      const reserveHours =
        timerUnit === "days" ? Number(timerVal) * 24 : Number(timerVal)
      if (isSupabaseConfigured) {
        await kargoApi.createBatch({
          title: title.trim(),
          category: cat,
          startsOn: startDate,
          endsOn: endDate,
          reservationHours: reserveHours,
          notes: desc.trim() || undefined,
          products: validProds.map((p) => ({
            name: p.name.trim(),
            basePrice: Number(p.basePrice),
            markup: Number(p.markup),
            quantity: Number(p.qty),
            limitPerUser: Number(p.limit) > 0 ? Number(p.limit) : undefined,
          })),
        })
      }
      onCreate({
        id: Date.now(),
        live: isSupabaseConfigured,
        locked: false,
        title: title.trim(),
        seller: sellerName || "You",
        rating: 0,
        trips: formatDateRange(startDate, endDate),
        items: prods.reduce((s, p) => s + p.qty, 0),
        claimed: 0,
        category: cat,
        notes: desc.trim() || undefined,
        products: prods,
        reserveHours,
      })
      setLoading(false)
      onClose()
    } catch (caught) {
      setLoading(false)
      setError(caught instanceof Error ? caught.message : "Unable to create batch.")
    }
  }

  return (
    <Modal title="Create New Batch" onClose={onClose} width={560}>
      <div className="space-y-4">
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
            Batch Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Japan Trip — Oct 2026"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
            className="placeholder:text-gray-400"
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
            Description
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Trip details, sourcing notes, payment/pickup instructions…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box",
              resize: "vertical",
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
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
              Category
            </label>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              style={{
                width: "100%",
                fontSize: 13,
                border: "1px solid #E5E7EB",
                borderRadius: 7,
                padding: "9px 12px",
                outline: "none",
                color: "#374151",
                background: "#fff",
              }}
            >
              {Object.keys(CAT_GRAD).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
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
              Trip Dates
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 3 }}
                >
                  Start
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    border: "1px solid #E5E7EB",
                    borderRadius: 7,
                    padding: "8px 10px",
                    outline: "none",
                    color: "#374151",
                    fontFamily: "inherit",
                    boxSizing: "border-box" as const,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 3 }}
                >
                  End
                </div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    border: "1px solid #E5E7EB",
                    borderRadius: 7,
                    padding: "8px 10px",
                    outline: "none",
                    color: "#374151",
                    fontFamily: "inherit",
                    boxSizing: "border-box" as const,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 6,
            }}
          >
            Reservation Period
          </label>
          <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
            {["24h", "48h", "72h", "5d", "7d", "Custom"].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setTimerPreset(p)
                  if (p !== "Custom") {
                    const isDay = p.endsWith("d")
                    setTimerUnit(isDay ? "days" : "hours")
                    setTimerVal(p.replace(/[hd]/, ""))
                  }
                }}
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 999,
                  border: `1px solid ${timerPreset === p ? INDIGO : "#E5E7EB"}`,
                  background: timerPreset === p ? "#EEF0FF" : "#fff",
                  color: timerPreset === p ? INDIGO : "#6B7280",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          {timerPreset === "Custom" && (
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="365"
                value={timerVal}
                onChange={(e) => setTimerVal(e.target.value)}
                style={{
                  width: 80,
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "8px 10px",
                  outline: "none",
                  color: "#374151",
                }}
              />
              <select
                value={timerUnit}
                onChange={(e) =>
                  setTimerUnit(e.target.value as "hours" | "days")
                }
                style={{
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "8px 10px",
                  outline: "none",
                  color: "#374151",
                  background: "#fff",
                }}
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          )}
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
            Buyers must pay within {timerVal} {timerUnit} of claiming, or the
            reservation expires.
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 8,
            }}
          >
            Items
          </label>
          <div className="space-y-3">
            {products.map((p, i) => {
              const selling = Number(p.basePrice || 0) + Number(p.markup || 0)
              const fieldLabel = {
                fontSize: 10,
                fontWeight: 600 as const,
                color: "#9CA3AF",
                display: "block" as const,
                marginBottom: 3,
              }
              const numInput = {
                width: "100%",
                fontSize: 12,
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: "7px 8px",
                outline: "none",
                color: "#374151",
                fontFamily: "inherit",
                boxSizing: "border-box" as const,
              }
              return (
                <div
                  key={i}
                  style={{
                    border: "1px solid #F3F4F6",
                    borderRadius: 8,
                    padding: 10,
                    background: "#FCFCFD",
                  }}
                >
                  {/* Line 1: product name (full width) */}
                  <div style={{ marginBottom: 8 }}>
                    <label style={fieldLabel}>Product Name</label>
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(i, "name", e.target.value)}
                      placeholder="Product name"
                      style={{
                        width: "100%",
                        fontSize: 12,
                        border: "1px solid #E5E7EB",
                        borderRadius: 6,
                        padding: "7px 10px",
                        outline: "none",
                        color: "#374151",
                        fontFamily: "inherit",
                        boxSizing: "border-box" as const,
                      }}
                      className="placeholder:text-gray-400"
                    />
                  </div>
                  {/* Line 2: numeric fields wrap on narrow screens, no scroll */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(78px, 1fr))",
                      gap: 8,
                    }}
                  >
                    <div>
                      <label style={fieldLabel}>Base Price (₱)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={p.basePrice}
                        onChange={(e) =>
                          updateProduct(i, "basePrice", e.target.value)
                        }
                        placeholder="0"
                        style={numInput}
                        className="placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label style={fieldLabel}>Markup (₱)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={p.markup}
                        onChange={(e) =>
                          updateProduct(i, "markup", e.target.value)
                        }
                        placeholder="0"
                        style={numInput}
                        className="placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label style={fieldLabel}>Selling Price</label>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: INDIGO,
                          background: "#EEF0FF",
                          borderRadius: 6,
                          padding: "7px 8px",
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {selling > 0 ? `₱${selling.toLocaleString()}` : "—"}
                      </div>
                    </div>
                    <div>
                      <label style={fieldLabel}>Qty</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={p.qty}
                        onChange={(e) =>
                          updateProduct(i, "qty", e.target.value)
                        }
                        placeholder="qty"
                        style={numInput}
                        className="placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label style={fieldLabel}>Limit / user</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={p.limit}
                        onChange={(e) =>
                          updateProduct(i, "limit", e.target.value)
                        }
                        placeholder="optional"
                        style={numInput}
                        className="placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <button
            onClick={addProduct}
            style={{
              marginTop: 8,
              fontSize: 12,
              color: INDIGO,
              fontWeight: 600,
              background: "none",
              border: `1px dashed ${INDIGO}`,
              borderRadius: 6,
              padding: "5px 12px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            + Add Item
          </button>
        </div>
        {error && (
          <div role="alert" style={{ color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 10px", fontSize: 11 }}>
            {error}
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={submit}
            loading={loading}
            disabled={!title.trim()}
          >
            {loading ? "Creating…" : "Create Batch"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

