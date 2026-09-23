import type { ClaimRow, ToPayRow } from "@/types"

type Expirable = Pick<ClaimRow, "status" | "hours" | "expiresAt">

export function deadlineHasPassed(item: Pick<Expirable, "hours" | "expiresAt">, now = Date.now()) {
  if (item.expiresAt) return new Date(item.expiresAt).getTime() <= now
  return item.hours <= 0
}

export function claimIsPayable(claim: Expirable, now = Date.now()) {
  return claim.status === "Pending" && !deadlineHasPassed(claim, now)
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
