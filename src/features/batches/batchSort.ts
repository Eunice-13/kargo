import type { BatchType } from "@/types"
import { batchCardClosed } from "./batchAvailability"

// A batch is "sold out" when its claimed count has reached (or exceeded) its
// total items — no claimable inventory remains. Used to sink sold-out batches
// to the bottom of any listing (3.3).
export function isBatchSoldOut(batch: BatchType): boolean {
  return batch.items > 0 && batch.claimed >= batch.items
}

// Listing priority: open first, sold-out next, closed last. Closed batches stay
// visible as history but never sit above a batch a buyer can still join.
function listingRank(batch: BatchType): number {
  if (batchCardClosed(batch)) return 2
  return isBatchSoldOut(batch) ? 1 : 0
}

// Stable sort that pushes sold-out batches to the end — and closed batches
// after those — while preserving the incoming order within each group.
export function sortSoldOutLast<T extends BatchType>(batches: T[]): T[] {
  return [...batches].sort((a, b) => listingRank(a) - listingRank(b))
}

// Stable sort that moves only closed batches to the end, leaving the incoming
// order (newest, most favorited) intact among the rest. For lists that already
// have their own ranking, such as Home's Latest and Popular.
export function sortClosedLast<T extends BatchType>(batches: T[]): T[] {
  return [...batches].sort(
    (a, b) => Number(batchCardClosed(a)) - Number(batchCardClosed(b)),
  )
}
