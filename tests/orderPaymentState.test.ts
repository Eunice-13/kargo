import test from "node:test"
import assert from "node:assert/strict"
import { effectiveOrderPaymentStatus } from "../src/services/orderPaymentState.ts"

test("a rejected latest payment makes an awaiting claim payable again", () => {
  assert.equal(
    effectiveOrderPaymentStatus("payment_submitted", [
      { status: "rejected", submitted_at: "2026-09-28T10:00:00Z" },
    ]),
    "payment_pending",
  )
})

test("a resubmission after rejection returns the claim to awaiting verification", () => {
  assert.equal(
    effectiveOrderPaymentStatus("payment_pending", [
      { status: "rejected", submitted_at: "2026-09-28T10:00:00Z" },
      { status: "pending_review", submitted_at: "2026-09-28T11:00:00Z" },
    ]),
    "payment_submitted",
  )
})

test("payment decisions do not reopen terminal orders", () => {
  assert.equal(
    effectiveOrderPaymentStatus("completed", [
      { status: "rejected", submitted_at: "2026-09-28T10:00:00Z" },
    ]),
    "completed",
  )
})
