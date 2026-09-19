import type React from "react"
import type { BatchType } from "@/types"

export function toggleBatchLock(
  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>,
  batchId: number,
  productIndex?: number,
) {
  setBatches((prev) =>
    prev.map((batch) => {
      if (batch.id !== batchId) return batch
      if (productIndex === undefined) return { ...batch, locked: !batch.locked }
      return {
        ...batch,
        products: batch.products.map((product, index) =>
          index === productIndex
            ? { ...product, locked: !product.locked }
            : product,
        ),
      }
    }),
  )
}

