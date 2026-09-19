import { useState } from "react"
import type { OrderRow } from "@/types"
import { INDIGO } from "@/constants/theme"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

export default function RateOrderModal({
  order,
  onRate,
  onClose,
}: {
  order: OrderRow
  onRate: (rating: number) => void
  onClose: () => void
}) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  return (
    <Modal title="Rate Your Experience" onClose={onClose} width={400}>
      <div className="space-y-5">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
            How was your order from <strong>{order.seller}</strong>?
          </div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setStars(s)}
                style={{
                  fontSize: 36,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "transform 0.1s",
                  transform:
                    (hovered || stars) >= s ? "scale(1.2)" : "scale(1)",
                  color: (hovered || stars) >= s ? "#FBBF24" : "#D1D5DB",
                }}
              >
                
              </button>
            ))}
          </div>
          {stars > 0 && (
            <div
              style={{
                fontSize: 12,
                color: INDIGO,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              {["", "Terrible", "Poor", "Okay", "Good", "Excellent!"][stars]}
            </div>
          )}
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Comments (optional)
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Skip
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => {
              if (stars > 0) onRate(stars)
            }}
            disabled={stars === 0}
          >
            Submit Rating
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
