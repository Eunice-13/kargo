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
  receipt: string
  receiptPath?: string
  rejectReason?: string
  rejectionDeadline?: string
  phone?: string
  amountPaid?: string
  contact?: string
}
