import type React from "react"
import { Toggle } from "@/components/shared"
import { NOTIF_DEFAULTS } from "./notifDefaults"

type NotificationsSectionProps = {
  notifs: Record<string, boolean>
  setNotifs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

export default function NotificationsSection({
  notifs,
  setNotifs,
}: NotificationsSectionProps) {
  return (
    <div className="pr">
      <h3
        style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 20,
        }}
      >
        Notification Preferences
      </h3>
      {NOTIF_DEFAULTS.map((n) => (
        <div
          key={n.key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 0",
            borderBottom: "1px solid #F3F4F6",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
              }}
            >
              {n.label}
            </div>
            <div
              style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
            >
              {n.sub}
            </div>
          </div>
          <Toggle
            on={notifs[n.key]}
            onChange={(v) => setNotifs((p) => ({ ...p, [n.key]: v }))}
          />
        </div>
      ))}
    </div>
  )
}
