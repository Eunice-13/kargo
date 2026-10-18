import { useState } from "react"
import type { FulfillmentOrder } from "@/types"
import { SELLER_COLUMNS, type SellerColumn } from "@/constants/fulfillment"
import {
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  StageProgress,
  SummaryBlock,
} from "@/components/shared"
import TrackingDetailsModal, {
  type TrackingDetailsInput,
} from "./TrackingDetailsModal"

export default function FulfillmentDetails({
  order,
  onMove,
  onSaveTracking,
}: {
  order: FulfillmentOrder
  onMove: (order: FulfillmentOrder, col: SellerColumn) => void
  onSaveTracking: (
    order: FulfillmentOrder,
    tracking: TrackingDetailsInput,
  ) => void | Promise<void>
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmShip, setConfirmShip] = useState(false)
  const [showTracking, setShowTracking] = useState(false)
  const [shipAfterTracking, setShipAfterTracking] = useState(false)
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
      <SummaryBlock
        title={order.product}
        product={order.product}
        details={[
          `Buyer: ${order.buyer} · ×${order.qty}`,
          `₱${order.amount.toLocaleString()}`,
        ]}
      />
      <StageProgress stages={SELLER_COLUMNS} current={order.col} compact />
      <label htmlFor={selectId} className="sr-only">
        Change status for {order.buyer}, {order.product}
      </label>
      <select
        id={selectId}
        value={order.col}
        onChange={(e) => {
          const next = e.target.value as SellerColumn
          if (next === "Cancelled") setConfirmCancel(true)
          else if (next === "Delivered") setConfirmComplete(true)
          else if (next === "Shipped") setConfirmShip(true)
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
        {SELLER_COLUMNS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {(order.col === "Shipped" || order.trackingNumber) && (
        <button
          type="button"
          onClick={() => setShowTracking(true)}
          style={{
            marginTop: 8,
            width: "100%",
            border: "1px solid #D1D5DB",
            borderRadius: 6,
            background: "#fff",
            padding: "6px 8px",
            color: "#191BA9",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {order.trackingNumber
            ? "Edit tracking details"
            : "Add tracking details"}
        </button>
      )}
      {confirmCancel && (
        <Modal
          title="Cancel this order?"
          onClose={() => setConfirmCancel(false)}
          width={420}
        >
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
            This ends {order.product} for {order.buyer}. You can restore its
            status later if needed.
          </p>
          <div className="kargo-modal-actions">
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
      {confirmComplete && (
        <Modal
          title="Mark this order as delivered?"
          onClose={() => setConfirmComplete(false)}
          width={420}
        >
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
            This finalizes {order.product} for {order.buyer} and counts it
            toward your fulfilled total. You can change it later if needed.
          </p>
          <div className="kargo-modal-actions">
            <SecondaryBtn onClick={() => setConfirmComplete(false)}>
              Not yet
            </SecondaryBtn>
            <PrimaryBtn
              onClick={() => {
                setConfirmComplete(false)
                onMove(order, "Delivered")
              }}
            >
              Mark delivered
            </PrimaryBtn>
          </div>
        </Modal>
      )}
      {confirmShip && (
        <Modal
          title="Mark this as shipped?"
          onClose={() => setConfirmShip(false)}
          width={420}
        >
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
            This emails {order.buyer} that {order.product} has shipped. Add
            tracking details to continue.
          </p>
          <div className="kargo-modal-actions">
            <SecondaryBtn onClick={() => setConfirmShip(false)}>
              Not yet
            </SecondaryBtn>
            <PrimaryBtn
              onClick={() => {
                setConfirmShip(false)
                setShipAfterTracking(true)
                setShowTracking(true)
              }}
            >
              Add tracking details
            </PrimaryBtn>
          </div>
        </Modal>
      )}
      {showTracking && (
        <TrackingDetailsModal
          order={order}
          onClose={() => {
            setShowTracking(false)
            setShipAfterTracking(false)
          }}
          onSave={async (tracking) => {
            await onSaveTracking(order, tracking)
            setShowTracking(false)
            if (shipAfterTracking) onMove(order, "Shipped")
            setShipAfterTracking(false)
          }}
        />
      )}
    </div>
  )
}
