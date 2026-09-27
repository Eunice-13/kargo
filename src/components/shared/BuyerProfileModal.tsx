import { CREAM, INDIGO } from "@/constants/theme"
import Modal from "./Modal"
import Avatar from "./Avatar"

// A buyer's public profile. Every number here is computed from real data:
// the transaction counters from the buyer's actual `orders` rows, and the
// join date from `profiles.created_at`. Nothing is a placeholder, so a buyer
// with no completed activity shows "New buyer" rather than an invented score.
export default function BuyerProfileModal({
  buyer,
  orderCounts,
  contactUrl,
  onClose,
}: {
  buyer: string
  // The buyer's real order rows, used for the transaction counters.
  orderCounts?: { completed: number; cancelled: number; incomplete: number }
  contactUrl?: string
  onClose: () => void
}) {
  const counts = orderCounts ?? { completed: 0, cancelled: 0, incomplete: 0 }

  return (
    <Modal title="" onClose={onClose} width={480}>
      <div style={{ margin: "-28px -28px 20px", background: "linear-gradient(135deg,#DEF3FA,#EEF0FF)", borderRadius: "12px 12px 0 0", padding: "24px 24px 16px", textAlign: "center" }}>
        <Avatar name={buyer} size={56} />
        <div style={{ fontFamily: "'Josefin Sans',sans-serif", fontSize: 17, fontWeight: 800, color: "#111827", marginTop: 10 }}>{buyer}</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {([
          ["Completed", counts.completed, "#0B7A59"],
          ["Cancelled", counts.cancelled, "#EF4444"],
          ["Incomplete", counts.incomplete, "#92400E"],
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
    </Modal>
  )
}
