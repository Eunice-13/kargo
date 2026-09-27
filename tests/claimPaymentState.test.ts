import test from "node:test"
import assert from "node:assert/strict"
import { reconcileRejectedClaim } from "../src/features/claims/claimPaymentState.ts"
import type { ClaimRow, PayHistRow } from "../src/types/index.ts"

const claim: ClaimRow = {
  id: "order-sk-ii",
  product: "SK-II Essence",
  batch: "Singapore Skincare Edit",
  seller: "Jade Bautista",
  qty: 1,
  amount: 4800,
  status: "Awaiting Verification",
  hours: 0,
}

test("persisted rejection returns an awaiting claim to payable pending", () => {
  const rejected: PayHistRow = {
    id: "payment-1",
    orderId: "order-sk-ii",
    submittedAt: "2026-09-28T10:00:00Z",
    product: claim.product,
    batch: claim.batch,
    method: "Cash on Delivery",
    amount: 4800,
    date: "9/28/2026",
    status: "Rejected",
    rejectionDeadline: "2026-09-29T10:00:00Z",
  }

  const result = reconcileRejectedClaim(
    claim,
    [rejected],
    new Date("2026-09-28T12:00:00Z").getTime(),
  )

  assert.equal(result.status, "Pending")
  assert.equal(result.hours, 22)
})

test("a newer resubmission remains awaiting verification", () => {
  const result = reconcileRejectedClaim(claim, [
    {
      id: "payment-rejected",
      orderId: "order-sk-ii",
      submittedAt: "2026-09-28T10:00:00Z",
      product: claim.product,
      batch: claim.batch,
      method: "Cash on Delivery",
      amount: 4800,
      date: "9/28/2026",
      status: "Rejected",
    },
    {
      id: "payment-new",
      orderId: "order-sk-ii",
      submittedAt: "2026-09-28T11:00:00Z",
      product: claim.product,
      batch: claim.batch,
      method: "Cash on Delivery",
      amount: 4800,
      date: "9/28/2026",
      status: "Pending",
    },
  ])

  assert.equal(result.status, "Awaiting Verification")
})
