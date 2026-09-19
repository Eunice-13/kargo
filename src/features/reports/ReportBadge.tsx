import type { ReportStatus } from "@/types"
import { REPORT_C } from "@/constants/theme"

export default function ReportBadge({ status }: { status: ReportStatus }) {
  const c = REPORT_C[status]
  return (
    <span
      role="status"
      aria-label={`Report status: ${status}`}
      style={{ background: c.bg, color: c.text }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
    >
      {status}
    </span>
  )
}
