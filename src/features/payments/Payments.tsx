import { useState, useRef } from "react"
import { CheckCircle2, Paperclip, Clock3 } from "lucide-react"
import type { ToPayRow, PayHistRow, OrderRow, ClaimStatus, SharedState } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import {
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  ProductThumb,
  StatusBadge,
  Countdown,
  PaymentIcon,
  PayModal,
} from "@/components/shared"
import PaymentSubmitModal from "./PaymentSubmitModal"
import TransactionDetailModal from "./TransactionDetailModal"
import SellerPaymentVerification from "./SellerPaymentVerification"
import AddressSection from "./AddressSection"

export default function Payments({
  toPay,
  setToPay,
  payHistory,
  setPayHistory,
  claims,
  setClaims,
  orders,
  setOrders,
  role,
  user,
}: SharedState) {
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

  if (role === "Seller") return <SellerPaymentVerification />

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
      <AddressSection />
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
                <CheckCircle2 size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
                All payments cleared!
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
                  <div style={{ color: INDIGO, marginBottom: 8, display: "flex", justifyContent: "center" }}><Clock3 size={32} aria-hidden="true" /></div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: INDIGO }}
                    className="lsh"
                  >
                    Uploading…
                  </div>
                </>
              ) : uploaded ? (
                <>
                  <div style={{ color: "#0B7A59", marginBottom: 8, display: "flex", justifyContent: "center" }}><CheckCircle2 size={32} aria-hidden="true" /></div>
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
                  <div style={{ color: "#9CA3AF", marginBottom: 8, display: "flex", justifyContent: "center" }}><Paperclip size={32} aria-hidden="true" /></div>
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
          contactPrefill={user.fb || ""}
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
