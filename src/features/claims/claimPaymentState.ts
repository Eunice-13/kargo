import type { ClaimRow, ClaimStatus, PayHistRow } from "@/types"

export type SellerOrderReceivedStatus =
  | "Pending"
  | "Awaiting Verification"
  | "Verified"
  | "Expired"
  | "Cancelled"

type SellerPaymentReviewStatus = "Pending" | "Verified" | "Rejected"

export function sellerOrderReceivedStatus(
  claimStatus: ClaimStatus,
  paymentStatus?: SellerPaymentReviewStatus,
): SellerOrderReceivedStatus {
  // The order lifecycle is canonical. A historical payment decision must not
  // reopen or relabel an order that has already expired or been cancelled.
  if (claimStatus === "Expired" || claimStatus === "Cancelled") {
    return claimStatus
  }
  if (claimStatus === "Paid and Reserved") return "Verified"

  if (paymentStatus === "Verified") return "Verified"
  if (paymentStatus === "Pending") return "Awaiting Verification"
  if (paymentStatus === "Rejected") return "Pending"

  if (claimStatus === "Awaiting Verification") return "Awaiting Verification"
  return "Pending"
}

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
