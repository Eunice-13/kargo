import { useState } from "react"
import { BadgeCheck } from "lucide-react"
import { INDIGO } from "@/constants/theme"
import BIRInfoModal from "./BIRInfoModal"

export default function BIRBadge({ size = 16, verified = true, onClick }: { size?: number; verified?: boolean; onClick?: () => void }) {
  const [showDetails, setShowDetails] = useState(false)
  return (
    <>
      <button
        type="button"
        title={verified ? "View BIR reference badge details" : "View pending BIR reference details"}
        aria-label={verified ? "View BIR registration seal badge details" : "View pending BIR badge details"}
        onClick={(event) => {
          event.stopPropagation()
          if (onClick) onClick()
          else setShowDetails(true)
        }}
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, background: verified ? "#EEF0FF" : "#F3F4F6", color: verified ? INDIGO : "#9CA3AF", fontSize: size - 2, fontWeight: 700, padding: `${size > 16 ? 4 : 2}px ${size > 16 ? 8 : 6}px`, borderRadius: 999, border: `1px solid ${verified ? "#C7C9F5" : "#D1D5DB"}`, lineHeight: 1, whiteSpace: "nowrap" }}
      >
        <BadgeCheck size={size - 3} aria-hidden="true" /> BIR reference
      </button>
      {showDetails && <BIRInfoModal status={verified ? "Verified" : "Checking"} onClose={() => setShowDetails(false)} />}
    </>
  )
}
