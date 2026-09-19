import type { EntityId } from "@/types"

export type PayMethod = {
  id: EntityId
  name: string
  detail: string
  icon: string
  verified: boolean
}
