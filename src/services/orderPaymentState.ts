type PaymentStateSnapshot = {
  status: string
  submitted_at?: string | null
  shortfall_amount?: number | string | null
}

export type OrderClaimLabel =
  | "Pending"
  | "Awaiting Verification"
  | "Paid and Reserved"
  | "Insufficient Payment"
  | "Expired"
  | "Cancelled"

/** The buyer/seller-facing label for a raw order status. */
export function orderStatusToClaimLabel(orderStatus: string): OrderClaimLabel {
  if (orderStatus === "expired") return "Expired"
  if (orderStatus === "cancelled" || orderStatus === "incomplete") return "Cancelled"
  if (orderStatus === "insufficient_payment") return "Insufficient Payment"
  if (orderStatus === "payment_submitted") return "Awaiting Verification"
  if (["payment_confirmed", "preparing", "completed"].includes(orderStatus)) {
    return "Paid and Reserved"
  }
  return "Pending"
}

const TERMINAL_ORDER_STATUSES = new Set([
  "payment_confirmed",
  "preparing",
  "completed",
  "expired",
  "cancelled",
])

/**
 * Resolve the buyer-facing order state from the latest payment decision.
 * The payment row is the authoritative review record, so this also handles a
 * briefly stale order snapshot after the seller accepts or rejects proof.
 */
export function effectiveOrderPaymentStatus(
  orderStatus: string,
  payments: PaymentStateSnapshot[] | null | undefined,
) {
  if (TERMINAL_ORDER_STATUSES.has(orderStatus)) return orderStatus

  const latestPayment = [...(payments ?? [])].sort((left, right) => {
    const leftTime = left.submitted_at
      ? new Date(left.submitted_at).getTime()
      : 0
    const rightTime = right.submitted_at
      ? new Date(right.submitted_at).getTime()
      : 0
    return rightTime - leftTime
  })[0]

  if (latestPayment?.status === "rejected") {
    return Number(latestPayment.shortfall_amount ?? 0) > 0
      ? "insufficient_payment"
      : "payment_pending"
  }
  if (latestPayment?.status === "pending_review") return "payment_submitted"
  return orderStatus
}
