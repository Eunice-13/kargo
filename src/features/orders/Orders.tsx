import { TransactionDetailModal } from "@/features/payments"
import { useState } from "react"
import type { OrderRow, PayHistRow, SharedState } from "@/types"
import { INDIGO, CREAM, GREEN } from "@/constants/theme"
import {
  Card,
  Modal,
  SecondaryBtn,
  SH,
  Avatar,
  ContactModal,
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
  payHistory,
  role,
  fulfillment,
  setFulfillment,
}: SharedState) {
  const board = useFulfillmentBoard(setFulfillment)
  const [contactOrder, setContact] = useState<OrderRow | null>(null)

  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [detailPayment, setDetailPayment] = useState<PayHistRow | null>(null)
  const detailOrder = orders.find((order) => order.id === detailOrderId)
  const orderPayments = detailOrder
    ? payHistory.filter((payment) => payment.orderId === (detailOrder.dbId ?? detailOrder.id))
    : []

  if (role === "Seller") {
    return (
      <div className="p-6 orders-page orders-page--seller">
        <SH title="Fulfillment Board" />
        <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: -8, marginBottom: 20 }}>
          Track all orders across fulfillment stages.
        </p>
        <div
          className="orders-board"
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
                className="orders-board-column"
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
    <div className="p-6 space-y-5 orders-page orders-page--buyer">
      {orders.map((order) => {
        return (
          <Card key={order.id} className="buyer-order-card">
            <div className="flex items-start justify-between mb-4 buyer-order-card__head">
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

            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2">
                <SecondaryBtn onClick={() => setDetailOrderId(order.id)}>
                  View Details
                </SecondaryBtn>
                <SecondaryBtn onClick={() => setContact(order)}>
                  Contact Seller
                </SecondaryBtn>
              </div>
            </div>
          </Card>
        )
      })}
      {detailOrder && !detailPayment && (
        <Modal title="Order Details" onClose={() => setDetailOrderId(null)} width={480}>
          <dl className="space-y-3">
            {[
              ["Order ID", detailOrder.id],
              ["Product", detailOrder.product],
              ["Batch", detailOrder.batch || "—"],
              ["Seller", detailOrder.seller],
              ["Total", `₱${detailOrder.amount.toLocaleString()}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-gray-100 pb-2 text-sm">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-right font-semibold break-words min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">Payment records</h3>
            {orderPayments.length === 0 ? (
              <p className="text-sm text-gray-500">No payment records for this order yet.</p>
            ) : orderPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{payment.date} · ₱{payment.amount.toLocaleString()} · {payment.status}</span>
                <SecondaryBtn onClick={() => setDetailPayment(payment)}>View payment</SecondaryBtn>
              </div>
            ))}
            <SecondaryBtn onClick={() => setDetailOrderId(null)}>Close</SecondaryBtn>
          </div>
        </Modal>
      )}
      {detailPayment && (
        <TransactionDetailModal tx={detailPayment} onClose={() => setDetailPayment(null)} />
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
