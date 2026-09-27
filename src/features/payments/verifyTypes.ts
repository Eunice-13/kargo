import type { EntityId } from "@/types"

export type VerifyItem = {
  id: EntityId
  orderId?: string
  buyer: string
  product: string
  amount: number
  ref: string
  date: string
  submittedAt?: string
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
  buyerNotified?: boolean
}
