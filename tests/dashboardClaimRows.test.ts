import test from "node:test";
import assert from "node:assert/strict";

import type { ClaimRow, PayHistRow } from "../src/types/index.ts";
import {
  claimPreview,
  collapseCombinedClaims,
  combinedByOrderId,
  combinedClaimMembers,
} from "../src/features/dashboard/dashboardClaimRows.ts";

function claim(overrides: Partial<ClaimRow>): ClaimRow {
  return {
    id: "order",
    product: "KitKat",
    batch: "South Korea - Dec. 2026",
    seller: "Eunice Kate Belasa",
    qty: 1,
    amount: 13.5,
    status: "Awaiting Verification",
    hours: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

const combinedPayment: PayHistRow = {
  id: "pay-combined",
  orderId: "order-primary",
  product: "Combined delivery · KitKat × 1, KitKat × 1, KitKat × 1",
  batch: "South Korea - Dec. 2026",
  method: "GCash",
  amount: 65.5,
  date: "11/1/2026",
  status: "Pending",
  combinedDeliveryGroupId: "combined-1",
  reservationIds: ["order-primary", "order-child-1", "order-child-2"],
};

test("combined delivery children collapse into one row keyed by combined group", () => {
  const rows = [
    claim({ id: "order-primary" }),
    claim({ id: "order-child-1" }),
    claim({ id: "order-child-2" }),
  ];

  const collapsed = collapseCombinedClaims(rows, [combinedPayment]);

  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].amount, 65.5);
  assert.equal(collapsed[0].combinedItemCount, 3);
  assert.equal(collapsed[0].combinedDeliveryGroupId, "combined-1");
});

test("a separate claim for the same product is never merged into the combined row", () => {
  const rows = [
    claim({ id: "order-primary" }),
    claim({ id: "order-child-1" }),
    claim({ id: "order-child-2" }),
    // A cancelled, non-combined KitKat claim for the same buyer + seller.
    claim({ id: "order-solo", status: "Cancelled", amount: 27 }),
  ];

  const collapsed = collapseCombinedClaims(rows, [combinedPayment]);

  assert.equal(collapsed.length, 2);
  assert.deepEqual(collapsed.map((row) => row.id).sort(), ["order-solo", "order-primary"].sort());
});

test("actionable Pending / Insufficient rows lead the Recent Claims preview", () => {
  const insufficient = claim({
    id: "order-insufficient",
    status: "Insufficient Payment",
    amount: 33.5,
    shortfallAmount: 3.66,
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  const rows = [
    claim({ id: "order-primary", createdAt: "2026-11-02T00:00:00.000Z" }),
    claim({ id: "order-child-1", createdAt: "2026-11-02T00:00:00.000Z" }),
    claim({ id: "order-child-2", createdAt: "2026-11-02T00:00:00.000Z" }),
    insufficient,
  ];

  const preview = claimPreview(rows, [combinedPayment]);

  assert.equal(preview.length, 2);
  assert.equal(preview[0].id, "order-insufficient");
  assert.equal(preview[0].shortfallAmount, 3.66);
  assert.equal(preview[1].combinedItemCount, 3);
});

test("combinedByOrderId indexes every reservation member", () => {
  const map = combinedByOrderId([combinedPayment]);
  assert.equal(map.size, 3);
  assert.equal(map.get("order-child-2")?.itemCount, 3);
  assert.equal(map.get("order-child-2")?.total, 65.5);
});

test("combined details include different products and exclude unrelated reservations", () => {
  const rows = [
    claim({ id: "order-primary", product: "Product A", productId: "product-a", qty: 1 }),
    claim({ id: "order-child-1", product: "Product B", productId: "product-b", qty: 2 }),
    claim({ id: "order-child-2", product: "Product C", productId: "product-c", qty: 3 }),
    claim({ id: "unrelated", product: "Product A", productId: "product-a" }),
    claim({ id: "another-group", product: "Product B", productId: "product-b" }),
  ];
  const otherPayment = {
    ...combinedPayment,
    id: "pay-other",
    orderId: "another-group",
    reservationIds: ["another-group"],
    combinedDeliveryGroupId: "combined-2",
  };
  const members = combinedClaimMembers("combined-1", rows, [combinedPayment, otherPayment]);
  assert.deepEqual(
    members.map((item) => [item.productId, item.product, item.qty]),
    [
      ["product-a", "Product A", 1],
      ["product-b", "Product B", 2],
      ["product-c", "Product C", 3],
    ],
  );
  assert.deepEqual(combinedClaimMembers("missing", rows, [combinedPayment]), []);
});
