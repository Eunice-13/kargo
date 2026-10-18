import { STAGE_COLORS, STAGE_ICONS } from "@/constants/fulfillment"
import type { FulfillmentColumn } from "@/constants/fulfillment"

export default function StageChip({ stage }: { stage: FulfillmentColumn }) {
  const colors = STAGE_COLORS[stage]
  const Icon = STAGE_ICONS[stage]

  return (
    <span
      className="kargo-stage-chip"
      style={{ background: colors.background, color: colors.foreground }}
    >
      <Icon size={12} aria-hidden="true" />
      {stage}
    </span>
  )
}
