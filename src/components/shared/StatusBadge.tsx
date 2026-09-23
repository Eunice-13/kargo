import type { ClaimStatus } from "@/types"
import { STATUS_C } from "@/constants/theme"

// Display-only, plain-language labels for each ClaimStatus. This does NOT change
// the ClaimStatus type, the STATUS_C keys, or any stored/business value — it only
// swaps the visible text (and the spoken aria-label) for something a buyer can
// act on. Applied on all viewports because plain language helps everywhere.
const STATUS_LABEL: Record<ClaimStatus, string> = {
  Pending: "Waiting for payment",
  "Paid and Reserved": "Paid — reserved for you",
  Expired: "Expired",
  Cancelled: "Cancelled",
  "Insufficient Payment": "Payment short — action needed",
}

export default function StatusBadge({ status }: { status: ClaimStatus }) {
  const c = STATUS_C[status]
  const label = STATUS_LABEL[status] ?? status
  return (
    <span
      role="status"
      aria-label={`Claim status: ${label}`}
      style={{ background: c.bg, color: c.text }}
      className="fi inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
    >
      <span
        style={{ background: c.dot }}
        className="w-1.5 h-1.5 rounded-full"
      />
      {label}
    </span>
  )
}
