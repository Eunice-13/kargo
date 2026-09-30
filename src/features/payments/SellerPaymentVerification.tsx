import { useEffect, useRef, useState } from "react"
import type React from "react"
import {
  Card,
  Avatar,
  Modal,
  PrimaryBtn,
  ProductThumb,
  SecondaryBtn,
  Countdown,
  PaymentIcon,
  StatusBadge,
} from "@/components/shared"
import { Pencil, Plus, Trash2, Upload } from "lucide-react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { kargoApi } from "@/services"
import type { VerifyItem } from "./verifyTypes"
import ReviewSubmissionModal from "./ReviewSubmissionModal"
import InsufficientPaymentModal from "./InsufficientPaymentModal"
import RejectPaymentModal from "./RejectPaymentModal"
import type { SellerPaymentMethod } from "@/services"

export default function SellerPaymentVerification({
  view = "history",
  refreshData,
}: {
  view?: "pending" | "history"
  refreshData?: () => Promise<void>
}) {
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
      receipt: "receipt_gcash.jpg",
      phone: "0917-823-4410",
      amountPaid: "750",
      contact: "https://facebook.com/anna.cruz",
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
      receipt: "maya_proof.png",
      phone: "0918-554-2291",
      amountPaid: "4800",
      contact: "https://facebook.com/ben.santos",
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
      receipt: "bdo_receipt.pdf",
      phone: "0916-001-2109",
      amountPaid: "480",
      contact: "https://facebook.com/carla.reyes",
    },
  ]
  const [verifyItems, setVerifyItems] = useState<VerifyItem[]>(
    isSupabaseConfigured ? [] : VERIFY_SEED,
  )
  const [historyFilter, setHistoryFilter] =
    useState<"All" | "Paid and Reserved" | "Pending Payment">("All")
  const [reviewTarget, setReviewTarget] = useState<VerifyItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<VerifyItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectCustom, setRejectCustom] = useState("")
  const [insuffTarget, setInsuffTarget] = useState<VerifyItem | null>(null)
  const [insuffAmtPaid, setInsuffAmtPaid] = useState("")
  const [paymentMethods, setPaymentMethods] = useState<SellerPaymentMethod[]>([])
  const [methodEditor, setMethodEditor] = useState<SellerPaymentMethod | "new" | null>(null)
  const [methodType, setMethodType] = useState("GCash")
  const [methodName, setMethodName] = useState("")
  const [methodNumber, setMethodNumber] = useState("")
  const [methodQr, setMethodQr] = useState<File | undefined>()
  const [savingMethod, setSavingMethod] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    kargoApi
      .loadSellerPaymentSubmissions()
      .then(setVerifyItems)
      .catch((error) =>
        alert(
          error instanceof Error ? error.message : "Unable to load payments.",
        ),
      )
  }, [])

  const reloadPaymentMethods = () =>
    kargoApi.loadOwnPaymentMethods().then(setPaymentMethods)

  useEffect(() => {
    if (!isSupabaseConfigured || view !== "history") return
    reloadPaymentMethods()
      .catch((error) =>
        alert(
          error instanceof Error
            ? error.message
            : "Unable to load configured payment methods.",
        ),
      )
  }, [view])

  const openMethodEditor = (method?: SellerPaymentMethod) => {
    setMethodEditor(method ?? "new")
    setMethodType(method?.methodType ?? "GCash")
    setMethodName(method?.accountName ?? "")
    setMethodNumber(method?.accountNumber ?? "")
    setMethodQr(undefined)
  }

  const savePaymentMethod = async () => {
    setSavingMethod(true)
    try {
      if (methodEditor === "new") {
        await kargoApi.addPaymentMethod(
          methodType,
          methodName.trim(),
          methodNumber.trim(),
          methodQr,
        )
      } else if (methodEditor) {
        await kargoApi.updatePaymentMethod(
          methodEditor.id,
          methodType,
          methodName.trim(),
          methodNumber.trim(),
          undefined,
          methodQr,
        )
      }
      await reloadPaymentMethods()
      setMethodEditor(null)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save payment method.")
    } finally {
      setSavingMethod(false)
    }
  }

  // New buyer submissions — including resubmissions after a rejection —
  // appear without a manual reload, so reviewing a repeat submission works
  // exactly like the first one.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    const channel = supabase
      .channel("seller-payment-review-submissions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payments" },
        () => {
          kargoApi
            .loadSellerPaymentSubmissions()
            .then(setVerifyItems)
            .catch(() => {})
        },
      )
      .subscribe()
    return () => {
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [isSupabaseConfigured, supabase])

  const verifyItemsRef = useRef<VerifyItem[]>(verifyItems)
  verifyItemsRef.current = verifyItems

  const updateVerifyItems: React.Dispatch<React.SetStateAction<VerifyItem[]>> =
    (action) => {
      // Diff against the current list OUTSIDE the state updater: the updater
      // must stay pure (React may invoke it more than once), and the review
      // RPC must never fire from inside it.
      const previous = verifyItemsRef.current
      const next = typeof action === "function" ? action(previous) : action
      if (isSupabaseConfigured) {
        for (const item of next) {
          const before = previous.find(
            (candidate) => candidate.id === item.id,
          )
          if (!before) continue
          let decision: "verified" | "rejected" | null = null
          if (item.status !== before.status && item.status === "Verified")
            decision = "verified"
          if (item.status !== before.status && item.status === "Rejected")
            decision = "rejected"
          if (
            item.status === "Pending" &&
            item.rejectReason?.startsWith("Short") &&
            item.rejectReason !== before.rejectReason
          ) {
            decision = "verified"
          }
          if (decision) {
            const deadlineHours = item.rejectionDeadline
              ? Math.max(
                  0,
                  (new Date(item.rejectionDeadline).getTime() - Date.now()) /
                    3_600_000,
                )
              : undefined
            void kargoApi
              .reviewPayment(
                String(item.id),
                decision,
                item.rejectReason,
                deadlineHours,
              )
              .then(
                () => {
                  void refreshData?.().catch(() => {})
                  // Reload from the server so the list reflects the persisted
                  // state (a reload failure keeps the confirmed decision).
                  kargoApi
                    .loadSellerPaymentSubmissions()
                    .then(setVerifyItems)
                    .catch(() => {})
                },
                (error) => {
                  alert(
                    error instanceof Error
                      ? error.message
                      : "Unable to review payment.",
                  )
                  // Roll back the optimistic update so the list matches the server.
                  setVerifyItems((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id ? before : candidate,
                    ),
                  )
                },
              )
          }
        }
      }
      verifyItemsRef.current = next
      setVerifyItems(next)
    }

  const REJECT_REASONS = [
    "Wrong amount transferred",
    "Invalid proof of payment",
    "Payment method mismatch",
    "Duplicate submission",
    "Other",
  ]
  // Only the newest submission for an order represents its current payment
  // state. Older attempts remain in the database audit trail, but must not
  // produce contradictory Paid and Reserved / Pending Payment rows in the UI.
  const currentVerifyItems = [...verifyItems]
    .sort((left, right) => {
      const leftTime = left.submittedAt
        ? new Date(left.submittedAt).getTime()
        : Number(left.id) || 0
      const rightTime = right.submittedAt
        ? new Date(right.submittedAt).getTime()
        : Number(right.id) || 0
      return rightTime - leftTime
    })
    .filter((item, index, sorted) => {
      if (!item.orderId) return true
      return (
        index ===
        sorted.findIndex(
          (candidate) => String(candidate.orderId) === String(item.orderId),
        )
      )
    })
  const pendingItems = currentVerifyItems.filter((item) => item.status === "Pending")
  const historyItems = currentVerifyItems.filter((item) => item.status !== "Pending")
  const filteredHistory = historyItems.filter(
    (item) =>
      historyFilter === "All" ||
      (historyFilter === "Paid and Reserved" && item.status === "Verified") ||
      (historyFilter === "Pending Payment" && item.status === "Rejected"),
  )
  const renderTable = (items: VerifyItem[], showAmountPaid: boolean) => (
    <Card className="!p-0 overflow-hidden seller-payment-table mobile-data-page">
      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-[13px]">
          <thead style={{ background: "#6892D5" }}>
            <tr>
              {[
                "Product",
                "Buyers",
                "Method",
                "Amount",
                ...(showAmountPaid ? ["Amount Paid"] : []),
                "Date",
                "Status",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 11,
                    padding: "10px 14px",
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const paidAmount =
                item.amountPaid == null ? null : Number(item.amountPaid)
              const isShort = paidAmount != null && paidAmount < item.amount
              const displayStatus =
                item.status === "Verified"
                  ? "Paid and Reserved"
                  : item.status === "Rejected"
                    ? "Pending Payment"
                    : "Awaiting Verification"
              return (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-gray-50"
                  style={{
                    borderTop: "1px solid #E5E7EB",
                    background: index % 2 ? "#FAFAFA" : "#fff",
                  }}
                >
                  <td style={{ padding: "12px 14px" }}>
                    <div className="flex items-center gap-2">
                      <ProductThumb name={item.product} />
                      <span style={{ color: "#374151" }}>{item.product}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={item.buyer} size={22} />
                      <span style={{ fontWeight: 500, color: "#111827" }}>
                        {item.buyer}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span className="inline-flex items-center gap-1 text-[12px]">
                      <PaymentIcon method={item.method} size={15} />
                      {item.method}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px 14px",
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Josefin Sans',sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ₱{item.amount.toLocaleString()}
                  </td>
                  {showAmountPaid && (
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      {item.method === "Cash on Meetup" ? (
                        <span style={{ color: "#9CA3AF" }}>Not applicable</span>
                      ) : paidAmount == null ? (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      ) : (
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: isShort ? "#D97706" : "#111827",
                            }}
                          >
                            ₱{paidAmount.toLocaleString()}
                          </div>
                          {isShort && (
                            <div
                              style={{
                                marginTop: 2,
                                color: "#92400E",
                                fontSize: 10,
                              }}
                            >
                              Short ₱
                              {(item.amount - paidAmount).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  <td
                    style={{
                      padding: "12px 14px",
                      color: "#748391",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.date}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <StatusBadge
                      status={displayStatus}
                    />
                    {item.status === "Pending" && isShort && (
                      <div
                        style={{
                          marginTop: 4,
                          color: "#92400E",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        Awaiting balance
                      </div>
                    )}
                    {item.status === "Rejected" && item.rejectionDeadline && (
                      <div
                        style={{
                          marginTop: 4,
                          color: "#6B7280",
                          fontSize: 10,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Resubmit in{" "}
                        <Countdown
                          hours={0}
                          id={`seller-reject-${item.id}`}
                          expiresAt={item.rejectionDeadline}
                        />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      type="button"
                      onClick={() => setReviewTarget(item)}
                      style={{
                        border: "1px solid #D1D5DB",
                        borderRadius: 8,
                        background: "#fff",
                        color: "#374151",
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={showAmountPaid ? 8 : 7}
                  style={{
                    padding: "28px 12px",
                    color: "#748391",
                    textAlign: "center",
                    fontSize: 12,
                  }}
                >
                  {showAmountPaid
                    ? "No payments awaiting review."
                    : "No payment history for this status."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )

  return (
    <div className="p-6 space-y-8">
      {view === "pending" && (
        <section>
          <div className="mb-4">
            <h2
              style={{
                fontFamily: "'Josefin Sans',sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Pending Payment Review
            </h2>
            <p style={{ marginTop: 2, color: "#9CA3AF", fontSize: 13 }}>
              Approve, reject, inspect receipts, or notify buyers from one review flow.
            </p>
          </div>
          {renderTable(pendingItems, true)}
        </section>
      )}

      {view === "history" && (
      <>
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            style={{
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Payment Methods
          </h2>
          <PrimaryBtn
            size="sm"
            onClick={() => openMethodEditor()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 36,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            <Plus size={14} aria-hidden="true" /> Add Payment Method
          </PrimaryBtn>
        </div>
        <Card>
          {paymentMethods.length > 0 ? (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 350px), 425px))",
                columnGap: 36,
                rowGap: 16,
                justifyContent: "start",
              }}
            >
              {paymentMethods.map((method) => (
                <div
                  key={`${method.methodType}-${method.accountNumber ?? "cash"}`}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 10,
                    minHeight: 84,
                    padding: "16px 20px",
                    background: "#fff",
                    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.10)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "#111827", flex: 1 }}>
                      <PaymentIcon method={method.methodType} size={20} />
                      <div>
                        <div>{method.methodType}</div>
                        {(method.accountName || method.accountNumber) && (
                          <div style={{ marginTop: 3, color: "#9CA3AF", fontSize: 10.5, fontWeight: 500 }}>
                            {[method.accountName, method.accountNumber].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <button type="button" aria-label={`Edit ${method.methodType}`} onClick={() => openMethodEditor(method)} style={{ border: 0, background: "transparent", color: "#6B7280", cursor: "pointer", padding: 4 }}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" aria-label={`Delete ${method.methodType}`} onClick={async () => {
                      if (!window.confirm(`Delete ${method.methodType}?`)) return
                      try {
                        await kargoApi.deactivatePaymentMethod(method.id)
                        await reloadPaymentMethods()
                      } catch (error) {
                        alert(error instanceof Error ? error.message : "Unable to delete payment method.")
                      }
                    }} style={{ border: 0, background: "transparent", color: "#E11D48", cursor: "pointer", padding: 4 }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#748391", fontSize: 12 }}>
              No payment methods are configured in seller settings.
            </div>
          )}
        </Card>
      </section>

      <section>
        <h2
          className="mb-4"
          style={{
            fontFamily: "'Josefin Sans',sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Payment History
        </h2>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              marginRight: 2,
              color: "#374151",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Filter:
          </span>
          {(["All", "Paid and Reserved", "Pending Payment"] as const).map((filter) => {
            const count =
              filter === "All"
                ? historyItems.length
                : historyItems.filter((item) =>
                    filter === "Paid and Reserved"
                      ? item.status === "Verified"
                      : item.status === "Rejected",
                  ).length
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
                aria-pressed={historyFilter === filter}
                style={{
                  border: `1px solid ${
                    historyFilter === filter ? "#191BA9" : "#E5E7EB"
                  }`,
                  borderRadius: 999,
                  background: historyFilter === filter ? "#191BA9" : "#fff",
                  color: historyFilter === filter ? "#fff" : "#374151",
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {filter} ({count})
              </button>
            )
          })}
        </div>
        {renderTable(filteredHistory, false)}
      </section>
      </>
      )}

      {methodEditor && (
        <Modal
          title={methodEditor === "new" ? "Add Payment Method" : "Edit Payment Method"}
          onClose={() => !savingMethod && setMethodEditor(null)}
          width={440}
        >
          <div className="space-y-4">
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151" }}>
              Method
              <select value={methodType} onChange={(event) => setMethodType(event.target.value)} style={{ display: "block", width: "100%", marginTop: 5, border: "1px solid #E5E7EB", borderRadius: 7, padding: "9px 10px", background: "#fff" }}>
                {["GCash", "Maya", "Bank Transfer", "Cash on Meetup", "Cash on Delivery", "Others"].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151" }}>
              Account Name
              <input value={methodName} onChange={(event) => setMethodName(event.target.value)} style={{ display: "block", width: "100%", marginTop: 5, border: "1px solid #E5E7EB", borderRadius: 7, padding: "9px 10px", boxSizing: "border-box" }} />
            </label>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151" }}>
              Account Number / Instructions
              <input value={methodNumber} onChange={(event) => setMethodNumber(event.target.value)} style={{ display: "block", width: "100%", marginTop: 5, border: "1px solid #E5E7EB", borderRadius: 7, padding: "9px 10px", boxSizing: "border-box" }} />
            </label>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              <div>QR image (optional)</div>
              <label
                htmlFor="payment-method-qr"
                className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-xs font-semibold text-gray-500 transition-colors hover:border-[#191BA9] hover:text-[#191BA9]"
              >
                <Upload size={16} aria-hidden="true" />
                <span>{methodQr ? methodQr.name : "Upload Image"}</span>
                <input
                  id="payment-method-qr"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setMethodQr(event.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <SecondaryBtn onClick={() => setMethodEditor(null)} disabled={savingMethod}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={savePaymentMethod} disabled={savingMethod}>{savingMethod ? "Saving…" : "Save Method"}</PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* Review submission modal */}
      {reviewTarget && (
        <ReviewSubmissionModal
          reviewTarget={reviewTarget}
          setReviewTarget={setReviewTarget}
          setVerifyItems={updateVerifyItems}
          setRejectTarget={setRejectTarget}
          setRejectReason={setRejectReason}
          setRejectCustom={setRejectCustom}
          onNotifyBuyer={async (item) => {
            if (item.status === "Rejected") {
              if (isSupabaseConfigured) {
                await kargoApi.notifyPaymentResubmission(String(item.id))
              }
              setVerifyItems((items) =>
                items.map((candidate) =>
                  candidate.id === item.id
                    ? { ...candidate, buyerNotified: true }
                    : candidate,
                ),
              )
              setReviewTarget((current) =>
                current?.id === item.id
                  ? { ...current, buyerNotified: true }
                  : current,
              )
              return
            }
            setInsuffTarget(item)
            setInsuffAmtPaid(item.amountPaid || "")
            setReviewTarget(null)
          }}
          onMarkPaid={(item) => {
            updateVerifyItems((items) =>
              items.map((candidate) =>
                candidate.id === item.id
                  ? { ...candidate, status: "Verified" as const }
                  : candidate,
              ),
            )
            setReviewTarget(null)
          }}
        />
      )}

      {/* Insufficient Payment modal */}
      {insuffTarget && (
        <InsufficientPaymentModal
          insuffTarget={insuffTarget}
          setInsuffTarget={setInsuffTarget}
          insuffAmtPaid={insuffAmtPaid}
          setInsuffAmtPaid={setInsuffAmtPaid}
          setVerifyItems={updateVerifyItems}
        />
      )}

      {/* Reject with reason modal */}
      {rejectTarget && (
        <RejectPaymentModal
          rejectTarget={rejectTarget}
          setRejectTarget={setRejectTarget}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          rejectCustom={rejectCustom}
          setRejectCustom={setRejectCustom}
          setInsuffTarget={setInsuffTarget}
          setInsuffAmtPaid={setInsuffAmtPaid}
          setVerifyItems={updateVerifyItems}
          REJECT_REASONS={REJECT_REASONS}
        />
      )}
    </div>
  )
}
