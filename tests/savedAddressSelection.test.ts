import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultAddressAutofill,
  savedAddressPin,
} from "../src/components/shared/savedAddressSelection.ts";
const home = {
  id: "home",
  buyer_id: "buyer",
  label: "Home",
  address_text: "Unit 1, Home",
  pin_lat: 14.6,
  pin_lng: 121,
  is_default: true,
  created_at: "",
  updated_at: "",
};
const work = { ...home, id: "work", label: "Work", address_text: "Office", is_default: false };
test("accounts without saved addresses preserve the one-time flow", () =>
  assert.equal(defaultAddressAutofill({}, []), undefined));
test("autofill selects the explicit default, not array order", () =>
  assert.equal(defaultAddressAutofill({}, [work, home]), home));
test("never overwrite in-progress custom addresses or resolving pins", () => {
  for (const value of [
    { lat: 0 },
    { lng: 0 },
    { address: "One time" },
    { isResolvingAddress: true },
  ])
    assert.equal(defaultAddressAutofill(value, [home]), undefined);
});
test("selection copies address scalars without mutable saved-address dependencies", () => {
  const selected = savedAddressPin(home);
  const reservation = { pinLat: selected.lat, pinLng: selected.lng, pinAddress: selected.address };
  selected.address = "One time edit";
  assert.equal(home.address_text, "Unit 1, Home");
  const edited = { ...home, address_text: "New address", pin_lat: 15 };
  assert.notEqual(edited.address_text, reservation.pinAddress);
  assert.deepEqual(reservation, { pinLat: 14.6, pinLng: 121, pinAddress: "Unit 1, Home" });
  assert.deepEqual(Object.keys(savedAddressPin(work)).sort(), ["address", "lat", "lng"]);
});

test("saved address snapshots preserve strict combined-delivery matching", async () => {
  const { requestSelectionEligibility } =
    await import("../src/features/combined-delivery/requestEligibility.ts");
  const pin = savedAddressPin(home);
  const first = {
    id: "a",
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
    itemSubtotal: 100,
    product: "Test",
    qty: 1,
    batchName: "Batch",
    sellerName: "Seller",
    orderNumber: "A",
    pinLat: pin.lat!,
    pinLng: pin.lng!,
    addressText: pin.address!,
  };
  const second = { ...first, id: "b" };
  assert(requestSelectionEligibility([first, second], "buyer").eligible);
  assert(
    !requestSelectionEligibility([first, { ...second, addressText: "Different unit" }], "buyer")
      .eligible,
  );
  assert(
    !requestSelectionEligibility(
      [first, { ...second, batchId: "72000000-0000-0000-0000-000000000002" }],
      "buyer",
    ).eligible,
  );
});
