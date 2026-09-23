import { Star } from "lucide-react"
import { CREAM, INDIGO } from "@/constants/theme"
import Modal from "./Modal"
import Avatar from "./Avatar"

export default function BuyerProfileModal({ buyer, contactUrl, onClose }: { buyer: string; contactUrl?: string; onClose: () => void }) {
  return (
    <Modal title="" onClose={onClose} width={480}>
      <div style={{ margin: "-28px -28px 20px", background: "linear-gradient(135deg,#DEF3FA,#EEF0FF)", borderRadius: "12px 12px 0 0", padding: "24px 24px 16px", textAlign: "center" }}>
        <Avatar name={buyer} size={56} />
        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 17, fontWeight: 800, color: "#111827", marginTop: 10 }}>{buyer}</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, display: "flex", justifyContent: "center", alignItems: "center", gap: 4 }}>
          <Star size={13} fill="#9CA3AF" aria-hidden="true" /> 4.8 average · Member since Mar 2025
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[["Completed", "12", "#0B7A59"], ["Cancelled", "1", "#EF4444"], ["Incomplete", "0", "#92400E"], ["Disputes", "0", "#6B7280"]].map(([label, value, color]) => (
          <div key={label} style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 6px", textAlign: "center", border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{value}</div>
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

      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
        Buyer ratings can only be submitted from a completed order. Open the completed transaction and choose <strong>Rate buyer</strong>.
      </div>
    </Modal>
  )
}
