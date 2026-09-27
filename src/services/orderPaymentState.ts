type PaymentStateSnapshot = {
  status: string
  submitted_at?: string | null
}

const TERMINAL_ORDER_STATUSES = new Set([
  "payment_confirmed",
  "preparing",
  "completed",
  "expired",
  "cancelled",
  "incomplete",
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

  if (latestPayment?.status === "rejected") return "payment_pending"
  if (latestPayment?.status === "pending_review") return "payment_submitted"
  return orderStatus
}
