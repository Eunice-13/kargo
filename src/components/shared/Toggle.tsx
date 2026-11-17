import { INDIGO } from "@/constants/theme"

export default function Toggle({
  on,
  onChange,
  label = "Toggle setting",
  compact = false,
  className,
  itemCard = false,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label?: string
  compact?: boolean
  className?: string
  itemCard?: boolean
}) {
  const width = itemCard ? 48 : compact ? 34 : 40
  const height = itemCard ? 28 : compact ? 18 : 22
  const knob = itemCard ? 22 : compact ? 14 : 16
  const inset = 3

  return (
    <button
      type="button"
      className={`kargo-toggle${compact ? " kargo-toggle--compact" : ""}${className ? ` ${className}` : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        width,
        height,
        borderRadius: 999,
        background: on ? INDIGO : "#E5E7EB",
        position: "relative",
        cursor: "pointer",
        border: 0,
        padding: 0,
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          width: knob,
          height: knob,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: itemCard ? 3 : compact ? 2 : inset,
          left: itemCard ? 3 : on ? width - knob - (compact ? 2 : inset) : compact ? 2 : inset,
          transform: itemCard && on ? "translateX(20px)" : "translateX(0)",
          transition: itemCard
            ? "transform 0.2s cubic-bezier(.22,1,.36,1)"
            : "left 0.2s cubic-bezier(.22,1,.36,1)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  )
}
