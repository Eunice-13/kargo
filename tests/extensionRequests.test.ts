import test from "node:test";
import assert from "node:assert/strict";
import {
  countPendingExtensionRequests,
  extensionRequestStatus,
  type SellerExtensionRequest,
} from "../src/services/extensionRequests.ts";

const deadline = "2026-11-04T12:00:00Z";
const now = Date.parse(deadline);
const request: SellerExtensionRequest = {
  id: "order-1",
  buyer: "Buyer",
  product: "Product",
  batch: "Batch",
  requestedAt: "Nov 4, 2026",
  status: "pending",
  orderStatus: "payment_pending",
  expiresAt: deadline,
};

test("pending requests expire exactly when the unpaused payment timer runs out", () => {
  assert.equal(extensionRequestStatus(request, now - 1), "pending");
  assert.equal(extensionRequestStatus(request, now), "expired");
  assert.equal(extensionRequestStatus(request, now + 1), "expired");
  assert.equal(
    extensionRequestStatus({ ...request, orderStatus: "insufficient_payment" }, now),
    "expired",
  );
});
test("server-expired orders remain expired without a usable deadline", () => {
  assert.equal(
    extensionRequestStatus({ ...request, orderStatus: "expired", expiresAt: undefined }, now),
    "expired",
  );
});
for (const paused of [
  { deadlinePausedAt: "2026-11-04T11:00:00Z" },
  { shippingState: "waiting_for_seller" },
  { shippingState: "correction_requested" },
]) {
  test(`paused shipping never expires from the wall clock: ${JSON.stringify(paused)}`, () => {
    assert.equal(extensionRequestStatus({ ...request, ...paused }, now + 1000), "pending");
  });
}
test("decided requests retain their decision after the deadline", () => {
  for (const status of ["approved", "denied"] as const) {
    assert.equal(extensionRequestStatus({ ...request, status }, now), status);
  }
});
test("submitted, paid and cancelled orders are not marked timer-expired", () => {
  for (const orderStatus of ["payment_submitted", "payment_confirmed", "completed", "cancelled"]) {
    assert.equal(extensionRequestStatus({ ...request, orderStatus }, now), "pending");
  }
});
test("missing or invalid timestamps do not invent an expired timer", () => {
  for (const expiresAt of [undefined, "", "not-a-date"]) {
    assert.equal(extensionRequestStatus({ ...request, expiresAt }, now), "pending");
  }
});
test("pending count excludes expired and decided requests while retaining paused ones", () => {
  const requests = [
    request,
    { ...request, id: "future", expiresAt: "2026-11-05T12:00:00Z" },
    { ...request, id: "paused", deadlinePausedAt: deadline },
    { ...request, id: "approved", status: "approved" as const },
    { ...request, id: "denied", status: "denied" as const },
  ];
  assert.equal(countPendingExtensionRequests(requests, now - 1), 3);
  assert.equal(countPendingExtensionRequests(requests, now), 2);
});
