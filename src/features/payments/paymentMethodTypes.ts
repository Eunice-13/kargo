import type { EntityId } from "@/types"

export type PayMethod = {
  id: EntityId
  name: string
  detail: string
  icon: string
  verified: boolean
  // Public URL of the seller's uploaded payment QR image, if any.
  qrUrl?: string
}
