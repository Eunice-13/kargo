import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
let server, Dialog, Card, SellerDialog, CombinedCard, AvailabilityNotice, PaymentForm;
before(async () => {
  server = await createServer({
    configFile: false,
    envFile: false, // Tests must never load production environment files.
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: /^@\/components\/shared$/,
          replacement: fileURLToPath(new URL("./fixtures/PaymentModalShared.ts", import.meta.url)),
        },
        {
          find: "@/features/payments",
          replacement: fileURLToPath(new URL("./fixtures/BrowserPaymentForm.tsx", import.meta.url)),
        },
        {
          find: "@/components/shared/Modal",
          replacement: fileURLToPath(new URL("./fixtures/RenderModal.tsx", import.meta.url)),
        },
        { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
      ],
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  Dialog = (
    await server.ssrLoadModule("/src/features/combined-delivery/CombinedDeliveryRequestDialog.tsx")
  ).default;
  SellerDialog = (
    await server.ssrLoadModule("/src/features/combined-delivery/SellerCombinedDelivery.tsx")
  ).SellerDeliveryDialog;
  PaymentForm = (await server.ssrLoadModule("/src/features/payments/PaymentSubmitModal.tsx"))
    .default;
  AvailabilityNotice = (
    await server.ssrLoadModule("/src/features/combined-delivery/DeliveryAvailabilityNotice.tsx")
  ).default;
  CombinedCard = (
    await server.ssrLoadModule("/src/features/combined-delivery/CombinedPaymentCard.tsx")
  ).default;
  Card = (await server.ssrLoadModule("/src/features/claims/PendingPaymentCard.tsx")).default;
});
after(async () => {
  await server?.close();
});
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
  itemSubtotal: 550,
  product: "Product A",
  qty: 1,
  batchName: "Batch A",
  sellerName: "Shop",
  orderNumber: "ORDER-A",
  pinLat: 14.6,
  pinLng: 121,
  addressText: "Unit 1, Building A",
};
const second = { ...first, id: "b", itemSubtotal: 400, product: "Product B", qty: 2 };
const existing = {
  id: "group",
  status: "pending_approval",
  destination: { pin_lat: 14.6, pin_lng: 121, address_text: first.addressText },
  decision_reason: null,
  members: [first, second].map((order) => ({
    order_id: order.id,
    item_subtotal: order.itemSubtotal,
    released_at: null,
    order: { quantity: order.qty, batch_products: { name: order.product } },
  })),
};
const baseProps = {
  buyerId: "buyer",
  options: [[first, second]],
  busy: false,
  onSubmit: async () => true,
  onCancelRequest: async () => true,
  onClose() {},
  imageForOrder() {},
};
test("opening confirmation renders original products/address and leaves submission disabled without explicit confirmation", () => {
  let submitted = 0;
  const html = renderToStaticMarkup(
    createElement(Dialog, {
      ...baseProps,
      onSubmit: async () => {
        submitted++;
        return true;
      },
    }),
  );
  assert.equal(submitted, 0);
  assert.match(html, /Product A/);
  assert.match(html, /Product B/);
  assert.match(html, /Batch A/);
  assert.match(html, /Unit 1, Building A/);
  assert.match(html, /₱950.00/);
  assert.match(html, /Pending seller review/);
  assert.match(html, /I confirm these selected reservations use this same saved pin/);
  assert.match(html, /<button disabled=""[^>]*>Confirm Request<\/button>/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3);
});
test("pending request details retain individual product amounts and provide buyer cancellation", () => {
  const html = renderToStaticMarkup(createElement(Dialog, { ...baseProps, existing }));
  assert.match(html, /Combined delivery requested/);
  assert.match(html, /Product A/);
  assert.match(html, /Product B/);
  assert.match(html, /₱550.00/);
  assert.match(html, /₱400.00/);
  assert.match(html, /Cancel request/);
  assert.doesNotMatch(html, /Confirm Request/);
});
test("rejected requests show the reason and keep the products, without approval or payment actions", () => {
  const html = renderToStaticMarkup(
    createElement(Dialog, {
      ...baseProps,
      existing: {
        ...existing,
        status: "rejected",
        decision_reason: "Different dispatch requirements",
      },
    }),
  );
  assert.match(html, /Different dispatch requirements/);
  assert.match(html, /Product A/);
  assert.match(html, /individual shipping flow/);
  assert.doesNotMatch(html, /Cancel request|Confirm Request|Pay Now|Approve/);
});
test("card keeps its horizontal layout and replaces the duplicate waiting label with the request status", () => {
  const item = {
    id: "a",
    product: "Product A",
    seller: "Shop",
    batch: "Batch A",
    qty: 1,
    amount: 550,
    hours: 24,
    status: "Pending",
    shippingState: "waiting_for_seller",
  };
  const html = renderToStaticMarkup(
    createElement(
      Card,
      { item, deliveryRequest: existing },
      createElement("button", { disabled: true }, "Pay Now"),
    ),
  );
  assert.match(html, /pending-product-card/);
  assert.match(html, /Combined delivery requested/);
  assert.match(html, /₱550/);
  assert.doesNotMatch(html, />Waiting for seller</);
  assert.match(html, /disabled=""/);
});

