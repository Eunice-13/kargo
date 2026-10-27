import { useEffect, useRef, useState } from "react"
import type { Role, Tab } from "@/types"
import { CREAM } from "@/constants/theme"
import { NotificationItem, useNotifications } from "@/features/notifications"

export default function NotificationsMenu({
  onNavigate,
}: {
  role?: Role
  onNavigate?: (tab: Tab) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const {
    notifications,
    unreadCount,
    loading,
    error,
    busy,
    hasMore,
    loadMore,
    markRead,
  } = useNotifications()

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener("pointerdown", dismiss)
    return () => document.removeEventListener("pointerdown", dismiss)
  }, [])

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          background: CREAM,
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          width: 36,
          height: 36,
        }}
        className="kargo-notification-trigger relative flex items-center justify-center transition-colors hover:bg-gray-100 bp"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            className="kargo-notification-icon"
            d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
            fill="#6B7280"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 min-w-4 rounded-full border-2 border-white bg-red-500 px-1 text-center text-[9px] leading-3 text-white"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="si kargo-notifications-popover absolute right-0 top-11 z-[60] w-[340px] overflow-hidden rounded-[10px] border border-gray-200 bg-white"
          style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-3.5 py-2.5">
            <span className="text-[13px] font-bold text-gray-900">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void markRead()}
                className="text-[11px] font-semibold text-[var(--kargo-navy)]"
              >
                Mark all read
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="px-3.5 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {notifications.slice(0, 5).map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              compact
              busy={busy || loading}
              onOpen={() => {
                void markRead(notification.id).then((ok) => {
                  if (!ok) return
                  setOpen(false)
                  onNavigate?.(notification.tab)
                })
              }}
            />
          ))}

          {loading && (
            <p role="status" className="p-4 text-xs text-gray-500">
              Loading notifications…
            </p>
          )}
          {!loading && !error && notifications.length === 0 && (
            <p className="p-4 text-xs text-gray-500">No notifications yet.</p>
          )}
          {error && !loading && notifications.length === 0 && hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="min-h-11 w-full text-xs text-[var(--kargo-navy)]"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onNavigate?.("Notifications")
            }}
            className="min-h-11 w-full border-t border-gray-100 px-3.5 py-2.5 text-xs font-semibold text-[var(--kargo-navy)] transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
          >
            View All Notifications
          </button>
        </div>
      )}
    </div>
  )
}
