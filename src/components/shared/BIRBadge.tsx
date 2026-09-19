import { BadgeCheck } from "lucide-react"
import { INDIGO } from "@/constants/theme"

export default function BIRBadge({
  size = 16,
  verified = true,
  onClick,
}: {
  size?: number
  verified?: boolean
  onClick?: () => void
}) {
  return (
    <span
      title={verified ? "BIR reference badge — not independently verified" : "BIR reference pending"}
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        background: verified ? "#EEF0FF" : "#F3F4F6",
        color: verified ? INDIGO : "#9CA3AF",
        fontSize: size - 2,
        fontWeight: 700,
        padding: `${size > 16 ? 4 : 2}px ${size > 16 ? 8 : 6}px`,
        borderRadius: 999,
        border: `1px solid ${verified ? "#C7C9F5" : "#D1D5DB"}`,
        lineHeight: 1,
        whiteSpace: "nowrap" as const,
      }}
    >
      <BadgeCheck size={size - 3} aria-hidden="true" /> BIR reference
    </span>
  )
}
