import { useState } from "react"
import { Star, Check } from "lucide-react"
import { INDIGO, CREAM, GREEN } from "@/constants/theme"
import Modal from "./Modal"
import PrimaryBtn from "./PrimaryBtn"
import Avatar from "./Avatar"

export default function BuyerProfileModal({
  buyer,
  onClose,
}: {
  buyer: string
  onClose: () => void
}) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [ratingDone, setRatingDone] = useState(false)

  return (
    <Modal title="" onClose={onClose} width={480}>
      {/* Banner */}
      <div
        style={{
          margin: "-28px -28px 20px",
          background: "linear-gradient(135deg,#DEF3FA,#EEF0FF)",
          borderRadius: "12px 12px 0 0",
          padding: "24px 24px 16px",
          textAlign: "center",
        }}
      >
        <Avatar name={buyer} size={56} />
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            fontSize: 17,
            fontWeight: 800,
            color: "#111827",
            marginTop: 10,
          }}
        >
          {buyer}
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
          <Star size={13} aria-hidden="true" /> 4.8 average · Member since Mar 2025
        </div>
      </div>

      {/* Trust stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          ["Completed", "12", "#0B7A59"],
          ["Cancelled", "1", "#EF4444"],
          ["Incomplete", "0", "#92400E"],
          ["Disputes", "0", "#6B7280"],
        ].map(([label, val, color]) => (
          <div
            key={label}
            style={{
              background: "#F9FAFB",
              borderRadius: 8,
              padding: "8px 6px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color,
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              {val}
            </div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Linked social */}
      <div
        style={{
          background: CREAM,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#1877F2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>
            f
          </span>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>
            Facebook
          </div>
          <a
            href={`https://facebook.com/${buyer.toLowerCase().replace(" ", ".")}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: INDIGO }}
          >
            facebook.com/{buyer.toLowerCase().replace(" ", ".")}
          </a>
        </div>
      </div>

      {/* Rate buyer */}
      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
            fontFamily: "'Plus Jakarta Sans',sans-serif",
          }}
        >
          Rate this Buyer
        </div>
        {ratingDone ? (
          <div
            style={{
              textAlign: "center",
              fontSize: 13,
              color: GREEN,
              fontWeight: 600,
              padding: "8px 0",
            }}
          >
            <Check size={14} aria-hidden="true" style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
            Rating submitted — thanks!
          </div>
        ) : (
          <div>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setStars(s)}
                  aria-label={`Rate ${s} star${s !== 1 ? "s" : ""}`}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "transform 0.1s",
                    transform:
                      (hovered || stars) >= s ? "scale(1.15)" : "scale(1)",
                    color: (hovered || stars) >= s ? "#FBBF24" : "#D1D5DB",
                    display: "flex",
                  }}
                >
                  <Star
                    size={28}
                    aria-hidden="true"
                    fill={(hovered || stars) >= s ? "#FBBF24" : "none"}
                  />
                </button>
              ))}
            </div>
            <PrimaryBtn
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
              disabled={stars === 0}
              onClick={() => setRatingDone(true)}
            >
              Submit Rating
            </PrimaryBtn>
          </div>
        )}
      </div>
    </Modal>
  )
}
