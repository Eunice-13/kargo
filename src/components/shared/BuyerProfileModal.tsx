import type { UserRating } from "@/types"
import { CREAM, INDIGO } from "@/constants/theme"
import { memberSince, type OrderTrustCounts } from "@/lib/ratings"
import Modal from "./Modal"
import Avatar from "./Avatar"
import RatingDisplay, { ReviewList } from "./RatingDisplay"

// A buyer's public profile. Every number here is computed from real data:
// the average and review list from `public.reviews`, the transaction counters
// from the buyer's actual `orders` rows, and the join date from
// `profiles.created_at`. Nothing is a placeholder, so a buyer with no completed
// activity shows "New buyer" rather than an invented score.
export default function BuyerProfileModal({
  buyer,
  rating,
  orderCounts,
  contactUrl,
  onClose,
}: {
  buyer: string
  // The buyer's entry from the shared computed rating map.
  rating?: UserRating
  // The buyer's real order rows, used for the transaction counters.
  orderCounts?: OrderTrustCounts
  contactUrl?: string
  onClose: () => void
}) {
  const counts = orderCounts ?? { completed: 0, cancelled: 0, incomplete: 0 }
  const joined = memberSince(rating?.memberSince)
  const resolved = rating ?? { average: null, count: 0, reviews: [] }

  return (
    <Modal title="" onClose={onClose} width={480}>
      <div style={{ margin: "-28px -28px 20px", background: "linear-gradient(135deg,#DEF3FA,#EEF0FF)", borderRadius: "12px 12px 0 0", padding: "24px 24px 16px", textAlign: "center" }}>
        <Avatar name={buyer} size={56} />
        <div style={{ fontFamily: "'Josefin Sans',sans-serif", fontSize: 17, fontWeight: 800, color: "#111827", marginTop: 10 }}>{buyer}</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <RatingDisplay summary={rating} subject="buyer" />
          {joined && <span>· Member since {joined}</span>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {([
          ["Completed", counts.completed, "#0B7A59"],
          ["Cancelled", counts.cancelled, "#EF4444"],
          ["Incomplete", counts.incomplete, "#92400E"],
          // Disputes are not modelled as an order status, so this is derived
          // from real data (below 3★ reviews) rather than a typed-in zero.
          ["Disputes", rating?.count
            ? (rating.breakdown[1] + rating.breakdown[2])
            : 0, "#6B7280"],
        ] as const).map(([label, value, color]) => (
          <div key={label} style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 6px", textAlign: "center", border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'Josefin Sans',sans-serif" }}>{value}</div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: CREAM, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Contact</div>
        {contactUrl ? (
          <a href={contactUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: INDIGO, wordBreak: "break-all" }}>
            {contactUrl}
          </a>
        ) : (
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
            This user hasn't added a contact link yet.
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Reviews from sellers
        </div>
        <ReviewList
          reviews={resolved.reviews}
          emptyText="No reviews yet. Sellers can rate this buyer after a completed transaction."
        />
      </div>

      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
        Buyer ratings can only be submitted from a completed order. Open the completed transaction and choose <strong>Rate buyer</strong>.
      </div>
    </Modal>
  )
}
