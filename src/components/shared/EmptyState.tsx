import type { LucideIcon } from "lucide-react"
import type React from "react"

export default function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon
  title: string
  message: string
  action?: React.ReactNode
}) {
  return (
    <div className="kargo-empty-state">
      <span className="kargo-empty-state__icon">
        <Icon size={21} aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <p>{message}</p>
      {action}
    </div>
  )
}
