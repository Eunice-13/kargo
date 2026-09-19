import type { EntityId } from "@/types"

export type VerifyItem = {
  id: EntityId
  buyer: string
  product: string
  amount: number
  ref: string
  date: string
  status: "Pending" | "Verified" | "Rejected"
  method: string
  acctName: string
  acctNum: string
  receipt: string
  rejectReason?: string
  phone?: string
  amountPaid?: string
  contact?: string
}
