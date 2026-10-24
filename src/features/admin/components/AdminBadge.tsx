import { ADMIN_TONES } from "@/constants/admin"

// Status/role/moderation pill. Matches StatusBadge: rounded-full, 11px semibold,
// dot + label. Tone resolved from ADMIN_TONES; communicates with text + shape.
export default function AdminBadge({
  tone,
  label,
}: {
  tone: keyof typeof ADMIN_TONES | string
  label: string
}) {
  const t = ADMIN_TONES[tone] ?? ADMIN_TONES.info
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
