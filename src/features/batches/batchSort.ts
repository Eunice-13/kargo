import type { BatchType } from "@/types"

// A batch is "sold out" when its claimed count has reached (or exceeded) its
// total items — no claimable inventory remains. Used to sink sold-out batches
// to the bottom of any listing (3.3).
export function isBatchSoldOut(batch: BatchType): boolean {
  return batch.items > 0 && batch.claimed >= batch.items
}

// Stable sort that pushes sold-out batches to the end while preserving the
// incoming order within each group.
export function sortSoldOutLast<T extends BatchType>(batches: T[]): T[] {
  return [...batches].sort(
    (a, b) => Number(isBatchSoldOut(a)) - Number(isBatchSoldOut(b)),
  )
}
