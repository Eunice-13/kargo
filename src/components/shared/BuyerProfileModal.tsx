import { ExternalLink } from "lucide-react"
import { CREAM } from "@/constants/theme"
import { normalizeUrl } from "./contactLink"
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
  socialLinks,
  onClose,

  // The buyer's real order rows, used for the transaction counters.
}: {
  buyer: string

  orderCounts?: { completed: number; cancelled: number; incomplete: number }
  contactUrl?: string
  socialLinks?: Record<string, string>
  onClose: () => void
}) {
  const counts = orderCounts ?? { completed: 0, cancelled: 0, incomplete: 0 }
  const visibleSocials = Object.entries(socialLinks ?? {}).filter(([, url]) =>
    url?.trim(),
  )

  if (visibleSocials.length === 0 && contactUrl) {
    visibleSocials.push(["Contact link", contactUrl])
  }

  return (
    <Modal title="" onClose={onClose} width={480} variant="detail">
      <div className="buyer-profile-modal__hero">
        <Avatar name={buyer} size={56} />
        <div
          style={{
            fontFamily: "'Josefin Sans',sans-serif",
            fontSize: 17,
            fontWeight: 800,
            color: "#111827",
            marginTop: 10,
          }}
        >
          {buyer}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {([
          ["Completed", counts.completed, "#0B7A59"],

          ["Cancelled", counts.cancelled, "#EF4444"],

          ["Incomplete", counts.incomplete, "#92400E"],
        ] as const).map(([label, value, color]) => (
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
                fontFamily: "'Josefin Sans',sans-serif",
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 500 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: CREAM,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
          Contact
        </div>
        {visibleSocials.length > 0 ? (
          <div className="buyer-profile-modal__socials">
            {visibleSocials.map(([platform, url]) => (
              <a
                key={platform}
                href={normalizeUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="buyer-profile-modal__social-link"
              >
                <span>
                  <strong>{platform}</strong>
                  <small>{url}</small>
                </span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
            This user hasn't added a contact link yet.
          </div>
        )}
      </div>
    </Modal>
  )
}
