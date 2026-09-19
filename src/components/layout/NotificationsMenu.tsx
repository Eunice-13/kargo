import { useState, useEffect, useRef } from "react"
import type { Role } from "@/types"
import { INDIGO, CREAM } from "@/constants/theme"
import { NOTIF_BUYER, NOTIF_SELLER } from "@/data/notifications"

export default function NotificationsMenu({ role }: { role?: Role }) {
  const [showNotif, setShowNotif] = useState(false)
  const [notifRead, setNotifRead] = useState(false)
  const [readSet, setReadSet] = useState<Set<number>>(new Set())
  const notifRef = useRef<HTMLDivElement>(null)
  const notifSource = role === "Seller" ? NOTIF_SELLER : NOTIF_BUYER
  const notifs = notifSource.map((n) => ({
    icon: n.icon,
    text: n.text,
    time: n.time,
    unread: !n.read,
  }))
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotif(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const markAllRead = () => {
    setReadSet(new Set(notifs.map((_, i) => i)))
    setNotifRead(true)
  }
  const hasUnread = !notifRead && notifs.some((n) => n.unread)

  return (
    <div ref={notifRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Notifications${hasUnread ? " (unread)" : ""}`}
        onClick={() => setShowNotif((s) => !s)}
        style={{
          position: "relative",
          background: CREAM,
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="hover:bg-gray-100 transition-colors bp"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
            fill="#6B7280"
          />
        </svg>
        {hasUnread && (
          <span
            style={{
              background: "#EF4444",
              width: 8,
              height: 8,
              borderRadius: "50%",
              position: "absolute",
              top: 6,
              right: 7,
              border: "2px solid #fff",
            }}
          />
        )}
      </button>
      {showNotif && (
        <div
          className="si"
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 340,
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
              padding: "10px 14px",
              borderBottom: "1px solid #F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Notifications
            </span>
            {hasUnread && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 11,
                  color: INDIGO,
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          {notifs.map((n, i) => {
            const isRead = readSet.has(i) || !n.unread
            return (
              <div
                key={i}
                onClick={() => setReadSet((s) => new Set([...s, i]))}
                role="button"
                tabIndex={0}
                aria-label={`${n.text}${isRead ? "" : " (unread)"}, mark as read`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setReadSet((s) => new Set([...s, i]))
                  }
                }}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #F9FAFB",
                  background: isRead ? "#fff" : "#FAFBFF",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: "pointer",
                }}
                className="hover:bg-gray-50 transition-colors"
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: isRead ? "transparent" : INDIGO,
                    borderRadius: "50%",
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                  {n.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#374151",
                      lineHeight: 1.4,
                      fontWeight: isRead ? 400 : 500,
                    }}
                  >
                    {n.text}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                  >
                    {n.time}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
