import type { ReactNode } from "react"
import { SH } from "@/components/shared"

// Title + subtitle on the left, optional actions on the right. Reused by every
// admin tab for a consistent header.
export default function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <SH title={title} />
        <p style={{ marginTop: -8, color: "#748391", fontSize: 12 }}>{subtitle}</p>
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  )
}
