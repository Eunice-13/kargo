import { useState } from "react"
import type { FulfillmentOrder } from "@/types"
import { KANBAN_COLS, type KanbanCol } from "@/constants/fulfillment"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

export default function FulfillmentDetails({
  order,
  onMove,
}: {
  order: FulfillmentOrder
  onMove: (order: FulfillmentOrder, col: KanbanCol) => void
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const selectId = `fulfillment-status-${order.id}`
  return (
    <div
      style={{
        background: "#F9FAFB",
        borderTop: "1px solid #E5E7EB",
        padding: "10px 12px",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>
        Qty: ×{order.qty} · Amount: ₱{order.amount.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: "#374151", marginBottom: 8 }}>
        Buyer: {order.buyer}
      </div>
      <label htmlFor={selectId} className="sr-only">
        Change status for {order.buyer}, {order.product}
      </label>
      <select
        id={selectId}
        value={order.col}
        onChange={(e) => {
          const next = e.target.value as KanbanCol
          if (next === "Cancelled") setConfirmCancel(true)
          else if (next === "Completed") setConfirmComplete(true)
          else onMove(order, next)
        }}
        style={{
          width: "100%",
          fontSize: 12,
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "5px 8px",
          background: "#fff",
          outline: "none",
          color: "#374151",
        }}
      >
        {KANBAN_COLS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {confirmCancel && (
        <Modal
          title="Cancel this order?"
          onClose={() => setConfirmCancel(false)}
          width={420}
        >
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
            Moving {order.product} for {order.buyer} to Cancelled ends this
            order. You can move it back to another status later if this was a
            mistake.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <SecondaryBtn onClick={() => setConfirmCancel(false)}>
              Keep order
            </SecondaryBtn>
            <PrimaryBtn
              onClick={() => {
                setConfirmCancel(false)
                onMove(order, "Cancelled")
              }}
            >
              Move to Cancelled
            </PrimaryBtn>
          </div>
        </Modal>
      )}
    </div>
  )
}
