import { useState, useRef, useEffect, useCallback } from "react"
import {
  Banknote,
  BarChart3,
  BadgeCheck,
  Bell,
  Check,
  Clock3,
  CreditCard,
  Gem,
  Globe2,
  HandCoins,
  Lock,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Star,
  Utensils,
  Unlock,
  UserRound,
  X,
} from "lucide-react"
import type {
  AppStage,
  UserInfo,
  Tab,
  Role,
  ClaimStatus,
  ReportStatus,
  SettingsSection,
  ClaimRow,
  ToPayRow,
  PayHistRow,
  OrderRow,
  ReportRow,
} from "@/types"
import {
  RETRO_THEME,
  INDIGO,
  CREAM,
  CYAN_L,
  SKY,
  CORAL,
  GREEN,
  AMBER,
  TODAY,
  CAT_GRAD,
  STATUS_C,
  REPORT_C,
} from "@/constants/theme"
import { navIntent } from "@/state/navIntent"
import { BATCHES_INIT } from "@/data/batches"
import { CLAIMS_INIT } from "@/data/claims"
import { TOPAY_INIT } from "@/data/toPay"
import { PAYHIST_INIT } from "@/data/payHistory"
import { ORDERS_INIT } from "@/data/orders"
import { REPORTS_INIT } from "@/data/reports"
import { NOTIF_BUYER, NOTIF_SELLER } from "@/data/notifications"
import type {
  BatchStoredProduct,
  BatchItem,
  BatchType,
  SharedState,
} from "@/types"
import {
  CategoryIcon,
  PaymentIcon,
  StatusBadge,
  Avatar,
  ProductThumb,
  PROD_IMG,
  Countdown,
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  Toggle,
  BIRBadge,
  Modal,
  PayModal,
  PAY_METHODS,
  SELLER_PAY_DETAILS,
  TrackOrderModal,
  ORDER_STEPS,
  ContactSellerModal,
  BuyerProfileModal,
} from "@/components/shared"
import {
  KANBAN_COLS,
  KANBAN_COL_BG,
  PRIOR_FULFILLED,
  FULFILLMENT_INIT,
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentDetails,
} from "@/features/fulfillment"
import type { KanbanCol, FulfillmentOrder } from "@/features/fulfillment"
import { Reports } from "@/features/reports"

function toggleBatchLock(
  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>,
  batchId: number,
  productIndex?: number,
) {
  setBatches((prev) =>
    prev.map((batch) => {
      if (batch.id !== batchId) return batch
      if (productIndex === undefined) return { ...batch, locked: !batch.locked }
      return {
        ...batch,
        products: batch.products.map((product, index) =>
          index === productIndex
            ? { ...product, locked: !product.locked }
            : product,
        ),
      }
    }),
  )
}

// ─── BIR Info Modal ───────────────────────────────────────────────────────────
function BIRInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="What is the BIR Registration Seal Badge?"
      onClose={onClose}
      width={420}
    >
      <div className="space-y-4">
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div
            style={{
              width: 120,
              height: 120,
              margin: "0 auto",
              border: "3px solid #111827",
              borderRadius: 8,
              padding: 8,
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 2,
            }}
          >
            {Array.from({ length: 49 }).map((_, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 1,
                  background: [
                    0, 1, 2, 5, 6, 7, 8, 14, 15, 21, 27, 28, 29, 33, 34, 35, 41,
                    42, 43, 44, 48,
                  ].includes(i)
                    ? "#111827"
                    : "transparent",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
            BIR Digital Seal (placeholder)
          </div>
        </div>
        <div
          style={{ background: CREAM, borderRadius: 8, padding: "12px 14px" }}
          className="space-y-3"
        >
          {[
            "It is a digital badge with a QR code.",
            "It proves your business is registered with the Bureau of Internal Revenue (BIR).",
            "Sellers with this badge have submitted their BIR Certificate for verification.",
            "Kargo verifies the document before awarding the badge — it is not self-declared.",
          ].map((text, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 13,
                color: "#374151",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: INDIGO, fontWeight: 700, flexShrink: 0 }}>
                ✓
              </span>
              {text}
            </div>
          ))}
        </div>
        <PrimaryBtn
          style={{ width: "100%", display: "flex", justifyContent: "center" }}
          onClick={onClose}
        >
          Got it
        </PrimaryBtn>
      </div>
    </Modal>
  )
}

