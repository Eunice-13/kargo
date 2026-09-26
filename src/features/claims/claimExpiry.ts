import type { ClaimRow, ToPayRow } from "@/types"

type Expirable = Pick<ClaimRow, "status" | "hours" | "expiresAt">

export function deadlineHasPassed(item: Pick<Expirable, "hours" | "expiresAt">, now = Date.now()) {
  if (item.expiresAt) return new Date(item.expiresAt).getTime() <= now
  return item.hours <= 0
}

// A claim is payable when the seller is waiting for (re)payment: a fresh
// "Pending" claim, or one the seller marked "Insufficient Payment" (a short
// payment the buyer can top up). "Awaiting Verification" — proof submitted,
// pending the seller's decision — is intentionally NOT payable.
export function claimIsPayable(claim: Expirable, now = Date.now()) {
  return (
    (claim.status === "Pending" || claim.status === "Insufficient Payment") &&
    !deadlineHasPassed(claim, now)
  )
}

export function expireClaimRows(claims: ClaimRow[], now = Date.now()) {
  return claims.map((claim) =>
    claim.status === "Pending" && deadlineHasPassed(claim, now)
      ? { ...claim, status: "Expired" as const, hours: 0 }
      : claim,
  )
}

export function removeExpiredPayments(toPay: ToPayRow[], claims: ClaimRow[], now = Date.now()) {
  const expiredIds = new Set(
    claims
      .filter((claim) => claim.status === "Pending" && deadlineHasPassed(claim, now))
      .map((claim) => String(claim.id)),
  )
  const expiredClaims = claims.filter((claim) => claim.status === "Pending" && deadlineHasPassed(claim, now))
  return toPay.filter((item) =>
    !expiredIds.has(String(item.orderId ?? item.id)) &&
    !expiredClaims.some((claim) => claim.product === item.product && claim.seller === item.seller),
  )
}
