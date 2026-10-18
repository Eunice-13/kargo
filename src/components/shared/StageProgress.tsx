import { STAGE_COLORS } from "@/constants/fulfillment"
import type { FulfillmentColumn } from "@/constants/fulfillment"

export default function StageProgress({
  stages,
  current,
  compact = false,
}: {
  stages: readonly FulfillmentColumn[]
  current: FulfillmentColumn
  compact?: boolean
}) {
  const currentIndex = stages.indexOf(current)
  const label =
    currentIndex >= 0
      ? `${current}, step ${currentIndex + 1} of ${stages.length}`
      : current

  return (
    <div
      className={`kargo-stage-progress${compact ? " is-compact" : ""}`}
      role="img"
      aria-label={`Fulfillment progress: ${label}`}
    >
      {stages.map((stage, index) => {
        const active = currentIndex >= 0 && index <= currentIndex
        return (
          <span
            key={stage}
            aria-hidden="true"
            style={{
              background: active ? STAGE_COLORS[stage].accent : "#E5E7EB",
            }}
          />
        )
      })}
    </div>
  )
}
