import test from "node:test"
import assert from "node:assert/strict"
import { productAvailability } from "../src/features/batches/productAvailability.ts"

const product = { qty: 2, claimed: 1, waitlist: 0, waitlistLimit: 2 }

test("last claim closes claims but leaves configured waitlist open", () => {
  assert.equal(productAvailability(product).canClaim, true)
  const full = productAvailability({ ...product, claimed: 2 })
  assert.equal(full.canClaim, false)
  assert.equal(full.canWaitlist, true)
  assert.equal(full.fullyLocked, false)
})

test("last waitlist slot fully locks the sold-out product", () => {
  const full = productAvailability({ ...product, claimed: 2, waitlist: 2 })
  assert.equal(full.canClaim, false)
  assert.equal(full.canWaitlist, false)
  assert.equal(full.fullyLocked, true)
  assert.equal(productAvailability({ ...product, claimed: 3, waitlist: 3 }).fullyLocked, true)
})

test("released capacity automatically reopens the appropriate action", () => {
  assert.equal(productAvailability({ ...product, claimed: 2, waitlist: 1 }).canWaitlist, true)
  assert.equal(productAvailability({ ...product, waitlist: 2 }).canClaim, true)
})

test("manual product and batch locks block both actions", () => {
  for (const claimed of [1, 2]) {
    for (const state of [productAvailability({ ...product, claimed, locked: true }), productAvailability({ ...product, claimed }, true)]) {
      assert.equal(state.canClaim, false)
      assert.equal(state.canWaitlist, false)
      assert.equal(state.fullyLocked, true)
    }
  }
})

test("an unset waitlist limit preserves the existing unlimited queue", () => {
  assert.equal(productAvailability({ ...product, claimed: 2, waitlist: 100, waitlistLimit: undefined }).canWaitlist, true)
})

test("zero waitlist slots locks at claim capacity without accepting a queue", () => {
  assert.equal(productAvailability({ ...product, waitlistLimit: 0 }).canClaim, true)
  const full = productAvailability({ ...product, claimed: 2, waitlistLimit: 0 })
  assert.equal(full.canWaitlist, false)
  assert.equal(full.fullyLocked, true)
})
