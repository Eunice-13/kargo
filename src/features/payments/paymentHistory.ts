import type { ClaimRow, PayHistRow } from "@/types"

export function completedPayments(payHistory: PayHistRow[], claims: ClaimRow[]) {
  // A payment attempt is history, but the order's latest attempt determines
  // its current state. Do not show an older verified attempt as paid when a
  // newer rejection has reopened that same order for payment.
  const latestPaymentIds = new Set<string>()
  const seenOrders = new Set<string>()
  for (const payment of [...payHistory].sort((left, right) => {
    const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0
    const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0
    return rightTime - leftTime
  })) {
    if (!payment.orderId) {
      latestPaymentIds.add(String(payment.id))
      continue
    }
    const orderId = String(payment.orderId)
    if (seenOrders.has(orderId)) continue
    seenOrders.add(orderId)
    latestPaymentIds.add(String(payment.id))
  }

  return payHistory
    .filter(
      (payment) =>
        payment.status === "Paid and Reserved" &&
        latestPaymentIds.has(String(payment.id)) &&
        (!payment.orderId ||
          claims.some(
            (claim) =>
              String(claim.id) === String(payment.orderId) &&
              claim.status === "Paid and Reserved",
          )),
    )
    .sort((left, right) => {
      const leftTime = left.submittedAt
        ? new Date(left.submittedAt).getTime()
        : Number(left.id) || 0
      const rightTime = right.submittedAt
        ? new Date(right.submittedAt).getTime()
        : Number(right.id) || 0
      return rightTime - leftTime
    })

}
