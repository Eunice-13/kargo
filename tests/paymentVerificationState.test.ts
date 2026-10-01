import assert from "node:assert/strict"
import test from "node:test"
import {
  rejectionDeadlineHasPassed,
  verificationDisplayStatus,
} from "../src/features/payments/verifyTypes.ts"

const deadline = "2026-09-28T22:00:14.386Z"

test("a rejected payment becomes expired after its resubmission deadline", () => {
  const payment = { status: "Rejected" as const, rejectionDeadline: deadline }

  assert.equal(
    rejectionDeadlineHasPassed(payment, Date.parse("2026-10-01T00:00:00Z")),
    true,
  )
  assert.equal(
    verificationDisplayStatus(payment, Date.parse("2026-10-01T00:00:00Z")),
    "Expired",
  )
})

test("a rejected payment remains pending before its resubmission deadline", () => {
  const payment = { status: "Rejected" as const, rejectionDeadline: deadline }

  assert.equal(
    rejectionDeadlineHasPassed(payment, Date.parse("2026-09-28T21:00:00Z")),
    false,
  )
  assert.equal(
    verificationDisplayStatus(payment, Date.parse("2026-09-28T21:00:00Z")),
    "Pending Payment",
  )
})

test("verified and pending submissions keep their review states", () => {
  assert.equal(verificationDisplayStatus({ status: "Verified" }), "Paid and Reserved")
  assert.equal(verificationDisplayStatus({ status: "Pending" }), "Awaiting Verification")
})
