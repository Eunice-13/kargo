import { useState } from "react"
import { Check, Package, Star } from "lucide-react"
import type { FulfillmentOrder, OrderRow, SharedState } from "@/types"
import { INDIGO, CREAM, CYAN_L, SKY, GREEN, AMBER } from "@/constants/theme"
import {
  Card,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  TrackOrderModal,
  ContactSellerModal,
  BuyerProfileModal,
  ORDER_STEPS,
} from "@/components/shared"
import {
  KANBAN_COLS,
  KANBAN_COL_BG,
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentDetails,
} from "@/features/fulfillment"
import RateOrderModal from "./RateOrderModal"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

const reviewIsEditable = (createdAt?: string) =>
  Boolean(createdAt && Date.now() - new Date(createdAt).getTime() <= 24 * 60 * 60 * 1000)

export default function Orders({
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
  const [sellerRateTarget, setSellerRateTarget] = useState<FulfillmentOrder | null>(null)
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
                      {o.col === "Completed" && (
                        <div style={{ marginTop: 8 }}>
                          {o.rated ? (
                            <div className="space-y-1">
                              <span style={{ fontSize: 11, color: AMBER, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Star size={12} fill={AMBER} aria-hidden="true" /> {o.rating}/5 · Buyer rated
                                {o.reviewCreatedAt && o.reviewUpdatedAt !== o.reviewCreatedAt ? " · Edited" : ""}
                              </span>
                              {reviewIsEditable(o.reviewCreatedAt) ? (
                                <button type="button" onClick={() => setSellerRateTarget(o)} style={{ display: "block", border: "none", background: "none", color: INDIGO, fontSize: 10.5, fontWeight: 700, padding: 0, cursor: "pointer" }}>Edit review</button>
                              ) : o.reviewCreatedAt ? (
                                <span style={{ display: "block", fontSize: 9.5, color: "#9CA3AF" }}>Editing period ended</span>
                              ) : null}
                            </div>
                          ) : (
                            <PrimaryBtn size="sm" onClick={() => setSellerRateTarget(o)}>
                              Rate buyer
                            </PrimaryBtn>
                          )}
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
        {sellerRateTarget && (
          <RateOrderModal
            subjectName={sellerRateTarget.buyer}
            subjectRole="Buyer"
            initialRating={sellerRateTarget.rating ?? 5}
            initialComment={sellerRateTarget.reviewComment ?? ""}
            initialStatements={sellerRateTarget.reviewStatements ?? []}
            onRate={async (rating, comment, statements) => {
              if (isSupabaseConfigured) {
                if (!sellerRateTarget.dbId) return
                try {
                  await kargoApi.createReview(sellerRateTarget.dbId, rating, comment, statements)
                } catch (error) {
                  alert(error instanceof Error ? error.message : "Unable to submit rating.")
                  return
                }
              }
              const now = new Date().toISOString()
              setFulfillment((current) => current.map((order) =>
                order.id === sellerRateTarget.id
                  ? { ...order, rated: true, rating, reviewComment: comment, reviewStatements: statements, reviewCreatedAt: order.reviewCreatedAt ?? now, reviewUpdatedAt: now }
                  : order,
              ))
              setSellerRateTarget(null)
            }}
            onClose={() => setSellerRateTarget(null)}
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
                      {i < si ? <Check size={12} aria-hidden="true" /> : i + 1}
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
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Package size={13} aria-hidden="true" />{" "}
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
                        aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          color: star <= (myH || myR) ? AMBER : "#E5E7EB",
                          transition: "color 0.1s,transform 0.1s",
                          transform: star <= myH ? "scale(1.2)" : "scale(1)",
                        }}
                      >
                        <Star size={20} aria-hidden="true" fill={star <= (myH || myR) ? AMBER : "none"} />
                      </button>
                    ))}
                    <PrimaryBtn size="sm" onClick={() => setRateTarget(order)}>
                      Rate
                    </PrimaryBtn>
                  </div>
                )}
                {(order.rated || myR > 0) && (
                  <div>
                    <span style={{ fontSize: 12, color: AMBER, display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Star size={12} aria-hidden="true" fill={AMBER} /> {order.rating || myR}/5 Rated
                      {order.reviewCreatedAt && order.reviewUpdatedAt !== order.reviewCreatedAt ? " · Edited" : ""}
                    </span>
                    {reviewIsEditable(order.reviewCreatedAt) ? (
                      <button type="button" onClick={() => setRateTarget(order)} style={{ display: "block", marginLeft: "auto", border: "none", background: "none", color: INDIGO, fontSize: 10.5, fontWeight: 700, padding: 0, cursor: "pointer" }}>Edit review</button>
                    ) : order.reviewCreatedAt ? (
                      <span style={{ display: "block", fontSize: 9.5, color: "#9CA3AF", textAlign: "right" }}>Editing period ended</span>
                    ) : null}
                  </div>
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
          subjectName={rateTarget.seller}
          subjectRole="Seller"
          initialRating={rateTarget.rating ?? 5}
          initialComment={rateTarget.reviewComment ?? ""}
          initialStatements={rateTarget.reviewStatements ?? []}
          onRate={async (rating, comment, statements) => {
            if (isSupabaseConfigured) {
              if (!rateTarget.dbId) return
              try {
                await kargoApi.createReview(rateTarget.dbId, rating, comment, statements)
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unable to submit rating.")
                return
              }
            }
            setRatings((r) => ({ ...r, [rateTarget.id]: rating }))
            const now = new Date().toISOString()
            setOrders((prev) =>
              prev.map((o) =>
                o.id === rateTarget.id
                  ? { ...o, rated: true, rating, reviewComment: comment, reviewStatements: statements, reviewCreatedAt: o.reviewCreatedAt ?? now, reviewUpdatedAt: now }
                  : o,
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
