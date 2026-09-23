import { useEffect, useState } from "react"
import { List, LayoutGrid, AlertTriangle, Link2 } from "lucide-react"
import type { ClaimRow, OrderRow, PayHistRow, ClaimStatus, SharedState } from "@/types"
import { INDIGO, CREAM, TODAY } from "@/constants/theme"
import {
  Modal,
  Card,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  ProductThumb,
  StatusBadge,
  Countdown,
  TrackOrderModal,
  BuyerProfileModal,
  ExtensionRequestModal,
} from "@/components/shared"
import { PaymentSubmitModal } from "@/features/payments"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import { claimIsPayable } from "./claimExpiry"

export default function MyClaims({
  claims,
  setClaims,
  toPay,
  setToPay,
  payHistory,
  setPayHistory,
  orders,
  setOrders,
  batches,
  setBatches,
  user,
  role,
}: SharedState) {
  const [filter, setFilter] = useState<ClaimStatus | "All">("All")
  const [payTarget, setPayTarget] = useState<ClaimRow | null>(null)
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null)
  const [extTarget, setExtTarget] = useState<ClaimRow | null>(null)
  // Transient confirmation that an extension request was sent to the seller
  // (#Task, buyer toast) — shown alongside the persistent "Extension Requested" badge.
  const [extToast, setExtToast] = useState(false)
  const [contact, setContact] = useState<ClaimRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ClaimRow | null>(null)
  const [orderFilter, setOrderFilter] = useState<ClaimStatus | "All">("All")
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  useEffect(() => {
    if (!payTarget) return
    const current = claims.find((claim) => claim.id === payTarget.id)
    if (!current || !claimIsPayable(current)) setPayTarget(null)
  }, [claims, payTarget])
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
    const [shipTarget, setShipTarget] = useState<ClaimRow | null>(null)
    const confirmShip = () => {
      if (!shipTarget) return
      setClaims((prev) =>
        prev.map((cl) =>
          cl.id === shipTarget.id
            ? { ...cl, status: "Paid and Reserved" as ClaimStatus }
            : cl,
        ),
      )
      setShipTarget(null)
    }
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
            <Link2 size={15} aria-hidden="true" /> Opening {fbToast}'s Facebook profile…
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
                      <Avatar name={c.buyer || c.seller} size={22} />
                      <button
                        onClick={() => setBuyerProfile(c.buyer || c.seller)}
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
                        {c.buyer || c.seller}
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
                      <Countdown hours={c.hours} expiresAt={c.expiresAt} />
                    ) : (
                      <span style={{ color: "#D1D5DB" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-1.5">
                      {c.status === "Pending" && (
                        <PrimaryBtn size="sm" onClick={() => setShipTarget(c)}>
                          Mark Shipped
                        </PrimaryBtn>
                      )}
                      <SecondaryBtn
                        size="sm"
                        onClick={() => {
                          const buyerName = c.buyer || c.seller
                          if (c.buyerFb) {
                            // Real contact link on file — open it.
                            setFbToast(buyerName)
                            setTimeout(() => {
                              window.open(
                                c.buyerFb,
                                "_blank",
                                "noopener,noreferrer",
                              )
                              setFbToast(null)
                            }, 1200)
                          } else {
                            // No contact link — open the buyer's profile instead
                            // of fabricating a Facebook URL.
                            setBuyerProfile(buyerName)
                          }
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
        {shipTarget && (
          <Modal
            title="Mark this as shipped?"
            onClose={() => setShipTarget(null)}
            width={420}
          >
            <p style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
              Are you sure you want to mark {shipTarget.product} for{" "}
              {shipTarget.buyer || "this buyer"} as shipped?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <SecondaryBtn onClick={() => setShipTarget(null)}>
                Not yet
              </SecondaryBtn>
              <PrimaryBtn onClick={confirmShip}>Yes, mark shipped</PrimaryBtn>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  const handlePay = async (method: string, refNo: string, receipt?: File) => {
    if (!payTarget) return
    const currentClaim = claims.find((claim) => claim.id === payTarget.id)
    if (!currentClaim || !claimIsPayable(currentClaim)) {
      setPayTarget(null)
      alert("This claim has expired and can no longer be paid.")
      return
    }
    if (isSupabaseConfigured) {
      try {
        await kargoApi.submitPayment({
          orderId: String(payTarget.id),
          method,
          amount: payTarget.amount,
          referenceNumber: refNo,
          receipt,
        })
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to submit payment.")
        return
      }
    }
    const newHist: PayHistRow = {
      id: payHistory.length + 1,
      product: payTarget.product,
      batch: payTarget.batch,
      method,
      amount: payTarget.amount,
      date: TODAY,
      status: isSupabaseConfigured ? "Pending" : "Paid and Reserved",
    }
    setPayHistory((h) => [newHist, ...h])
    if (!isSupabaseConfigured) setClaims((prev) =>
      prev.map((c) =>
        c.id === payTarget.id
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    if (!isSupabaseConfigured) setToPay((prev) => prev.filter((t) => t.product !== payTarget.product))
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
    if (!isSupabaseConfigured) setOrders((prev) => [newOrder, ...prev])
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {m === "table" ? (
                  <><List size={13} aria-hidden="true" /> Table</>
                ) : (
                  <><LayoutGrid size={13} aria-hidden="true" /> Cards</>
                )}
              </span>
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
                    <Countdown hours={c.hours} expiresAt={c.expiresAt} />
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
                    {claimIsPayable(c) && (
                      <PrimaryBtn size="sm" onClick={() => claimIsPayable(c) && setPayTarget(c)}>
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
                      <Countdown hours={c.hours} expiresAt={c.expiresAt} />
                    ) : (
                      <span style={{ color: "#D1D5DB" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {claimIsPayable(c) && (
                        <PrimaryBtn size="sm" onClick={() => claimIsPayable(c) && setPayTarget(c)}>
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
        <PaymentSubmitModal
          item={{
            id: payTarget.id,
            orderId: String(payTarget.id),
            product: payTarget.product,
            seller: payTarget.seller,
            sellerId: payTarget.sellerId,
            qty: payTarget.qty,
            amount: payTarget.amount,
            hours: payTarget.hours,
          }}
          contactPrefill={user.fb || ""}
          onConfirm={(method, refNo, receipt) => handlePay(method, refNo, receipt)}
          onClose={() => setPayTarget(null)}
        />
      )}
      {viewOrder && (
        <TrackOrderModal order={viewOrder} onClose={() => setViewOrder(null)} />
      )}
      {extTarget && (
        <ExtensionRequestModal
          claim={extTarget}
          onSubmit={async (hours, reason) => {
            if (isSupabaseConfigured) {
              try {
                await kargoApi.requestOrderExtension(String(extTarget.id), hours, reason)
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unable to request extension.")
                return
              }
            }
            setClaims((prev) =>
              prev.map((c) =>
                c.id === extTarget.id ? { ...c, extensionRequested: true } : c,
              ),
            )
            setExtTarget(null)
            setExtToast(true)
            setTimeout(() => setExtToast(false), 2600)
          }}
          onClose={() => setExtTarget(null)}
        />
      )}
      {extToast && (
        <div
          className="fi"
          role="status"
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#065F46",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 16px",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 2000,
          }}
        >
          Extension request sent to the seller.
        </div>
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
                  <AlertTriangle size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
                  This item has already been paid. A refund will be processed
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
                onClick={async () => {
                  if (isSupabaseConfigured) {
                    try {
                      await kargoApi.cancelOrder(String(cancelTarget.id))
                    } catch (error) {
                      alert(error instanceof Error ? error.message : "Unable to cancel order.")
                      return
                    }
                  }
                  const releasedQty = Math.max(1, cancelTarget.qty || 1)
                  setClaims((prev) =>
                    prev.map((c) =>
                      c.id === cancelTarget.id
                        ? { ...c, status: "Cancelled" as ClaimStatus }
                        : c,
                    ),
                  )
                  // Return the reserved stock to the batch/product so the slots
                  // free up immediately for other buyers.
                  setBatches((prev) =>
                    prev.map((bt) => {
                      const hasProduct = bt.products.some(
                        (p) =>
                          (cancelTarget.productId && p.dbId === cancelTarget.productId) ||
                          (p.name === cancelTarget.product && bt.title === cancelTarget.batch),
                      )
                      if (!hasProduct) return bt
                      return {
                        ...bt,
                        claimed: Math.max(0, bt.claimed - releasedQty),
                        products: bt.products.map((p) =>
                          (cancelTarget.productId && p.dbId === cancelTarget.productId) ||
                          (p.name === cancelTarget.product && bt.title === cancelTarget.batch)
                            ? { ...p, claimed: Math.max(0, p.claimed - releasedQty) }
                            : p,
                        ),
                      }
                    }),
                  )
                  // Drop any outstanding "to pay" entry for the cancelled claim.
                  // A claim's id equals its order id, which is what toPay.orderId
                  // stores in Supabase mode; fall back to product name for demo rows.
                  setToPay((prev) =>
                    prev.filter(
                      (t) =>
                        !(
                          t.orderId === String(cancelTarget.id) ||
                          t.product === cancelTarget.product
                        ),
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
