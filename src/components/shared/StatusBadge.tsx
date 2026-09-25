import type { PaymentHistoryStatus } from "@/types"
import { STATUS_C } from "@/constants/theme"

export default function StatusBadge({ status }: { status: PaymentHistoryStatus }) {
  const c = STATUS_C[status]
  return (
    <span
      role="status"
      aria-label={`Claim status: ${status}`}
      style={{ background: c.bg, color: c.text }}
      className="fi inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
    >
      <span
        style={{ background: c.dot }}
        className="w-1.5 h-1.5 rounded-full"
      />
      {status}
    </span>
  )
}
