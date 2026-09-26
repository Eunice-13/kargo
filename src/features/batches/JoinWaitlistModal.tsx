import { useState } from "react"
import { Users, Info } from "lucide-react"
import { INDIGO, CREAM } from "@/constants/theme"
import { Modal, PrimaryBtn, SecondaryBtn, ProductThumb } from "@/components/shared"

// Buyers pick how many units they want before joining a waitlist. The desired
// quantity is stored on their entry and decides, when stock later frees up,
// whether it is a full match (auto-claim) or a partial match (accept/decline).
export default function JoinWaitlistModal({
  productName,
  batchTitle,
  price,
  onConfirm,
  onClose,
}: {
  productName: string
  batchTitle: string
  price: number
  onConfirm: (quantity: number) => void
  onClose: () => void
}) {
  const [qty, setQty] = useState(1)
  // Waitlists are for sold-out items, so we don't know how much will free up.
  // Cap the request at a sensible ceiling to keep expectations realistic.
  const maxQty = 10

  return (
    <Modal title="Join the waitlist" onClose={onClose} width={440}>
      <div className="space-y-4">
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            background: CREAM,
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <ProductThumb name={productName} />
          <div className="flex-1">
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                fontFamily: "'Josefin Sans',sans-serif",
              }}
            >
              {productName}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              from {batchTitle}
            </div>
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: INDIGO,
              fontFamily: "'Josefin Sans',sans-serif",
            }}
          >
            ₱{price.toLocaleString()}
          </div>
        </div>

        {/* Desired quantity */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
            How many do you want?
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              style={stepBtn}
            >
              −
            </button>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                minWidth: 20,
                textAlign: "center",
              }}
            >
              {qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              style={stepBtn}
            >
              +
            </button>
          </div>
        </div>

        <div
          style={{
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Info size={16} aria-hidden="true" style={{ color: "#2563EB", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11, color: "#1E40AF", lineHeight: 1.6 }}>
            If a claim is cancelled and enough stock frees up to cover your full
            request, it is claimed for you automatically. If only part is
            available, we will ask you to accept or decline before anything is
            claimed.
          </div>
        </div>

        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center", fontSize: 12 }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center", fontSize: 12 }}
            onClick={() => onConfirm(qty)}
          >
            <Users size={13} aria-hidden="true" style={{ marginRight: 6 }} />
            Join Waitlist
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

const stepBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "1px solid #E5E7EB",
  background: "#fff",
  cursor: "pointer",
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#374151",
}
