import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/shared"

// Buyer dashboard summary tile. Reuses the shared Card for consistent
// elevation/rounding; the reference places the icon in the top-right corner,
// a large Manrope value below (global CSS upgrades the numeric readout font),
// then a label and a colored context line.
export default function StatCard({
  value,
  label,
  sub,
  accent,
  bg,
  edge,
  icon: Icon,
  onClick,
}: {
  value: string
  label: string
  sub: string
  accent: string
  bg: string
  // Bright saturated strip along the top edge of the card (per the reference).
  edge: string
  icon: LucideIcon
  onClick?: () => void
}) {
  const interactive = typeof onClick === "function"
  return (
    <Card
      className="fi stat-card"
      style={{
        position: "relative",
        background: bg,
        overflow: "hidden",
        cursor: interactive ? "pointer" : undefined,
      }}
    >
      {/* Bright saturated top strip (per the reference). Rendered as an element
          rather than a border so the shared .kargo-card `border !important`
          rule can't override its color. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: edge,
        }}
      />
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `${label}: ${value}. ${sub}` : undefined}
        onClick={onClick}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onClick?.()
                }
              }
            : undefined
        }
      >
        <Icon
          size={18}
          aria-hidden="true"
          style={{
            color: accent,
            opacity: 0.55,
            position: "absolute",
            top: 2,
            right: 2,
          }}
        />
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1,
            marginTop: 8,
          }}
          className="stat-card-value mb-1"
        >
          {value}
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 4 }}>
          {sub}
        </div>
      </div>
    </Card>
  )
}
