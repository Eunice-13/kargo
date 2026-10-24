import { useRef } from "react"
import { INDIGO } from "@/constants/theme"

// Accessible segmented control (tablist with arrow-key navigation). Scrolls
// horizontally on mobile. Used for Transactions sub-tabs.
export default function AdminSectionTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[]
  active: T
  onChange: (value: T) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  return (
    <div
      role="tablist"
      aria-label="Sections"
      style={{
        display: "flex",
        gap: 4,
        marginBottom: 16,
        overflowX: "auto",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      {tabs.map((t, i) => {
        const selected = t.value === active
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault()
                const dir = e.key === "ArrowRight" ? 1 : -1
                const next = (i + dir + tabs.length) % tabs.length
                onChange(tabs[next].value)
                refs.current[next]?.focus()
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              padding: "0 14px",
              border: "none",
              borderBottom: selected ? `2px solid ${INDIGO}` : "2px solid transparent",
              background: "transparent",
              color: selected ? INDIGO : "#6B7280",
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 13,
              fontWeight: selected ? 700 : 500,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span
                style={{
                  background: selected ? INDIGO : "#E5E7EB",
                  color: selected ? "#fff" : "#6B7280",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
