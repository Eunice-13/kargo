import { useState, useEffect, useRef } from "react"
import { UserRound, Settings as SettingsIcon, LogOut, Store, Clock3, AlertTriangle } from "lucide-react"
import type { UserInfo } from "@/types"
import { Avatar, BIRBadge } from "@/components/shared"

export default function UserMenu({
  user,
  onSettings,
  onLogout,
  onApplyToSell,
  displayLabel,
}: {
  user: UserInfo
  onSettings: () => void
  onLogout: () => void
  onApplyToSell?: () => void
  displayLabel?: string
}) {
  const [showUser, setShowUser] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setShowUser(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  return (
    <div ref={userRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Open profile menu for ${user.name || "User"}`}
        onClick={() => setShowUser((s) => !s)}
        className="flex items-center gap-2 bp"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: 8,
        }}
      >
        <Avatar name={user.name || "User"} size={32} imageUrl={user.avatarUrl} />
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
          {displayLabel || user.name.split(" ")[0] || "User"}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 4.5l3 3 3-3"
            stroke="#9CA3AF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {showUser && (
        <div
          className="si"
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 200,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            zIndex: 60,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid #F3F4F6",
            }}
          >
            <div
              style={{
                fontFamily: "'Josefin Sans',sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {user.name || "User"}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
              {user.email}
            </div>
          </div>
          {/* Seller status / apply entry point — reflects verification state */}
          {(() => {
            const s = user.birState ?? "None"
            if (s === "Verified") {
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 14px",
                    borderBottom: "1px solid #F3F4F6",
                    fontSize: 12,
                    color: "#0B7A59",
                    fontWeight: 600,
                  }}
                >
                  <Store size={15} aria-hidden="true" /> Verified Seller <BIRBadge size={14} />
                </div>
              )
            }
            if (user.sellerEnabled) return null
            if (s === "Flagged") {
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "9px 14px",
                    borderBottom: "1px solid #F3F4F6",
                    fontSize: 11.5,
                    color: "#B91C1C",
                    lineHeight: 1.45,
                  }}
                >
                  <AlertTriangle
                    size={15}
                    aria-hidden="true"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  Seller verification failed — access suspended pending review.
                </div>
              )
            }
            if (s === "Uploading" || s === "Scanning" || s === "Verifying") {
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 14px",
                    borderBottom: "1px solid #F3F4F6",
                    fontSize: 11.5,
                    color: "#92400E",
                    fontWeight: 600,
                  }}
                >
                  <Clock3 size={15} aria-hidden="true" /> Seller application under
                  review
                </div>
              )
            }
            // None → offer to apply
            return (
              <button
                onClick={() => {
                  setShowUser(false)
                  onApplyToSell?.()
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 14px",
                  borderBottom: "1px solid #F3F4F6",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#4F46E5",
                  fontWeight: 600,
                  textAlign: "left",
                }}
                className="hover:bg-gray-50 transition-colors"
              >
                <Store size={16} aria-hidden="true" />
                Start Selling
              </button>
            )
          })()}
          {[
            {
              icon: <UserRound size={16} aria-hidden="true" />,
              label: "View Profile",
              action: () => {
                onSettings()
                setShowUser(false)
              },
            },
            {
              icon: <SettingsIcon size={16} aria-hidden="true" />,
              label: "Settings",
              action: () => {
                onSettings()
                setShowUser(false)
              },
            },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#374151",
                textAlign: "left",
              }}
              className="hover:bg-gray-50 transition-colors"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #F3F4F6" }}>
            <button
              onClick={() => {
                setShowUser(false)
                onLogout()
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#EF4444",
                fontWeight: 600,
                textAlign: "left",
              }}
              className="hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} aria-hidden="true" />Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
