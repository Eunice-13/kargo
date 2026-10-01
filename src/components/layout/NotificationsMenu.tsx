import { useState, useEffect, useRef } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Check,
  Clock3,
  Package,
  ArrowUp,
  ShoppingBasket,
  ClipboardList,
  Star,
} from "lucide-react"
import type { Role, Tab } from "@/types"
import { INDIGO, CREAM } from "@/constants/theme"
import { NOTIF_BUYER, NOTIF_SELLER } from "@/data/notifications"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

const NOTIF_ICONS: Record<string, LucideIcon> = {
  check: Check,
  clock: Clock3,
  package: Package,
  up: ArrowUp,
  bag: ShoppingBasket,
  clipboard: ClipboardList,
  star: Star,
}

export default function NotificationsMenu({
  role,
  onNavigate,
}: {
  role?: Role
  onNavigate?: (tab: Tab) => void
}) {
  const [showNotif, setShowNotif] = useState(false)
  const [savingRead, setSavingRead] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [readSet, setReadSet] = useState<Set<string | number>>(new Set())
  const [databaseNotifs, setDatabaseNotifs] = useState<Array<{
    id: string
    category: string
    message: string
    target_path: string | null
    context: Record<string, unknown>
    read_at: string | null
    created_at: string
  }> | null>(null)
  const loadVersion = useRef(0)
  const notifRef = useRef<HTMLDivElement>(null)
  const notifSource = role === "Seller" ? NOTIF_SELLER : NOTIF_BUYER
  const notifs = databaseNotifs
    ? databaseNotifs.map((notification) => ({
        id: notification.id,
        icon: notification.category,
        text: notification.message,
        time: new Date(notification.created_at).toLocaleString(),
        unread: !notification.read_at,
        tab: (notification.target_path || notification.context.tab || "Dashboard") as Tab,
      }))
    : (isSupabaseConfigured ? [] : notifSource).map((n) => ({
        id: n.id,
        icon: n.icon,
        text: n.text,
        time: n.time,
        unread: !n.read,
        tab: n.tab,
      }))
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    const version = ++loadVersion.current
    kargoApi.loadNotifications()
      .then((rows) => {
        if (active && version === loadVersion.current) setDatabaseNotifs(rows as typeof databaseNotifs)
      })
      .catch(() => {
        if (active && version === loadVersion.current) setNotificationError("Unable to load notifications. Please reopen this menu to retry.")
      })
    return () => { active = false }
  }, [showNotif])
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotif(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const markRead = async (id?: string | number) => {
    if (savingRead) return false
    ++loadVersion.current
    setSavingRead(true)
    setNotificationError(null)
    try {
      if (isSupabaseConfigured) {
        const updated = await kargoApi.markNotificationRead(id === undefined ? undefined : String(id))
        const ids = new Set(updated.map((notification) => notification.id))
        const expected = notifs.filter((n) => n.unread && (id === undefined || n.id === id))
        if (expected.some((n) => !ids.has(String(n.id)))) {
          throw new Error("Some notifications could not be marked as read. Please try again.")
        }
        const readAt = new Date().toISOString()
        setDatabaseNotifs((rows) => rows?.map((row) => ids.has(row.id) ? { ...row, read_at: readAt } : row) ?? null)
      } else {
        setReadSet((current) => new Set([...current, ...(id === undefined ? notifs.map((n) => n.id) : [id])]))
      }
      return true
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Unable to save read status. Please try again.")
      return false
    } finally {
      setSavingRead(false)
    }
  }
  const hasUnread = notifs.some((n) => n.unread && !readSet.has(n.id))

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
          className="si kargo-notifications-popover"
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
                fontFamily: "'Josefin Sans',sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Notifications
            </span>
            {hasUnread && (
              <button
                onClick={() => void markRead()}
                disabled={savingRead}
                style={{
                  fontSize: 11,
                  color: INDIGO,
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {savingRead ? "Saving…" : "Mark all read"}
              </button>
            )}
          </div>
          {notificationError && <p role="alert" className="px-3 py-2 text-xs text-red-700">{notificationError}</p>}
          {notifs.map((n) => {
            const isRead = readSet.has(n.id) || !n.unread
            const Icon = NOTIF_ICONS[n.icon]
            const openNotification = async () => {
              if (!isRead && !(await markRead(n.id))) return
              setShowNotif(false)
              onNavigate && onNavigate(n.tab)
            }
            return (
              <div
                key={n.id}
                onClick={openNotification}
                role="button"
                tabIndex={0}
                aria-label={`${n.text}${isRead ? "" : " (unread)"}, go to ${n.tab}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openNotification()
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
                <span
                  style={{
                    flexShrink: 0,
                    color: isRead ? "#9CA3AF" : INDIGO,
                    display: "flex",
                    marginTop: 1,
                  }}
                >
                  {Icon && <Icon size={16} aria-hidden="true" />}
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
