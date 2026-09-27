import type { ClaimRow, PayHistRow } from "@/types"

function matchesOrder(payment: PayHistRow, claim: ClaimRow) {
  return payment.orderId
    ? String(payment.orderId) === String(claim.id)
    : payment.product === claim.product && payment.batch === claim.batch
}

export function latestClaimPayment(
  claim: ClaimRow,
  payments: PayHistRow[],
) {
  return payments
    .filter((payment) => matchesOrder(payment, claim))
    .sort((left, right) => {
      const leftTime = left.submittedAt
        ? new Date(left.submittedAt).getTime()
        : 0
      const rightTime = right.submittedAt
        ? new Date(right.submittedAt).getTime()
        : 0
      return rightTime - leftTime
    })[0]
}

/** Reconcile a stale awaiting-verification claim with its persisted rejection. */
export function reconcileRejectedClaim(
  claim: ClaimRow,
  payments: PayHistRow[],
  now = Date.now(),
): ClaimRow {
  if (claim.status !== "Awaiting Verification") return claim

  const latestPayment = latestClaimPayment(claim, payments)
  if (latestPayment?.status !== "Rejected") return claim

  const expiresAt = latestPayment.rejectionDeadline ?? claim.expiresAt
  const expires = expiresAt ? new Date(expiresAt).getTime() : Number.NaN
  if (Number.isFinite(expires) && expires <= now) {
    return { ...claim, status: "Expired", expiresAt, hours: 0 }
  }

  return {
    ...claim,
    status: "Pending",
    expiresAt,
    hours: Number.isFinite(expires)
      ? Math.max(1, Math.ceil((expires - now) / 3_600_000))
      : claim.hours,
  }
}