// ─── Financial Summary Modal ──────────────────────────────────────────────────
function FinancialSummaryModal({
  batch,
  onClose,
}: {
  batch: BatchType
  onClose: () => void
}) {
  const totalOrders = batch.products.reduce(
    (s, p) => s + p.price * p.claimed,
    0,
  )
  const [expenses, setExpenses] = useState("")
  const [tax, setTax] = useState("")
  const profit = totalOrders - (Number(expenses) || 0) - (Number(tax) || 0)
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
            value={expenses}
            placeholder="0"
            onChange={(e) => setExpenses(e.target.value)}
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

// ─── New Batch Modal ──────────────────────────────────────────────────────────
type BatchProduct = {
  name: string
  basePrice: string
  markup: string
  qty: string
}
function NewBatchModal({
  onCreate,
  onClose,
  sellerName,
}: {
  onCreate: (b: BatchType) => void
  onClose: () => void
  sellerName?: string
}) {
  const [title, setTitle] = useState("")
  const [cat, setCat] = useState("Mixed")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [timerUnit, setTimerUnit] = useState<"hours" | "days">("hours")
  const [timerVal, setTimerVal] = useState("48")
  const [timerPreset, setTimerPreset] = useState("48h")
  const [products, setProducts] = useState<BatchProduct[]>([
    { name: "", basePrice: "", markup: "", qty: "" },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const addProduct = () =>
    setProducts((p) => [...p, { name: "", basePrice: "", markup: "", qty: "" }])
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

  const submit = () => {
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
    setError("")
    setLoading(true)
    setTimeout(() => {
      const prods = validProds.map((p) => ({
              name: p.name.trim(),
              price: Number(p.basePrice) + Number(p.markup),
              qty: Number(p.qty),
              claimed: 0,
              waitlist: 0,
              locked: false,
            }))
      const reserveHours =
        timerUnit === "days" ? Number(timerVal) * 24 : Number(timerVal)
      onCreate({
        id: Date.now(),
        live: false,
        locked: false,
        title: title.trim(),
        seller: sellerName || "You",
        rating: 0,
        trips: formatDateRange(startDate, endDate),
        items: prods.reduce((s, p) => s + p.qty, 0),
        claimed: 0,
        category: cat,
        products: prods,
        reserveHours,
      })
      setLoading(false)
      onClose()
    }, 1000)
  }

  return (
    <Modal title="Create New Batch" onClose={onClose} width={520}>
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              gap: 4,
              marginBottom: 4,
            }}
          >
            {[
              "Product Name",
              "Base Price (₱)",
              "Markup (₱)",
              "Selling Price",
              "Qty",
            ].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#9CA3AF",
                  padding: "0 2px",
                }}
              >
                {h}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {products.map((p, i) => {
              const selling = Number(p.basePrice || 0) + Number(p.markup || 0)
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                    gap: 4,
                  }}
                >
                  <input
                    value={p.name}
                    onChange={(e) => updateProduct(i, "name", e.target.value)}
                    placeholder="Product name"
                    style={{
                      fontSize: 12,
                      border: "1px solid #E5E7EB",
                      borderRadius: 6,
                      padding: "7px 10px",
                      outline: "none",
                      color: "#374151",
                      fontFamily: "inherit",
                    }}
                    className="placeholder:text-gray-400"
                  />
                  <input
                    type="number"
                    value={p.basePrice}
                    onChange={(e) =>
                      updateProduct(i, "basePrice", e.target.value)
                    }
                    placeholder="0"
                    style={{
                      fontSize: 12,
                      border: "1px solid #E5E7EB",
                      borderRadius: 6,
                      padding: "7px 8px",
                      outline: "none",
                      color: "#374151",
                      fontFamily: "inherit",
                    }}
                    className="placeholder:text-gray-400"
                  />
                  <input
                    type="number"
                    value={p.markup}
                    onChange={(e) => updateProduct(i, "markup", e.target.value)}
                    placeholder="0"
                    style={{
                      fontSize: 12,
                      border: "1px solid #E5E7EB",
                      borderRadius: 6,
                      padding: "7px 8px",
                      outline: "none",
                      color: "#374151",
                      fontFamily: "inherit",
                    }}
                    className="placeholder:text-gray-400"
                  />
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: INDIGO,
                      background: "#EEF0FF",
                      borderRadius: 6,
                      padding: "7px 8px",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    {selling > 0 ? `₱${selling.toLocaleString()}` : "—"}
                  </div>
                  <input
                    type="number"
                    value={p.qty}
                    onChange={(e) => updateProduct(i, "qty", e.target.value)}
                    placeholder="qty"
                    style={{
                      fontSize: 12,
                      border: "1px solid #E5E7EB",
                      borderRadius: 6,
                      padding: "7px 8px",
                      outline: "none",
                      color: "#374151",
                      fontFamily: "inherit",
                    }}
                    className="placeholder:text-gray-400"
                  />
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

// ─── Social Connect Modal ─────────────────────────────────────────────────────
function SocialConnectModal({
  platform,
  onConnect,
  onClose,
}: {
  platform: string
  onConnect: (username: string) => void
  onClose: () => void
}) {
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const confirm = () => {
    if (!username.trim()) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onConnect(username.trim())
      onClose()
    }, 1000)
  }
  return (
    <Modal title={`Connect ${platform}`} onClose={onClose} width={400}>
      <div className="space-y-4">
        <div
          style={{
            background: CREAM,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          This is a demo connection flow. Enter your {platform} username to link
          your account.
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
            {platform} Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={
              platform === "Instagram" ? "@yourhandle" : "Your name on Facebook"
            }
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
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={confirm}
            loading={loading}
            disabled={!username.trim()}
          >
            {loading ? "Connecting…" : "Connect Account"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

// ─── Extension Request Modal ──────────────────────────────────────────────────
function ExtensionRequestModal({
  claim,
  onSubmit,
  onClose,
}: {
  claim: ClaimRow
  onSubmit: () => void
  onClose: () => void
}) {
  const [days, setDays] = useState("3")
  const [reason, setReason] = useState("")
  return (
    <Modal title="Request Extension" onClose={onClose} width={420}>
      <div className="space-y-4">
        <div
          style={{
            background: "#EEF0FF",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#374151",
          }}
        >
          Requesting extension for <strong>{claim.product}</strong> from{" "}
          {claim.seller}.
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
            Additional Days Needed
          </label>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
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
            {["1", "2", "3", "5", "7"].map((d) => (
              <option key={d} value={d}>
                {d} day{d !== "1" ? "s" : ""}
              </option>
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
            Reason (optional)
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Waiting for my next paycheck on Friday…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              resize: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onSubmit}
          >
            Send Request
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

// ─── Buyer Request Form Modal ─────────────────────────────────────────────────
function BuyerRequestFormModal({
  batches,
  onClose,
}: {
  batches: BatchType[]
  onClose: () => void
}) {
  const [batch, setBatch] = useState(batches[0]?.title || "")
  const [product, setProduct] = useState("")
  const [qty, setQty] = useState("1")
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  if (sent)
    return (
      <Modal title="Request Sent" onClose={onClose} width={400}>
        <div className="space-y-4 text-center" style={{ padding: "12px 0" }}>
          <div style={{ fontSize: 48 }}>📬</div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            Request Sent!
          </div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            The seller will review your request and reply in-app or via
            Messenger.
          </div>
          <PrimaryBtn
            onClick={onClose}
            style={{
              display: "flex",
              margin: "0 auto",
              justifyContent: "center",
            }}
          >
            Done
          </PrimaryBtn>
        </div>
      </Modal>
    )

  return (
    <Modal title="Request an Item" onClose={onClose} width={440}>
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
            Batch
          </label>
          <select
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
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
            {batches.map((b) => (
              <option key={b.id} value={b.title}>
                {b.title}
              </option>
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
            Item / Product Name
          </label>
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. Hada Labo Premium Lotion 170ml"
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
            Quantity
          </label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            min="1"
            max="10"
            style={{
              width: 100,
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
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
            Message to Seller
          </label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Any special notes, size, variant preferences…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              resize: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => {
              if (product.trim()) setSent(true)
            }}
            disabled={!product.trim()}
          >
            Send Request
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

// ─── Rate Order Modal ─────────────────────────────────────────────────────────
function RateOrderModal({
  order,
  onRate,
  onClose,
}: {
  order: OrderRow
  onRate: (rating: number) => void
  onClose: () => void
}) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  return (
    <Modal title="Rate Your Experience" onClose={onClose} width={400}>
      <div className="space-y-5">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
            How was your order from <strong>{order.seller}</strong>?
          </div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setStars(s)}
                style={{
                  fontSize: 36,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "transform 0.1s",
                  transform:
                    (hovered || stars) >= s ? "scale(1.2)" : "scale(1)",
                  color: (hovered || stars) >= s ? "#FBBF24" : "#D1D5DB",
                }}
              >
                
              </button>
            ))}
          </div>
          {stars > 0 && (
            <div
              style={{
                fontSize: 12,
                color: INDIGO,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {["", "Terrible", "Poor", "Okay", "Good", "Excellent!"][stars]}
            </div>
          )}
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
            Comments (optional)
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Skip
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => {
              if (stars > 0) onRate(stars)
            }}
            disabled={stars === 0}
          >
            Submit Rating
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

// ─── Auth input ───────────────────────────────────────────────────────────────
// ─── Item Claim Modal ─────────────────────────────────────────────────────────
function ItemClaimModal({
  batch,
  product,
  onConfirm,
  onClose,
}: {
  batch: BatchType
  product: {
    name: string
    price: number
    qty: number
    claimed: number
    waitlist: number
    locked?: boolean
  }
  onConfirm: () => void
  onClose: () => void
}) {
  const [qty, setQty] = useState(1)
  const [showReminders, setShowReminders] = useState(false)
  const left = product.qty - product.claimed
  const maxQty = Math.min(left, 5)

  return (
    <Modal title="Review claim before submitting" onClose={onClose} width={480}>
      <div className="space-y-4">
        {/* Product header */}
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            background: CREAM,
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <ProductThumb name={product.name} />
          <div className="flex-1">
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              {product.name}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              from {batch.title}
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: INDIGO,
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            ₱{product.price.toLocaleString()}
          </div>
        </div>

        {/* Seller trust row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 0",
            borderBottom: "1px solid #F3F4F6",
          }}
        >
          <Avatar name={batch.seller} size={28} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              {batch.seller}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#9CA3AF",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Star size={12} aria-hidden="true" /> {batch.rating} · Verified Seller <BIRBadge />
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {["FB", "IG", "TT"].map((s) => (
              <span
                key={s}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background:
                    s === "FB" ? "#1877F2" : s === "IG" ? "#E1306C" : "#000",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s[0]}
              </span>
            ))}
          </div>
        </div>

        {/* Reservation countdown notice */}
        <div
          style={{
            background: "#FFF7ED",
            border: "1px solid #FCD34D",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Clock3 size={18} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
              48-hour payment window
            </div>
            <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
              Your reservation expires if payment is not submitted within 48
              hours of claiming.
            </div>
          </div>
        </div>

        {/* Qty selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
            Quantity
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid #E5E7EB",
                background: "#fff",
                cursor: "pointer",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#374151",
              }}
            >
              −
            </button>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                minWidth: 20,
                textAlign: "center",
              }}
            >
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid #E5E7EB",
                background: "#fff",
                cursor: "pointer",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#374151",
              }}
            >
              +
            </button>
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
            {left} slot{left !== 1 ? "s" : ""} left
          </span>
        </div>

        {/* Accepted payment methods */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Accepted Payments
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["GCash", "Maya", "Bank Transfer", "COD"].map((m) => (
              <span
                key={m}
                style={{
                  background: "#F3F4F6",
                  color: "#374151",
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #E5E7EB",
                }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Reminders accordion */}
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowReminders((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              background: CREAM,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
            }}
          >
            📋 Important Reminders
            <span style={{ fontSize: 10, color: "#9CA3AF" }}>
              {showReminders ? "▲" : "▼"}
            </span>
          </button>
          <div
            style={{
              maxHeight: showReminders ? 200 : 0,
              overflow: "hidden",
              transition: "max-height 0.25s ease",
            }}
          >
            <ul
              style={{
                margin: 0,
                padding: "10px 14px 10px 28px",
                fontSize: 11,
                color: "#6B7280",
                lineHeight: 1.8,
              }}
            >
              <li>
                Pay before the 48-hour timer ends or your reservation will
                expire.
              </li>
              <li>
                COD is for tracking purposes only — coordinate pickup with the
                seller.
              </li>
              <li>
                Extensions are subject to seller approval and not guaranteed.
              </li>
              <li>Claims are non-transferable to another buyer.</li>
            </ul>
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#111827",
            textAlign: "right",
            fontFamily: "'Plus Jakarta Sans',sans-serif",
          }}
        >
          Total: ₱{(product.price * qty).toLocaleString()}
        </div>

        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onConfirm}
          >
            Yes, confirm claim
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

function PaymentSubmitModal({
  item,
  onConfirm,
  onClose,
}: {
  item: ToPayRow
  onConfirm: (method: string, refNo: string) => void
  onClose: () => void
}) {
  const [method, setMethod] = useState("GCash")
  const [refNo, setRefNo] = useState("")
  const [acctName, setAcctName] = useState("")
  const [phone, setPhone] = useState("")
  const [amountPaid, setAmountPaid] = useState(String(item.amount))
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const SELLER_DETAILS: Record<string, {
    name: string
    number: string
    icon: string
  }> = {
    GCash: { name: "Maria Santos", number: "0917 •••• 8821", icon: "" },
    Maya: { name: "Maria Santos", number: "0917 •••• 5543", icon: "" },
    "Bank Transfer": {
      name: "Maria Santos",
      number: "BDO •••• 4421",
      icon: "",
    },
    COD: { name: "", number: "", icon: "" },
  }
  const details = SELLER_DETAILS[method]
  const isCOD = method === "COD"

  const handleFile = (file: File) => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(file.name)
    }, 1200)
  }

  return (
    <Modal title="Submit Payment" onClose={onClose} width={480}>
      <div className="space-y-4">
        <div
          style={{
            background: "#F9FAFB",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
              {item.product}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              Seller: {item.seller}
            </div>
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#111827",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            ₱{item.amount.toLocaleString()}
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
            Payment Method
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["GCash", "Maya", "Bank Transfer", "COD"].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `2px solid ${method === m ? "#191BA9" : "#E5E7EB"}`,
                  background: method === m ? "#EEF0FF" : "#fff",
                  color: method === m ? "#191BA9" : "#6B7280",
                  transition: "all 0.15s",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                {SELLER_DETAILS[m].icon} {m}
              </button>
            ))}
          </div>
        </div>

        {!isCOD && (
          <div
            style={{
              background: "#EEF0FF",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#374151",
                marginBottom: 8,
                letterSpacing: 0.5,
              }}
            >
              SEND TO
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                Account Name
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {details.name}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                Account Number
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {details.number}
              </span>
            </div>
          </div>
        )}

        {isCOD && (
          <div
            style={{
              background: "#FFF7ED",
              border: "1px solid #FCD34D",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#92400E",
            }}
          >
             COD: Coordinate pickup directly with the seller via Messenger or
            the in-app chat. No payment details required.
          </div>
        )}

        {!isCOD && (
          <>
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
                Reference / Transaction Number
              </label>
              <input
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g. GC-20260910-3821"
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
                Account Name Used for Transfer
              </label>
              <input
                value={acctName}
                onChange={(e) => setAcctName(e.target.value)}
                placeholder="Your GCash / bank account name"
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
                Mobile Number <span style={{ color: "#E11D2E" }}>*</span>
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                type="tel"
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
                Amount Paid (₱) <span style={{ color: "#E11D2E" }}>*</span>
              </label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={String(item.amount)}
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
                  marginBottom: 6,
                }}
              >
                Upload Receipt / Screenshot
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              <div
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload receipt or screenshot"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    fileRef.current?.click()
                  }
                }}
                style={{
                  border: "2px dashed #D1D5DB",
                  borderRadius: 8,
                  padding: 20,
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#FAFAFA",
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor =
                    "#191BA9"
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor =
                    "#D1D5DB"
                }}
              >
                {uploading ? (
                  <div style={{ fontSize: 12, color: "#191BA9" }}>
                    Uploading…
                  </div>
                ) : uploaded ? (
                  <>
                    <div style={{ fontSize: 24 }}>✅</div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#065F46",
                      }}
                    >
                      {uploaded}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}
                    >
                      Click to replace
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28 }}>📎</div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Drop your receipt here or click to browse
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}
                    >
                      JPG, PNG, PDF
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
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
            onClick={() => onConfirm(method, refNo)}
            disabled={
              !isCOD &&
              (!refNo.trim() ||
                !uploaded ||
                !phone.trim() ||
                !amountPaid.trim())
            }
          >
            {isCOD ? "Confirm COD Order" : "Submit Payment"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

function TransactionDetailModal({
  tx,
  onClose,
}: {
  tx: PayHistRow
  onClose: () => void
}) {
  return (
    <Modal title="Transaction Details" onClose={onClose} width={460}>
      <div className="space-y-4">
        <div
          style={{
            background: "#F9FAFB",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          {([
            ["Product", tx.product],
            ["Batch", tx.batch || "—"],
            ["Method", tx.method],
            ["Amount", `₱${tx.amount.toLocaleString()}`],
            ["Date", tx.date],
            ["Status", tx.status],
          ] as [string, string][]).map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>
                {k}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {k === "Status" ? <StatusBadge status={tx.status} /> : v}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            background: "#EEF0FF",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#374151",
          }}
        >
          📋 This record is for your reference only. Contact the seller directly
          for disputes.
        </div>
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

function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
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
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          fontSize: 13.5,
          border: `1.5px solid ${
            error ? "#EF4444" : focused ? INDIGO : "#E5E7EB"
          }`,
          borderRadius: 8,
          padding: "10px 13px",
          outline: "none",
          color: "#111827",
          background: "#fff",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
        className="placeholder:text-gray-400"
      />
      {error && (
        <p
          className="fi"
          style={{
            fontSize: 11.5,
            color: "#EF4444",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
            <path
              d="M6 3.5v3M6 8h.01"
              stroke="#EF4444"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Logo mark ────────────────────────────────────────────────────────────────
function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: INDIGO,
          borderRadius: size * 0.22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(25,27,169,0.28)",
        }}
      >
        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M2 5h16M2 10h10M2 15h13"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          color: INDIGO,
          fontWeight: 800,
          fontSize: size * 0.52,
          letterSpacing: -0.8,
          lineHeight: 1,
        }}
      >
        Kargo
      </span>
    </div>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────
function Login({
  onSignUp,
  onSuccess,
}: {
  onSignUp: () => void
  onSuccess: (u: UserInfo) => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailErr, setEmailErr] = useState("")
  const [passErr, setPassErr] = useState("")
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const submit = useCallback(() => {
    let ok = true
    if (!email.trim() || !email.includes("@")) {
      setEmailErr("Enter a valid email address.")
      ok = false
    } else setEmailErr("")
    if (!password) {
      setPassErr("Password is required.")
      ok = false
    } else if (password !== "password123") {
      setPassErr("Incorrect email or password.")
      ok = false
    } else setPassErr("")
    if (!ok) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSuccess({ name: "Juan Dela Cruz", email, role: "Buyer" })
    }, 1600)
  }, [email, password, onSuccess])

  return (
    <div
      style={{
        minHeight: "100vh",
        background: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="pu" style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <LogoMark size={52} />
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
            padding: 32,
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            Welcome back
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#9CA3AF",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Sign in to your Kargo account
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AuthInput
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              error={emailErr}
              placeholder="juan@email.com"
            />
            <div>
              <AuthInput
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                error={passErr}
                placeholder="••••••••"
              />
              <div style={{ textAlign: "right", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setForgotSent(true)}
                  style={{
                    fontSize: 12,
                    color: INDIGO,
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Forgot password?
                </button>
                {forgotSent && (
                  <div role="status" style={{ marginTop: 7, color: "#0B7A59", fontSize: 11 }}>
                    If this email is registered, recovery instructions will be sent shortly.
                  </div>
                )}
              </div>
            </div>
            <PrimaryBtn
              onClick={submit}
              loading={loading}
              style={{
                width: "100%",
                padding: "11px 0",
                fontSize: 14,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {loading ? "Signing in…" : "Log In"}
            </PrimaryBtn>
          </div>
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>
              Don't have an account?{" "}
            </span>
            <button
              onClick={onSignUp}
              style={{
                fontSize: 13,
                color: INDIGO,
                fontWeight: 700,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Sign up
            </button>
          </div>
          <div
            style={{
              background: CYAN_L,
              border: `1px solid ${SKY}`,
              borderRadius: 7,
              padding: "8px 12px",
              marginTop: 16,
            }}
          >
            <p
              style={{ fontSize: 11.5, color: "#0369A1", textAlign: "center" }}
            >
              <strong>Demo:</strong> any email + password{" "}
              <code
                style={{
                  background: "rgba(0,0,0,0.07)",
                  borderRadius: 3,
                  padding: "1px 4px",
                }}
              >
                password123
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────
function SignUp({
  onLogin,
  onSuccess,
}: {
  onLogin: () => void
  onSuccess: (u: UserInfo) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("Buyer")
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Buyer extras
  const photoRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState("")

  // Seller extras
  const [shopName, setShopName] = useState("")
  const [phone, setPhone] = useState("")
  const [socials, setSocials] = useState<Record<string, {
    on: boolean
    url: string
  }>>({
    Facebook: { on: false, url: "" },
    TikTok: { on: false, url: "" },
    Instagram: { on: false, url: "" },
  })
  const [birState, setBirState] = useState<"none" | "uploading" | "submitted">(
    "none",
  )
  const birRef = useRef<HTMLInputElement>(null)
  const [terms, setTerms] = useState(false)

  const submit = useCallback(() => {
    const e: Record<string, string> = {}
    if (!name.trim() || name.trim().split(" ").length < 2)
      e.name = "Enter your full name (first and last)."
    if (!email.includes("@")) e.email = "Enter a valid email address."
    if (password.length < 8)
      e.password = "Password must be at least 8 characters."
    if (role === "Seller") {
      if (!shopName.trim()) e.shopName = "Shop name is required."
      if (!Object.values(socials).some((s) => s.on))
        e.social = "Link at least one social account."
      if (birState !== "submitted")
        e.bir = "Please upload your BIR Certificate."
      if (!terms) e.terms = "You must agree to the Terms and Privacy Policy."
    }
    setErrs(e)
    if (Object.keys(e).length > 0) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSuccess({ name: name.trim(), email, role })
    }, 1800)
  }, [
    name,
    email,
    password,
    role,
    shopName,
    socials,
    birState,
    terms,
    onSuccess,
  ])

  const socialIcons: Record<string, React.ReactNode> = {
    Facebook: (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#1877F2",
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        f
      </span>
    ),
    TikTok: (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#000",
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        T
      </span>
    ),
    Instagram: (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
          color: "#fff",
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        📷
      </span>
    ),
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        overflowY: "auto",
      }}
    >
      <div
        className="pl"
        style={{
          width: "100%",
          maxWidth: 460,
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <LogoMark size={48} />
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
            padding: 32,
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            Create your account
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#9CA3AF",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Join Kargo to buy or sell pasabuy items
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AuthInput
              label="Full Name"
              value={name}
              onChange={setName}
              error={errs.name}
              placeholder="Juan Dela Cruz"
            />
            <AuthInput
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              error={errs.email}
              placeholder="juan@email.com"
            />
            <AuthInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errs.password}
              placeholder="Min. 8 characters"
            />

            {/* Buyer: profile photo */}
            {role === "Buyer" && (
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
                  Profile Photo (optional)
                </label>
                <div
                  onClick={() => photoRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload profile photo"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      photoRef.current?.click()
                    }
                  }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "2px dashed #D1D5DB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    background: CREAM,
                    overflow: "hidden",
                  }}
                >
                  {photo ? (
                    <span
                      style={{
                        fontSize: 9,
                        color: "#374151",
                        textAlign: "center",
                        padding: 4,
                        wordBreak: "break-all",
                      }}
                    >
                      {photo}
                    </span>
                  ) : (
                    <span style={{ fontSize: 22, color: "#D1D5DB" }}>+</span>
                  )}
                </div>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) setPhoto(e.target.files[0].name)
                  }}
                />
              </div>
            )}

            {/* Seller: extra fields */}
            {role === "Seller" && (
              <div
                className="fi"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  borderTop: "1px solid #F3F4F6",
                  paddingTop: 14,
                }}
              >
                <AuthInput
                  label="Shop Name"
                  value={shopName}
                  onChange={setShopName}
                  error={errs.shopName}
                  placeholder="e.g. Maria's Japan Haul Shop"
                />
                {errs.shopName && <span />}
                <AuthInput
                  label="Contact Number"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+63 9XX XXX XXXX"
                />

                {/* Social accounts */}
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
                    Linked Social Accounts{" "}
                    <span style={{ color: "#6B7280", fontWeight: 400 }}>
                      (at least one required)
                    </span>
                  </label>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {(["Facebook", "TikTok", "Instagram"] as const).map(
                      (platform) => (
                        <div
                          key={platform}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {socialIcons[platform]}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#374151",
                              flex: 1,
                            }}
                          >
                            {platform}
                          </span>
                          <Toggle
                            on={socials[platform].on}
                            onChange={(v) =>
                              setSocials((s) => ({
                                ...s,
                                [platform]: { ...s[platform], on: v },
                              }))
                            }
                          />
                          {socials[platform].on && (
                            <input
                              value={socials[platform].url}
                              onChange={(e) =>
                                setSocials((s) => ({
                                  ...s,
                                  [platform]: {
                                    ...s[platform],
                                    url: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Profile URL or @username"
                              style={{
                                fontSize: 12,
                                border: "1px solid #E5E7EB",
                                borderRadius: 6,
                                padding: "5px 9px",
                                outline: "none",
                                color: "#374151",
                                width: 180,
                              }}
                            />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                  {errs.social && (
                    <p
                      className="fi"
                      style={{
                        fontSize: 11.5,
                        color: "#EF4444",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
                        <path
                          d="M6 3.5v3M6 8h.01"
                          stroke="#EF4444"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {errs.social}
                    </p>
                  )}
                </div>

                {/* BIR Certificate */}
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
                    BIR Certificate{" "}
                    <span style={{ color: "#6B7280", fontWeight: 400 }}>
                      (required for Verification Badge)
                    </span>
                  </label>
                  <input
                    ref={birRef}
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setBirState("uploading")
                        setTimeout(() => setBirState("submitted"), 1500)
                      }
                    }}
                  />
                  {birState === "none" && (
                    <div
                      onClick={() => birRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      aria-label="Upload BIR Certificate"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          birRef.current?.click()
                        }
                      }}
                      style={{
                        border: "2px dashed #D1D5DB",
                        borderRadius: 8,
                        padding: "18px 0",
                        textAlign: "center",
                        cursor: "pointer",
                        background: CREAM,
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        Click to upload BIR Certificate
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                      >
                        PDF or image file
                      </div>
                    </div>
                  )}
                  {birState === "uploading" && (
                    <div
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 8,
                        padding: "14px",
                        textAlign: "center",
                        color: "#6B7280",
                        fontSize: 13,
                      }}
                    >
                      <span className="animate-spin inline-block mr-2">⏳</span>
                      Uploading…
                    </div>
                  )}
                  {birState === "submitted" && (
                    <div
                      style={{
                        background: "#D4F5EA",
                        border: "1px solid #6EE7B7",
                        borderRadius: 8,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>✅</span>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#065F46",
                        }}
                      >
                        BIR Certificate Uploaded — Pending Review
                      </div>
                    </div>
                  )}
                  {errs.bir && (
                    <p
                      className="fi"
                      style={{
                        fontSize: 11.5,
                        color: "#EF4444",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
                        <path
                          d="M6 3.5v3M6 8h.01"
                          stroke="#EF4444"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {errs.bir}
                    </p>
                  )}
                </div>

                {/* Terms */}
                <div>
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      fontSize: 12,
                      color: "#6B7280",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      I agree to the{" "}
                      <span style={{ color: INDIGO }}>Terms of Service</span>{" "}
                      and <span style={{ color: INDIGO }}>Privacy Policy</span>.
                      Linked accounts and BIR badge are reference indicators
                      only, not automatically verified by Kargo.
                    </span>
                  </label>
                  {errs.terms && (
                    <p
                      className="fi"
                      style={{
                        fontSize: 11.5,
                        color: "#EF4444",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
                        <path
                          d="M6 3.5v3M6 8h.01"
                          stroke="#EF4444"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {errs.terms}
                    </p>
                  )}
                </div>
              </div>
            )}

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
                I want to join as…
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                {(["Buyer", "Seller"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `2px solid ${role === r ? INDIGO : "#E5E7EB"}`,
                      background: role === r ? "#EEF0FF" : "#fff",
                      color: role === r ? INDIGO : "#6B7280",
                      transition: "all 0.15s",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    {r === "Buyer" ? "🛍 Buyer" : "✈️ Seller"}
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 400,
                        color: role === r ? "#5B5FC7" : "#9CA3AF",
                        marginTop: 2,
                      }}
                    >
                      {r === "Buyer"
                        ? "Claim items from batches"
                        : "Run pasabuy batches"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <PrimaryBtn
              onClick={submit}
              loading={loading}
              style={{
                width: "100%",
                padding: "11px 0",
                fontSize: 14,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {loading
                ? role === "Seller"
                  ? "Creating shop…"
                  : "Creating account…"
                : role === "Seller"
                  ? "Create Shop"
                  : "Create Account"}
            </PrimaryBtn>
          </div>
          <p
            style={{
              fontSize: 11,
              color: "#9CA3AF",
              textAlign: "center",
              marginTop: 14,
            }}
          >
            By signing up, you agree to our{" "}
            <span style={{ color: INDIGO, cursor: "pointer" }}>Terms</span> and{" "}
            <span style={{ color: INDIGO, cursor: "pointer" }}>
              Privacy Policy
            </span>
            .
          </p>
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>
              Already have an account?{" "}
            </span>
            <button
              onClick={onLogin}
              style={{
                fontSize: 13,
                color: INDIGO,
                fontWeight: 700,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Onboarding spotlight ─────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    selector: "[data-spotlight='dashboard-tab']",
    headline: "Welcome to Kargo 👋",
    copy: "Your pasabuy command center. The Dashboard shows your active claims, deadlines, and order status at a glance.",
  },
  {
    selector: "[data-spotlight='batches-tab']",
    headline: "Claim items from batches",
    copy: "Sellers post trip batches here. Browse items, claim your slot before it fills up, and track status in real time.",
  },
  {
    selector: "[data-spotlight='payments-tab']",
    headline: "Pay before the countdown hits zero",
    copy: "All pending payments and deadlines are here. Upload your GCash or bank receipt to lock in your order.",
  },
  {
    selector: "[data-spotlight='role-toggle']",
    headline: "One account, two roles",
    copy: "Toggle to Seller mode to create your own pasabuy batch and manage buyers — no separate account needed.",
  },
]
function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [dir, setDir] = useState<"l" | "r">("l")
  const [contentKey, setContentKey] = useState(0)

  useEffect(() => {
    const el = document.querySelector(
      TOUR_STEPS[step].selector,
    ) as HTMLElement | null
    if (el) setRect(el.getBoundingClientRect())
  }, [step])

  const go = (next: number, d: "l" | "r") => {
    setDir(d)
    setContentKey((k) => k + 1)
    setStep(next)
  }

  const PAD = 10
  const sw = rect ? rect.width + PAD * 2 : 0
  const sh = rect ? rect.height + PAD * 2 : 0
  const sx = rect ? rect.left - PAD : 0
  const sy = rect ? rect.top - PAD : 0
  const tooltipW = 340
  const tooltipX = rect
    ? Math.max(
        12,
        Math.min(
          window.innerWidth - tooltipW - 12,
          rect.left + rect.width / 2 - tooltipW / 2,
        ),
      )
    : 0
  const tooltipY = rect ? sy + sh + 14 : 0
  const arrowX = rect ? rect.left + rect.width / 2 - tooltipX : tooltipW / 2
  const isLast = step === TOUR_STEPS.length - 1

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 198 }} />
      <div
        style={{
          position: "fixed",
          zIndex: 199,
          pointerEvents: "none",
          top: sy,
          left: sx,
          width: sw,
          height: sh,
          borderRadius: 10,
          boxShadow: "0 0 0 9999px rgba(10,10,30,0.68)",
          transition:
            "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          opacity: rect ? 1 : 0,
        }}
      />
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 200,
            pointerEvents: "none",
            top: sy - 4,
            left: sx - 4,
            width: sw + 8,
            height: sh + 8,
            borderRadius: 14,
            border: `2px solid ${CORAL}`,
            animation: "ping 1.8s ease-out infinite",
            transition:
              "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          }}
        />
      )}
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 200,
            pointerEvents: "none",
            top: sy - 4,
            left: sx - 4,
            width: sw + 8,
            height: sh + 8,
            borderRadius: 14,
            border: `2px solid ${CORAL}`,
            animation: "ping 1.8s ease-out 0.7s infinite",
            transition:
              "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          }}
        />
      )}
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 201,
            top: tooltipY,
            left: tooltipX,
            width: tooltipW,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.24)",
            border: "1px solid #E5E7EB",
            transition: "top 0.3s ease-in-out,left 0.3s ease-in-out",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -7,
              left: Math.max(14, Math.min(tooltipW - 24, arrowX - 7)),
              width: 14,
              height: 14,
              background: "#fff",
              transform: "rotate(45deg)",
              border: "1px solid #E5E7EB",
              borderRight: "none",
              borderBottom: "none",
            }}
          />
          <div
            style={{
              height: 3,
              background: "#F3F4F6",
              borderRadius: "12px 12px 0 0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: INDIGO,
                width: `${((step + 1) / TOUR_STEPS.length) * 100}%`,
                transition: "width 0.3s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
          <div style={{ padding: "16px 18px 14px" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => go(i, i > step ? "l" : "r")}
                    role="button"
                    tabIndex={0}
                    aria-label={`Go to tour step ${i + 1} of ${TOUR_STEPS.length}`}
                    aria-current={i === step ? "step" : undefined}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        go(i, i > step ? "l" : "r")
                      }
                    }}
                    style={{
                      width: i === step ? 16 : 6,
                      height: 6,
                      borderRadius: 999,
                      background: i === step ? INDIGO : "#E5E7EB",
                      transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={onDone}
                style={{
                  fontSize: 11,
                  color: "#9CA3AF",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Skip tour
              </button>
            </div>
            <div key={contentKey} className={dir === "l" ? "pl" : "pr"}>
              <h3
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#111827",
                  marginBottom: 6,
                }}
              >
                {TOUR_STEPS[step].headline}
              </h3>
              <p
                style={{
                  fontSize: 12.5,
                  color: "#6B7280",
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}
              >
                {TOUR_STEPS[step].copy}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => go(step - 1, "r")}
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  visibility: step === 0 ? "hidden" : "visible",
                }}
              >
                ← Back
              </button>
              <PrimaryBtn
                onClick={() => (isLast ? onDone() : go(step + 1, "l"))}
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {isLast ? (
                  "Get Started 🚀"
                ) : (
                  <>
                    Next{" "}
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path
                        d="M3 6.5h7M8 4l2.5 2.5L8 9"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Role Toggle ──────────────────────────────────────────────────────────────
function RoleToggle({
  role,
  setRole,
}: {
  role: Role
  setRole: (r: Role) => void
}) {
  return (
    <div
      data-spotlight="role-toggle"
      style={{
        background: CREAM,
        border: "1px solid #E5E7EB",
        borderRadius: 999,
        padding: 2,
        position: "relative",
        display: "inline-flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: role === "Seller" ? "50%" : 2,
          width: "calc(50% - 2px)",
          bottom: 2,
          background: INDIGO,
          borderRadius: 999,
          transition: "left 0.22s cubic-bezier(.22,1,.36,1)",
          pointerEvents: "none",
        }}
      />
      {(["Buyer", "Seller"] as Role[]).map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          style={{
            position: "relative",
            zIndex: 1,
            color: role === r ? "#fff" : "#6B7280",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            transition: "color 0.2s",
            fontFamily: "'Plus Jakarta Sans',sans-serif",
          }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({
  user,
  onLogout,
  onSettings,
  role,
  batches,
  onNavigate,
  onBatchSelect,
  onSellerSelect,
}: {
  user: UserInfo
  onLogout: () => void
  onSettings: () => void
  role?: Role
  batches?: BatchType[]
  onNavigate?: (tab: Tab) => void
  onBatchSelect?: (id: number) => void
  onSellerSelect?: (name: string) => void
}) {
  const [showNotif, setShowNotif] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [notifRead, setNotifRead] = useState(false)
  const [readSet, setReadSet] = useState<Set<number>>(new Set())
  const [searchQ, setSearchQ] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setShowUser(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const notifSource = role === "Seller" ? NOTIF_SELLER : NOTIF_BUYER
  const notifs = notifSource.map((n) => ({
    icon: n.icon,
    text: n.text,
    time: n.time,
    unread: !n.read,
  }))
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotif(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const markAllRead = () => {
    setReadSet(new Set(notifs.map((_, i) => i)))
    setNotifRead(true)
  }
  const hasUnread = !notifRead && notifs.some((n) => n.unread)

  return (
    <header
      style={{
        background: "#fff",
        borderBottom: "1px solid #E5E7EB",
        height: 56,
        zIndex: 50,
      }}
      className="kargo-header flex items-center px-6 gap-6 sticky top-0"
    >
      <div
        className="kargo-brand-lockup flex items-center gap-2 flex-shrink-0"
        style={{ width: 160 }}
      >
        <div
          className="kargo-brand-mark"
          style={{
            background: INDIGO,
            width: 28,
            height: 28,
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h12M2 8h8M2 12h10"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span
          className="kargo-brand-name"
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            color: INDIGO,
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: -0.5,
          }}
        >
          Kargo
        </span>
      </div>
      <div
        className="kargo-search-wrap flex-1 max-w-lg mx-auto"
        style={{ position: "relative" }}
      >
        <div
          style={{
            background: CREAM,
            border: "1px solid #E5E7EB",
            borderRadius: 8,
          }}
          className="kargo-search flex items-center gap-2 px-3 py-2"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
            <path
              d="M11 11l3 3"
              stroke="#9CA3AF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            aria-label="Search batches, products, and sellers"
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value)
              setSearchOpen(e.target.value.length > 0)
            }}
            placeholder="Search batches, products, sellers…"
            style={{
              background: "transparent",
              fontSize: 13,
              color: "#374151",
              outline: "none",
              width: "100%",
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        {searchOpen && searchQ && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              zIndex: 50,
              overflow: "hidden",
              marginTop: 4,
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: 0.5,
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              RESULTS FOR "{searchQ}"
            </div>
            {(() => {
              const q = searchQ.toLowerCase()
              const allBatches = batches || []
              const batchResults = allBatches
                .filter((b) => b.title.toLowerCase().includes(q))
                .slice(0, 3)
              const productResults: {
                name: string
                batchId: number
                batchTitle: string
              }[] = []
              for (const b of allBatches) {
                for (const p of b.products) {
                  if (
                    p.name.toLowerCase().includes(q) &&
                    productResults.length < 3
                  ) {
                    productResults.push({
                      name: p.name,
                      batchId: b.id,
                      batchTitle: b.title,
                    })
                  }
                }
              }
              const sellerSet = new Set<string>()
              const sellerResults: string[] = []
              for (const b of allBatches) {
                if (
                  b.seller.toLowerCase().includes(q) &&
                  !sellerSet.has(b.seller) &&
                  sellerResults.length < 3
                ) {
                  sellerSet.add(b.seller)
                  sellerResults.push(b.seller)
                }
              }
              const hasAny =
                batchResults.length ||
                productResults.length ||
                sellerResults.length
              if (!hasAny)
                return (
                  <div
                    style={{
                      padding: "14px",
                      fontSize: 13,
                      color: "#9CA3AF",
                      textAlign: "center",
                    }}
                  >
                    No results found.
                  </div>
                )
              return (
                <>
                  {batchResults.length > 0 && (
                    <>
                      <div
                        style={{
                          padding: "6px 14px 2px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#9CA3AF",
                          letterSpacing: 0.5,
                        }}
                      >
                        BATCHES
                      </div>
                      {batchResults.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onBatchSelect) {
                              onBatchSelect(b.id)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open batch ${b.title}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSearchOpen(false)
                              setSearchQ("")
                              if (onBatchSelect) {
                                onBatchSelect(b.id)
                              } else {
                                onNavigate && onNavigate("Batches")
                              }
                            }
                          }}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            color: "#374151",
                            cursor: "pointer",
                            borderBottom: "1px solid #F9FAFB",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "#F9FAFB")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "")
                          }
                        >
                          📦 {b.title}
                        </div>
                      ))}
                    </>
                  )}
                  {productResults.length > 0 && (
                    <>
                      <div
                        style={{
                          padding: "6px 14px 2px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#9CA3AF",
                          letterSpacing: 0.5,
                        }}
                      >
                        PRODUCTS
                      </div>
                      {productResults.map((p, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onBatchSelect) {
                              onBatchSelect(p.batchId)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open product ${p.name} in ${p.batchTitle}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSearchOpen(false)
                              setSearchQ("")
                              if (onBatchSelect) {
                                onBatchSelect(p.batchId)
                              } else {
                                onNavigate && onNavigate("Batches")
                              }
                            }
                          }}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            color: "#374151",
                            cursor: "pointer",
                            borderBottom: "1px solid #F9FAFB",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "#F9FAFB")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "")
                          }
                        >
                          🛍️ {p.name}{" "}
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                            in {p.batchTitle}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  {sellerResults.length > 0 && (
                    <>
                      <div
                        style={{
                          padding: "6px 14px 2px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#9CA3AF",
                          letterSpacing: 0.5,
                        }}
                      >
                        SELLERS
                      </div>
                      {sellerResults.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onSellerSelect) {
                              onSellerSelect(s)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open seller ${s}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSearchOpen(false)
                              setSearchQ("")
                              if (onSellerSelect) {
                                onSellerSelect(s)
                              } else {
                                onNavigate && onNavigate("Batches")
                              }
                            }
                          }}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            color: "#374151",
                            cursor: "pointer",
                            borderBottom: "1px solid #F9FAFB",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "#F9FAFB")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "")
                          }
                        >
                          👤 {s}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label={`Notifications${hasUnread ? " (unread)" : ""}`}
            onClick={() => setShowNotif((s) => !s)}
            style={{
              position: "relative",
              background: CREAM,
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            className="hover:bg-gray-100 transition-colors bp"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                fill="#6B7280"
              />
            </svg>
            {hasUnread && (
              <span
                style={{
                  background: "#EF4444",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  position: "absolute",
                  top: 6,
                  right: 7,
                  border: "2px solid #fff",
                }}
              />
            )}
          </button>
          {showNotif && (
            <div
              className="si"
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 340,
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 10,
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                zIndex: 60,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  Notifications
                </span>
                {hasUnread && (
                  <button
                    onClick={markAllRead}
                    style={{
                      fontSize: 11,
                      color: INDIGO,
                      fontWeight: 600,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifs.map((n, i) => {
                const isRead = readSet.has(i) || !n.unread
                return (
                  <div
                    key={i}
                    onClick={() => setReadSet((s) => new Set([...s, i]))}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.text}${isRead ? "" : " (unread)"}, mark as read`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setReadSet((s) => new Set([...s, i]))
                      }
                    }}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #F9FAFB",
                      background: isRead ? "#fff" : "#FAFBFF",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      cursor: "pointer",
                    }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        background: isRead ? "transparent" : INDIGO,
                        borderRadius: "50%",
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {n.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#374151",
                          lineHeight: 1.4,
                          fontWeight: isRead ? 400 : 500,
                        }}
                      >
                        {n.text}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                      >
                        {n.time}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div ref={userRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label={`Open profile menu for ${user.name || "User"}`}
            onClick={() => setShowUser((s) => !s)}
            className="flex items-center gap-2 bp"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 8,
            }}
          >
            <Avatar name={user.name || "User"} size={32} />
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
              {user.name.split(" ")[0] || "User"}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 4.5l3 3 3-3"
                stroke="#9CA3AF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {showUser && (
            <div
              className="si"
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 200,
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 10,
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                zIndex: 60,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {user.name || "User"}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                  {user.email}
                </div>
              </div>
              {[
                {
                  icon: "👤",
                  label: "View Profile",
                  action: () => {
                    onSettings()
                    setShowUser(false)
                  },
                },
                {
                  icon: "⚙️",
                  label: "Settings",
                  action: () => {
                    onSettings()
                    setShowUser(false)
                  },
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#374151",
                    textAlign: "left",
                  }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
              <div style={{ borderTop: "1px solid #F3F4F6" }}>
                <button
                  onClick={() => {
                    setShowUser(false)
                    onLogout()
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#EF4444",
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                  className="hover:bg-red-50 transition-colors"
                >
                  <span style={{ fontSize: 16 }}>🚪</span>Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TABS: Tab[] = ["Dashboard", "Batches", "My Claims", "Payments"]
function TabBar({
  active,
  setActive,
  role,
  setRole,
  onNewBatch,
}: {
  active: Tab
  setActive: (t: Tab) => void
  role: Role
  setRole: (r: Role) => void
  onNewBatch: () => void
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderBottom: "1px solid #E5E7EB",
        zIndex: 40,
        height: 44,
      }}
      className="kargo-tabbar flex items-center sticky top-14"
    >
      {/* Tabs — equally distributed across available width */}
      <div style={{ display: "flex", flex: 1, height: "100%", minWidth: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            data-spotlight={
              tab === "Dashboard"
                ? "dashboard-tab"
                : tab === "Batches"
                  ? "batches-tab"
                  : tab === "Payments"
                    ? "payments-tab"
                    : undefined
            }
            onClick={() => setActive(tab)}
            aria-current={active === tab ? "page" : undefined}
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              color: active === tab ? INDIGO : "#6B7280",
              fontWeight: active === tab ? 700 : 500,
              fontSize: 13,
              borderBottom:
                active === tab
                  ? `2px solid ${INDIGO}`
                  : "2px solid transparent",
              height: 44,
              flex: 1,
              paddingLeft: 4,
              paddingRight: 4,
              borderRadius: 0,
              background: "transparent",
              transition: "color 0.15s,border-color 0.15s",
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            className="hover:text-gray-800"
          >
            {tab === "My Claims"
              ? role === "Seller"
                ? "Orders Received"
                : "My Claims"
              : tab}
          </button>
        ))}
      </div>
      {/* Right group — clear separation via border + padding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingLeft: 24,
          paddingRight: 20,
          borderLeft: "1px solid #E5E7EB",
          height: "100%",
          flexShrink: 0,
        }}
      >
        <RoleToggle role={role} setRole={setRole} />
        {role === "Seller" && (
          <PrimaryBtn
            size="sm"
            onClick={onNewBatch}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1v10M1 6h10"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            New Batch
          </PrimaryBtn>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
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
}: SharedState) {
  const [showPayAll, setShowPayAll] = useState(false)
  const [buyerProfile, setBuyerProfile] = useState<string | null>(null)
  const board = useFulfillmentBoard(setFulfillment)
  const pending = claims.filter((c) => c.status === "Pending")
  const pendingTotal = toPay.reduce((s, t) => s + t.amount, 0)

  const buyerStats = [
    {
      label: "Active Claims",
      value: String(claims.filter((c) => c.status === "Pending").length),
      icon: "📦",
      sub: "+3 this week",
      sc: GREEN,
      bg: "#E8F9F3",
    },
    {
      label: "Pending Payments",
      value: `₱${pendingTotal.toLocaleString()}`,
      icon: "💳",
      sub: `${toPay.length} items due soon`,
      sc: AMBER,
      bg: "#FFF8E8",
    },
    {
      label: "Waitlist Position",
      value: "#3",
      icon: "⏳",
      sub: "Laneige Lip Mask",
      sc: "#6B7280",
      bg: CYAN_L,
    },
    {
      label: "Completed Orders",
      value: "47",
      icon: "✅",
      sub: "All time",
      sc: "#6B7280",
      bg: "#F0EEFF",
    },
  ]
  const sellerStats = [
    {
      label: "Active Batches",
      value: String(batches.filter((b) => b.live).length),
      icon: "✈️",
      sub: "(open + scheduled)",
      sc: GREEN,
      bg: CREAM,
    },
    {
      label: "Awaiting Verification",
      value: "3",
      icon: "📋",
      sub: "Payment proofs to review",
      sc: AMBER,
      bg: CYAN_L,
    },
    {
      label: "Extension Requests",
      value: "2",
      icon: "⏳",
      sub: "Awaiting your approval",
      sc: "#6B7280",
      bg: "#FFF7ED",
    },
    {
      label: "Orders Fulfilled",
      value: String(
        PRIOR_FULFILLED + fulfillment.filter((o) => o.col === "Completed").length,
      ),
      icon: "✅",
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

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="fi"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              style={{
                background: s.bg,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xl">{s.icon}</span>
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
                  icon: "📋",
                  label: "Payments to Verify",
                  count: 3,
                  tab: "Payments" as Tab,
                },
                {
                  icon: "⏳",
                  label: "Extension Requests",
                  count: 2,
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
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
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
                ✅ No "Pay All Pending" needed — sellers verify, not pay.
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
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                Track all orders across fulfillment stages
              </span>
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
            {KANBAN_COLS.map((col) => {
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
                <div key={col} style={{ minWidth: 180, flexShrink: 0 }}>
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
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "#374151",
                                }}
                              >
                                {o.buyer}
                              </span>
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
            })}
          </div>
          <FulfillmentLiveRegion text={board.announcement} />
        </Card>
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
                  ✅ All payments cleared!
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
    </div>
  )
}

// ─── Batch Detail Panel ───────────────────────────────────────────────────────
function BatchDetailPanel({
  batch,
  onClose,
  waitlisted,
  setWaitlisted,
  claimed,
  onClaim,
  role,
  setBatches,
  onSellerClick,
}: {
  batch: BatchType
  onClose: () => void
  waitlisted: Record<string, boolean>
  setWaitlisted: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  claimed: Record<string, boolean>
  onClaim: (
    key: string,
    batch: BatchType,
    product: typeof batch.products[0],
  ) => void
  role: Role
  setBatches?: React.Dispatch<React.SetStateAction<BatchType[]>>
  onSellerClick?: (name: string) => void
}) {
  const isLockedBuyer = batch.locked && role === "Buyer"
  const [claimTarget, setClaimTarget] = useState<{
    p: typeof batch.products[0]
    key: string
  } | null>(null)
  return (
    <Card style={{ border: `2px solid ${INDIGO}`, marginTop: 4 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {batch.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Avatar name={batch.seller} size={20} />
            <span
              style={{
                fontSize: 12,
                color: "#6B7280",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <button
                onClick={() => onSellerClick && onSellerClick(batch.seller)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: onSellerClick ? "pointer" : "default",
                  color: "#6B7280",
                  fontSize: 12,
                  fontWeight: 500,
                  padding: 0,
                  textDecoration: onSellerClick ? "underline" : "none",
                  textUnderlineOffset: 2,
                }}
              >
                {batch.seller}
              </button>
              <BIRBadge /> ·  {batch.rating} · {batch.trips}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            color: "#9CA3AF",
            fontSize: 24,
            background: "none",
            border: "none",
            cursor: "pointer",
            lineHeight: 1,
            padding: "0 4px",
          }}
        >
          ×
        </button>
      </div>
      {isLockedBuyer && (
        <div
          style={{
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Lock size={20} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>
              Not Accepting Orders
            </div>
            <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 2 }}>
              The seller has temporarily locked this batch. Check back later.
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-3">
        {batch.products.map((p, pIdx) => {
          const wKey = `${batch.id}-${p.name}`
          const cKey = `${batch.id}-${p.name}-claimed`
          const isClaimed = claimed[cKey]
          const soldOut = p.claimed >= p.qty && !isClaimed
          const almostGone = !soldOut && p.qty - p.claimed <= 2
          const full = soldOut
          return (
            <div
              key={p.name}
              style={{
                background: CREAM,
                border: "1px solid #EDE8E8",
                borderRadius: 8,
              }}
              className="p-3 flex items-center gap-4"
            >
              <ProductThumb name={p.name} />
              <div className="flex-1">
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {isClaimed ? p.claimed + 1 : p.claimed}/{p.qty} claimed
                  {p.waitlist > 0 ? ` · ${p.waitlist} on waitlist` : ""}
                </div>
                <div
                  style={{
                    background: "#E5E7EB",
                    borderRadius: 999,
                    height: 3,
                    marginTop: 6,
                    overflow: "hidden",
                    width: 120,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, ((isClaimed ? p.claimed + 1 : p.claimed) / p.qty) * 100)}%`,
                      height: "100%",
                      background: full ? "#9CA3AF" : INDIGO,
                      borderRadius: 999,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                {role !== "Seller" && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {soldOut && (
                      <span
                        style={{
                          background: "#FEE2E2",
                          color: "#991B1B",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                        }}
                      >
                        Sold Out
                      </span>
                    )}
                    {!soldOut && almostGone && (
                      <span
                        style={{
                          background: "#FEF3C7",
                          color: "#92400E",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                        }}
                      >
                        Only {p.qty - p.claimed} left!
                      </span>
                    )}
                    {!soldOut && !isClaimed && waitlisted[wKey] && (
                      <span
                        style={{
                          background: CYAN_L,
                          color: "#0369A1",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                        }}
                      >
                        Queue #{p.waitlist + 1}
                      </span>
                    )}
                  </div>
                )}
                {role === "Seller" && (
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                    {p.claimed} claimed · {p.waitlist} waitlisted
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  minWidth: 70,
                  textAlign: "right",
                }}
              >
                ₱{p.price.toLocaleString()}
              </div>
              <div style={{ minWidth: 130 }}>
                {role === "Seller" ? (
                  <div className="flex items-center gap-2 justify-end">
                    <span style={{ fontSize: 11, color: "#6B7280" }}>
                      {p.locked ? <><Lock size={12} aria-hidden="true" /> Locked</> : <><Unlock size={12} aria-hidden="true" /> Open</>}
                    </span>
                    <Toggle
                      on={!p.locked}
                      label={`${p.locked ? "Unlock" : "Lock"} ${p.name}`}
                      onChange={() => {
                        if (setBatches) toggleBatchLock(setBatches, batch.id, pIdx)
                      }}
                    />
                  </div>
                ) : isClaimed ? (
                  <div
                    style={{
                      background: "#D4F5EA",
                      color: "#0B7A59",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "6px 10px",
                      borderRadius: 6,
                      textAlign: "center",
                    }}
                  >
                    ✓ Added to Claims!
                  </div>
                ) : full ? (
                  <div>
                    <div
                      style={{
                        background: "#F3F4F6",
                        color: "#9CA3AF",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 6,
                        textAlign: "center",
                        marginBottom: 4,
                      }}
                    >
                      Fully Claimed
                    </div>
                    {waitlisted[wKey] ? (
                      <div
                        style={{
                          background: CYAN_L,
                          color: "#0369A1",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                          textAlign: "center",
                        }}
                      >
                        Queue #{p.waitlist + 1}
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setWaitlisted((w) => ({ ...w, [wKey]: true }))
                        }
                        style={{
                          width: "100%",
                          background: "#fff",
                          border: `1px solid ${INDIGO}`,
                          color: INDIGO,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                      >
                        Join Waitlist
                      </button>
                    )}
                  </div>
                ) : isLockedBuyer ? (
                  <div
                    style={{
                      background: "#F3F4F6",
                      color: "#9CA3AF",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "6px 10px",
                      borderRadius: 6,
                      textAlign: "center",
                    }}
                  >
                    <><Lock size={13} aria-hidden="true" /> Locked</>
                  </div>
                ) : (
                  <PrimaryBtn
                    size="sm"
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                    }}
                    onClick={() => setClaimTarget({ p, key: cKey })}
                  >
                    Claim Item
                  </PrimaryBtn>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {claimTarget && (
        <ItemClaimModal
          batch={batch}
          product={claimTarget.p}
          onConfirm={() => {
            onClaim(claimTarget.key, batch, claimTarget.p)
            setClaimTarget(null)
          }}
          onClose={() => setClaimTarget(null)}
        />
      )}
    </Card>
  )
}

// ─── Seller Profile Modal ─────────────────────────────────────────────────────
function SellerProfileModal({
  seller,
  batches,
  onClose,
  onClaimFromProfile,
  setTab: setAppTab,
}: {
  seller: string
  batches: BatchType[]
  onClose: () => void
  onClaimFromProfile?: (batchId: number) => void
  setTab?: (t: Tab) => void
}) {
  const [tab, setTab] = useState<"Shop" | "Reviews" | "About">("Shop")
  const [shopCat, setShopCat] = useState("All")
  const [shopSort, setShopSort] = useState("Newest")
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [showBIR, setShowBIR] = useState(false)
  const sellerBatches = batches.filter((b) => b.seller === seller)
  const avgRating = sellerBatches.length
    ? (
        sellerBatches.reduce((s, b) => s + b.rating, 0) / sellerBatches.length
      ).toFixed(1)
    : "5.0"
  const activeBatches = sellerBatches
    .filter((b) => !b.locked && (shopCat === "All" || b.category === shopCat))
    .sort((a, b) =>
      shopSort === "Most Claimed"
        ? b.claimed - a.claimed
        : shopSort === "Ending Soonest"
          ? a.id - b.id
          : b.id - a.id,
    )
  const pastBatches = sellerBatches.filter((b) => b.locked)
  const REVIEWS = [
    {
      buyer: "Trisha L.",
      rating: 5,
      comment:
        "Super responsive seller! Items arrived in perfect condition. Will definitely order again!",
    },
    {
      buyer: "Carlo R.",
      rating: 4,
      comment:
        "Good communication. Slight delay but overall satisfied with the service.",
    },
    {
      buyer: "Mia S.",
      rating: 5,
      comment:
        "My fave pasabuy seller. Always gives updates on ETA and packaging is amazing.",
    },
  ]
  const grad =
    CAT_GRAD[sellerBatches[0]?.category || "Mixed"] || CAT_GRAD["Mixed"]
  return (
    <Modal title="" onClose={onClose} width={600}>
      <div
        style={{
          margin: "-28px -28px 20px",
          borderRadius: "12px 12px 0 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 90,
            background: grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Avatar name={seller} size={52} />
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            padding: "12px 24px 0",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 17,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
            }}
          >
            {seller}
            <BIRBadge size={18} onClick={() => setShowBIR(true)} />
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>
             {avgRating} · {sellerBatches.length} batch
            {sellerBatches.length !== 1 ? "es" : ""}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {(["Shop", "Reviews", "About"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? INDIGO : "#fff",
              color: tab === t ? "#fff" : "#6B7280",
              border: `1px solid ${tab === t ? INDIGO : "#E5E7EB"}`,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Shop" && (
        <div>
          {/* Overview strip */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              {
                label: "Active Batches",
                value: String(
                  sellerBatches.filter((b) => b.live).length ||
                    sellerBatches.length,
                ),
                icon: "✈️",
              },
              {
                label: "Products Available",
                value: String(
                  sellerBatches.reduce((s, b) => s + b.products.length, 0),
                ),
                icon: "📦",
              },
              {
                label: "Claim Rate",
                value: `${Math.round(
                  (sellerBatches.reduce((s, b) => s + b.claimed, 0) /
                    Math.max(
                      1,
                      sellerBatches.reduce((s, b) => s + b.items, 0),
                    )) *
                    100,
                )}%`,
                icon: "📈",
              },
            ].map((st) => (
              <div
                key={st.label}
                style={{
                  background: CREAM,
                  borderRadius: 8,
                  padding: "10px 12px",
                  textAlign: "center",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div style={{ fontSize: 18 }}>{st.icon}</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#111827",
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  {st.value}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#9CA3AF",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {st.label}
                </div>
              </div>
            ))}
          </div>
          {/* Filter bar */}
          <div
            className="flex items-center gap-2 mb-4"
            style={{ flexWrap: "wrap" }}
          >
            <select
              value={shopCat}
              onChange={(e) => setShopCat(e.target.value)}
              style={{
                fontSize: 12,
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: "5px 8px",
                background: "#fff",
                outline: "none",
                color: "#374151",
              }}
            >
              {[
                "All",
                ...Array.from(new Set(sellerBatches.map((b) => b.category))),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={shopSort}
              onChange={(e) => setShopSort(e.target.value)}
              style={{
                fontSize: 12,
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: "5px 8px",
                background: "#fff",
                outline: "none",
                color: "#374151",
              }}
            >
              {["Newest", "Most Claimed", "Ending Soonest"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          {/* Batch cards */}
          <div
            className="space-y-3"
            style={{ maxHeight: 360, overflowY: "auto" }}
          >
            {activeBatches.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "16px 0",
                }}
              >
                No active batches.
              </div>
            )}
            {activeBatches.map((b) => {
              const pct = Math.round((b.claimed / b.items) * 100)
              const isExpanded = expandedBatch === b.id
              const grad = CAT_GRAD[b.category] || CAT_GRAD["Mixed"]
              return (
                <div
                  key={b.id}
                  style={{
                    border: `1px solid ${isExpanded ? INDIGO : "#E5E7EB"}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    boxShadow: isExpanded ? `0 0 0 2px ${INDIGO}20` : "none",
                  }}
                >
                  <div
                    style={{
                      height: 70,
                      background: grad,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0 14px",
                    }}
                  >
                    <CategoryIcon category={b.category} size={28} color="#fff" />
                    <div className="flex-1">
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fff",
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                        }}
                      >
                        {b.title}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}
                      >
                        {b.trips}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#fff", padding: "10px 14px" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: 11, color: "#6B7280" }}>
                        {b.claimed}/{b.items} claimed
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color:
                            pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div
                      style={{
                        background: "#F3F4F6",
                        borderRadius: 999,
                        height: 4,
                        overflow: "hidden",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background:
                            pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setExpandedBatch(isExpanded ? null : b.id)
                        }
                        style={{
                          flex: 1,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "6px 0",
                          borderRadius: 7,
                          border: `1px solid ${INDIGO}`,
                          background: isExpanded ? "#EEF0FF" : "#fff",
                          color: INDIGO,
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "Hide Products ↑" : "View Products →"}
                      </button>
                      <button
                        onClick={() => {
                          onClaimFromProfile?.(b.id)
                          onClose()
                        }}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "6px 12px",
                          borderRadius: 7,
                          border: "none",
                          background: INDIGO,
                          color: "#fff",
                          cursor: "pointer",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        Claim →
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: "1px solid #E5E7EB",
                        background: "#FAFAFA",
                      }}
                    >
                      {b.products.map((p, pi) => {
                        const soldOut = p.claimed >= p.qty
                        const onlyN = p.qty - p.claimed
                        return (
                          <div
                            key={pi}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 0",
                              borderBottom: "1px solid #F3F4F6",
                            }}
                          >
                            <ProductThumb name={p.name} />
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {p.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6B7280",
                                  marginTop: 1,
                                }}
                              >
                                {p.claimed}/{p.qty} claimed
                              </div>
                              {soldOut ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#991B1B",
                                    background: "#FEE2E2",
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                  }}
                                >
                                  Sold Out
                                </span>
                              ) : onlyN <= 3 ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#92400E",
                                    background: "#FEF3C7",
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                  }}
                                >
                                  Only {onlyN} left
                                </span>
                              ) : null}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#111827",
                                fontFamily: "'Plus Jakarta Sans',sans-serif",
                              }}
                            >
                              ₱{p.price.toLocaleString()}
                            </div>
                            {soldOut ? (
                              <button
                                onClick={() => {
                                  onClose()
                                  setAppTab && setAppTab("Batches")
                                }}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  cursor: "pointer",
                                  background: INDIGO,
                                  color: "#fff",
                                  whiteSpace: "nowrap" as const,
                                }}
                              >
                                Join Waitlist
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  onClose()
                                  setAppTab && setAppTab("Batches")
                                }}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  cursor: "pointer",
                                  background: "#C81E62",
                                  color: "#fff",
                                  whiteSpace: "nowrap" as const,
                                }}
                              >
                                Claim this Item
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {pastBatches.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPast((v) => !v)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#6B7280",
                  }}
                >
                  <span>📦 Past & Locked Batches ({pastBatches.length})</span>
                  <span>{showPast ? "▲" : "▼"}</span>
                </button>
                {showPast && (
                  <div className="space-y-2 mt-2">
                    {pastBatches.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          opacity: 0.7,
                        }}
                      >
                        <CategoryIcon category={b.category} size={18} color={INDIGO} />
                        <div className="flex-1">
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            {b.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                            {b.trips} · {b.claimed}/{b.items} claimed
                          </div>
                        </div>
                        {b.locked && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#9CA3AF",
                              background: "#F3F4F6",
                              borderRadius: 999,
                              padding: "2px 8px",
                            }}
                          >
                            <><Lock size={13} aria-hidden="true" /> Locked</>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {tab === "Reviews" && (
        <div className="space-y-3">
          {REVIEWS.map((r, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Avatar name={r.buyer} size={24} />
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}
                >
                  {r.buyer}
                </span>
                <span style={{ fontSize: 12, color: AMBER }}>
                  {"".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                {r.comment}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "About" && (
        <div className="space-y-4">
          <div
            style={{
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.6,
              background: CREAM,
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            Trusted pasabuy seller since 2024. I travel frequently to Japan,
            Korea, and Southeast Asia. I specialize in K-beauty, Japanese
            snacks, and luxury items at competitive prices. All items are 100%
            authentic with receipts upon request.
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Social Accounts
            </div>
            <div className="space-y-2">
              {[
                {
                  bg: "#1877F2",
                  label: "Facebook",
                  icon: (
                    <span
                      style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}
                    >
                      f
                    </span>
                  ),
                  url: `https://facebook.com/${seller.toLowerCase().replace(" ", ".")}`,
                },
                {
                  bg: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)",
                  label: "Instagram",
                  icon: <span style={{ color: "#fff", fontSize: 11 }}>📷</span>,
                  url: `https://instagram.com/${seller.toLowerCase().replace(" ", "_")}.pasabuy`,
                },
                {
                  bg: "#000",
                  label: "TikTok",
                  icon: (
                    <span
                      style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}
                    >
                      T
                    </span>
                  ),
                  url: `https://tiktok.com/@${seller.toLowerCase().replace(" ", "_")}`,
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "#374151",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "#F9FAFB")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "")
                  }
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: s.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {s.label}
                    </div>
                    <div style={{ fontSize: 11, color: INDIGO }}>{s.url}</div>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 12,
                      color: "#9CA3AF",
                    }}
                  >
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
          <button
            style={{
              fontSize: 11,
              color: "#EF4444",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Report this Shop
          </button>
        </div>
      )}
      {showBIR && <BIRInfoModal onClose={() => setShowBIR(false)} />}
    </Modal>
  )
}

// ─── Seller Shop Page ─────────────────────────────────────────────────────────
function SellerShopPage({
  seller,
  batches,
  onBatchClick,
}: {
  seller: string
  batches: BatchType[]
  onBatchClick: (id: number) => void
}) {
  const sellerBatches = batches.filter((b) => b.seller === seller)
  const avgRating = sellerBatches.length
    ? (
        sellerBatches.reduce((s, b) => s + b.rating, 0) / sellerBatches.length
      ).toFixed(1)
    : "5.0"
  const totalItems = sellerBatches.reduce((s, b) => s + b.products.length, 0)
  const totalClaimed = sellerBatches.reduce((s, b) => s + b.claimed, 0)
  const totalAvail = sellerBatches.reduce((s, b) => s + b.items, 0)
  const rate =
    totalAvail > 0 ? Math.round((totalClaimed / totalAvail) * 100) : 0
  const [catFilter, setCatFilter] = useState("All")
  const [sortBy, setSortBy] = useState("Newest")
  const cats = [
    "All",
    ...Array.from(new Set(sellerBatches.map((b) => b.category))),
  ]

  const filtered = sellerBatches
    .filter((b) => catFilter === "All" || b.category === catFilter)
    .sort((a, b_) =>
      sortBy === "Most Claimed"
        ? b_.claimed - a.claimed
        : sortBy === "Ending Soonest"
          ? a.id - b_.id
          : b_.id - a.id,
    )

  return (
    <div
      className="grid gap-6"
      style={{ gridTemplateColumns: "1fr 300px", alignItems: "start" }}
    >
      {/* Left — items */}
      <div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap" as const,
            alignItems: "center",
          }}
        >
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            style={{
              fontSize: 12,
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              padding: "6px 10px",
              background: "#fff",
              outline: "none",
              color: "#374151",
            }}
          >
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              fontSize: 12,
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              padding: "6px 10px",
              background: "#fff",
              outline: "none",
              color: "#374151",
            }}
          >
            {["Newest", "Most Claimed", "Ending Soonest"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: "auto" }}>
            {filtered.length} batch{filtered.length !== 1 ? "es" : ""}
          </span>
        </div>
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: 13,
              padding: "40px 0",
            }}
          >
            No batches match filters.
          </div>
        )}
        {filtered.map((b) => {
          const pct = Math.round((b.claimed / b.items) * 100)
          const grad = CAT_GRAD[b.category] || CAT_GRAD["Mixed"]
          return (
            <div key={b.id} style={{ marginBottom: 20 }}>
              <div
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: 70,
                    background: grad,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0 16px",
                    position: "relative",
                  }}
                >
                  <CategoryIcon category={b.category} size={28} color="#fff" />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      {b.title}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}
                    >
                      {b.trips}
                    </div>
                  </div>
                </div>
                <div style={{ padding: "10px 16px" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 11, color: "#6B7280" }}>
                      {b.claimed}/{b.items} claimed
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      background: "#F3F4F6",
                      borderRadius: 999,
                      height: 4,
                      overflow: "hidden",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background:
                          pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
                {/* All items across this batch */}
                <div style={{ borderTop: "1px solid #F3F4F6" }}>
                  <div
                    style={{
                      padding: "8px 16px",
                      background: CREAM,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#374151",
                      letterSpacing: 0.5,
                    }}
                  >
                    AVAILABLE ITEMS
                  </div>
                  {b.products.map((p, pi) => {
                    const left = p.qty - p.claimed
                    const soldOut = left <= 0
                    return (
                      <div
                        key={pi}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 16px",
                          borderTop: "1px solid #F9FAFB",
                        }}
                      >
                        <ProductThumb name={p.name} />
                        <div className="flex-1">
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {p.name}
                          </div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                            {p.claimed}/{p.qty} claimed
                            {p.waitlist > 0
                              ? ` · ${p.waitlist} on waitlist`
                              : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: INDIGO,
                              fontFamily: "'Plus Jakarta Sans',sans-serif",
                            }}
                          >
                            ₱{p.price.toLocaleString()}
                          </div>
                          {soldOut ? (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#EF4444",
                                fontWeight: 600,
                                background: "#FEE2E2",
                                borderRadius: 999,
                                padding: "1px 6px",
                              }}
                            >
                              Sold Out
                            </span>
                          ) : left <= 2 ? (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#D97706",
                                fontWeight: 600,
                                background: "#FEF3C7",
                                borderRadius: 999,
                                padding: "1px 6px",
                              }}
                            >
                              Only {left} left!
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: "#6B7280" }}>
                              {left} available
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div
                  style={{
                    padding: "10px 16px",
                    borderTop: "1px solid #E5E7EB",
                  }}
                >
                  <button
                    onClick={() => onBatchClick(b.id)}
                    style={{
                      width: "100%",
                      background: "#C81E62",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 0",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    Claim from this batch →
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Right — seller profile panel */}
      <div style={{ position: "sticky", top: 140 }} className="space-y-4">
        <Card>
          <div
            style={{
              textAlign: "center",
              paddingBottom: 12,
              borderBottom: "1px solid #F3F4F6",
              marginBottom: 12,
            }}
          >
            <Avatar name={seller} size={56} />
            <div
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 16,
                fontWeight: 800,
                color: "#111827",
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {seller}
              <BIRBadge size={14} />
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
               {avgRating} · Member since Jan 2024
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#374151",
              background: CREAM,
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            Trusted pasabuy seller. Linked Facebook account:{" "}
            <a
              href={`https://facebook.com/${seller.toLowerCase().replace(" ", ".")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: INDIGO }}
            >
              facebook.com/{seller.toLowerCase().replace(" ", ".")}
            </a>
            <div
              style={{
                fontSize: 10,
                color: "#9CA3AF",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              This is a credibility reference only — not a payment guarantee.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Completed", "47", "#0B7A59"],
              ["Cancelled", "2", "#EF4444"],
              ["Incomplete", "1", "#92400E"],
              ["Disputes", "0", "#6B7280"],
            ].map(([label, val, color]) => (
              <div
                key={label}
                style={{
                  background: "#F9FAFB",
                  borderRadius: 8,
                  padding: "8px 10px",
                  textAlign: "center",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color,
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  {val}
                </div>
                <div
                  style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#374151",
              background: "#EEF0FF",
              borderRadius: 8,
              padding: "8px 12px",
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            94% of this seller's tracked transactions reached Completed. These
            numbers come from recorded transactions, not self-reported ratings.
          </div>
        </Card>
        <Card>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#374151",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            SHOP STATS
          </div>
          {[
            ["Total Batches", sellerBatches.length],
            ["Total Products", totalItems],
            ["Claim Rate", `${rate}%`],
          ].map(([label, val]) => (
            <div
              key={String(label)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                borderBottom: "1px solid #F9FAFB",
                fontSize: 12,
              }}
            >
              <span style={{ color: "#6B7280" }}>{label}</span>
              <span
                style={{
                  fontWeight: 700,
                  color: "#111827",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                {val}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ─── Seller Directory Page ─────────────────────────────────────────────────────
function SellerDirectoryPage({
  batches,
  onBack,
  onSellerSelect,
  onClaimFromProfile,
}: {
  batches: BatchType[]
  onBack: () => void
  onSellerSelect: (name: string) => void
  onClaimFromProfile: (batchId: number) => void
}) {
  const [query, setQuery] = useState("")
  const [chip, setChip] = useState<"All" | "4.5+" | "Has Active Batch">("All")
  const [shopPage, setShopPage] = useState<string | null>(null)

  const sellerMap: Record<string, { batches: BatchType[]; rating: number }> = {}
  batches.forEach((b) => {
    if (!sellerMap[b.seller]) sellerMap[b.seller] = { batches: [], rating: 0 }
    sellerMap[b.seller].batches.push(b)
  })
  Object.values(sellerMap).forEach((s) => {
    s.rating = parseFloat(
      (
        s.batches.reduce((sum, b) => sum + b.rating, 0) / s.batches.length
      ).toFixed(1),
    )
  })

  const sellers = Object.entries(sellerMap).filter(([name, data]) => {
    if (query && !name.toLowerCase().includes(query.toLowerCase())) return false
    if (chip === "4.5+" && data.rating < 4.5) return false
    if (chip === "Has Active Batch" && !data.batches.some((b) => b.live))
      return false
    return true
  })

  if (shopPage) {
    return (
      <div>
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #E5E7EB",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            position: "sticky",
            top: 88,
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setShopPage(null)}
            style={{
              fontSize: 13,
              color: INDIGO,
              fontWeight: 600,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ← Back to Sellers
          </button>
          <span style={{ fontSize: 12, color: "#D1D5DB" }}>/</span>
          <span style={{ fontSize: 13, color: "#6B7280" }}>{shopPage}</span>
        </div>
        <div className="p-6">
          <SellerShopPage
            seller={shopPage}
            batches={batches}
            onBatchClick={() => {}}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #E5E7EB",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "sticky",
          top: 88,
          zIndex: 30,
        }}
      >
        <button
          onClick={onBack}
          style={{
            fontSize: 13,
            color: INDIGO,
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ← Back to Batches
        </button>
        <span style={{ fontSize: 12, color: "#D1D5DB" }}>/</span>
        <span style={{ fontSize: 13, color: "#6B7280" }}>Browse Sellers</span>
      </div>
      <div className="p-6">
        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 20,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 4,
            }}
          >
            Seller Directory
          </h2>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            Browse verified pasabuy sellers and their active batches.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            alignItems: "center",
            flexWrap: "wrap" as const,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by shop name…"
            style={{
              flex: 1,
              minWidth: 200,
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
            }}
            className="placeholder:text-gray-400"
          />
          {(["All", "4.5+", "Has Active Batch"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: `1px solid ${chip === c ? INDIGO : "#E5E7EB"}`,
                background: chip === c ? "#EEF0FF" : "#fff",
                color: chip === c ? INDIGO : "#6B7280",
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}
        >
          {sellers.length === 0 && (
            <div
              style={{
                gridColumn: "1/-1",
                textAlign: "center",
                color: "#9CA3AF",
                fontSize: 13,
                padding: "40px 0",
              }}
            >
              No sellers found.
            </div>
          )}
          {sellers.map(([name, data]) => {
            const hasLive = data.batches.some((b) => b.live)
            return (
              <Card
                key={name}
                style={{ cursor: "pointer" }}
                className="hover:shadow-md transition-shadow"
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Avatar name={name} size={44} />
                  <div className="flex-1">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#111827",
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                        }}
                      >
                        {name}
                      </span>
                      <BIRBadge size={12} />
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                       {data.rating} · {data.batches.length} batch
                      {data.batches.length !== 1 ? "es" : ""}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 12,
                    flexWrap: "wrap" as const,
                  }}
                >
                  {Array.from(new Set(data.batches.map((b) => b.category)))
                    .slice(0, 3)
                    .map((cat) => (
                      <span
                        key={cat}
                        style={{
                          fontSize: 10,
                          background: "#F3F4F6",
                          color: "#6B7280",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 500,
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                </div>
                <PrimaryBtn
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                  }}
                  onClick={() => setShopPage(name)}
                >
                  View Shop
                </PrimaryBtn>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Seller Search Modal ──────────────────────────────────────────────────────
function SellerSearchModal({
  batches,
  onClose,
  onClaimFromProfile,
}: {
  batches: BatchType[]
  onClose: () => void
  onClaimFromProfile?: (batchId: number) => void
}) {
  const [query, setQuery] = useState("")
  const [chipFilter, setChip] = useState<"All" | "4.5+" | "Has Active Batch">(
    "All",
  )
  const [profile, setProfile] = useState<string | null>(null)

  const sellerMap: Record<string, { batches: BatchType[]; rating: number }> = {}
  batches.forEach((b) => {
    if (!sellerMap[b.seller]) sellerMap[b.seller] = { batches: [], rating: 0 }
    sellerMap[b.seller].batches.push(b)
  })
  Object.values(sellerMap).forEach((s) => {
    s.rating = parseFloat(
      (
        s.batches.reduce((sum, b) => sum + b.rating, 0) / s.batches.length
      ).toFixed(1),
    )
  })

  const sellers = Object.entries(sellerMap).filter(([name, data]) => {
    if (query && !name.toLowerCase().includes(query.toLowerCase())) return false
    if (chipFilter === "4.5+" && data.rating < 4.5) return false
    if (chipFilter === "Has Active Batch" && !data.batches.some((b) => b.live))
      return false
    return true
  })

  return (
    <>
      <Modal title="Browse Sellers" onClose={onClose} width={640}>
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by shop name…"
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
              marginBottom: 12,
            }}
            className="placeholder:text-gray-400"
          />
          <div className="flex gap-2 mb-4">
            {(["All", "4.5+", "Has Active Batch"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                style={{
                  background: chipFilter === c ? INDIGO : "#fff",
                  color: chipFilter === c ? "#fff" : "#6B7280",
                  border: `1px solid ${chipFilter === c ? INDIGO : "#E5E7EB"}`,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <div
            className="space-y-3"
            style={{ maxHeight: 360, overflowY: "auto" }}
          >
            {sellers.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "24px 0",
                }}
              >
                No sellers found.
              </div>
            )}
            {sellers.map(([name, data]) => {
              const hasLive = data.batches.some((b) => b.live)
              return (
                <div
                  key={name}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 9,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <Avatar name={name} size={40} />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#111827",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {name}
                      <BIRBadge />
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}
                    >
                       {data.rating} · {data.batches.length} batch
                      {data.batches.length !== 1 ? "es" : ""}
                    </div>
                  </div>
                  <SecondaryBtn onClick={() => setProfile(name)}>
                    View Profile
                  </SecondaryBtn>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
      {profile && (
        <SellerProfileModal
          seller={profile}
          batches={batches}
          onClose={() => setProfile(null)}
          onClaimFromProfile={onClaimFromProfile}
        />
      )}
    </>
  )
}

// ─── Batch Full-Page View ─────────────────────────────────────────────────────
function BatchPage({
  batch,
  role,
  user,
  batches,
  claims,
  setClaims,
  toPay,
  setToPay,
  onBack,
  onSellerClick,
  setBatches,
}: {
  batch: BatchType
  role: Role
  user: UserInfo
  batches: BatchType[]
  claims: ClaimRow[]
  setClaims: React.Dispatch<React.SetStateAction<ClaimRow[]>>
  toPay: ToPayRow[]
  setToPay: React.Dispatch<React.SetStateAction<ToPayRow[]>>
  onBack: () => void
  onSellerClick: (name: string) => void
  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>
}) {
  const [waitlisted, setWaitlisted] = useState<Record<string, boolean>>({})
  const [claimedKeys, setClaimedKeys] = useState<Record<string, boolean>>({})
  const [claimTarget, setClaimTarget] = useState<{
    p: typeof batch.products[0]
    key: string
  } | null>(null)
  const [contact, setContact] = useState(false)
  const pct = Math.round((batch.claimed / batch.items) * 100)
  const grad = CAT_GRAD[batch.category] || CAT_GRAD["Mixed"]
  const reserveHrs = batch.reserveHours || 48
  const handleClaim = (
    key: string,
    b: BatchType,
    product: typeof batch.products[0],
  ) => {
    setClaimedKeys((c) => ({ ...c, [key]: true }))
    setClaims((prev) => [
      {
        id: Date.now(),
        product: product.name,
        batch: b.title,
        seller: b.seller,
        qty: 1,
        amount: product.price,
        status: "Pending",
        hours: reserveHrs,
      },
      ...prev,
    ])
    if (!toPay.some((t) => t.product === product.name))
      setToPay((prev) => [
        {
          id: Date.now(),
          product: product.name,
          seller: b.seller,
          amount: product.price,
          hours: reserveHrs,
        },
        ...prev,
      ])
  }

  return (
    <div className="p-6 fi" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: INDIGO,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 0 16px",
          fontFamily: "'Plus Jakarta Sans',sans-serif",
        }}
      >
        ← Back to Batches
      </button>

      {/* Hero header */}
      <div
        style={{
          height: 180,
          background: grad,
          borderRadius: 12,
          display: "flex",
          alignItems: "flex-end",
          padding: 20,
          position: "relative",
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-60%)",
            fontSize: 72,
            opacity: 0.18,
          }}
        >
          <CategoryIcon category={batch.category} size={44} color="#fff" />
        </span>
        {batch.locked && role === "Buyer" && (
          <span
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
            }}
          >
            <><Lock size={14} aria-hidden="true" /> Not Accepting Orders</>
          </span>
        )}
        <div>
          <h1
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            {batch.title}
          </h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
              }}
            >
              {batch.category}
            </span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
              ✈️ {batch.trips}
            </span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
               48h reservation window
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left: products */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Items in this Batch
            </h2>
            {role === "Buyer" && (
              <SecondaryBtn onClick={() => setContact(true)}>
                Contact Seller
              </SecondaryBtn>
            )}
          </div>
          <div className="space-y-3">
            {batch.products.map((p, pIdx) => {
              const pKey = `${batch.id}-${pIdx}`
              const isClaimed = claimedKeys[pKey]
              const left = p.qty - p.claimed - (isClaimed ? 1 : 0)
              const soldOut = left <= 0
              const onWaitlist = waitlisted[pKey]
              return (
                <Card
                  key={pIdx}
                  style={{ display: "flex", alignItems: "center", gap: 14 }}
                >
                  <ProductThumb name={p.name} />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {p.claimed}/{p.qty} claimed
                      {p.waitlist > 0 ? ` · ${p.waitlist} on waitlist` : ""}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 5,
                        flexWrap: "wrap" as const,
                      }}
                    >
                      {soldOut && !isClaimed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#EF4444",
                            background: "#FEE2E2",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          Sold Out
                        </span>
                      )}
                      {!soldOut && left <= 2 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#D97706",
                            background: "#FEF3C7",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          Only {left} left!
                        </span>
                      )}
                      {isClaimed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: GREEN,
                            background: "#D4F5EA",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          ✓ Claimed
                        </span>
                      )}
                      {onWaitlist && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#0369A1",
                            background: CYAN_L,
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          Queue #{p.waitlist + 1}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: INDIGO,
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                        marginBottom: 8,
                      }}
                    >
                      ₱{p.price.toLocaleString()}
                    </div>
                    {role === "Seller" ? (
                      <Toggle
                        on={!p.locked}
                        label={`${p.locked ? "Unlock" : "Lock"} ${p.name}`}
                        onChange={() => toggleBatchLock(setBatches, batch.id, pIdx)}
                      />
                    ) : batch.locked ? (
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                        <><Lock size={13} aria-hidden="true" /> Locked</>
                      </span>
                    ) : isClaimed ? (
                      <span
                        style={{ fontSize: 11, color: GREEN, fontWeight: 600 }}
                      >
                        ✓ In Claims
                      </span>
                    ) : soldOut ? (
                      onWaitlist ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#0369A1",
                            fontWeight: 600,
                          }}
                        >
                          On Waitlist
                        </span>
                      ) : (
                        <PrimaryBtn
                          size="sm"
                          onClick={() =>
                            setWaitlisted((w) => ({ ...w, [pKey]: true }))
                          }
                        >
                          Join Waitlist
                        </PrimaryBtn>
                      )
                    ) : (
                      <PrimaryBtn
                        size="sm"
                        onClick={() => setClaimTarget({ p, key: pKey })}
                        style={{
                          background: "#C81E62",
                          boxShadow: "0 2px 8px rgba(200,30,98,0.35)",
                        }}
                      >
                        Claim this item
                      </PrimaryBtn>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Right: seller panel */}
        <div className="space-y-4">
          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: 0.8,
                marginBottom: 12,
              }}
            >
              SELLER
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
              onClick={() => onSellerClick(batch.seller)}
              role="button"
              tabIndex={0}
              aria-label={`View ${batch.seller}'s shop`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSellerClick(batch.seller)
                }
              }}
            >
              <Avatar name={batch.seller} size={40} />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#111827",
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {batch.seller}
                  <BIRBadge verified />
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                   {batch.rating} · Tap to view shop
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "#EEF0FF",
                borderRadius: 8,
                display: "flex",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>📘</span>
              <div>
                <div
                  style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}
                >
                  Linked Facebook account
                </div>
                <div style={{ fontSize: 11, color: INDIGO }}>
                  facebook.com/{batch.seller.toLowerCase().replace(" ", ".")}
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                  Credibility reference only — not a payment guarantee.
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: 0.8,
                marginBottom: 12,
              }}
            >
              BATCH PROGRESS
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {batch.claimed}/{batch.items} claimed
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                }}
              >
                {pct}%
              </span>
            </div>
            <div
              style={{
                background: "#F3F4F6",
                borderRadius: 999,
                height: 6,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                  borderRadius: 999,
                }}
              />
            </div>
            {[
              ["Items", String(batch.items)],
              ["Claimed", String(batch.claimed)],
              ["Remaining", String(batch.items - batch.claimed)],
              ["Rating", ` ${batch.rating}`],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{k}</span>
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}
                >
                  {v}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {claimTarget && (
        <ItemClaimModal
          batch={batch}
          product={claimTarget.p}
          onConfirm={() => {
            handleClaim(claimTarget.key, batch, claimTarget.p)
            setClaimTarget(null)
          }}
          onClose={() => setClaimTarget(null)}
        />
      )}
      {contact && (
        <ContactSellerModal
          seller={batch.seller}
          product={batch.title}
          onClose={() => setContact(false)}
        />
      )}
    </div>
  )
}

// ─── Batches ──────────────────────────────────────────────────────────────────
const COLS = 3
function Batches({
  batches,
  setBatches,
  claims,
  setClaims,
  toPay,
  setToPay,
  role,
  user,
  setTab,
}: SharedState) {
  const [batchPage, setBatchPage] = useState<BatchType | null>(() => {
    const id = navIntent.batchId
    navIntent.batchId = null
    return id ? batches.find((b) => b.id === id) || null : null
  })
  const [waitlisted, setWaitlisted] = useState<Record<string, boolean>>({})
  const [claimedKeys, setClaimedKeys] = useState<Record<string, boolean>>({})
  const [catFilter, setCatFilter] = useState("All")
  const [dateFilter, setDateFilter] = useState("All")
  const [ratingFilter, setRatingFilter] = useState("All")
  const [showBuyerReqForm, setShowBuyerReqForm] = useState(false)
  const [sellerDir, setSellerDir] = useState(false)
  const [profile, setProfile] = useState<string | null>(() => {
    const n = navIntent.sellerName
    navIntent.sellerName = null
    return n
  })
  const [contact, setContact] = useState<BatchType | null>(null)
  const [claimTarget, setClaimTarget] = useState<{
    p: typeof batches[0]["products"][0]
    key: string
  } | null>(null)
  const [financialBatch, setFinancialBatch] = useState<BatchType | null>(null)
  const [profileClaimTarget, setProfileClaimTarget] = useState<{
    batch: BatchType
    product: BatchType["products"][0]
  } | null>(null)

  // Seller-only state
  type ExtReq = {
    id: number
    buyer: string
    product: string
    batch: string
    requestedAt: string
    status: "pending" | "approved" | "denied"
  }
  type BuyerReq = {
    id: number
    buyer: string
    product: string
    batch: string
    message: string
    requestedAt: string
    replied: boolean
  }
  const [extensionRequests, setExtensionRequests] = useState<ExtReq[]>([
    {
      id: 1,
      buyer: "Carlo Reyes",
      product: "Laneige Lip Mask",
      batch: "Korea Haul",
      requestedAt: "Sep 9, 2026",
      status: "pending",
    },
    {
      id: 2,
      buyer: "Mia Santos",
      product: "SK-II Essence",
      batch: "Singapore Haul",
      requestedAt: "Sep 10, 2026",
      status: "pending",
    },
  ])
  const [buyerRequests, setBuyerRequests] = useState<BuyerReq[]>([
    {
      id: 1,
      buyer: "Trisha Lim",
      product: "Tokyo Banana (more qty?)",
      batch: "Japan Trip",
      message:
        "Hi! Can I order 3 pcs instead of the max of 2? Willing to pay extra shipping.",
      requestedAt: "Sep 8, 2026",
      replied: false,
    },
    {
      id: 2,
      buyer: "Paolo Cruz",
      product: "Custom request",
      batch: "Korea Haul",
      message:
        "Do you accept requests for Etude House products? Planning to order 5 pcs.",
      requestedAt: "Sep 9, 2026",
      replied: false,
    },
  ])

  const filtered = batches.filter((b) => {
    if (catFilter !== "All" && b.category !== catFilter) return false
    if (dateFilter !== "All") {
      const mm: Record<string, string> = {
        "May 2026": "May",
        "Jun 2026": "Jun",
        "Jul 2026": "Jul",
        "Aug 2026": "Aug",
        "Sep 2026": "Sep",
        "Oct 2026": "Oct",
      }
      if (!b.trips.includes(mm[dateFilter] || "")) return false
    }
    if (ratingFilter === "4.8+" && b.rating < 4.8) return false
    if (ratingFilter === "4.5+" && b.rating < 4.5) return false
    return true
  })

  const rows: BatchType[][] = []
  for (let i = 0; i < filtered.length; i += COLS)
    rows.push(filtered.slice(i, i + COLS))

  const handleClaim = (
    key: string,
    batch: BatchType,
    product: typeof batch.products[0],
  ) => {
    setClaimedKeys((c) => ({ ...c, [key]: true }))
    const reserveHrs = batch.reserveHours || 48
    const newClaim: ClaimRow = {
      id: Date.now(),
      product: product.name,
      batch: batch.title.replace("—", "—"),
      seller: batch.seller,
      qty: 1,
      amount: product.price,
      status: "Pending",
      hours: reserveHrs,
    }
    setClaims((prev) => [newClaim, ...prev])
    const alreadyInToPay = toPay.some((t) => t.product === product.name)
    if (!alreadyInToPay) {
      setToPay((prev) => [
        {
          id: Date.now(),
          product: product.name,
          seller: batch.seller,
          amount: product.price,
          hours: reserveHrs,
        },
        ...prev,
      ])
    }
  }

  const handleProfileClaim = (batchId: number) => {
    const batch = batches.find((b) => b.id === batchId)
    const product = batch?.products[0]
    if (!batch || !product) return
    setProfile(null)
    setProfileClaimTarget({ batch, product })
  }

  if (batchPage)
    return (
      <>
        <BatchPage
          batch={batchPage}
          role={role}
          user={user}
          batches={batches}
          claims={claims}
          setClaims={setClaims}
          toPay={toPay}
          setToPay={setToPay}
          onBack={() => setBatchPage(null)}
          onSellerClick={(name) => setProfile(name)}
          setBatches={setBatches}
        />
        {profile && (
          <SellerProfileModal
            seller={profile}
            batches={batches}
            onClose={() => setProfile(null)}
            onClaimFromProfile={handleProfileClaim}
            setTab={setTab}
          />
        )}
        {profileClaimTarget && (
          <ItemClaimModal
            batch={profileClaimTarget.batch}
            product={profileClaimTarget.product}
            onConfirm={() => {
              handleClaim(
                `${profileClaimTarget.batch.id}-${profileClaimTarget.product.name}`,
                profileClaimTarget.batch,
                profileClaimTarget.product,
              )
              setProfileClaimTarget(null)
            }}
            onClose={() => setProfileClaimTarget(null)}
          />
        )}
      </>
    )

  const BatchGrid = ({ batchList }: { batchList: BatchType[] }) => {
    const gridRows: BatchType[][] = []
    for (let i = 0; i < batchList.length; i += COLS)
      gridRows.push(batchList.slice(i, i + COLS))
    return (
      <div className="space-y-0">
        {gridRows.map((row, rowIdx) => {
          return (
            <div key={rowIdx}>
              <div
                className="grid gap-5"
                style={{
                  gridTemplateColumns: "repeat(3,1fr)",
                  marginBottom: 20,
                }}
              >
                {row.map((b, i) => {
                  const pct = Math.round((b.claimed / b.items) * 100)
                  const grad = CAT_GRAD[b.category] || CAT_GRAD["Mixed"]
                  return (
                    <div
                      key={b.id}
                      className="fi"
                      style={{
                        animationDelay: `${(rowIdx * COLS + i) * 40}ms`,
                      }}
                    >
                      <div
                        style={{
                          background: "#fff",
                          border: `1px solid ${
                            b.locked ? "#FCA5A5" : "#E5E7EB"
                          }`,
                          borderRadius: 8,
                          overflow: "hidden",
                          boxShadow: b.locked
                            ? "0 0 0 1px #FCA5A5,0 1px 3px rgba(0,0,0,0.06)"
                            : "0 1px 3px rgba(0,0,0,0.06)",
                          transition: "transform 0.15s,box-shadow 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.transform = "translateY(-2px)"
                          el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)"
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.transform = ""
                          el.style.boxShadow = b.locked
                            ? "0 0 0 1px #FCA5A5,0 1px 3px rgba(0,0,0,0.06)"
                            : "0 1px 3px rgba(0,0,0,0.06)"
                        }}
                      >
                        <div
                          style={{
                            height: 120,
                            background: grad,
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <CategoryIcon category={b.category} size={40} color="rgba(255,255,255,.78)" />
                          {role === "Seller" ? (
                            <button
                              type="button"
                              aria-label={b.locked ? "Unlock batch" : "Lock batch"}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleBatchLock(setBatches, b.id)
                              }}
                              style={{
                                position: "absolute",
                                top: 8,
                                left: 8,
                                background: "rgba(255,255,255,0.92)",
                                border: "none",
                                borderRadius: 6,
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontSize: 15,
                                boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                              }}
                              title={b.locked ? "Unlock batch" : "Lock batch"}
                            >
                              {b.locked ? "Lock" : "Open"}
                            </button>
                          ) : b.locked ? (
                            <span
                              style={{
                                position: "absolute",
                                top: 10,
                                left: 10,
                                background: "#FEE2E2",
                                color: "#991B1B",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 999,
                                letterSpacing: 0.5,
                              }}
                            >
                              <><Lock size={13} aria-hidden="true" /> LOCKED</>
                            </span>
                          ) : (
                            <span
                              style={{
                                position: "absolute",
                                top: 10,
                                left: 10,
                                background: "rgba(255,255,255,0.9)",
                                backdropFilter: "blur(4px)",
                                color: "#374151",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 999,
                                letterSpacing: 0.5,
                              }}
                            >
                              {b.category.toUpperCase()}
                            </span>
                          )}
                          {role === "Seller" && (
                            <span
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                background: "rgba(255,255,255,0.9)",
                                backdropFilter: "blur(4px)",
                                color: "#374151",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 999,
                                letterSpacing: 0.5,
                              }}
                            >
                              {b.category.toUpperCase()}
                            </span>
                          )}
                          {role === "Buyer" && (
                            <span
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                background: "rgba(0,0,0,0.45)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "3px 8px",
                                borderRadius: 999,
                              }}
                            >
                               {b.rating}
                            </span>
                          )}
                          {pct >= 90 && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: 8,
                                right: 8,
                                background: CORAL,
                                color: "#fff",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              ALMOST FULL
                            </span>
                          )}
                          {rowIdx === 0 && i < COLS && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: 8,
                                left: 8,
                                background: AMBER,
                                color: "#7A4800",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              TRENDING ✦
                            </span>
                          )}
                        </div>
                        <div style={{ padding: "14px 16px" }}>
                          <h3
                            style={{
                              fontFamily: "'Plus Jakarta Sans',sans-serif",
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: "#111827",
                              marginBottom: 6,
                            }}
                          >
                            {b.title}
                          </h3>
                          <div className="flex items-center gap-1.5 mb-3">
                            <Avatar name={b.seller} size={18} />
                            <span style={{ fontSize: 11.5, color: "#6B7280" }}>
                              {b.seller}
                            </span>
                            <span style={{ fontSize: 11, color: "#D1D5DB" }}>
                              ·
                            </span>
                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                              {b.trips}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span style={{ fontSize: 11, color: "#6B7280" }}>
                              {b.claimed}/{b.items} claimed
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color:
                                  pct > 85
                                    ? "#EF4444"
                                    : pct > 60
                                      ? AMBER
                                      : "#6B7280",
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div
                            style={{
                              background: "#F3F4F6",
                              borderRadius: 999,
                              height: 4,
                              overflow: "hidden",
                              marginBottom: 12,
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background:
                                  pct > 85
                                    ? "#EF4444"
                                    : pct > 60
                                      ? AMBER
                                      : INDIGO,
                                borderRadius: 999,
                                transition:
                                  "width 0.6s cubic-bezier(.22,1,.36,1)",
                              }}
                            />
                          </div>
                          {role === "Buyer" && b.locked ? (
                            <div
                              style={{
                                background: "#FEE2E2",
                                color: "#991B1B",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "7px 12px",
                                borderRadius: 6,
                                textAlign: "center",
                              }}
                            >
                              <><Lock size={14} aria-hidden="true" /> Not Accepting Orders</>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 6 }}>
                              <PrimaryBtn
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  justifyContent: "center",
                                }}
                                onClick={() => setBatchPage(b)}
                                size="sm"
                              >
                                View Items →
                              </PrimaryBtn>
                              {role === "Seller" && (
                                <SecondaryBtn
                                  size="sm"
                                  ariaLabel="View batch financial summary"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setFinancialBatch(b)
                                  }}
                                >
                                  <BarChart3 size={15} aria-hidden="true" />
                                </SecondaryBtn>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {row.length < COLS &&
                  Array.from({ length: COLS - row.length }).map((_, i) => (
                    <div key={`ph-${i}`} />
                  ))}
              </div>
            </div>
          )
        })}
        {batchList.length === 0 && (
          <div
            style={{
              padding: "60px 0",
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: 13,
            }}
          >
            No batches match your filters.
          </div>
        )}
      </div>
    )
  }

  const FilterBar = () => (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: "12px 16px",
      }}
      className="flex items-center gap-3 mb-6"
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
        Filter:
      </span>
      <select
        value={catFilter}
        onChange={(e) => {
          setCatFilter(e.target.value)
        }}
        style={{
          fontSize: 12,
          color: "#374151",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "5px 8px",
          background: "#fff",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {[
          "All",
          "Food & Beauty",
          "Skincare",
          "Grocery & Snacks",
          "Beauty",
          "Luxury",
          "Mixed",
        ].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <select
        value={dateFilter}
        onChange={(e) => {
          setDateFilter(e.target.value)
        }}
        style={{
          fontSize: 12,
          color: "#374151",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "5px 8px",
          background: "#fff",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {[
          "All",
          "May 2026",
          "Jun 2026",
          "Jul 2026",
          "Aug 2026",
          "Sep 2026",
          "Oct 2026",
        ].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <select
        value={ratingFilter}
        onChange={(e) => setRatingFilter(e.target.value)}
        style={{
          fontSize: 12,
          color: "#374151",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "5px 8px",
          background: "#fff",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {["All", "4.5+", "4.8+"].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <div className="flex-1" />
      {role === "Buyer" && (
        <SecondaryBtn onClick={() => setSellerDir(true)}>
          🔍 Browse Sellers
        </SecondaryBtn>
      )}
      {role === "Buyer" && (
        <SecondaryBtn onClick={() => setShowBuyerReqForm(true)}>
          📝 Request Item
        </SecondaryBtn>
      )}
      <span style={{ fontSize: 12, color: "#9CA3AF" }}>
        {filtered.length} batch{filtered.length !== 1 ? "es" : ""} found
      </span>
    </div>
  )

  // Full-page seller directory
  if (sellerDir) {
    return (
      <SellerDirectoryPage
        batches={batches}
        onBack={() => setSellerDir(false)}
        onClaimFromProfile={handleProfileClaim}
        onSellerSelect={(name) => {
          setProfile(name)
        }}
      />
    )
  }

  if (role === "Seller") {
    const myBatches = batches.filter((b) => b.seller === user.name)
    const myFiltered = myBatches.filter((b) => {
      if (catFilter !== "All" && b.category !== catFilter) return false
      if (dateFilter !== "All") {
        const mm: Record<string, string> = {
          "May 2026": "May",
          "Jun 2026": "Jun",
          "Jul 2026": "Jul",
          "Aug 2026": "Aug",
          "Sep 2026": "Sep",
          "Oct 2026": "Oct",
        }
        if (!b.trips.includes(mm[dateFilter] || "")) return false
      }
      if (ratingFilter === "4.8+" && b.rating < 4.8) return false
      if (ratingFilter === "4.5+" && b.rating < 4.5) return false
      return true
    })
    return (
      <div className="p-6">
        <h2
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          My Batches
        </h2>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
          Manage your pasabuy batches. Toggle lock to pause new orders.
        </p>
        <FilterBar />
        {myBatches.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "32px 24px" }}>
            <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 12 }}>
              You haven't created any batches yet. Click '+ New Batch' to get
              started.
            </div>
          </Card>
        ) : (
          <BatchGrid batchList={myFiltered} />
        )}
        {/* Seller panels */}
        <div className="mt-6" style={{ overflowX: "auto" }}>
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "1fr 1fr", minWidth: 560 }}
          >
            {/* Extension Approval Panel */}
            <Card>
              <SH title="Extension Requests" />
            {extensionRequests.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "16px 0",
                }}
              >
                No pending extension requests.
              </div>
            ) : (
              <div className="space-y-3">
                {extensionRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      padding: "12px 14px",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#111827",
                          }}
                        >
                          {req.buyer}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9CA3AF",
                            marginTop: 2,
                          }}
                        >
                          {req.product} · {req.batch}
                        </div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                          Requested {req.requestedAt}
                        </div>
                      </div>
                      {req.status === "pending" ? (
                        <div className="flex gap-2">
                          <PrimaryBtn
                            size="sm"
                            onClick={() =>
                              setExtensionRequests((p) =>
                                p.map((r) =>
                                  r.id === req.id
                                    ? { ...r, status: "approved" as const }
                                    : r,
                                ),
                              )
                            }
                          >
                            Approve
                          </PrimaryBtn>
                          <button
                            onClick={() =>
                              setExtensionRequests((p) =>
                                p.map((r) =>
                                  r.id === req.id
                                    ? { ...r, status: "denied" as const }
                                    : r,
                                ),
                              )
                            }
                            style={{
                              fontSize: 12,
                              color: "#EF4444",
                              fontWeight: 600,
                              background: "none",
                              border: "1px solid #EF4444",
                              borderRadius: 6,
                              padding: "4px 10px",
                              cursor: "pointer",
                            }}
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            background:
                              req.status === "approved" ? "#D4F5EA" : "#FEE2E2",
                            color:
                              req.status === "approved" ? "#0B7A59" : "#991B1B",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 999,
                          }}
                        >
                          {req.status === "approved" ? "Approved" : "Denied"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {/* Buyer Requests Inbox */}
          <Card>
            <SH title="Buyer Requests" />
            {buyerRequests.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "16px 0",
                }}
              >
                No buyer requests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {buyerRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      padding: "12px 14px",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar name={req.buyer} size={20} />
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {req.buyer}
                          </span>
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                            · {req.batch}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#374151",
                            lineHeight: 1.5,
                          }}
                        >
                          <strong>{req.product}</strong>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            marginTop: 3,
                            lineHeight: 1.5,
                          }}
                        >
                          {req.message}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9CA3AF",
                            marginTop: 4,
                          }}
                        >
                          {req.requestedAt}
                        </div>
                      </div>
                      {req.replied ? (
                        <span
                          style={{
                            background: "#D4F5EA",
                            color: "#0B7A59",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 999,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Replied
                        </span>
                      ) : (
                        <SecondaryBtn
                          onClick={() => {
                            const fbUrl = `https://facebook.com/${req.buyer.toLowerCase().replace(" ", ".")}`
                            window.open(fbUrl, "_blank", "noopener,noreferrer")
                            setBuyerRequests((p) =>
                              p.map((r) =>
                                r.id === req.id ? { ...r, replied: true } : r,
                              ),
                            )
                          }}
                        >
                          Reply on FB →
                        </SecondaryBtn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          </div>
        </div>
        {showBuyerReqForm && (
          <BuyerRequestFormModal
            batches={batches}
            onClose={() => setShowBuyerReqForm(false)}
          />
        )}
        {profile && (
          <SellerProfileModal
            seller={profile}
            batches={batches}
            onClose={() => setProfile(null)}
            onClaimFromProfile={handleProfileClaim}
            setTab={setTab}
          />
        )}
        {profileClaimTarget && (
          <ItemClaimModal
            batch={profileClaimTarget.batch}
            product={profileClaimTarget.product}
            onConfirm={() => {
              handleClaim(
                `${profileClaimTarget.batch.id}-${profileClaimTarget.product.name}`,
                profileClaimTarget.batch,
                profileClaimTarget.product,
              )
              setProfileClaimTarget(null)
            }}
            onClose={() => setProfileClaimTarget(null)}
          />
        )}
        {financialBatch && (
          <FinancialSummaryModal
            batch={financialBatch}
            onClose={() => setFinancialBatch(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-6">
      <FilterBar />
      <BatchGrid batchList={filtered} />
      {showBuyerReqForm && (
        <BuyerRequestFormModal
          batches={batches}
          onClose={() => setShowBuyerReqForm(false)}
        />
      )}
      {profile && (
        <SellerProfileModal
          seller={profile}
          batches={batches}
          onClose={() => setProfile(null)}
          onClaimFromProfile={handleProfileClaim}
          setTab={setTab}
        />
      )}
      {profileClaimTarget && (
        <ItemClaimModal
          batch={profileClaimTarget.batch}
          product={profileClaimTarget.product}
          onConfirm={() => {
            handleClaim(
              `${profileClaimTarget.batch.id}-${profileClaimTarget.product.name}`,
              profileClaimTarget.batch,
              profileClaimTarget.product,
            )
            setProfileClaimTarget(null)
          }}
          onClose={() => setProfileClaimTarget(null)}
        />
      )}
      {financialBatch && (
        <FinancialSummaryModal
          batch={financialBatch}
          onClose={() => setFinancialBatch(null)}
        />
      )}
    </div>
  )
}

// ─── My Claims ────────────────────────────────────────────────────────────────
function MyClaims({
  claims,
  setClaims,
  toPay,
  setToPay,
  payHistory,
  setPayHistory,
  orders,
  setOrders,
  role,
}: SharedState) {
  const [filter, setFilter] = useState<ClaimStatus | "All">("All")
  const [payTarget, setPayTarget] = useState<ClaimRow | null>(null)
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null)
  const [extTarget, setExtTarget] = useState<ClaimRow | null>(null)
  const [contact, setContact] = useState<ClaimRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ClaimRow | null>(null)
  const [orderFilter, setOrderFilter] = useState<ClaimStatus | "All">("All")
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  const filters: (ClaimStatus | "All")[] = [
    "All",
    "Pending",
    "Paid and Reserved",
    "Expired",
    "Cancelled",
  ]
  const filtered =
    filter === "All" ? claims : claims.filter((c) => c.status === filter)

  const [fbToast, setFbToast] = useState<string | null>(null)

  if (role === "Seller") {
    const ordFiltered =
      orderFilter === "All"
        ? claims
        : claims.filter((c) => c.status === orderFilter)
    const [buyerProfile, setBuyerProfile] = useState<string | null>(null)
    return (
      <div className="p-6">
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
            <span>📘</span> Opening {fbToast}'s Facebook profile…
          </div>
        )}
        <h2
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          Orders Received
        </h2>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 16 }}>
          Manage orders from your buyers.
        </p>
        <div className="flex items-center gap-2 mb-5">
          {([
            "All",
            "Pending",
            "Paid and Reserved",
            "Expired",
          ] as (ClaimStatus | "All")[]).map((f) => (
            <button
              key={f}
              onClick={() => setOrderFilter(f)}
              style={{
                background: orderFilter === f ? INDIGO : "#fff",
                color: orderFilter === f ? "#fff" : "#6B7280",
                border: `1px solid ${orderFilter === f ? INDIGO : "#E5E7EB"}`,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 14px",
                transition: "all 0.15s",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                cursor: "pointer",
              }}
            >
              {f}
              {f !== "All" && (
                <span
                  style={{
                    marginLeft: 6,
                    background:
                      orderFilter === f ? "rgba(255,255,255,0.25)" : "#F3F4F6",
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
        </div>
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: CREAM }}>
              <tr>
                {[
                  "Buyer",
                  "Product",
                  "Batch",
                  "Qty",
                  "Amount",
                  "Status",
                  "Deadline",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      color: "#9CA3AF",
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
              {ordFiltered.map((c, i) => (
                <tr
                  key={c.id}
                  style={{
                    borderTop: "1px solid #F3F4F6",
                    background: i % 2 ? "#FAFAFA" : "#fff",
                  }}
                >
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={c.seller} size={22} />
                      <button
                        onClick={() => setBuyerProfile(c.seller)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: INDIGO,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        {c.seller}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-2">
                      <ProductThumb name={c.product} />
                      <span style={{ color: "#374151" }}>{c.product}</span>
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
                  <td style={{ padding: "10px 14px", color: "#374151" }}>
                    ×{c.qty}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    ₱{c.amount.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {c.status === "Pending" && c.hours > 0 ? (
                      <Countdown hours={c.hours} />
                    ) : (
                      <span style={{ color: "#D1D5DB" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-1.5">
                      {c.status === "Pending" && (
                        <PrimaryBtn
                          size="sm"
                          onClick={() =>
                            setClaims((prev) =>
                              prev.map((cl) =>
                                cl.id === c.id
                                  ? {
                                      ...cl,
                                      status:
                                        "Paid and Reserved" as ClaimStatus,
                                    }
                                  : cl,
                              ),
                            )
                          }
                        >
                          Mark Shipped
                        </PrimaryBtn>
                      )}
                      <SecondaryBtn
                        size="sm"
                        onClick={() => {
                          const fbUrl = `https://facebook.com/${c.seller.toLowerCase().replace(" ", ".")}`
                          setFbToast(c.seller)
                          setTimeout(() => {
                            window.open(fbUrl, "_blank", "noopener,noreferrer")
                            setFbToast(null)
                          }, 1200)
                        }}
                      >
                        Contact Buyer
                      </SecondaryBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {ordFiltered.length === 0 && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              No orders found.
            </div>
          )}
        </Card>
        {buyerProfile && (
          <BuyerProfileModal
            buyer={buyerProfile}
            onClose={() => setBuyerProfile(null)}
          />
        )}
      </div>
    )
  }

  const handlePay = (method: string) => {
    if (!payTarget) return
    const newHist: PayHistRow = {
      id: payHistory.length + 1,
      product: payTarget.product,
      batch: payTarget.batch,
      method,
      amount: payTarget.amount,
      date: TODAY,
      status: "Paid and Reserved",
    }
    setPayHistory((h) => [newHist, ...h])
    setClaims((prev) =>
      prev.map((c) =>
        c.id === payTarget.id
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    setToPay((prev) => prev.filter((t) => t.product !== payTarget.product))
    const newOrder: OrderRow = {
      id: `ORD-2026-${String(orders.length + 60).padStart(4, "0")}`,
      product: payTarget.product,
      batch: payTarget.batch,
      seller: payTarget.seller,
      amount: payTarget.amount,
      step: 3,
      trackingNo: null,
      eta: "Est. Oct 2026",
      rated: false,
    }
    setOrders((prev) => [newOrder, ...prev])
    setPayTarget(null)
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5 flex-wrap">
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
              fontFamily: "'Plus Jakarta Sans',sans-serif",
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
              {m === "table" ? "☰ Table" : "⊞ Cards"}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "card" ? (
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
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(2,1fr)" }}
          >
            {filtered.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start gap-3">
                  <ProductThumb name={c.product} />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      {c.product}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}
                    >
                      {c.batch}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}
                    >
                      Seller: {c.seller}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
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
                    <Countdown hours={c.hours} />
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
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    ₱{c.amount.toLocaleString()}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {c.status === "Pending" && (
                      <PrimaryBtn size="sm" onClick={() => setPayTarget(c)}>
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
                    {(c.status === "Pending" ||
                      c.status === "Paid and Reserved") && (
                      <SecondaryBtn
                        size="sm"
                        onClick={() => setCancelTarget(c)}
                        style={{
                          color: "#EF4444",
                          borderColor: "#FECACA",
                          background: "#FEF2F2",
                        }}
                      >
                        Cancel
                      </SecondaryBtn>
                    )}
                    {c.status === "Paid and Reserved" && (
                      <SecondaryBtn
                        size="sm"
                        onClick={() => {
                          const o = orders.find(
                            (o) => o.product === c.product,
                          ) || {
                            id: `ORD-${c.id}`,
                            product: c.product,
                            batch: c.batch,
                            seller: c.seller,
                            amount: c.amount,
                            step: 3,
                            trackingNo: null,
                            eta: "Est. Oct 2026",
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
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: CREAM }}>
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
                      color: "#9CA3AF",
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
                  style={{
                    borderTop: "1px solid #F3F4F6",
                    background: i % 2 ? "#FAFAFA" : "#fff",
                  }}
                  className="hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-2.5">
                      <ProductThumb name={c.product} />
                      <span style={{ fontWeight: 500, color: "#111827" }}>
                        {c.product}
                      </span>
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
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    ₱{c.amount.toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {c.status === "Pending" && c.hours > 0 ? (
                      <Countdown hours={c.hours} />
                    ) : (
                      <span style={{ color: "#D1D5DB" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {c.status === "Pending" && (
                        <PrimaryBtn size="sm" onClick={() => setPayTarget(c)}>
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
                            const o = orders.find(
                              (o) => o.product === c.product,
                            ) || {
                              id: `ORD-${c.id}`,
                              product: c.product,
                              batch: c.batch,
                              seller: c.seller,
                              amount: c.amount,
                              step: 3,
                              trackingNo: null,
                              eta: "Est. Oct 2026",
                              rated: false,
                            }
                            setViewOrder(o)
                          }}
                        >
                          View Order
                        </SecondaryBtn>
                      )}
                      {(c.status === "Pending" ||
                        c.status === "Paid and Reserved") && (
                        <SecondaryBtn
                          size="sm"
                          onClick={() => setCancelTarget(c)}
                          style={{
                            color: "#EF4444",
                            borderColor: "#FECACA",
                            background: "#FEF2F2",
                          }}
                        >
                          Cancel
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
      {payTarget && (
        <PayModal
          items={[{ product: payTarget.product, amount: payTarget.amount }]}
          onConfirm={handlePay}
          onClose={() => setPayTarget(null)}
        />
      )}
      {viewOrder && (
        <TrackOrderModal order={viewOrder} onClose={() => setViewOrder(null)} />
      )}
      {extTarget && (
        <ExtensionRequestModal
          claim={extTarget}
          onSubmit={() => {
            setClaims((prev) =>
              prev.map((c) =>
                c.id === extTarget.id ? { ...c, extensionRequested: true } : c,
              ),
            )
            setExtTarget(null)
          }}
          onClose={() => setExtTarget(null)}
        />
      )}
      {cancelTarget && (
        <Modal
          title="Cancel this claim?"
          onClose={() => setCancelTarget(null)}
          width={420}
        >
          <div className="space-y-4">
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
              You are about to cancel your claim for{" "}
              <strong>{cancelTarget.product}</strong>.
              {cancelTarget.status === "Paid and Reserved" && (
                <div
                  style={{
                    marginTop: 8,
                    background: "#FFF7ED",
                    border: "1px solid #FCD34D",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "#92400E",
                  }}
                >
                  ⚠️ This item has already been paid. A refund will be processed
                  to the phone number and payment method on file within 3–5
                  business days.
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <SecondaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setCancelTarget(null)}
              >
                Keep Claim
              </SecondaryBtn>
              <button
                onClick={() => {
                  setClaims((prev) =>
                    prev.map((c) =>
                      c.id === cancelTarget.id
                        ? { ...c, status: "Cancelled" as ClaimStatus }
                        : c,
                    ),
                  )
                  setCancelTarget(null)
                }}
                style={{
                  flex: 1,
                  background: "#EF4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function Payments({
  toPay,
  setToPay,
  payHistory,
  setPayHistory,
  claims,
  setClaims,
  orders,
  setOrders,
  role,
}: SharedState) {
  type VerifyItem = {
    id: number
    buyer: string
    product: string
    amount: number
    ref: string
    date: string
    status: "Pending" | "Verified" | "Rejected"
    method: string
    acctName: string
    acctNum: string
    receipt: string
    rejectReason?: string
    phone?: string
    amountPaid?: string
  }
  const VERIFY_SEED: VerifyItem[] = [
    {
      id: 1,
      buyer: "Anna Cruz",
      product: "Laneige Lip Mask",
      amount: 950,
      ref: "GC-20260910-3821",
      date: "Sep 10, 2026",
      status: "Pending",
      method: "GCash",
      acctName: "Anna C. Cruz",
      acctNum: "0917-823-4410",
      receipt: "receipt_gcash.jpg",
      phone: "0917-823-4410",
      amountPaid: "750",
    },
    {
      id: 2,
      buyer: "Ben Santos",
      product: "SK-II Essence",
      amount: 4800,
      ref: "MAYA-2026-9942",
      date: "Sep 9, 2026",
      status: "Pending",
      method: "Maya",
      acctName: "Benedicto Santos",
      acctNum: "0918-554-2291",
      receipt: "maya_proof.png",
      phone: "0918-554-2291",
      amountPaid: "4800",
    },
    {
      id: 3,
      buyer: "Carla Reyes",
      product: "Tokyo Banana",
      amount: 480,
      ref: "BDO-TXN-1188",
      date: "Sep 8, 2026",
      status: "Verified",
      method: "Bank Transfer",
      acctName: "Carla M. Reyes",
      acctNum: "BDO-0044-2109",
      receipt: "bdo_receipt.pdf",
      phone: "0916-001-2109",
      amountPaid: "480",
    },
  ]
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>(VERIFY_SEED)
  const [reviewTarget, setReviewTarget] = useState<VerifyItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<VerifyItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectCustom, setRejectCustom] = useState("")
  const [insuffTarget, setInsuffTarget] = useState<VerifyItem | null>(null)
  const [insuffAmtPaid, setInsuffAmtPaid] = useState("")

  const [dragging, setDragging] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [payTarget, setPayTarget] = useState<ToPayRow | null>(null)
  const [payAll, setPayAll] = useState(false)
  const [histFilter, setHistFilter] =
    useState<"All" | "Paid and Reserved" | "Pending" | "Rejected">("All")
  const [dateFilter2, setDateFilter2] = useState("All")
  const [txDetail, setTxDetail] = useState<PayHistRow | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFilePick = (file: File) => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(file.name)
    }, 1200)
  }

  const handlePay = (item: ToPayRow | null, method: string) => {
    const targets = item ? [item] : toPay
    const newHist: PayHistRow[] = targets.map((t, i) => ({
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
        targets.some((t) => t.product === c.product) && c.status === "Pending"
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    const newOrders: OrderRow[] = targets.map((t, i) => ({
      id: `ORD-2026-${String(orders.length + 60 + i).padStart(4, "0")}`,
      product: t.product,
      batch: "",
      seller: t.seller,
      amount: t.amount,
      step: 3,
      trackingNo: null,
      eta: "Est. Oct 2026",
      rated: false,
    }))
    setOrders((prev) => [...newOrders, ...prev])
    setToPay((prev) => (item ? prev.filter((x) => x.id !== item.id) : []))
    setPayTarget(null)
    setPayAll(false)
  }

  const REJECT_REASONS = [
    "Wrong amount transferred",
    "Invalid proof of payment",
    "Payment method mismatch",
    "Duplicate submission",
    "Other",
  ]
  const methodIcon: Record<string, string> = {
    GCash: "",
    Maya: "",
    "Bank Transfer": "",
    "Cash on Meetup": "",
  }

  if (role === "Seller") {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Payment Verification
            </h2>
            <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>
              Review buyer submissions and confirm or reject each payment.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Pending", "Verified", "Rejected"] as const).map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 999,
                  background:
                    s === "Pending"
                      ? "#FEF3C7"
                      : s === "Verified"
                        ? "#D4F5EA"
                        : "#FEE2E2",
                  color:
                    s === "Pending"
                      ? "#92400E"
                      : s === "Verified"
                        ? "#0B7A59"
                        : "#991B1B",
                }}
              >
                {verifyItems.filter((v) => v.status === s).length} {s}
              </span>
            ))}
          </div>
        </div>
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: CREAM }}>
              <tr>
                {[
                  "Buyer",
                  "Product",
                  "Method",
                  "Amount",
                  "Amount Paid",
                  "Submitted",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      color: "#9CA3AF",
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
              {verifyItems.map((item, i) => {
                const paidNum =
                  item.amountPaid != null ? Number(item.amountPaid) : null
                const isShort = paidNum != null && paidNum < item.amount
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderTop: "1px solid #F3F4F6",
                      background: i % 2 ? "#FAFAFA" : "#fff",
                    }}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div className="flex items-center gap-2">
                        <Avatar name={item.buyer} size={22} />
                        <span style={{ fontWeight: 500, color: "#111827" }}>
                          {item.buyer}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div className="flex items-center gap-2">
                        <ProductThumb name={item.product} />
                        <span style={{ color: "#374151" }}>{item.product}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {methodIcon[item.method] || "💳"} {item.method}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{item.amount.toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {paidNum != null ? (
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: isShort ? "#D97706" : "#111827",
                            }}
                          >
                            ₱{paidNum.toLocaleString()}
                          </div>
                          {isShort && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#92400E",
                                background: "#FFF7ED",
                                borderRadius: 999,
                                padding: "1px 7px",
                                marginTop: 2,
                                display: "inline-block",
                              }}
                            >
                              Short ₱{(item.amount - paidNum).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        color: "#9CA3AF",
                        fontSize: 12,
                      }}
                    >
                      {item.date}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {item.status === "Pending" && (
                        <div>
                          <span
                            style={{
                              background: "#FEF3C7",
                              color: "#92400E",
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 999,
                            }}
                          >
                            Pending
                          </span>
                          {isShort && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#92400E",
                                fontWeight: 600,
                                marginTop: 3,
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <span
                                style={{
                                  background: "#FCD34D",
                                  borderRadius: 999,
                                  width: 5,
                                  height: 5,
                                  display: "inline-block",
                                }}
                              />
                              Awaiting balance
                            </div>
                          )}
                        </div>
                      )}
                      {item.status === "Verified" && (
                        <span
                          style={{
                            background: "#D4F5EA",
                            color: "#0B7A59",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 999,
                          }}
                        >
                          Verified
                        </span>
                      )}
                      {item.status === "Rejected" && (
                        <div>
                          <span
                            style={{
                              background: "#FEE2E2",
                              color: "#991B1B",
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 999,
                            }}
                          >
                            Rejected
                          </span>
                          {item.rejectReason && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#9CA3AF",
                                marginTop: 3,
                                maxWidth: 160,
                              }}
                            >
                              {item.rejectReason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {(() => {
                        const btnBase: React.CSSProperties = {
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "5px 12px",
                          borderRadius: 6,
                          border: "1px solid",
                          cursor: "pointer",
                          whiteSpace: "nowrap" as const,
                        }
                        return (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => setReviewTarget(item)}
                              style={{
                                ...btnBase,
                                background: "#fff",
                                color: "#374151",
                                borderColor: "#E5E7EB",
                              }}
                            >
                              Review
                            </button>
                            {item.status === "Pending" && isShort ? (
                              <>
                                {item.rejectReason?.includes(
                                  "buyer notified",
                                ) ? (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "#0B7A59",
                                      background: "#D4F5EA",
                                      border: "1px solid #6EE7B7",
                                      borderRadius: 6,
                                      padding: "5px 12px",
                                      whiteSpace: "nowrap" as const,
                                    }}
                                  >
                                    ✓ Notified
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setInsuffTarget(item)
                                      setInsuffAmtPaid(item.amountPaid || "")
                                    }}
                                    style={{
                                      ...btnBase,
                                      background: "#FEF3C7",
                                      color: "#92400E",
                                      borderColor: "#FCD34D",
                                    }}
                                  >
                                    📢 Notify Buyer
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    setVerifyItems((p) =>
                                      p.map((v) =>
                                        v.id === item.id
                                          ? {
                                              ...v,
                                              status: "Verified" as const,
                                            }
                                          : v,
                                      ),
                                    )
                                  }
                                  style={{
                                    ...btnBase,
                                    background: INDIGO,
                                    color: "#fff",
                                    borderColor: INDIGO,
                                  }}
                                >
                                  Mark Paid
                                </button>
                              </>
                            ) : (
                              item.status === "Pending" && (
                                <>
                                  <button
                                    onClick={() =>
                                      setVerifyItems((p) =>
                                        p.map((v) =>
                                          v.id === item.id
                                            ? {
                                                ...v,
                                                status: "Verified" as const,
                                              }
                                            : v,
                                        ),
                                      )
                                    }
                                    style={{
                                      ...btnBase,
                                      background: INDIGO,
                                      color: "#fff",
                                      borderColor: INDIGO,
                                    }}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectTarget(item)
                                      setRejectReason("")
                                      setRejectCustom("")
                                    }}
                                    style={{
                                      ...btnBase,
                                      background: "#fff",
                                      color: "#EF4444",
                                      borderColor: "#EF4444",
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </Card>

        {/* Review submission modal */}
        {reviewTarget && (
          <Modal
            title="Payment Submission Details"
            onClose={() => setReviewTarget(null)}
            width={520}
          >
            <div className="space-y-4">
              {/* Buyer + product header */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  background: CREAM,
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <Avatar name={reviewTarget.buyer} size={40} />
                <div className="flex-1">
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    {reviewTarget.buyer}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
                    {reviewTarget.product}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: INDIGO,
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  ₱{reviewTarget.amount.toLocaleString()}
                </div>
              </div>

              {/* Submitted details grid */}
              <div
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: CREAM,
                    padding: "8px 14px",
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#374151",
                      letterSpacing: 0.6,
                    }}
                  >
                    BUYER SUBMISSION
                  </span>
                </div>
                {([
                  [
                    "Payment Method",
                    `${methodIcon[reviewTarget.method] || "💳"} ${reviewTarget.method}`,
                  ],
                  ["Reference ID", reviewTarget.ref],
                  ["Account Name", reviewTarget.acctName],
                  ["Account Number", reviewTarget.acctNum],
                  ["Date Submitted", reviewTarget.date],
                  ["Phone Number", reviewTarget.phone || "—"],
                  [
                    "Amount Paid",
                    reviewTarget.amountPaid
                      ? `₱${Number(reviewTarget.amountPaid).toLocaleString()}`
                      : "—",
                  ],
                ] as [string, string][]).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        fontWeight: 500,
                      }}
                    >
                      {k}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily:
                          k === "Reference ID" ? "monospace" : "inherit",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
                {/* Receipt row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                  }}
                >
                  <span
                    style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}
                  >
                    Receipt File
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{ fontSize: 12, fontWeight: 600, color: INDIGO }}
                    >
                      📎 {reviewTarget.receipt}
                    </span>
                    <button
                      style={{
                        fontSize: 11,
                        color: "#fff",
                        background: INDIGO,
                        border: "none",
                        borderRadius: 6,
                        padding: "3px 10px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>

              {/* Seller's own records reminder */}
              <div
                style={{
                  background: "#EEF0FF",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#374151",
                }}
              >
                <strong>Your account:</strong>{" "}
                {reviewTarget.method === "Bank Transfer"
                  ? "BDO •••• 4421"
                  : reviewTarget.method === "GCash"
                    ? "0917 •••• 8821"
                    : reviewTarget.method === "Maya"
                      ? "0917 •••• 5543"
                      : "—"}{" "}
                — check that the reference ID and amount match what you
                received.
              </div>

              {(() => {
                const btnBase: React.CSSProperties = {
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "1px solid",
                  cursor: "pointer",
                  whiteSpace: "nowrap" as const,
                }
                return (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setReviewTarget(null)}
                      style={{
                        ...btnBase,
                        flex: 1,
                        justifyContent: "center",
                        display: "flex",
                        background: "#fff",
                        color: "#374151",
                        borderColor: "#E5E7EB",
                      }}
                    >
                      Close
                    </button>
                    {reviewTarget.status === "Pending" && (
                      <>
                        <button
                          onClick={() => {
                            setVerifyItems((p) =>
                              p.map((v) =>
                                v.id === reviewTarget.id
                                  ? { ...v, status: "Verified" as const }
                                  : v,
                              ),
                            )
                            setReviewTarget(null)
                          }}
                          style={{
                            ...btnBase,
                            flex: 1,
                            justifyContent: "center",
                            display: "flex",
                            background: INDIGO,
                            color: "#fff",
                            borderColor: INDIGO,
                          }}
                        >
                          ✓ Confirm Payment
                        </button>
                        <button
                          onClick={() => {
                            setRejectTarget(reviewTarget)
                            setReviewTarget(null)
                            setRejectReason("")
                            setRejectCustom("")
                          }}
                          style={{
                            ...btnBase,
                            flex: 1,
                            justifyContent: "center",
                            display: "flex",
                            background: "#fff",
                            color: "#EF4444",
                            borderColor: "#EF4444",
                          }}
                        >
                          ✕ Reject
                        </button>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
          </Modal>
        )}

        {/* Insufficient Payment modal */}
        {insuffTarget &&
          (() => {
            const paidAmt = Number(insuffAmtPaid) || 0
            const shortAmt = insuffTarget.amount - paidAmt
            const isValid = paidAmt > 0 && shortAmt > 0
            return (
              <Modal
                title="Mark as Insufficient Payment"
                onClose={() => setInsuffTarget(null)}
                width={460}
              >
                <div className="space-y-4">
                  <div
                    style={{
                      background: "#FFF7ED",
                      border: "1px solid #FCD34D",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 12,
                      color: "#92400E",
                    }}
                  >
                    The buyer submitted payment for{" "}
                    <strong>{insuffTarget.product}</strong> but the amount may
                    be short of ₱{insuffTarget.amount.toLocaleString()}.
                  </div>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: "1fr 1fr" }}
                  >
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
                        Amount Due
                      </label>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#111827",
                          padding: "9px 12px",
                          background: "#F9FAFB",
                          borderRadius: 7,
                          border: "1px solid #E5E7EB",
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                        }}
                      >
                        ₱{insuffTarget.amount.toLocaleString()}
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
                        Amount Actually Paid{" "}
                        <span style={{ color: "#E11D2E" }}>*</span>
                      </label>
                      <input
                        type="number"
                        value={insuffAmtPaid}
                        onChange={(e) => setInsuffAmtPaid(e.target.value)}
                        placeholder="e.g. 750"
                        style={{
                          width: "100%",
                          fontSize: 13,
                          border: `1.5px solid ${
                            insuffAmtPaid && !isValid ? "#EF4444" : "#E5E7EB"
                          }`,
                          borderRadius: 7,
                          padding: "9px 12px",
                          outline: "none",
                          color: "#374151",
                          fontFamily: "inherit",
                          boxSizing: "border-box" as const,
                        }}
                      />
                    </div>
                  </div>
                  {paidAmt > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: shortAmt > 0 ? "#FEF9C3" : "#D4F5EA",
                        border: `1px solid ${
                          shortAmt > 0 ? "#FCD34D" : "#6EE7B7"
                        }`,
                        borderRadius: 8,
                        padding: "10px 14px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: shortAmt > 0 ? "#92400E" : "#065F46",
                        }}
                      >
                        {shortAmt > 0
                          ? "Amount Short"
                          : "No shortfall detected"}
                      </span>
                      {shortAmt > 0 && (
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#92400E",
                            fontFamily: "'Plus Jakarta Sans',sans-serif",
                          }}
                        >
                          ₱{shortAmt.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  {isValid && (
                    <div
                      style={{
                        background: CYAN_L,
                        border: `1px solid ${SKY}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "#0369A1",
                      }}
                    >
                      <Phone
                        size={13}
                        aria-hidden="true"
                        style={{
                          display: "inline",
                          verticalAlign: -2,
                          marginRight: 5,
                        }}
                      />
                      The buyer will be notified: "Your payment for{" "}
                      <strong>{insuffTarget.product}</strong> is short by ₱
                      {shortAmt.toLocaleString()}. Please send the remaining
                      balance to avoid your reservation expiring."
                    </div>
                  )}
                  <div className="flex gap-3">
                    <SecondaryBtn
                      style={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "center",
                      }}
                      onClick={() => setInsuffTarget(null)}
                    >
                      Cancel
                    </SecondaryBtn>
                    <button
                      disabled={!isValid}
                      onClick={() => {
                        setVerifyItems((p) =>
                          p.map((v) =>
                            v.id === insuffTarget.id
                              ? {
                                  ...v,
                                  status: "Pending" as const,
                                  amountPaid: String(paidAmt),
                                  rejectReason: `Short ₱${shortAmt.toLocaleString()} — buyer notified.`,
                                }
                              : v,
                          ),
                        )
                        setInsuffTarget(null)
                      }}
                      style={{
                        flex: 1,
                        background: "#F59E0B",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        padding: "8px 0",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                        opacity: !isValid ? 0.45 : 1,
                        transition: "opacity 0.15s",
                      }}
                    >
                      Notify Buyer
                    </button>
                  </div>
                </div>
              </Modal>
            )
          })()}

        {/* Reject with reason modal */}
        {rejectTarget &&
          (() => {
            const isWrongAmt = rejectReason === "Wrong amount transferred"
            const isOther = rejectReason === "Other"
            const canProceed =
              !!rejectReason && (!isOther || rejectCustom.trim().length > 0)
            return (
              <Modal
                title="Reject Payment"
                onClose={() => setRejectTarget(null)}
                width={480}
              >
                <div className="space-y-4">
                  <div
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 12,
                      color: "#991B1B",
                    }}
                  >
                    You are reviewing <strong>{rejectTarget.buyer}</strong>'s
                    payment for <strong>{rejectTarget.product}</strong>. Select
                    a reason.
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
                      Reason <span style={{ color: "#E11D2E" }}>*</span>
                    </label>
                    <div className="space-y-2">
                      {REJECT_REASONS.map((r) => (
                        <label
                          key={r}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            cursor: "pointer",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: `1.5px solid ${
                              rejectReason === r
                                ? r === "Wrong amount transferred"
                                  ? "#FCD34D"
                                  : INDIGO
                                : "#E5E7EB"
                            }`,
                            background:
                              rejectReason === r
                                ? r === "Wrong amount transferred"
                                  ? "#FFF7ED"
                                  : "#EEF0FF"
                                : "#fff",
                            transition: "all 0.15s",
                          }}
                        >
                          <input
                            type="radio"
                            name="rejectReason"
                            value={r}
                            checked={rejectReason === r}
                            onChange={() => setRejectReason(r)}
                            style={{ marginTop: 2, accentColor: INDIGO }}
                          />
                          <div>
                            <span
                              style={{
                                fontSize: 13,
                                color: "#374151",
                                fontWeight: rejectReason === r ? 600 : 400,
                              }}
                            >
                              {r}
                            </span>
                            {r === "Wrong amount transferred" && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#92400E",
                                  marginTop: 1,
                                }}
                              >
                                This will open the shortfall flow instead of
                                outright rejecting.
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  {isOther && (
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
                        Details <span style={{ color: "#E11D2E" }}>*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={rejectCustom}
                        onChange={(e) => setRejectCustom(e.target.value)}
                        placeholder="Describe the issue so the buyer can resubmit correctly…"
                        style={{
                          width: "100%",
                          fontSize: 13,
                          border: "1px solid #E5E7EB",
                          borderRadius: 7,
                          padding: "9px 12px",
                          outline: "none",
                          resize: "none",
                          color: "#374151",
                          fontFamily: "inherit",
                          boxSizing: "border-box" as const,
                        }}
                        className="placeholder:text-gray-400"
                      />
                    </div>
                  )}
                  {isWrongAmt && rejectReason && (
                    <div
                      style={{
                        background: "#FFF7ED",
                        border: "1px solid #FCD34D",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "#92400E",
                      }}
                    >
                      ⚠️ Selecting this won't reject the payment — instead,
                      you'll enter the shortfall amount and the buyer will be
                      notified to complete their payment.
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <SecondaryBtn
                      style={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "center",
                      }}
                      onClick={() => setRejectTarget(null)}
                    >
                      Cancel
                    </SecondaryBtn>
                    <button
                      disabled={!canProceed}
                      onClick={() => {
                        if (isWrongAmt) {
                          const item = rejectTarget
                          setRejectTarget(null)
                          setInsuffTarget(item)
                          setInsuffAmtPaid(item.amountPaid || "")
                        } else {
                          const finalReason = isOther
                            ? rejectCustom.trim()
                            : rejectReason
                          setVerifyItems((p) =>
                            p.map((v) =>
                              v.id === rejectTarget.id
                                ? {
                                    ...v,
                                    status: "Rejected" as const,
                                    rejectReason: finalReason,
                                  }
                                : v,
                            ),
                          )
                          setRejectTarget(null)
                        }
                      }}
                      style={{
                        flex: 1,
                        background: isWrongAmt ? "#F59E0B" : "#EF4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: 7,
                        padding: "8px 0",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                        opacity: !canProceed ? 0.45 : 1,
                        transition: "all 0.15s",
                      }}
                    >
                      {isWrongAmt
                        ? "Enter Shortfall Details →"
                        : "Send Rejection"}
                    </button>
                  </div>
                </div>
              </Modal>
            )
          })()}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <SH
          title="Payment Methods"
          action={<PrimaryBtn size="sm">+ Add Method</PrimaryBtn>}
        />
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              name: "GCash",
              icon: "",
              color: "#007AFF",
              desc: "09XX-XXX-8821",
              connected: true,
            },
            {
              name: "Maya",
              icon: "",
              color: "#6B21A8",
              desc: "09XX-XXX-5543",
              connected: true,
            },
            {
              name: "Bank Transfer",
              icon: "",
              color: "#065F46",
              desc: "BDO · •••• 4421",
              connected: true,
            },
            {
              name: "Cash on Meetup",
              icon: "",
              color: "#92400E",
              desc: "Coordinate with seller",
              connected: false,
            },
          ].map((m) => (
            <Card
              key={m.name}
              style={{ borderLeft: `4px solid ${m.color}` }}
              className="flex items-center gap-3"
            >
              <span className="text-2xl" style={{ color: m.color }}><PaymentIcon method={m.name} size={22} /></span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#111827",
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {m.desc}
                </div>
              </div>
              <div className="ml-auto">
                {m.connected ? (
                  <span
                    style={{
                      background: "#D4F5EA",
                      color: "#0B7A59",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 999,
                    }}
                  >
                    Connected
                  </span>
                ) : (
                  <span
                    style={{
                      background: "#F3F4F6",
                      color: "#9CA3AF",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 999,
                    }}
                  >
                    Manual
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <SH title="To Pay" />
          <div className="space-y-3">
            {toPay.map((t) => (
              <Card key={t.id} className="flex items-center gap-4">
                <ProductThumb name={t.product} />
                <div className="flex-1">
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}
                  >
                    {t.product}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {t.seller}
                    </span>
                    <span style={{ fontSize: 11, color: "#D1D5DB" }}>·</span>
                    <Countdown hours={t.hours} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#111827",
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  ₱{t.amount.toLocaleString()}
                </div>
                <PrimaryBtn size="sm" onClick={() => setPayTarget(t)}>
                  Pay Now
                </PrimaryBtn>
              </Card>
            ))}
            {toPay.length > 0 ? (
              <Card
                style={{ background: CREAM, border: "1px dashed #C7B8B8" }}
                className="flex items-center justify-between"
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}
                >
                  Total Due
                </span>
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: INDIGO,
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    ₱{toPay.reduce((s, t) => s + t.amount, 0).toLocaleString()}
                  </span>
                  <PrimaryBtn onClick={() => setPayAll(true)}>
                    Pay All
                  </PrimaryBtn>
                </div>
              </Card>
            ) : (
              <div
                style={{
                  background: "#D4F5EA",
                  borderRadius: 8,
                  padding: "14px 18px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#065F46",
                  fontWeight: 600,
                }}
              >
                ✅ All payments cleared!
              </div>
            )}
          </div>
        </div>
        <div>
          <SH title="Upload Proof of Payment" />
          <Card className="!p-0 overflow-hidden">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFilePick(f)
              }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload proof of payment"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  fileRef.current?.click()
                }
              }}
              style={{
                border: `2px dashed ${dragging ? INDIGO : "#D1D5DB"}`,
                background: dragging ? "#EEF0FF" : CREAM,
                borderRadius: 8,
                padding: 32,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                margin: 16,
                transform: dragging ? "scale(1.01)" : "scale(1)",
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFilePick(f)
                }}
              />
              {uploading ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: INDIGO }}
                    className="lsh"
                  >
                    Uploading…
                  </div>
                </>
              ) : uploaded ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}
                  >
                    {uploaded}
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    Click to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}
                  >
                    Drag & drop your receipt here
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                    or click to browse — JPG, PNG, PDF
                  </div>
                </>
              )}
            </div>
            {uploaded && !uploading && (
              <div className="px-4 pb-4">
                <select
                  style={{
                    width: "100%",
                    fontSize: 12,
                    border: "1px solid #E5E7EB",
                    borderRadius: 6,
                    padding: "7px 10px",
                    marginBottom: 8,
                    outline: "none",
                  }}
                >
                  <option>Select claim to attach…</option>
                  {toPay.map((t) => (
                    <option key={t.id}>
                      {t.product} — ₱{t.amount.toLocaleString()}
                    </option>
                  ))}
                </select>
                <PrimaryBtn
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  Submit Payment Proof
                </PrimaryBtn>
              </div>
            )}
          </Card>
        </div>
      </div>
      <div>
        <SH title="Payment History" />
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
            Filter:
          </span>
          {(["All", "Paid and Reserved", "Pending", "Rejected"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setHistFilter(f)}
                style={{
                  background: histFilter === f ? "#191BA9" : "#fff",
                  color: histFilter === f ? "#fff" : "#6B7280",
                  border: `1px solid ${
                    histFilter === f ? "#191BA9" : "#E5E7EB"
                  }`,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ),
          )}
          <div style={{ flex: 1 }} />
          <select
            value={dateFilter2}
            onChange={(e) => setDateFilter2(e.target.value)}
            style={{
              fontSize: 12,
              color: "#374151",
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              padding: "5px 8px",
              background: "#fff",
              outline: "none",
            }}
          >
            {["All", "Sep 2026", "Aug 2026", "Jul 2026", "Jun 2026"].map(
              (o) => (
                <option key={o}>{o}</option>
              ),
            )}
          </select>
        </div>
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: CREAM }}>
              <tr>
                {[
                  "Product",
                  "Batch",
                  "Method",
                  "Amount",
                  "Date",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      color: "#9CA3AF",
                      fontWeight: 600,
                      fontSize: 11,
                      padding: "10px 14px",
                      textAlign: "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payHistory
                .filter((h) => {
                  if (histFilter !== "All" && h.status !== histFilter)
                    return false
                  if (
                    dateFilter2 !== "All" &&
                    !h.date.includes(dateFilter2.split(" ")[0])
                  )
                    return false
                  return true
                })
                .map((p, i) => (
                  <tr
                    key={p.id}
                    style={{
                      borderTop: "1px solid #F3F4F6",
                      background: i % 2 ? "#FAFAFA" : "#fff",
                    }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <div className="flex items-center gap-2">
                        <ProductThumb name={p.product} />
                        <span style={{ fontWeight: 500, color: "#111827" }}>
                          {p.product}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#6B7280",
                        fontSize: 12,
                      }}
                    >
                      {p.batch || "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "#374151",
                      }}
                    >
                      {p.method}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{p.amount.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#9CA3AF",
                        fontSize: 12,
                      }}
                    >
                      {p.date}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <SecondaryBtn size="sm" onClick={() => setTxDetail(p)}>
                        View Details
                      </SecondaryBtn>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
      {payTarget && (
        <PaymentSubmitModal
          item={payTarget}
          onConfirm={(method, refNo) => handlePay(payTarget, method)}
          onClose={() => setPayTarget(null)}
        />
      )}
      {payAll && (
        <PayModal
          items={toPay.map((t) => ({ product: t.product, amount: t.amount }))}
          onConfirm={(m) => handlePay(null, m)}
          onClose={() => setPayAll(false)}
        />
      )}
      {txDetail && (
        <TransactionDetailModal
          tx={txDetail}
          onClose={() => setTxDetail(null)}
        />
      )}
    </div>
  )
}

// ─── Orders ───────────────────────────────────────────────────────────────────
function Orders({
  orders,
  setOrders,
  role,
  fulfillment,
  setFulfillment,
}: SharedState) {
  const board = useFulfillmentBoard(setFulfillment)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [hover, setHover] = useState<Record<string, number>>({})
  const [trackOrder, setTrackOrder] = useState<OrderRow | null>(null)
  const [contactOrder, setContact] = useState<OrderRow | null>(null)
  const [rateTarget, setRateTarget] = useState<OrderRow | null>(null)
  const [buyerProfile, setBuyerProfile] = useState<string | null>(null)

  if (role === "Seller") {
    return (
      <div className="p-6">
        <h2
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          Fulfillment Board
        </h2>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
          Track all orders across fulfillment stages.
        </p>
        <div
          style={{
            display: "flex",
            gap: 14,
            overflowX: "auto",
            paddingBottom: 16,
          }}
        >
          {KANBAN_COLS.map((col) => {
            const colOrders = fulfillment.filter((o) => o.col === col)
            return (
              <div
                key={col}
                style={{
                  minWidth: 200,
                  width: 200,
                  flexShrink: 0,
                  background: "#F9FAFB",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  maxHeight: "70vh",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: KANBAN_COL_BG[col],
                    padding: "10px 12px",
                    borderBottom: "1px solid #E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}
                  >
                    {col}
                  </span>
                  <span
                    style={{
                      background: "rgba(0,0,0,0.08)",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#374151",
                      padding: "1px 7px",
                    }}
                  >
                    {colOrders.length}
                  </span>
                </div>
                <div
                  style={{
                    overflowY: "auto",
                    padding: "10px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {colOrders.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        background: "#fff",
                        borderRadius: 8,
                        border: "1px solid #E5E7EB",
                        padding: "10px 12px",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar name={o.buyer} size={20} />
                        <button
                          onClick={() => setBuyerProfile(o.buyer)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: INDIGO,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {o.buyer}
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#374151",
                          marginBottom: 4,
                        }}
                      >
                        {o.product}
                      </div>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                          ×{o.qty}
                        </span>
                        <span
                          style={{
                            background: CYAN_L,
                            color: "#0369A1",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 999,
                          }}
                        >
                          ₱{o.amount.toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => board.toggle(o.id)}
                        aria-expanded={board.expandedId === o.id}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: INDIGO,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "6px 0 0",
                        }}
                      >
                        {board.expandedId === o.id
                          ? "Hide status ▴"
                          : "Update status ▾"}
                      </button>
                      {board.expandedId === o.id && (
                        <div style={{ marginTop: 8, marginLeft: -12, marginRight: -12, marginBottom: -10 }}>
                          <FulfillmentDetails order={o} onMove={board.move} />
                        </div>
                      )}
                    </div>
                  ))}
                  {colOrders.length === 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#9CA3AF",
                        textAlign: "center",
                        padding: "12px 0",
                      }}
                    >
                      No orders
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <FulfillmentLiveRegion text={board.announcement} />
        {buyerProfile && (
          <BuyerProfileModal
            buyer={buyerProfile}
            onClose={() => setBuyerProfile(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <Card style={{ background: CYAN_L, border: `1px solid ${SKY}` }}>
        <div className="flex items-center">
          {ORDER_STEPS.map((step, i) => (
            <div
              key={step}
              className="flex items-center"
              style={{ flex: i < ORDER_STEPS.length - 1 ? 1 : "none" as never }}
            >
              <div className="flex flex-col items-center">
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: INDIGO,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: INDIGO,
                    fontWeight: 600,
                    marginTop: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  {step}
                </div>
              </div>
              {i < ORDER_STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: INDIGO,
                    margin: "0 4px",
                    marginBottom: 20,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </Card>
      {orders.map((order) => {
        const si = order.step - 1
        const pct = Math.round((order.step / ORDER_STEPS.length) * 100)
        const delivered = order.step === 5
        const myR = ratings[order.id] || 0
        const myH = hover[order.id] || 0
        return (
          <Card key={order.id}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    style={{
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {order.product}
                  </span>
                  <span
                    style={{
                      background: CREAM,
                      border: "1px solid #E5E7EB",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#9CA3AF",
                      padding: "2px 8px",
                    }}
                  >
                    {order.id}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={order.seller} size={18} />
                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    {order.seller}
                    {order.batch ? " · " + order.batch : ""}
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#111827",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                ₱{order.amount.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center mb-4">
              {ORDER_STEPS.map((step, i) => (
                <div
                  key={step}
                  className="flex items-center"
                  style={{
                    flex: i < ORDER_STEPS.length - 1 ? 1 : "none" as never,
                  }}
                >
                  <div
                    className="flex flex-col items-center"
                    style={{ minWidth: 60 }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: i <= si ? INDIGO : "#E5E7EB",
                        color: i <= si ? "#fff" : "#9CA3AF",
                        fontSize: 10,
                        fontWeight: 700,
                        transition: "background 0.3s",
                      }}
                    >
                      {i < si ? "✓" : i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: i <= si ? INDIGO : "#9CA3AF",
                        fontWeight: i === si ? 700 : 500,
                        marginTop: 3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step}
                    </div>
                  </div>
                  {i < ORDER_STEPS.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        background: i < si ? INDIGO : "#E5E7EB",
                        margin: "0 2px",
                        marginBottom: 16,
                        transition: "background 0.3s",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div
              style={{
                background: "#F3F4F6",
                borderRadius: 999,
                height: 5,
                marginBottom: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: delivered ? GREEN : INDIGO,
                  borderRadius: 999,
                  transition: "width 0.6s cubic-bezier(.22,1,.36,1)",
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {order.trackingNo ? (
                  <span>
                    📦{" "}
                    <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                      {order.trackingNo}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: delivered ? GREEN : "#9CA3AF" }}>
                    {order.eta}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {delivered && !order.rated && !(myR > 0) && (
                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      Rate seller:
                    </span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onMouseEnter={() =>
                          setHover((h) => ({ ...h, [order.id]: star }))
                        }
                        onMouseLeave={() =>
                          setHover((h) => ({ ...h, [order.id]: 0 }))
                        }
                        onClick={() => setRateTarget(order)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 20,
                          color: star <= (myH || myR) ? AMBER : "#E5E7EB",
                          transition: "color 0.1s,transform 0.1s",
                          transform: star <= myH ? "scale(1.2)" : "scale(1)",
                        }}
                      >
                        
                      </button>
                    ))}
                    <PrimaryBtn size="sm" onClick={() => setRateTarget(order)}>
                      Rate
                    </PrimaryBtn>
                  </div>
                )}
                {order.step >= 4 &&
                  !delivered &&
                  !order.rated &&
                  !(myR > 0) && (
                    <PrimaryBtn size="sm" onClick={() => setRateTarget(order)}>
                      Rate
                    </PrimaryBtn>
                  )}
                {(order.rated || myR > 0) && (
                  <span style={{ fontSize: 12, color: AMBER }}>
                     {order.rating || myR}/5 Rated
                  </span>
                )}
                {!delivered && (
                  <SecondaryBtn onClick={() => setTrackOrder(order)}>
                    Track Order
                  </SecondaryBtn>
                )}
                <SecondaryBtn onClick={() => setContact(order)}>
                  Contact Seller
                </SecondaryBtn>
              </div>
            </div>
          </Card>
        )
      })}
      {trackOrder && (
        <TrackOrderModal
          order={trackOrder}
          onClose={() => setTrackOrder(null)}
        />
      )}
      {contactOrder && (
        <ContactSellerModal
          seller={contactOrder.seller}
          product={contactOrder.product}
          onClose={() => setContact(null)}
        />
      )}
      {rateTarget && (
        <RateOrderModal
          order={rateTarget}
          onRate={(rating) => {
            setRatings((r) => ({ ...r, [rateTarget.id]: rating }))
            setOrders((prev) =>
              prev.map((o) =>
                o.id === rateTarget.id ? { ...o, rated: true, rating } : o,
              ),
            )
            setRateTarget(null)
          }}
          onClose={() => setRateTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────
const NOTIF_DEFAULTS = [
  {
    label: "Payment deadline reminders",
    sub: "Get notified 24h and 6h before payment is due",
    key: "payments",
  },
  {
    label: "Claim status updates",
    sub: "When your claim is reserved, cancelled, or expires",
    key: "claims",
  },
  {
    label: "New batches from followed sellers",
    sub: "First to know when a seller posts a new batch",
    key: "newBatches",
  },
  {
    label: "Waitlist position updates",
    sub: "When you move up the waitlist",
    key: "waitlist",
  },
  {
    label: "Delivery tracking",
    sub: "Shipping and delivery status changes",
    key: "delivery",
  },
  {
    label: "Seller messages",
    sub: "Direct messages from sellers about your orders",
    key: "messages",
  },
]

function Settings({ user, setUser, role }: SharedState) {
  const [section, setSection] = useState<SettingsSection>("Profile")
  const [fbConn, setFbConn] = useState(false)
  const [fbUser, setFbUser] = useState("")
  const [igConn, setIgConn] = useState(false)
  const [igUser, setIgUser] = useState("")
  const [socialModal, setSocialModal] =
    useState<"Facebook" | "Instagram" | null>(null)
  const [idState, setIdState] = useState<"none" | "uploading" | "submitted">(
    "none",
  )
  const idFileRef = useRef<HTMLInputElement>(null)
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    payments: true,
    claims: true,
    newBatches: false,
    waitlist: true,
    delivery: true,
    messages: true,
  })
  const [firstName, setFirstName] = useState(user.name.split(" ")[0] || "")
  const [lastName, setLastName] = useState(
    user.name.split(" ").slice(1).join(" ") || "",
  )
  const [email, setEmail] = useState(user.email || "")
  const [bio, setBio] = useState(user.bio || "")
  const [saved, setSaved] = useState(false)
  const sections: SettingsSection[] =
    role === "Seller"
      ? [
          "Profile",
          "Linked Accounts",
          "Notifications",
          "Payment Methods",
          "Security",
        ]
      : ["Profile", "Notifications", "Security"]
  useEffect(() => {
    if (!sections.includes(section)) setSection("Profile")
  }, [role])

  // Payment methods state
  type PayMethod = {
    id: number
    name: string
    detail: string
    icon: string
    verified: boolean
  }
  const [payMethods, setPayMethods] = useState<PayMethod[]>([
    {
      id: 1,
      name: "GCash",
      detail: "09XX-XXX-8821",
      icon: "",
      verified: true,
    },
    {
      id: 2,
      name: "Maya",
      detail: "09XX-XXX-5543",
      icon: "",
      verified: true,
    },
    {
      id: 3,
      name: "BDO Bank Transfer",
      detail: "Account •••• 4421",
      icon: "",
      verified: false,
    },
  ])
  const [showAddPM, setShowAddPM] = useState(false)
  const [verifyTarget, setVerifyTarget] = useState<PayMethod | null>(null)
  const [removeTarget, setRemoveTarget] = useState<PayMethod | null>(null)
  const [pmType, setPmType] = useState("GCash")
  const [pmName, setPmName] = useState("")
  const [pmNum, setPmNum] = useState("")
  const [pmLoading, setPmLoading] = useState(false)

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [show2FA, setShow2FA] = useState(false)
  const [tfaStep, setTfaStep] = useState<"phone" | "code">("phone")
  const [tfaPhone, setTfaPhone] = useState("")
  const [tfaCode, setTfaCode] = useState("")
  const [tfaLoading, setTfaLoading] = useState(false)

  const saveProfile = () => {
    const newName = [firstName, lastName].filter(Boolean).join(" ") || user.name
    setUser((u) => ({ ...u, name: newName, email, bio }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleIdPick = () => {
    setIdState("uploading")
    setTimeout(() => setIdState("submitted"), 1500)
  }

  const addPayMethod = () => {
    if (!pmName.trim() || !pmNum.trim()) return
    setPmLoading(true)
    setTimeout(() => {
      const icons: Record<string, string> = {
        GCash: "",
        Maya: "",
        "Bank Transfer": "",
        "Cash on Meetup": "",
      }
      setPayMethods((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: pmType,
          detail: pmNum.trim(),
          icon: icons[pmType] || "💳",
          verified: false,
        },
      ])
      setPmName("")
      setPmNum("")
      setPmLoading(false)
      setShowAddPM(false)
    }, 800)
  }

  const confirmVerify = () => {
    if (!verifyTarget) return
    setPmLoading(true)
    setTimeout(() => {
      setPayMethods((p) =>
        p.map((m) => (m.id === verifyTarget.id ? { ...m, verified: true } : m)),
      )
      setPmLoading(false)
      setVerifyTarget(null)
    }, 900)
  }

  const confirmRemove = () => {
    if (!removeTarget) return
    setPayMethods((p) => p.filter((m) => m.id !== removeTarget.id))
    setRemoveTarget(null)
  }

  const submit2FA = () => {
    if (tfaStep === "phone") {
      setTfaLoading(true)
      setTimeout(() => {
        setTfaLoading(false)
        setTfaStep("code")
      }, 800)
    } else {
      setTfaLoading(true)
      setTimeout(() => {
        setTfaLoading(false)
        setTwoFAEnabled(true)
        setShow2FA(false)
        setTfaStep("phone")
        setTfaPhone("")
        setTfaCode("")
      }, 800)
    }
  }

  return (
    <div className="p-6">
      <div className="grid gap-6" style={{ gridTemplateColumns: "220px 1fr" }}>
        <div>
          <Card className="!p-2">
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                padding: "6px 10px",
                letterSpacing: 1,
              }}
            >
              ACCOUNT
            </div>
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: section === s ? 600 : 400,
                  color: section === s ? INDIGO : "#374151",
                  background: section === s ? "#EEF0FF" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  gap: 8,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 15 }}>
                  {s === "Profile"
                    ? "👤"
                    : s === "Linked Accounts"
                      ? "🔗"
                      : s === "Notifications"
                        ? "🔔"
                        : s === "Payment Methods"
                          ? "💳"
                          : "Lock"}
                </span>
                {s}
              </button>
            ))}
          </Card>
        </div>
        <Card>
          {section === "Profile" && (
            <div className="pr">
              <h3
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: 20,
                }}
              >
                Profile
              </h3>
              <div className="flex items-center gap-5 mb-6">
                <Avatar name={user.name || "User"} size={64} />
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    {user.name || "—"}
                  </div>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                    {user.email || "—"} · Member since{" "}
                    {new Date().toLocaleDateString("en-PH", {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <SecondaryBtn style={{ marginTop: 8 }}>
                    Change Photo
                  </SecondaryBtn>
                </div>
              </div>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "1fr 1fr" }}
              >
                {[
                  ["First Name", firstName, setFirstName],
                  ["Last Name", lastName, setLastName],
                ].map(([label, val, set]) => (
                  <div key={label as string}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      {label as string}
                    </label>
                    <input
                      value={val as string}
                      onChange={(e) =>
                        (set as (v: string) => void)(e.target.value)
                      }
                      style={{
                        width: "100%",
                        fontSize: 13,
                        border: "1px solid #E5E7EB",
                        borderRadius: 7,
                        padding: "8px 12px",
                        outline: "none",
                        color: "#374151",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Email
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      fontSize: 13,
                      border: "1px solid #E5E7EB",
                      borderRadius: 7,
                      padding: "8px 12px",
                      outline: "none",
                      color: "#374151",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Bio
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell sellers a bit about yourself…"
                    style={{
                      width: "100%",
                      fontSize: 13,
                      border: "1px solid #E5E7EB",
                      borderRadius: 7,
                      padding: "8px 12px",
                      outline: "none",
                      resize: "none",
                      color: "#374151",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                    className="placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-5">
                {saved && (
                  <span
                    className="fi"
                    style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}
                  >
                    ✓ Changes saved!
                  </span>
                )}
                <PrimaryBtn onClick={saveProfile}>Save Changes</PrimaryBtn>
              </div>
            </div>
          )}
          {section === "Linked Accounts" && (
            <div className="pr">
              <h3
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: 4,
                }}
              >
                Linked Accounts
              </h3>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
                Connect your social media accounts to discover batches and
                sellers.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  {
                    name: "Facebook" as const,
                    grad: "#1877F2",
                    icon: (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                      </svg>
                    ),
                    connected: fbConn,
                    username: fbUser,
                    disconnect: () => {
                      setFbConn(false)
                      setFbUser("")
                    },
                  },
                  {
                    name: "Instagram" as const,
                    grad: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)",
                    icon: (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <rect
                          x="2"
                          y="2"
                          width="20"
                          height="20"
                          rx="5"
                          ry="5"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="4"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <circle cx="17.5" cy="6.5" r="1" fill="white" />
                      </svg>
                    ),
                    connected: igConn,
                    username: igUser,
                    disconnect: () => {
                      setIgConn(false)
                      setIgUser("")
                    },
                  },
                ].map((m) => (
                  <div
                    key={m.name}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 10,
                      padding: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: m.grad,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <PaymentIcon method={m.name} size={18} />
                    </div>
                    <div className="flex-1">
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {m.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: m.connected ? "#065F46" : "#9CA3AF",
                          fontWeight: m.connected ? 500 : 400,
                        }}
                      >
                        {m.connected
                          ? `✓ Connected as ${m.username}`
                          : "Not connected"}
                      </div>
                    </div>
                    {m.connected ? (
                      <button
                        onClick={m.disconnect}
                        style={{
                          background: "#FEE2E2",
                          color: "#991B1B",
                          border: "none",
                          borderRadius: 7,
                          padding: "7px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Disconnect
                      </button>
                    ) : (
                      <PrimaryBtn
                        size="sm"
                        onClick={() => setSocialModal(m.name)}
                      >
                        Connect
                      </PrimaryBtn>
                    )}
                  </div>
                ))}
              </div>
              <div
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: CREAM,
                    padding: "12px 16px",
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}
                  >
                    Government ID Verification
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                    Required to become a verified seller. Accepted: PhilSys,
                    Driver's License, Passport, SSS, UMID.
                  </div>
                </div>
                <div className="p-4">
                  <input
                    ref={idFileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleIdPick()
                    }}
                  />
                  {idState === "none" && (
                    <div
                      onClick={() => idFileRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      aria-label="Upload Government ID"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          idFileRef.current?.click()
                        }
                      }}
                      style={{
                        border: "2px dashed #D1D5DB",
                        borderRadius: 8,
                        padding: 28,
                        textAlign: "center",
                        cursor: "pointer",
                        background: CREAM,
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.borderColor =
                          INDIGO
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.borderColor =
                          "#D1D5DB"
                      }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🪪</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#374151",
                        }}
                      >
                        Upload Government ID
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}
                      >
                        Click to browse or drag & drop
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <PrimaryBtn size="sm">Choose File</PrimaryBtn>
                      </div>
                    </div>
                  )}
                  {idState === "uploading" && (
                    <div
                      className="fi"
                      style={{
                        background: "#EEF0FF",
                        borderRadius: 8,
                        padding: 24,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: INDIGO }}
                        className="lsh"
                      >
                        Uploading ID…
                      </div>
                    </div>
                  )}
                  {idState === "submitted" && (
                    <div
                      className="fi"
                      style={{
                        background: "#D4F5EA",
                        borderRadius: 8,
                        padding: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 24 }}>✅</span>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#065F46",
                          }}
                        >
                          Submitted — Pending Review
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            marginTop: 2,
                          }}
                        >
                          Usually verified within 24–48 hours.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {section === "Notifications" && (
            <div className="pr">
              <h3
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: 20,
                }}
              >
                Notification Preferences
              </h3>
              {NOTIF_DEFAULTS.map((n) => (
                <div
                  key={n.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {n.label}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {n.sub}
                    </div>
                  </div>
                  <Toggle
                    on={notifs[n.key]}
                    onChange={(v) => setNotifs((p) => ({ ...p, [n.key]: v }))}
                  />
                </div>
              ))}
            </div>
          )}
          {section === "Payment Methods" && (
            <div className="pr">
              <div className="flex items-center justify-between mb-5">
                <h3
                  style={{
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  Payment Methods
                </h3>
                <PrimaryBtn
                  size="sm"
                  onClick={() => setShowAddPM(true)}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  + Add Method
                </PrimaryBtn>
              </div>
              <div className="space-y-3">
                {payMethods.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 9,
                      padding: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 24 }}><PaymentIcon method={m.name} size={24} /></span>
                    <div className="flex-1">
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        {m.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {m.detail}
                      </div>
                    </div>
                    {m.verified ? (
                      <span
                        style={{
                          background: "#D4F5EA",
                          color: "#0B7A59",
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                        }}
                      >
                        Verified
                      </span>
                    ) : (
                      <PrimaryBtn size="sm" onClick={() => setVerifyTarget(m)}>
                        Verify
                      </PrimaryBtn>
                    )}
                    <button
                      onClick={() => setRemoveTarget(m)}
                      style={{
                        color: "#EF4444",
                        background: "none",
                        border: "none",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {payMethods.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 0",
                      color: "#9CA3AF",
                      fontSize: 13,
                    }}
                  >
                    No payment methods added yet.
                  </div>
                )}
              </div>
            </div>
          )}
          {section === "Security" && (
            <div className="pr">
              <h3
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: 20,
                }}
              >
                Security
              </h3>
              <div className="space-y-5">
                {[
                  ["Current Password", "••••••••"],
                  ["New Password", ""],
                ].map(([label, val]) => (
                  <div key={label}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </label>
                    <input
                      type="password"
                      defaultValue={val}
                      style={{
                        width: "100%",
                        maxWidth: 360,
                        fontSize: 13,
                        border: "1px solid #E5E7EB",
                        borderRadius: 7,
                        padding: "8px 12px",
                        outline: "none",
                        color: "#374151",
                      }}
                      className="placeholder:text-gray-400"
                    />
                  </div>
                ))}
                <PrimaryBtn>Update Password</PrimaryBtn>
                <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 20 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      Two-Factor Authentication
                    </div>
                    {twoFAEnabled ? (
                      <span
                        style={{
                          background: "#D4F5EA",
                          color: "#0B7A59",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 999,
                        }}
                      >
                        Enabled
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#F3F4F6",
                          color: "#9CA3AF",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 999,
                        }}
                      >
                        Not enabled
                      </span>
                    )}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}
                  >
                    {twoFAEnabled
                      ? "Your account is protected with 2FA via SMS."
                      : "Add an extra layer of security with SMS verification."}
                  </div>
                  {twoFAEnabled ? (
                    <SecondaryBtn onClick={() => setTwoFAEnabled(false)}>
                      Disable 2FA
                    </SecondaryBtn>
                  ) : (
                    <PrimaryBtn
                      onClick={() => {
                        setShow2FA(true)
                        setTfaStep("phone")
                      }}
                    >
                      Enable 2FA
                    </PrimaryBtn>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Add Payment Method modal */}
      {showAddPM && (
        <Modal
          title="Add Payment Method"
          onClose={() => setShowAddPM(false)}
          width={420}
        >
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
                Method Type
              </label>
              <select
                value={pmType}
                onChange={(e) => setPmType(e.target.value)}
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
                {["GCash", "Maya", "Bank Transfer", "Cash on Meetup"].map(
                  (t) => (
                    <option key={t}>{t}</option>
                  ),
                )}
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
                Account Name
              </label>
              <input
                value={pmName}
                onChange={(e) => setPmName(e.target.value)}
                placeholder="Full name on account"
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
                {pmType === "Bank Transfer"
                  ? "Account Number"
                  : "Mobile Number"}
              </label>
              <input
                value={pmNum}
                onChange={(e) => setPmNum(e.target.value)}
                placeholder={
                  pmType === "Bank Transfer"
                    ? "e.g. 1234-5678-9012"
                    : "e.g. 09XX-XXX-XXXX"
                }
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
            <div className="flex gap-3 pt-1">
              <SecondaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setShowAddPM(false)}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={addPayMethod}
                loading={pmLoading}
                disabled={!pmName.trim() || !pmNum.trim()}
              >
                Add Method
              </PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* Verify modal */}
      {verifyTarget && (
        <Modal
          title="Verify Payment Method"
          onClose={() => setVerifyTarget(null)}
          width={400}
        >
          <div className="space-y-4">
            <div
              style={{
                background: CREAM,
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 24 }}><PaymentIcon method={verifyTarget.name} size={24} /></span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {verifyTarget.name}
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                  {verifyTarget.detail}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
              Kargo will send a small verification amount (₱1) to confirm
              ownership. Check your account to confirm you received it.
            </div>
            <div className="flex gap-3">
              <SecondaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setVerifyTarget(null)}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={confirmVerify}
                loading={pmLoading}
              >
                Confirm Ownership
              </PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <Modal
          title="Remove Payment Method"
          onClose={() => setRemoveTarget(null)}
          width={400}
        >
          <div className="space-y-4">
            <div style={{ fontSize: 13, color: "#374151" }}>
              Are you sure you want to remove{" "}
              <strong>
                {removeTarget.name} ({removeTarget.detail})
              </strong>
              ? This cannot be undone.
            </div>
            <div className="flex gap-3">
              <SecondaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </SecondaryBtn>
              <button
                onClick={confirmRemove}
                style={{
                  flex: 1,
                  background: "#EF4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2FA setup modal */}
      {show2FA && (
        <Modal
          title="Enable Two-Factor Authentication"
          onClose={() => {
            setShow2FA(false)
            setTfaStep("phone")
          }}
          width={420}
        >
          <div className="space-y-4">
            {tfaStep === "phone" ? (
              <>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  Enter your mobile number to receive a verification code.
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
                    Mobile Number
                  </label>
                  <input
                    value={tfaPhone}
                    onChange={(e) => setTfaPhone(e.target.value)}
                    placeholder="+63 9XX XXX XXXX"
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
                <div className="flex gap-3 pt-1">
                  <SecondaryBtn
                    style={{
                      flex: 1,
                      display: "flex",
                      justifyContent: "center",
                    }}
                    onClick={() => setShow2FA(false)}
                  >
                    Cancel
                  </SecondaryBtn>
                  <PrimaryBtn
                    style={{
                      flex: 1,
                      display: "flex",
                      justifyContent: "center",
                    }}
                    onClick={submit2FA}
                    loading={tfaLoading}
                    disabled={!tfaPhone.trim()}
                  >
                    Send Code
                  </PrimaryBtn>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    background: CYAN_L,
                    border: `1px solid ${SKY}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "#0369A1",
                  }}
                >
                  A 6-digit code was sent to {tfaPhone}. For this demo, enter
                  any 6 digits.
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
                    Verification Code
                  </label>
                  <input
                    value={tfaCode}
                    onChange={(e) =>
                      setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    maxLength={6}
                    style={{
                      width: "100%",
                      fontSize: 20,
                      letterSpacing: 8,
                      textAlign: "center",
                      border: "1px solid #E5E7EB",
                      borderRadius: 7,
                      padding: "12px",
                      outline: "none",
                      color: "#111827",
                      fontFamily: "monospace",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <SecondaryBtn
                    style={{
                      flex: 1,
                      display: "flex",
                      justifyContent: "center",
                    }}
                    onClick={() => setTfaStep("phone")}
                  >
                    ← Back
                  </SecondaryBtn>
                  <PrimaryBtn
                    style={{
                      flex: 1,
                      display: "flex",
                      justifyContent: "center",
                    }}
                    onClick={submit2FA}
                    loading={tfaLoading}
                    disabled={tfaCode.length < 6}
                  >
                    Verify & Enable
                  </PrimaryBtn>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {socialModal && (
        <SocialConnectModal
          platform={socialModal}
          onConnect={(u) => {
            if (socialModal === "Facebook") {
              setFbConn(true)
              setFbUser(u)
            } else {
              setIgConn(true)
              setIgUser(u)
            }
          }}
          onClose={() => setSocialModal(null)}
        />
      )}
    </div>
  )
}

// ─── Tab content with direction-aware transition ───────────────────────────────
function TabContent({ tab, shared }: { tab: Tab; shared: SharedState }) {
  const [displayed, setDisplayed] = useState(tab)
  const [animClass, setAnimClass] = useState("fi")
  const prev = useRef(tab)

  useEffect(() => {
    if (tab !== prev.current) {
      setAnimClass(TABS.indexOf(tab) > TABS.indexOf(prev.current) ? "pl" : "pr")
      setDisplayed(tab)
      prev.current = tab
    }
  }, [tab])

  const map: Record<Tab, React.ReactNode> = {
    Dashboard: <Dashboard {...shared} />,
    Batches: <Batches {...shared} />,
    "My Claims": <MyClaims {...shared} />,
    Payments: <Payments {...shared} />,
    Orders: <Orders {...shared} />,
    Reports: <Reports {...shared} />,
    Settings: <Settings {...shared} />,
  }
  return (
    <div key={displayed} className={animClass}>
      {map[displayed]}
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const originalPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "original"
  const [stage, setStage] = useState<AppStage>(originalPreview ? "app" : "signup")
  const [showOnboarding, setOnboard] = useState(false)
  const [tab, setTab] = useState<Tab>("Dashboard")
  const [user, setUser] = useState<UserInfo>({
    name: originalPreview ? "Alex Jordan" : "",
    email: originalPreview ? "alex@kargo.demo" : "",
    role: "Buyer",
  })
  const [role, setRole] = useState<Role>("Buyer")
  const [showNewBatch, setShowNewBatch] = useState(false)

  // Shared mutable data
  const [claims, setClaims] = useState<ClaimRow[]>(CLAIMS_INIT)
  const [toPay, setToPay] = useState<ToPayRow[]>(TOPAY_INIT)
  const [payHistory, setPayHistory] = useState<PayHistRow[]>(PAYHIST_INIT)
  const [orders, setOrders] = useState<OrderRow[]>(ORDERS_INIT)
  const [reports, setReports] = useState<ReportRow[]>(REPORTS_INIT)
  const [batches, setBatches] = useState<BatchType[]>(BATCHES_INIT)
  const [fulfillment, setFulfillment] =
    useState<FulfillmentOrder[]>(FULFILLMENT_INIT)

  const shared: SharedState = {
    claims,
    setClaims,
    toPay,
    setToPay,
    payHistory,
    setPayHistory,
    orders,
    setOrders,
    reports,
    setReports,
    batches,
    setBatches,
    fulfillment,
    setFulfillment,
    user,
    setUser,
    setTab,
    role,
  }

  const handleSignupSuccess = (u: UserInfo) => {
    setUser(u)
    setRole(u.role)
    setStage("app")
    setOnboard(true)
  }
  const handleLoginSuccess = (u: UserInfo) => {
    setUser(u)
    setRole(u.role)
    setStage("app")
  }

  return (
    <>
      {stage === "signup" && (
        <div className="pu">
          <SignUp
            onLogin={() => setStage("login")}
            onSuccess={handleSignupSuccess}
          />
        </div>
      )}
      {stage === "login" && (
        <div className="pl">
          <Login
            onSignUp={() => setStage("signup")}
            onSuccess={handleLoginSuccess}
          />
        </div>
      )}
      {stage === "app" && (
        <div
          className="pu kargo-original-app"
          style={{
            background: CREAM,
            minHeight: "100vh",
            fontFamily: "'Inter',sans-serif",
          }}
        >
          <Header
            user={user}
            onLogout={() => setStage("login")}
            onSettings={() => setTab("Settings")}
            role={role}
            batches={batches}
            onNavigate={setTab}
            onBatchSelect={(id) => {
              navIntent.batchId = id
              setTab("Batches")
            }}
            onSellerSelect={(name) => {
              navIntent.sellerName = name
              setTab("Batches")
            }}
          />
          <TabBar
            active={tab}
            setActive={setTab}
            role={role}
            setRole={(r) => {
              setRole(r)
            }}
            onNewBatch={() => setShowNewBatch(true)}
          />
          <main style={{ minHeight: "calc(100vh - 100px)" }}>
            <TabContent tab={tab} shared={shared} />
          </main>
          {showOnboarding && <Onboarding onDone={() => setOnboard(false)} />}
          {showNewBatch && (
            <NewBatchModal
              onCreate={(b) => setBatches((prev) => [b, ...prev])}
              onClose={() => setShowNewBatch(false)}
              sellerName={user.name}
            />
          )}
        </div>
      )}
    </>
  )
}
