import { Lock } from "lucide-react"
import { batchEndDatePassed, formatBatchEndDate } from "./batchAvailability"

// The "this batch is over" marker for a gray, inert batch card. It always says
// so in words, so the state never depends on the gray alone.
//
//   large  a full-image banner for the seller's profile page, where closed
//          batches sit at the end of the grid
//   small  a chip for the denser Home cards
export default function ClosedBatchBadge({
  size,
  endsOn,
}: {
  size: "large" | "small"
  endsOn?: string
}) {
  if (size === "small") {
    return (
      <span className="closed-batch-chip">
        <Lock size={11} aria-hidden="true" />
        Batch closed
      </span>
    )
  }
  // Only say "Closed <date>" when that date has actually passed. A batch can
  // also read as closed because the seller locked it or every item is locked,
  // and then the end date may still be in the future.
  const date = batchEndDatePassed(endsOn) ? formatBatchEndDate(endsOn) : ""
  return (
    <div className="closed-batch-banner">
      <Lock size={22} aria-hidden="true" />
      <strong>Batch closed</strong>
      {date && <small>Closed {date}</small>}
    </div>
  )
}