const sellerRequest = {
  ...existing,
  shipping_fee: null,
  buyerName: "Buyer A",
  batchName: "Batch A",
  payment_method: "GCash",
};
const sellerProps = { onClose() {}, onUpdated() {} };
test("seller review shows existing products and confirmed destination with separate approve/reject actions", () => {
  const html = renderToStaticMarkup(
    createElement(SellerDialog, { ...sellerProps, request: sellerRequest }),
  );
  assert.match(html, /Buyer A/);
  assert.match(html, /Product A/);
  assert.match(html, /Unit 1, Building A/);
  assert.match(html, /Approve request/);
  assert.match(html, /Reject request/);
  assert.doesNotMatch(html, /Save shared fee|Pay Now/);
});
test("approved request offers one shared fee input and no second approval", () => {
  const html = renderToStaticMarkup(
    createElement(SellerDialog, {
      ...sellerProps,
      request: { ...sellerRequest, status: "awaiting_shipping_fee" },
    }),
  );
  assert.match(html, /One shared shipping fee/);
  assert.match(html, /Save shared fee/);
  assert.match(html, /inputMode="decimal"/);
  assert.doesNotMatch(html, /Approve request|Reject request|Pay Now/);
});
test("assigned fee appears once in group summary with a link to combined payment", () => {
  const request = { ...sellerRequest, status: "shipping_fee_set", shipping_fee: 125.5 };
  for (const html of [
    renderToStaticMarkup(createElement(SellerDialog, { ...sellerProps, request })),
    renderToStaticMarkup(createElement(Dialog, { ...baseProps, existing: request })),
  ]) {
    assert.match(html, /₱950.00/);
    assert.match(html, /₱125.50/);
    assert.match(html, /₱1,075.50/);
    assert.equal((html.match(/₱125.50/g) ?? []).length, 1);
    assert.match(html, /[Pp]ayment|Pending Payments/);
    assert.doesNotMatch(html, /remain paused/);
    assert.doesNotMatch(html, /Save shared fee|Cancel request|Pay Now/);
  }
});

test("approved buyer requests expose eligibility recovery without general cancellation", () => {
  const html = renderToStaticMarkup(
    createElement(Dialog, {
      ...baseProps,
      existing: { ...sellerRequest, status: "awaiting_shipping_fee" },
      onRecoverRequest: async () => true,
    }),
  );
  assert.match(html, /Check eligibility and recover/);
  assert.match(html, /Valid approved requests stay unchanged/);
  assert.doesNotMatch(html, /Cancel request|Pay Now/);
});
test("invalidated buyer and seller summaries preserve historical fee without payable actions", () => {
  const request = {
    ...sellerRequest,
    status: "invalidated",
    shipping_fee: 125.5,
    decision_reason: "Only reservations from the same Pasabuy batch can be combined.",
  };
  for (const html of [
    renderToStaticMarkup(
      createElement(Dialog, {
        ...baseProps,
        existing: request,
        onRecoverRequest: async () => true,
      }),
    ),
    renderToStaticMarkup(createElement(SellerDialog, { ...sellerProps, request })),
  ]) {
    assert.match(html, /Previous combined total/);
    assert.match(html, /₱125.50/);
    assert.match(html, /historical/);
    assert.match(html, /same Pasabuy batch/);
    assert.doesNotMatch(
      html,
      /Check eligibility and recover|Approve request|Save shared fee|Cancel request|Pay Now/,
    );
  }
});

