import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
let server;
let Card;
let PrimaryBtn;
let PaymentHint;
let claimIsPayable;
before(async () => {
  server = await createServer({
    configFile: false,
    envFile: false, // Tests must never load production environment files.
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  Card = (await server.ssrLoadModule("/src/features/claims/PendingPaymentCard.tsx")).default;
  PaymentHint = (await server.ssrLoadModule("/src/features/claims/PendingPaymentHint.tsx")).default;
  PrimaryBtn = (await server.ssrLoadModule("/src/components/shared/PrimaryBtn.tsx")).default;
  claimIsPayable = (await server.ssrLoadModule("/src/features/claims/claimExpiry.ts"))
    .claimIsPayable;
});
after(async () => {
  await server?.close();
});
const claim = {
  id: "checkout-a",
  product: "Test product",
  seller: "Test shop",
  batch: "Test batch",
  qty: 2,
  amount: 1200,
  status: "Pending",
  hours: 48,
  reservedPaymentMethod: "GCash",
  shippingApplies: true,
  shippingState: "waiting_for_seller",
};
const render = (item) =>
  renderToStaticMarkup(
    createElement(
      Card,
      { item },
      createElement(
        PaymentHint,
        { waiting: item.shippingState === "waiting_for_seller" },
        createElement(PrimaryBtn, { size: "sm", disabled: !claimIsPayable(item) }, "Pay Now"),
      ),
    ),
  );
test("product cards show product, seller, quantity and the original amount", () => {
  const html = render(claim);
  assert.match(html, /class="kargo-card p-5 pending-product-card"/);
  assert.match(html, /Test product/);
  assert.doesNotMatch(html, /Test batch/);
  assert.match(html, /Test shop/);
  assert.match(html, /GCash/);
  assert.match(html, /Qty: 2/);
  assert.match(html, /₱1,200/);
  assert.doesNotMatch(html, /<details|Payment breakdown|Unit price|Items subtotal|checkout-shop/);
});
test("waiting keeps the existing status and disabled action", () => {
  const html = render(claim);
  assert.match(html, /Waiting for seller/);
  assert.match(html, /Shipping fee pending/);
  assert.doesNotMatch(html, /role="dialog"/);
  assert.match(
    html,
    /class="pending-pay-help__trigger" tabindex="0" role="button" aria-label="Why Pay Now is unavailable" aria-haspopup="dialog" aria-expanded="false"/,
  );
  assert.doesNotMatch(html, /Why payment is waiting|lucide-info/);
  assert.match(html, /<button disabled=""[^>]*>Pay Now<\/button>/);
  assert.doesNotMatch(html, /Paused — waiting for seller/);
});
test("finalized shipping displays the unchanged inclusive amount and allows payment", () => {
  const html = render({ ...claim, amount: 1350, shippingFee: 150, shippingState: "fee_set" });
  assert.match(html, /₱1,350/);
  assert.match(html, /Awaiting payment/);
  assert.match(html, /Includes ₱150 shipping/);
  assert.doesNotMatch(html, /Waiting for seller|Shipping fee pending|disabled=""/);
});
test("independent records retain separate product cards and eligibility", () => {
  const items = [
    claim,
    { ...claim, id: "second", shippingState: "fee_set", shippingFee: 0 },
    { ...claim, id: "third", seller: "Another shop", batch: "Another batch" },
  ];
  const html = items.map(render).join("");
  assert.equal((html.match(/class="kargo-card p-5 pending-product-card"/g) ?? []).length, 3);
  assert.equal((html.match(/<button disabled=""/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Another batch/);
  assert.match(html, /Another shop/);
});
test("correction and insufficient payment retain their distinct statuses", () => {
  const correction = render({ ...claim, shippingState: "correction_requested" });
  assert.match(correction, /Seller requested a corrected delivery location/);
  assert.match(correction, /<button disabled=""/);
  const insufficient = render({
    ...claim,
    status: "Insufficient Payment",
    shippingState: "fee_set",
    shippingFee: 0,
  });
  assert.match(insufficient, /Insufficient Payment/);
  assert.doesNotMatch(insufficient, /disabled=""/);
});
test("actual product images are used when supplied and the existing fallback remains", () => {
  const html = renderToStaticMarkup(
    createElement(Card, { item: claim, imageUrl: "https://example.com/product.jpg" }),
  );
  assert.match(html, /src="https:\/\/example.com\/product.jpg"/);
  assert.match(html, /alt="Test product"/);
  assert.match(render(claim), /<img[^>]+src="https:\/\/images.unsplash.com/);
});
test("aggregate group records retain their amount and are not split into invented products", () => {
  const html = render({
    ...claim,
    groupOrderId: "group-a",
    product: "Group Order · 2 items",
    qty: 5,
  });
  assert.equal((html.match(/class="kargo-card p-5 pending-product-card"/g) ?? []).length, 1);
  assert.match(html, /₱1,200/);
  assert.match(html, /Qty: 5/);
});

test("photo preview remains available alongside combined delivery status", () => {
  const html = renderToStaticMarkup(createElement(Card, {
    item: claim,
    onPreview: () => {},
    deliveryRequest: { status: "pending_approval" },
  }));
  assert.match(html, /aria-label="Enlarge photo of Test product"/);
  assert.match(html, /Combined delivery requested/);
  assert.doesNotMatch(html, /Waiting for seller/);
});
