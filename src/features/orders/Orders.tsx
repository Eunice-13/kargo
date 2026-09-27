import { useState } from "react"
import { Check, Package } from "lucide-react"
import type { FulfillmentOrder, OrderRow, SharedState } from "@/types"
import { INDIGO, CREAM, CYAN_L, SKY, GREEN } from "@/constants/theme"
import {
  Card,
  SecondaryBtn,
  SH,
  Avatar,
  TrackOrderModal,
  ContactModal,
  ORDER_STEPS,
} from "@/components/shared"
import {
  KANBAN_COLS,
  KANBAN_COL_BG,
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentDetails,
} from "@/features/fulfillment"

export default function Orders({
  orders,
  setOrders,
  role,
  fulfillment,
  setFulfillment,
}: SharedState) {
  const board = useFulfillmentBoard(setFulfillment)
  const [trackOrder, setTrackOrder] = useState<OrderRow | null>(null)
  const [contactOrder, setContact] = useState<OrderRow | null>(null)

  if (role === "Seller") {
    return (
      <div className="p-6">
        <SH title="Fulfillment Board" />
        <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: -8, marginBottom: 20 }}>
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
                        <span
                          style={{
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
                        </span>
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
                            color: GREEN,
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: "'Josefin Sans',sans-serif",
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
        return (
          <Card key={order.id}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    style={{
                      fontFamily: "'Josefin Sans',sans-serif",
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
                  fontFamily: "'Josefin Sans',sans-serif",
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
        <ContactModal
          name={contactOrder.seller}
          context={contactOrder.product}
          contactUrl={contactOrder.sellerFb}
          onClose={() => setContact(null)}
        />
      )}
    </div>
  )
}
