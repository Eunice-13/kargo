import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/shared"

// Seller-dashboard stat treatment: white card, tinted icon square, uppercase
// muted label, large Josefin value, optional sub-label.
export default function AdminStatCard({
  icon: Icon,
  label,
  value,
  sub,
  tint = "#EEF0FB",
  ink = "#2E3192",
}: {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  tint?: string
  ink?: string
}) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 38,
            height: 38,
            borderRadius: 10,
            background: tint,
            color: ink,
            flex: "0 0 auto",
          }}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "#9aa3bd",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 23,
              fontWeight: 800,
              color: "#171923",
              lineHeight: 1.1,
            }}
          >
            {value}
          </div>
          {sub && <div style={{ fontSize: 11, color: "#748391", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </Card>
  )
}
