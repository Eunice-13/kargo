import test from "node:test";
import assert from "node:assert/strict";

import {
  amountCoversDue,
  confirmPaymentCopy,
} from "../src/features/payments/confirmPaymentWarning.ts";

const base = { amount: 1000, product: "Yokan Red Bean", method: "GCash" as string };

test("a payment covering the full amount due locks the order and warns about cancellation", () => {
  const copy = confirmPaymentCopy({ ...base, amountPaid: "1000" });
  assert.equal(amountCoversDue({ ...base, amountPaid: "1000" }), true);
  assert.equal(copy.locksOrder, true);
  assert.match(copy.warning ?? "", /can no longer be cancelled/i);
  assert.equal(copy.confirmLabel, "Confirm Payment");
});

test("an overpayment also fully confirms and locks", () => {
  const copy = confirmPaymentCopy({ ...base, amountPaid: "1500" });
  assert.equal(copy.locksOrder, true);
  assert.match(copy.warning ?? "", /can no longer be cancelled/i);
});

test("a short/partial payment is NOT locked and does not claim it cannot be cancelled", () => {
  const item = { ...base, amountPaid: "600" };
  assert.equal(amountCoversDue(item), false);
  const copy = confirmPaymentCopy(item);
  assert.equal(copy.locksOrder, false);
  // Must stay accurate for partial payments: no uncancellable claim.
  assert.doesNotMatch(copy.warning ?? "", /can no longer be cancelled/i);
  assert.match(copy.warning ?? "", /insufficient|short|still be cancelled/i);
});

test("Cash on Meetup has no amount to compare and is treated as a full confirmation", () => {
  const item = {
    amount: 1000,
    product: "Meetup Order",
    method: "Cash on Meetup",
    amountPaid: undefined,
  };
  assert.equal(amountCoversDue(item), true);
  assert.equal(confirmPaymentCopy(item).locksOrder, true);
});

test("a missing or non-numeric submitted amount defaults to a full confirmation", () => {
  assert.equal(amountCoversDue({ ...base, amountPaid: undefined }), true);
  assert.equal(amountCoversDue({ ...base, amountPaid: "" }), true);
  assert.equal(amountCoversDue({ ...base, amountPaid: "not-a-number" }), true);
});

test("the exact-to-the-peso amount counts as covering the amount due", () => {
  assert.equal(amountCoversDue({ ...base, amount: 999.5, amountPaid: "999.5" }), true);
  assert.equal(amountCoversDue({ ...base, amount: 999.5, amountPaid: "999.49" }), false);
});
