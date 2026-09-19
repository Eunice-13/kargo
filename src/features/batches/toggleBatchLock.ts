import type React from "react"
import type { BatchType } from "@/types"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

export function toggleBatchLock(
  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>,
  batchId: number,
  productIndex?: number,
) {
  setBatches((prev) =>
    prev.map((batch) => {
      if (batch.id !== batchId) return batch
      if (productIndex === undefined) {
        if (isSupabaseConfigured && batch.dbId) {
          void kargoApi.setBatchLock(batch.dbId, !batch.locked).catch((error) =>
            alert(error instanceof Error ? error.message : "Unable to update batch lock."),
          )
        }
        return { ...batch, locked: !batch.locked }
      }
      const target = batch.products[productIndex]
      if (isSupabaseConfigured && target?.dbId) {
        void kargoApi.setProductLock(target.dbId, !target.locked).catch((error) =>
          alert(error instanceof Error ? error.message : "Unable to update product lock."),
        )
      }
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

