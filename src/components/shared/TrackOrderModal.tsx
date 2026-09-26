import { Check } from "lucide-react"
import type { OrderRow } from "@/types"
import { INDIGO, CREAM, GREEN } from "@/constants/theme"
import Modal from "./Modal"

export const ORDER_STEPS = [
  "Claimed",
  "Pending",
  "Paid and Reserved",
  "Ordered",
  "Delivered",
]
export default function TrackOrderModal({
  order,
  onClose,
}: {
  order: OrderRow
  onClose: () => void
}) {
  const si = order.step - 1
  return (
    <Modal title="Track Order" onClose={onClose} width={520}>
      <div className="space-y-5">
        <div
          style={{ background: CREAM, borderRadius: 8, padding: "12px 16px" }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#111827",
              fontFamily: "'Josefin Sans',sans-serif",
            }}
          >
            {order.product}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
            {order.id} · {order.seller}
          </div>
        </div>
        <div style={{ padding: "0 8px" }}>
          {ORDER_STEPS.map((step, i) => (
            <div
              key={step}
              className="flex items-start gap-4"
              style={{
                paddingBottom: i < ORDER_STEPS.length - 1 ? 24 : 0,
                position: "relative",
              }}
            >
              {i < ORDER_STEPS.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: 15,
                    top: 28,
                    width: 2,
                    height: 24,
                    background: i < si ? INDIGO : "#E5E7EB",
                    transition: "background 0.3s",
                  }}
                />
              )}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: i <= si ? INDIGO : "#F3F4F6",
                  color: i <= si ? "#fff" : "#9CA3AF",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.3s",
                }}
              >
                {i < si ? <Check size={14} aria-hidden="true" /> : i + 1}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: i === si ? 700 : 500,
                    color: i <= si ? "#111827" : "#9CA3AF",
                  }}
                >
                  {step}
                </div>
                {i === si && (
                  <div
                    style={{
                      fontSize: 11,
                      color: INDIGO,
                      marginTop: 2,
                      fontWeight: 600,
                    }}
                  >
                    Current status
                  </div>
                )}
                {i === ORDER_STEPS.length - 1 && i <= si && (
                  <div style={{ fontSize: 11, color: GREEN, marginTop: 2 }}>
                    {order.eta}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {order.trackingNo && (
          <div
            style={{
              background: "#F0EEFF",
              border: `1px solid #C7D2FE`,
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
              Tracking Number
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: INDIGO,
                marginTop: 2,
              }}
            >
              {order.trackingNo}
            </div>
          </div>
        )}
        <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "right" }}>
          ETA: {order.eta}
        </div>
      </div>
    </Modal>
  )
}
