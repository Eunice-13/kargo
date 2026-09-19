import { useState } from "react"
import { Clock3, Star } from "lucide-react"
import type { BatchType } from "@/types"
import { INDIGO, CREAM } from "@/constants/theme"
import { Modal, PrimaryBtn, SecondaryBtn, Avatar, ProductThumb, BIRBadge } from "@/components/shared"

export default function ItemClaimModal({
  batch,
  product,
  onConfirm,
  onClose,
}: {
  batch: BatchType
  product: {
    name: string
    price: number
    qty: number
    claimed: number
    waitlist: number
    locked?: boolean
  }
  onConfirm: () => void
  onClose: () => void
}) {
  const [qty, setQty] = useState(1)
  const [showReminders, setShowReminders] = useState(false)
  const left = product.qty - product.claimed
  const maxQty = Math.min(left, 5)

  return (
    <Modal title="Review claim before submitting" onClose={onClose} width={480}>
      <div className="space-y-4">
        {/* Product header */}
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
          <ProductThumb name={product.name} />
          <div className="flex-1">
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              {product.name}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              from {batch.title}
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: INDIGO,
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            ₱{product.price.toLocaleString()}
          </div>
        </div>

        {/* Seller trust row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 0",
            borderBottom: "1px solid #F3F4F6",
          }}
        >
          <Avatar name={batch.seller} size={28} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              {batch.seller}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#9CA3AF",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Star size={12} aria-hidden="true" /> {batch.rating} · Verified Seller <BIRBadge />
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {["FB", "IG", "TT"].map((s) => (
              <span
                key={s}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background:
                    s === "FB" ? "#1877F2" : s === "IG" ? "#E1306C" : "#000",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s[0]}
              </span>
            ))}
          </div>
        </div>

        {/* Reservation countdown notice */}
        <div
          style={{
            background: "#FFF7ED",
            border: "1px solid #FCD34D",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Clock3 size={18} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
              48-hour payment window
            </div>
            <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
              Your reservation expires if payment is not submitted within 48
              hours of claiming.
            </div>
          </div>
        </div>

        {/* Qty selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
            Quantity
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              style={{
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
              }}
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
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              style={{
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
              }}
            >
              +
            </button>
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
            {left} slot{left !== 1 ? "s" : ""} left
          </span>
        </div>

        {/* Accepted payment methods */}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            Accepted Payments
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["GCash", "Maya", "Bank Transfer", "COD"].map((m) => (
              <span
                key={m}
                style={{
                  background: "#F3F4F6",
                  color: "#374151",
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #E5E7EB",
                }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Reminders accordion */}
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowReminders((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              background: CREAM,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
            }}
          >
            📋 Important Reminders
            <span style={{ fontSize: 10, color: "#9CA3AF" }}>
              {showReminders ? "▲" : "▼"}
            </span>
          </button>
          <div
            style={{
              maxHeight: showReminders ? 200 : 0,
              overflow: "hidden",
              transition: "max-height 0.25s ease",
            }}
          >
            <ul
              style={{
                margin: 0,
                padding: "10px 14px 10px 28px",
                fontSize: 11,
                color: "#6B7280",
                lineHeight: 1.8,
              }}
            >
              <li>
                Pay before the 48-hour timer ends or your reservation will
                expire.
              </li>
              <li>
                COD is for tracking purposes only — coordinate pickup with the
                seller.
              </li>
              <li>
                Extensions are subject to seller approval and not guaranteed.
              </li>
              <li>Claims are non-transferable to another buyer.</li>
            </ul>
          </div>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#111827",
            textAlign: "right",
            fontFamily: "'Plus Jakarta Sans',sans-serif",
          }}
        >
          Total: ₱{(product.price * qty).toLocaleString()}
        </div>

        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onConfirm}
          >
            Yes, confirm claim
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

