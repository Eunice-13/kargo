import test from "node:test";
import assert from "node:assert/strict";
import {
  groupOrderErrorMessage,
  groupCommitmentMaximum,
  validGroupCommitmentQuantity,
} from "../src/features/batches/groupOrderFeedback.ts";
test("plain Supabase per-buyer rejection is displayed instead of generic fallback", () => {
  assert.equal(
    groupOrderErrorMessage(
      { code: "P0001", message: "Per-buyer limit of 2 reached for this item", details: null },
      "Unable to update group order.",
    ),
    "Per-buyer limit of 2 reached for this item",
  );
});
test("real Error messages remain intact and malformed errors use the fallback", () => {
  assert.equal(
    groupOrderErrorMessage(new Error("Insufficient inventory"), "Fallback"),
    "Insufficient inventory",
  );
  for (const error of [null, {}, "failure", { message: 4 }, { message: " " }])
    assert.equal(groupOrderErrorMessage(error, "Fallback"), "Fallback");
});
test("visible production case cannot submit five against a two-per-buyer cap", () => {
  const max = groupCommitmentMaximum({ qty: 15, claimed: 8, limitPerUser: 2 }, 1);
  assert.equal(max, 2);
  assert(!validGroupCommitmentQuantity(5, max));
  assert(validGroupCommitmentQuantity(2, max));
});
test("replacement quantities include the buyers existing commitment without inflating stock", () => {
  assert.equal(groupCommitmentMaximum({ qty: 10, claimed: 10, limitPerUser: 5 }, 3), 3);
  assert.equal(groupCommitmentMaximum({ qty: 10, claimed: 8 }, 2), 4);
  assert.equal(groupCommitmentMaximum({ qty: 10, claimed: 10 }, 0), 0);
});
test("zero, fractional, nonfinite and above-cap quantities cannot be submitted", () => {
  for (const qty of [0, -1, 1.5, NaN, Infinity, 3]) assert(!validGroupCommitmentQuantity(qty, 2));
  assert(validGroupCommitmentQuantity(1, 2));
});
