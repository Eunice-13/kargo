import { INDIGO } from "@/constants/theme"

export default function Toggle({
  on,
  onChange,
  label = "Toggle setting",
}: {
  on: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    // The wrapper is a no-op on desktop; on mobile CSS grows it to a 44px
    // transparent hit area (.kargo-toggle-hit) around the 40x22 visual switch.
    <span className="kargo-toggle-hit" style={{ flexShrink: 0 }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        style={{
          width: 40,
          height: 22,
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
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 3,
            left: on ? 21 : 3,
            transition: "left 0.2s cubic-bezier(.22,1,.36,1)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </span>
  )
}
