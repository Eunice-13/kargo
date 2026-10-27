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
    <div className="admin-page-header">
      <div style={{ minWidth: 0 }}>
        <SH title={title} />
        <p className="admin-page-header__subtitle">{subtitle}</p>
      </div>
      {actions && (
        <div className="admin-page-header__actions">
          {actions}
        </div>
      )}
    </div>
  )
}
