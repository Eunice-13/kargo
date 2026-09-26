import type React from "react"
import { Check } from "lucide-react"
import type { Role } from "@/types"
import { GREEN } from "@/constants/theme"
import { Toggle, PrimaryBtn } from "@/components/shared"
import { NOTIF_GROUPS } from "./notifDefaults"

type NotificationsSectionProps = {
  notifs: Record<string, boolean>
  setNotifs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onSave: () => void
  saved: boolean
  saving: boolean
  role: Role
}

export default function NotificationsSection({
  notifs,
  setNotifs,
  onSave,
  saved,
  saving,
  role,
}: NotificationsSectionProps) {
  // Show the groups relevant to this role, plus shared ones.
  const groups = NOTIF_GROUPS.filter(
    (g) => g.roles === "shared" || g.roles === role,
  )

  return (
    <div className="pr">
      <h3
        style={{
          fontFamily: "'Josefin Sans',sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        Notification Preferences
      </h3>
      <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 18 }}>
        These control both in-app alerts and emails. Turning one off opts you out
        of that category.
      </p>

      {groups.map((group) => (
        <div key={group.title} style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "#9CA3AF",
              marginBottom: 4,
            }}
          >
            {group.title}
          </div>
          {group.items.map((n) => (
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
              <div style={{ paddingRight: 16 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}
                >
                  {n.label}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {n.sub}
                </div>
              </div>
              <Toggle
                on={notifs[n.key] !== false}
                onChange={(v) => setNotifs((p) => ({ ...p, [n.key]: v }))}
              />
            </div>
          ))}
        </div>
      ))}

      <div className="flex items-center justify-end gap-3 mt-2">
        {saved && (
          <span
            style={{
              fontSize: 12,
              color: GREEN,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Check size={13} aria-hidden="true" /> Preferences saved!
          </span>
        )}
        <PrimaryBtn onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save Preferences"}
        </PrimaryBtn>
      </div>
    </div>
  )
}