const paymentAccount = {
  group_id: "group",
  items_subtotal: 950,
  shipping_fee: 125.5,
  total: 1075.5,
  deadline: "2099-01-01T00:00:00Z",
  status: "ready",
};
function combinedHtml(status = "ready", deadline = paymentAccount.deadline, extra = {}) {
  return renderToStaticMarkup(
    createElement(CombinedCard, {
      request: {
        ...sellerRequest,
        status: "shipping_fee_set",
        payment: { ...paymentAccount, status, deadline },
      },
      seller: "KARGO Shop",
      imageForOrder: () => undefined,
      onUpdated: async () => {},
      onDetails: () => {},
      ...extra,
    }),
  );
}
test("combined payment uses the compact horizontal card and one shared fee", () => {
  const html = combinedHtml();
  assert.match(html, /pending-product-card/);
  for (const text of [
    "KARGO Shop",
    "Product A",
    "Product B",
    "Items subtotal",
    "Shared shipping fee",
    "₱1,075.50",
    "Pay Now",
    "View details",
  ])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/₱125.50/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<table|Request Extension/);
  assert.doesNotMatch(html, /disabled=""/);
});
test("combined submitted payment cannot be paid again and expiry disables the action", () => {
  const pending = combinedHtml("pending_review");
  assert.match(pending, /Awaiting verification/);
  assert.match(pending, /disabled=""/);
  const expired = combinedHtml("ready", "2000-01-01T00:00:00Z");
  assert.match(expired, /Payment deadline expired/);
  assert.match(expired, /disabled=""/);
  assert.match(combinedHtml("rejected"), /submit a new proof/);
});
test("verified and recovered combined groups do not render a payable card", () => {
  assert.equal(combinedHtml("verified"), "");
  assert.equal(combinedHtml("invalidated"), "");
});

test("known unavailable backend is an accessible notice with no mutation actions", () => {
  const html = renderToStaticMarkup(
    createElement(AvailabilityNotice, {
      error: "Combined delivery is not available yet. Your individual reservations are unchanged.",
      unavailable: true,
      loading: false,
      onRetry() {},
    }),
  );
  assert.match(html, /role="status"/);
  assert.match(html, /Check again/);
  assert.doesNotMatch(html, /Request Combined Delivery|Pay Now|Approve request|Reject request/);
});
test("unexpected backend error remains an alert and supports retry", () => {
  const html = renderToStaticMarkup(
    createElement(AvailabilityNotice, {
      error: "Unable to load combined delivery. Permission denied",
      unavailable: false,
      loading: true,
      onRetry() {},
    }),
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /Permission denied/);
  assert.match(html, /Retry/);
  assert.match(html, /disabled=""/);
});
test("background refresh disables card actions and invalid deadlines cannot enable payment", () => {
  const refreshing = combinedHtml("ready", paymentAccount.deadline, { actionsDisabled: true });
  assert.equal((refreshing.match(/disabled=""/g) ?? []).length, 2);
  const invalid = combinedHtml("ready", "invalid timestamp");
  assert.match(invalid, /Payment details need refreshing/);
  assert.match(invalid, /disabled=""/);
  assert.doesNotMatch(invalid, /role="timer"/);
  assert.match(refreshing, /<article aria-label="Combined delivery payment to KARGO Shop"/);
  assert.match(refreshing, /role="group" aria-label="Payment actions for KARGO Shop"/);
});
test("refreshing seller review disables mutations while keeping Close available", () => {
  const html = renderToStaticMarkup(
    createElement(SellerDialog, { ...sellerProps, request: sellerRequest, actionsDisabled: true }),
  );
  assert.match(html, /disabled=""[^>]*>Approve request/);
  assert.match(html, /disabled=""[^>]*>Reject request/);
  assert.doesNotMatch(html, /disabled=""[^>]*>Close/);
});

test("refreshing combined proof form communicates its disabled submission without changing standalone cash", () => {
  const props = {
    item: {
      id: "group",
      product: "Included products",
      seller: "Shop",
      amount: 1075.5,
      hours: 12,
      expiresAt: "2099-01-01T00:00:00Z",
      reservedPaymentMethod: "Cash on Delivery",
    },
    onConfirm() {},
    onClose() {},
  };
  const combined = renderToStaticMarkup(
    createElement(PaymentForm, { ...props, requireProof: true, submissionDisabled: true }),
  );
  assert.match(combined, /role="status"[^>]*>Checking payment availability/);
  assert.match(combined, /disabled=""[^>]*>Submit Payment/);
  const standalone = renderToStaticMarkup(createElement(PaymentForm, props));
  assert.match(standalone, /Confirm Order/);
  assert.doesNotMatch(standalone, /Checking payment availability/);
});
