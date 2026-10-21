import test from "node:test";
import assert from "node:assert/strict";
import { combinedDeliveryEligibility } from "../src/features/combined-delivery/eligibility.ts";
import type { CombinedDeliveryCandidate } from "../src/types/combinedDelivery.ts";

const first: CombinedDeliveryCandidate = {
  id: "order-a",
  buyerId: "buyer",
  sellerId: "seller",
  batchId: "72000000-0000-0000-0000-000000000001",
  destinationId: "confirmed-destination",
  destinationMatches: true,
  fulfillmentMethod: "delivery",
  paymentMethod: "GCash",
  orderStatus: "payment_pending",
  shippingState: "waiting_for_seller",
  shippingFee: null,
  shippingFeeSet: false,
  shippingAccepted: true,
  deadlinePausedAt: "2026-01-01T00:00:00Z",
  expiresAt: "2026-01-02T00:00:00Z",
  groupOrderId: null,
  activeDeliveryGroupId: null,
  hasPaymentHistory: false,
  itemSubtotal: 550,
};
const second: CombinedDeliveryCandidate = { ...first, id: "order-b", itemSubtotal: 400 };
const evaluate = (change: Partial<CombinedDeliveryCandidate>) =>
  combinedDeliveryEligibility([first, { ...second, ...change }], "buyer");
test("same buyer, seller, batch and confirmed destination are eligible without changing reservations", () => {
  const before = JSON.stringify([first, second]);
  assert.deepEqual(combinedDeliveryEligibility([first, second], "buyer"), {
    eligible: true,
    reasons: [],
    feedback: [],
  });
  assert.equal(JSON.stringify([first, second]), before);
});
for (const [label, change, reason] of [
  ["different sellers", { sellerId: "other" }, "different_seller"],
  ["different buyers", { buyerId: "other" }, "different_buyer"],
  ["different batches", { batchId: "72000000-0000-0000-0000-000000000002" }, "different_batch"],
  ["different confirmed destinations", { destinationId: "other" }, "different_destination"],
  ["unconfirmed addresses", { destinationId: null }, "unconfirmed_destination"],
  ["changed address snapshots", { destinationMatches: false }, "destination_changed"],
  ["meetup fulfillment", { fulfillmentMethod: "meetup" }, "not_delivery"],
  ["different payment methods", { paymentMethod: "Maya" }, "different_payment_method"],
  ["missing payment methods", { paymentMethod: null }, "different_payment_method"],
  ["paid reservations", { orderStatus: "payment_confirmed" }, "not_unpaid"],
  ["expired reservations", { orderStatus: "expired" }, "not_unpaid"],
  ["cancelled reservations", { orderStatus: "cancelled" }, "not_unpaid"],
  ["submitted payments", { orderStatus: "payment_submitted" }, "not_unpaid"],
  ["insufficient-payment reservations", { orderStatus: "insufficient_payment" }, "not_unpaid"],
  [
    "prior payment records, including rejected proofs",
    { hasPaymentHistory: true },
    "payment_history",
  ],
  ["existing group orders", { groupOrderId: "group" }, "already_grouped"],
  ["existing active delivery groups", { activeDeliveryGroupId: "group" }, "already_grouped"],
  ["a finalized fee, including zero", { shippingFee: 0 }, "shipping_finalized"],
  ["a fee-set audit timestamp", { shippingFeeSet: true }, "shipping_finalized"],
  [
    "delivery correction pending",
    { shippingState: "correction_requested" },
    "shipping_not_pending",
  ],
  ["shipping not accepted", { shippingAccepted: false }, "shipping_not_accepted"],
  ["unpaused countdowns", { deadlinePausedAt: null }, "not_paused"],
  ["exhausted original time budget", { expiresAt: first.deadlinePausedAt }, "deadline_exhausted"],
  ["invalid deadline timestamps", { expiresAt: "invalid" }, "deadline_exhausted"],
] as Array<[string, Partial<CombinedDeliveryCandidate>, string]>) {
  test(`rejects ${label}`, () => {
    const result = evaluate(change);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes(reason as (typeof result.reasons)[number]));
  });
}
test("single and duplicate reservations cannot create a group", () => {
  assert.equal(combinedDeliveryEligibility([first], "buyer").eligible, false);
  assert.ok(
    combinedDeliveryEligibility([first, first], "buyer").reasons.includes("duplicate_reservation"),
  );
});
test("wall-clock expiry does not invalidate a legitimately paused reservation", () => {
  assert.equal(evaluate({}).eligible, true);
  assert.ok(Date.parse(second.expiresAt) < Date.now());
});

test("strict batch policy rejects missing and malformed IDs even when all values match", () => {
  for (const batchId of ["", "   ", "same display name", "not-a-uuid", null, undefined]) {
    const orders = [first, second].map((order) => ({
      ...order,
      batchId,
    })) as CombinedDeliveryCandidate[];
    const result = combinedDeliveryEligibility(orders, "buyer");
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes("invalid_batch"));
    assert.deepEqual(result.feedback, ["Each reservation must belong to a valid Pasabuy batch."]);
  }
});

test("same seller, buyer, destination and batch display name never override different batch IDs", () => {
  const namedOrders = [
    { ...first, batchName: "Identical batch name" },
    {
      ...second,
      batchName: "Identical batch name",
      batchId: "72000000-0000-0000-0000-000000000002",
    },
  ];
  const result = combinedDeliveryEligibility(namedOrders, "buyer");
  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, ["different_batch"]);
  assert.deepEqual(result.feedback, [
    "Only reservations from the same Pasabuy batch can be combined.",
  ]);
});

test("UUID casing represents the same actual database batch identifier", () => {
  const batchId = "abcdef00-1234-5678-9012-abcdef123456";
  const result = combinedDeliveryEligibility(
    [
      { ...first, batchId },
      { ...second, batchId: batchId.toUpperCase() },
    ],
    "buyer",
  );
  assert.equal(result.eligible, true);
});
