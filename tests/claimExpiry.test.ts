import test from "node:test"
import assert from "node:assert/strict"
import { claimIsPayable, expireClaimRows, removeExpiredPayments } from "../src/features/claims/claimExpiry.ts"
import type { ClaimRow, ToPayRow } from "../src/types/index.ts"

const expiredClaim: ClaimRow = {
  id: "order-expired",
  product: "Thai Snack Box",
  batch: "Bangkok Haul",
  seller: "Kristine Aquino",
  qty: 2,
  amount: 1300,
  status: "Pending",
  hours: 0,
  expiresAt: "2026-01-01T00:00:00.000Z",
}

test("an expired pending claim is immediately non-payable and visibly Expired", () => {
  const now = new Date("2026-01-01T00:00:01.000Z").getTime()
  assert.equal(claimIsPayable(expiredClaim, now), false)
  assert.equal(expireClaimRows([expiredClaim], now)[0].status, "Expired")
})

test("an expired claim is removed from all payment actions", () => {
  const now = new Date("2026-01-01T00:00:01.000Z").getTime()
  const toPay: ToPayRow[] = [{ id: "order-expired", orderId: "order-expired", product: "Thai Snack Box", seller: "Kristine Aquino", amount: 1300, hours: 0, expiresAt: expiredClaim.expiresAt }]
  assert.deepEqual(removeExpiredPayments(toPay, [expiredClaim], now), [])
})
