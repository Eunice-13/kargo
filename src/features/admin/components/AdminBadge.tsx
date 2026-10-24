import { ADMIN_TONES, type AdminTone } from "@/constants/admin"

// Status/role/moderation pill. Matches StatusBadge: rounded-full, 11px semibold,
// dot + label. `tone` is either a named key in ADMIN_TONES or a resolved
// AdminTone object (e.g. from toneForStatus). Communicates with text + shape.
export default function AdminBadge({
  tone,
  label,
}: {
  tone: keyof typeof ADMIN_TONES | string | AdminTone
  label: string
}) {
  const t = typeof tone === "string" ? ADMIN_TONES[tone] ?? ADMIN_TONES.info : tone
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: t.dot,
          flex: "0 0 auto",
        }}
      />
      {label}
    </span>
  )
}
