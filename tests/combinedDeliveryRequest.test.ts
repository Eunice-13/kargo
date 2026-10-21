import test from "node:test";
import assert from "node:assert/strict";
import { combinedDeliveryEligibility } from "../src/features/combined-delivery/eligibility.ts";
import {
  requestSelectionEligibility,
  potentialDeliveryRequests,
  latestDeliveryRequestForOrder,
} from "../src/features/combined-delivery/requestEligibility.ts";
import type {
  CombinedDeliveryRequest,
  CombinedDeliveryRequestCandidate,
} from "../src/types/combinedDelivery.ts";
const first: CombinedDeliveryRequestCandidate = {
  id: "order-a",
  buyerId: "buyer",
  sellerId: "seller",
  batchId: "72000000-0000-0000-0000-000000000001",
  destinationId: null,
  destinationMatches: false,
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
  product: "Product A",
  qty: 1,
  batchName: "Same display name",
  sellerName: "Shop",
  orderNumber: "ORDER-A",
  pinLat: 14.6,
  pinLng: 121,
  addressText: "Unit 1, Building A",
};
const second = {
  ...first,
  id: "order-b",
  product: "Product B",
  orderNumber: "ORDER-B",
  itemSubtotal: 400,
};
test("same exact pin/full address can be offered for explicit confirmation without silently assigning an ID", () => {
  const orders = [first, second];
  const before = JSON.stringify(orders);
  assert.equal(combinedDeliveryEligibility(orders, "buyer").eligible, false);
  assert.equal(potentialDeliveryRequests(orders, "buyer").length, 1);
  assert.equal(requestSelectionEligibility(orders, "buyer").eligible, true);
  assert.equal(JSON.stringify(orders), before);
  assert.equal(first.destinationId, null);
});
for (const [label, patch] of [
  ["other batch with identical title", { batchId: "72000000-0000-0000-0000-000000000002" }],
  ["other buyer", { buyerId: "someone-else" }],
  ["other seller", { sellerId: "other-shop" }],
  ["different payment method", { paymentMethod: "Maya" }],
  ["meetup", { fulfillmentMethod: "meetup" }],
  ["different apartment at the same pin", { addressText: "Unit 2, Building A" }],
  ["nearby but different pin", { pinLat: 14.600001 }],
  ["URL-only/missing pin", { pinLat: null }],
  ["empty address", { addressText: "" }],
  ["paid", { orderStatus: "payment_confirmed" }],
  ["expired", { orderStatus: "expired" }],
  ["cancelled", { orderStatus: "cancelled" }],
  ["old payment history", { hasPaymentHistory: true }],
  ["shipping finalized at zero", { shippingFee: 0 }],
  ["active delivery membership", { activeDeliveryGroupId: "group" }],
  ["multi-buyer group", { groupOrderId: "group" }],
  ["changed confirmed destination", { destinationId: "confirmed", destinationMatches: false }],
  ["shipping correction", { shippingState: "correction_requested" }],
] as Array<[string, Partial<CombinedDeliveryRequestCandidate>]>) {
  test(`never offers a request for ${label}`, () => {
    assert.equal(potentialDeliveryRequests([first, { ...second, ...patch }], "buyer").length, 0);
    assert.equal(
      requestSelectionEligibility([first, { ...second, ...patch }], "buyer").eligible,
      false,
    );
  });
}
test("one eligible product has no combine action and three allow eligible subsets", () => {
  assert.equal(potentialDeliveryRequests([first], "buyer").length, 0);
  const third = { ...first, id: "order-c" };
  assert.equal(potentialDeliveryRequests([first, second, third], "buyer")[0].length, 3);
  assert.equal(requestSelectionEligibility([first, third], "buyer").eligible, true);
});
test("ineligible products are excluded without preventing unrelated eligible reservations", () => {
  const groups = potentialDeliveryRequests(
    [first, second, { ...first, id: "paid", orderStatus: "payment_confirmed" }],
    "buyer",
  );
  assert.deepEqual(
    groups[0].map((order) => order.id),
    ["order-a", "order-b"],
  );
});
test("separate confirmed destinations never merge, even with identical coordinates and strings", () => {
  const a = { ...first, destinationId: "a", destinationMatches: true };
  const b = { ...second, destinationId: "b", destinationMatches: true };
  assert.equal(requestSelectionEligibility([a, b], "buyer").eligible, false);
  assert.equal(potentialDeliveryRequests([a, b], "buyer").length, 0);
  assert.equal(requestSelectionEligibility([a, second], "buyer").eligible, true);
});
test("active/rejected request association is per reservation, not seller name", () => {
  const requests = [
    { id: "rejected", status: "rejected", members: [{ order_id: "order-a" }] },
    { id: "pending", status: "pending_approval", members: [{ order_id: "order-b" }] },
  ] as CombinedDeliveryRequest[];
  assert.equal(latestDeliveryRequestForOrder(requests, "order-a")?.status, "rejected");
  assert.equal(latestDeliveryRequestForOrder(requests, "order-b")?.status, "pending_approval");
  assert.equal(latestDeliveryRequestForOrder(requests, "unrelated"), undefined);
});
