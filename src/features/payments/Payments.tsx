import { useEffect, useState, useRef } from "react"
import { CheckCircle2, Paperclip, Clock3 } from "lucide-react"
import type { ToPayRow, PayHistRow, OrderRow, ClaimStatus, SharedState, EntityId } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import {
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  ProductThumb,
  StatusBadge,
  Countdown,
} from "@/components/shared"
import PaymentSubmitModal from "./PaymentSubmitModal"
import BatchCheckoutModal from "./BatchCheckoutModal"
import TransactionDetailModal from "./TransactionDetailModal"
import SellerPaymentVerification from "./SellerPaymentVerification"
import AddressSection from "./AddressSection"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import { deadlineHasPassed } from "@/features/claims/claimExpiry"

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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [proofClaimId, setProofClaimId] = useState<EntityId | "">("")
  const [proofToast, setProofToast] = useState(false)
  const [payTarget, setPayTarget] = useState<ToPayRow | null>(null)
  const [payAll, setPayAll] = useState(false)
  const [histFilter, setHistFilter] =
    useState<"All" | "Paid and Reserved" | "Pending" | "Rejected">("All")
  const [dateFilter2, setDateFilter2] = useState("All")
  const [txDetail, setTxDetail] = useState<PayHistRow | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const payableToPay = toPay.filter((item) => !deadlineHasPassed(item))

  useEffect(() => {
    if (payTarget && deadlineHasPassed(payTarget)) setPayTarget(null)
    if (payableToPay.length === 0) setPayAll(false)
  }, [payTarget, payableToPay.length])

  const handleFilePick = (file: File) => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(file.name)
      setUploadedFile(file)
    }, 1200)
  }

  const handlePay = async (item: ToPayRow | null, method: string, referenceNumber?: string, receipt?: File) => {
    const targets = (item ? [item] : payableToPay).filter((target) => !deadlineHasPassed(target))
    if (targets.length === 0) {
      setPayTarget(null)
      setPayAll(false)
      alert("This claim has expired and can no longer be paid.")
      return
    }
    if (isSupabaseConfigured) {
      try {
        for (const target of targets) {
          const orderId = target.orderId ?? String(target.id)
          await kargoApi.submitPayment({
            orderId,
            method,
            amount: target.amount,
            referenceNumber,
            receipt,
          })
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to submit payment.")
        return
      }
    }
    const newHist: PayHistRow[] = targets.map((t, i) => ({
      id: payHistory.length + i + 1,
      product: t.product,
      batch: "",
      method,
      amount: t.amount,
      date: TODAY,
      status: (isSupabaseConfigured ? "Pending" : "Paid and Reserved") as ClaimStatus,
    }))
    setPayHistory((h) => [...newHist, ...h])
    if (!isSupabaseConfigured) setClaims((prev) =>
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
    if (!isSupabaseConfigured) {
      setOrders((prev) => [...newOrders, ...prev])
      setToPay((prev) => (item ? prev.filter((x) => x.id !== item.id) : []))
    }
    setPayTarget(null)
    setPayAll(false)
  }

  // Submit an uploaded receipt against a chosen "To Pay" item: record it as a
  // manual bank/receipt payment (reusing the same flow as Pay Now) and reset.
  const handleSubmitProof = async () => {
    const item = payableToPay.find((t) => t.id === proofClaimId)
    if (!item) return
    await handlePay(item, "Receipt Upload", undefined, uploadedFile ?? undefined)
    setUploaded(null)
    setUploadedFile(null)
    setProofClaimId("")
    setProofToast(true)
    setTimeout(() => setProofToast(false), 2400)
  }

  if (role === "Seller") return <SellerPaymentVerification />

  return (
    <div className="p-6 space-y-6">
      <AddressSection />
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <SH title="To Pay" />
          <div className="space-y-3">
            {payableToPay.map((t) => (
              <Card key={t.id} className="flex items-center gap-4">
                <ProductThumb name={t.product} />
                <div className="flex-1">
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}
                  >
                    {t.product}
                    {t.qty && t.qty > 1 ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginLeft: 6 }}>
                        ×{t.qty}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {t.seller}
                    </span>
                    <span style={{ fontSize: 11, color: "#D1D5DB" }}>·</span>
                    <Countdown hours={t.hours} expiresAt={t.expiresAt} />
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
            {payableToPay.length > 0 ? (
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
                    ₱{payableToPay.reduce((s, t) => s + t.amount, 0).toLocaleString()}
                  </span>
                  <PrimaryBtn onClick={() => setPayAll(true)}>
                    Batch Checkout
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
                  value={proofClaimId}
                  onChange={(e) =>
                    setProofClaimId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
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
                  <option value="">Select claim to attach…</option>
                  {payableToPay.map((t) => (
                    <option key={t.id} value={t.id}>
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
                  disabled={proofClaimId === ""}
                  onClick={handleSubmitProof}
                >
                  Submit Payment Proof
                </PrimaryBtn>
                {proofToast && (
                  <div
                    className="fi"
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "#065F46",
                      background: "#D4F5EA",
                      borderRadius: 6,
                      padding: "6px 10px",
                    }}
                  >
                    Payment proof submitted — moved to Payment History.
                  </div>
                )}
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
                  border: `1px solid ${histFilter === f ? "#191BA9" : "#E5E7EB"
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
          onConfirm={(method, refNo) => handlePay(payTarget, method, refNo)}
          onClose={() => setPayTarget(null)}
        />
      )}
      {payAll && (
        <BatchCheckoutModal
          items={payableToPay}
          contactPrefill={user.fb || ""}
          onSubmit={(item, method, refNo, receipt) => handlePay(item, method, refNo, receipt)}
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
