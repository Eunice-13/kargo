import { useEffect, useState, useRef } from "react"
import { CheckCircle2, Paperclip, Clock3 } from "lucide-react"
import type { ToPayRow, PayHistRow, OrderRow, ClaimStatus, SharedState, EntityId } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import {
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  ProductThumb,
  StatusBadge,
  Countdown,
  PaymentSuccessToast,
  PaymentIcon,
  PaymentMethodCard,
} from "@/components/shared"
import PaymentSubmitModal from "./PaymentSubmitModal"
import type { PaymentSubmissionDetails } from "./PaymentSubmitModal"
import BatchCheckoutModal from "./BatchCheckoutModal"
import TransactionDetailModal from "./TransactionDetailModal"
import SellerPaymentVerification from "./SellerPaymentVerification"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { kargoApi } from "@/services"
import { deadlineHasPassed } from "@/features/claims/claimExpiry"
import { BUYER_METHOD_CATALOG, METHOD_COLORS } from "./buyerPaymentMethods"
import type { BuyerMethodType, BuyerPaymentMethod } from "./buyerPaymentMethods"
import type { PayMethod } from "./paymentMethodTypes"
import AddPaymentMethodModal from "./AddPaymentMethodModal"
import EditPaymentMethodModal from "./EditPaymentMethodModal"
import RemovePaymentMethodModal from "./RemovePaymentMethodModal"

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
  refreshData,
}: SharedState) {
  const [dragging, setDragging] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [proofClaimId, setProofClaimId] = useState<EntityId | "">("")
  const [proofToast, setProofToast] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [payTarget, setPayTarget] = useState<ToPayRow | null>(null)
  const [payAll, setPayAll] = useState(false)
  const [histFilter, setHistFilter] =
    useState<"All" | "Paid and Reserved" | "Rejected" | "Cancelled">("All")
  const [txDetail, setTxDetail] = useState<PayHistRow | null>(null)
  const [buyerMethods, setBuyerMethods] = useState<BuyerPaymentMethod[]>(() =>
    BUYER_METHOD_CATALOG.filter((method) => method === "GCash" || method === "Maya").map((type, index) => ({
      id: index + 1,
      type,
      detail: index === 0 ? "0917-555-8821" : "0918-555-5543",
      accountName: user.name,
    })),
  )
  const [showAddPM, setShowAddPM] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<PayMethod | null>(null)
  const [editTarget, setEditTarget] = useState<PayMethod | null>(null)
  const [pmType, setPmType] = useState<BuyerMethodType>("GCash")
  const [pmName, setPmName] = useState(user.name)
  const [pmNum, setPmNum] = useState("")
  const [pmQr, setPmQr] = useState<File | null>(null)
  const [editName, setEditName] = useState("")
  const [editNum, setEditNum] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const payableToPay = toPay.filter((item) => !deadlineHasPassed(item))

  const saveBuyerMethod = () => {
    if (!BUYER_METHOD_CATALOG.includes(pmType)) return
    setBuyerMethods((methods) => [
      ...methods,
      {
        id: Date.now(),
        type: pmType,
        detail: pmNum.trim(),
        accountName: pmName.trim(),
      },
    ])
    setPmName(user.name)
    setPmNum("")
    setPmQr(null)
    setShowAddPM(false)
  }

  const openBuyerMethodEdit = (method: BuyerPaymentMethod) => {
    setEditTarget({
      id: method.id,
      name: method.type,
      detail: method.detail,
      icon: "",
      verified: true,
    })
    setEditName(method.accountName ?? user.name)
    setEditNum(method.detail)
  }

  const saveBuyerMethodEdit = () => {
    if (!editTarget) return
    setBuyerMethods((methods) => methods.map((method) => method.id === editTarget.id
      ? { ...method, accountName: editName.trim(), detail: editNum.trim() }
      : method))
    setEditTarget(null)
  }

  const removeBuyerMethod = () => {
    if (!removeTarget) return
    setBuyerMethods((methods) => methods.filter((method) => method.id !== removeTarget.id))
    setRemoveTarget(null)
  }

  useEffect(() => {
    if (!isSupabaseConfigured || role !== "Buyer") return
    const refresh = () => void refreshData().catch(() => { })
    refresh()
    const refreshOnFocus = () => refresh()
    window.addEventListener("focus", refreshOnFocus)
    const channel = user.id && supabase
      ? supabase
        .channel(`buyer-payment-history-${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "payments", filter: `submitted_by=eq.${user.id}` },
          refresh,
        )
        .subscribe()
      : null
    return () => {
      window.removeEventListener("focus", refreshOnFocus)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [refreshData, role, user.id])

  useEffect(() => {
    if (payTarget && deadlineHasPassed(payTarget)) setPayTarget(null)
    if (payableToPay.length === 0) setPayAll(false)
  }, [payTarget, payableToPay.length])

  useEffect(() => {
    if (!paymentSuccess) return
    const timer = window.setTimeout(() => setPaymentSuccess(false), 6000)
    return () => window.clearTimeout(timer)
  }, [paymentSuccess])

  const handleFilePick = (file: File) => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(file.name)
      setUploadedFile(file)
    }, 1200)
  }

  const handlePay = async (
    item: ToPayRow | null,
    method: string,
    referenceNumber?: string,
    receipt?: File,
    details?: PaymentSubmissionDetails,
  ) => {
    const targets = (item ? [item] : payableToPay).filter((target) => !deadlineHasPassed(target))
    if (targets.length === 0) {
      setPayTarget(null)
      setPayAll(false)
      alert("This claim has expired and can no longer be paid.")
      return false
    }
    if (isSupabaseConfigured) {
      try {
        for (const target of targets) {
          const orderId = target.orderId ?? String(target.id)
          await kargoApi.submitPayment({
            orderId,
            method,
            amount: details?.amountPaid ?? target.amount,
            referenceNumber,
            receipt,
            payerAccountName: details?.payerAccountName,
            payerPhone: details?.payerPhone,
            buyerContactUrl: details?.buyerContactUrl,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to submit payment."
        // Re-sync on ANY failure so a stale snapshot can't drive a second
        // doomed submit (the "fails every other time" bug), then close the
        // modal so the reused stale targets can't be resubmitted.
        await refreshData()
        setPayTarget(null)
        setPayAll(false)
        if (message === "Order is not payable") {
          alert("This order already has a submitted payment or is no longer payable. Your payment data has been refreshed.")
        } else {
          alert(message)
        }
        return false
      }
      await refreshData()
      setPayTarget(null)
      setPayAll(false)
      setPaymentSuccess(true)
      return true
    }
    const newHist: PayHistRow[] = targets.map((t, i) => ({
      id: payHistory.length + i + 1,
      product: t.product,
      batch: "",
      method,
      amount: details?.amountPaid ?? t.amount,
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
    setPaymentSuccess(true)
    return true
  }

  // Submit an uploaded receipt against a chosen "To Pay" item: record it as a
  // manual bank/receipt payment (reusing the same flow as Pay Now) and reset.
  const handleSubmitProof = async () => {
    const item = payableToPay.find((t) => t.id === proofClaimId)
    if (!item) return
    const submitted = await handlePay(item, "Receipt Upload", undefined, uploadedFile ?? undefined)
    if (!submitted) return
    setUploaded(null)
    setUploadedFile(null)
    setProofClaimId("")
    setProofToast(true)
    setTimeout(() => setProofToast(false), 2400)
  }

  if (role === "Seller") return <SellerPaymentVerification />

  return (
    <div className="p-6 space-y-8">
      <section>
        <SH
          title="Payment Methods"
          action={
            <PrimaryBtn size="sm" onClick={() => setShowAddPM(true)}>
              + Add Payment Method
            </PrimaryBtn>
          }
        />
        <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {buyerMethods.map((method) => {
            const color = METHOD_COLORS[method.type] ?? "#4B5563"
            return (
              <PaymentMethodCard
                key={method.id}
                name={method.type}
                detail={method.detail}
                color={color}
                onEdit={() => openBuyerMethodEdit(method)}
                onDelete={() => setRemoveTarget({
                  id: method.id,
                  name: method.type,
                  detail: method.detail,
                  icon: "",
                  verified: true,
                })}
                deleteDisabled={buyerMethods.length <= 1}
                deleteTitle={buyerMethods.length <= 1 ? "Keep at least one payment method" : undefined}
              />
            )
          })}
        </div>
      </section>
      <div className="hidden" aria-hidden="true">
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
                    fontFamily: "'Josefin Sans',sans-serif",
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
                      fontFamily: "'Josefin Sans',sans-serif",
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
          {(["All", "Paid and Reserved", "Rejected", "Cancelled"] as const).map(
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
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ),
          )}
        </div>
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
            <table className="buyer-payment-history w-full text-[12px]">
              <thead style={{ background: "#5D87D1" }}>
                <tr>
                  {[
                    "Product",
                    "Buyers",
                    "Method",
                    "Amount",
                    "Date",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: 10,
                        padding: "8px 10px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.04em",
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
                    return true
                  })
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <ProductThumb name={p.product} />
                          <span className="font-semibold text-[#111827]">{p.product}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <Avatar name={user.name} size={18} />
                          <span className="text-[11px] text-[#526170]">{user.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#526170]">
                          <PaymentIcon method={p.method} size={15} />
                          {p.method}
                        </span>
                      </td>
                      <td className="whitespace-nowrap font-bold text-[#111827]">
                        ₱{p.amount.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap text-[11px] text-[#748391]">{p.date}</td>
                      <td>
                        <StatusBadge status={p.status} />
                        {p.status === "Rejected" && p.rejectionDeadline && (
                          <div style={{ fontSize: 10, color: "#6B7280", marginTop: 4, whiteSpace: "nowrap" }}>
                            Resubmit in <Countdown hours={0} id={`buyer-reject-${p.id}`} expiresAt={p.rejectionDeadline} />
                          </div>
                        )}
                      </td>
                      <td>
                        <SecondaryBtn size="sm" onClick={() => setTxDetail(p)}>
                          View Details
                        </SecondaryBtn>
                      </td>
                    </tr>
                  ))}
                {payHistory.filter((history) => histFilter === "All" || history.status === histFilter).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#748391]">
                      No payment history for this status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {payTarget && (
        <PaymentSubmitModal
          item={payTarget}
          contactPrefill={user.fb || ""}
          onConfirm={(method, refNo, receipt, paymentDetails) =>
            handlePay(payTarget, method, refNo, receipt, paymentDetails)
          }
          onClose={() => setPayTarget(null)}
        />
      )}
      {payAll && (
        <BatchCheckoutModal
          items={payableToPay}
          contactPrefill={user.fb || ""}
          onSubmit={(item, method, refNo, receipt, paymentDetails) =>
            handlePay(item, method, refNo, receipt, paymentDetails)
          }
          onClose={() => setPayAll(false)}
        />
      )}
      {txDetail && (
        <TransactionDetailModal
          tx={txDetail}
          onClose={() => setTxDetail(null)}
        />
      )}
      {showAddPM && (
        <AddPaymentMethodModal
          pmType={pmType}
          setPmType={(value) => {
            const method = BUYER_METHOD_CATALOG.find((candidate) => candidate === value)
            if (method) setPmType(method)
          }}
          pmName={pmName}
          setPmName={setPmName}
          pmNum={pmNum}
          setPmNum={setPmNum}
          pmQr={pmQr}
          setPmQr={setPmQr}
          pmLoading={false}
          addPayMethod={saveBuyerMethod}
          setShowAddPM={setShowAddPM}
        />
      )}
      {editTarget && (
        <EditPaymentMethodModal
          editTarget={editTarget}
          editName={editName}
          setEditName={setEditName}
          editNum={editNum}
          setEditNum={setEditNum}
          pmLoading={false}
          saveEdit={saveBuyerMethodEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {removeTarget && (
        <RemovePaymentMethodModal
          removeTarget={removeTarget}
          setRemoveTarget={setRemoveTarget}
          confirmRemove={removeBuyerMethod}
          isLastMethod={buyerMethods.length <= 1}
        />
      )}
      {paymentSuccess && <PaymentSuccessToast onClose={() => setPaymentSuccess(false)} />}

    </div>
  )
}
