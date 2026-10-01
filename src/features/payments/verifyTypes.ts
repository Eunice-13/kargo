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

export function rejectionDeadlineHasPassed(
  item: Pick<VerifyItem, "status" | "rejectionDeadline">,
  now = Date.now(),
) {
  if (item.status !== "Rejected" || !item.rejectionDeadline) return false

  const deadline = new Date(item.rejectionDeadline).getTime()
  return Number.isFinite(deadline) && deadline <= now
}

export function verificationDisplayStatus(
  item: Pick<VerifyItem, "status" | "rejectionDeadline">,
  now = Date.now(),
) {
  if (item.status === "Verified") return "Paid and Reserved"
  if (item.status === "Pending") return "Awaiting Verification"
  if (rejectionDeadlineHasPassed(item, now)) return "Expired"
  return "Pending Payment"
}
