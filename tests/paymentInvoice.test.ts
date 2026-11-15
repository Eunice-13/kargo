import test from "node:test";
import assert from "node:assert/strict";
import { buildPaymentInvoiceHtml } from "../src/features/payments/paymentInvoice.ts";
import type { VerifyItem } from "../src/features/payments/verifyTypes.ts";

const item: VerifyItem = {
  id: "order-123",
  orderId: "order-123",
  buyer: "Anna Cruz",
  product: "Laneige Lip Mask",
  amount: 950,
  ref: "GC-20260910-3821",
  date: "Sep 10, 2026",
  status: "Verified",
  method: "GCash",
  acctName: "Anna C. Cruz",
  receipt: "receipt_gcash.jpg",
  phone: "0917-823-4410",
  amountPaid: "950",
};

const branding = { shopName: "Kristine's Shop" };

test("invoice shows the shop, buyer, payment details, and paid status", () => {
  const html = buildPaymentInvoiceHtml(item, branding);

  assert.match(html, /Kristine&#39;s Shop/);
  assert.match(html, /Anna Cruz/);
  assert.match(html, /Laneige Lip Mask/);
  assert.match(html, /GC-20260910-3821/);
  assert.match(html, /Paid and Reserved/);
  assert.match(html, /INV-ORDER123/);
});

test("every amount carries two decimals", () => {
  const html = buildPaymentInvoiceHtml(item, branding);

  assert.match(html, /₱950\.00/);
  assert.doesNotMatch(html, /₱950<|₱950\s/);
});

test("invoice escapes customer-provided values", () => {
  const html = buildPaymentInvoiceHtml(
    { ...item, buyer: "<script>alert(1)</script>", product: "A & B" },
    { shopName: "Shop" },
  );

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /A &amp; B/);
});

test("a partial verified payment shows the remaining balance", () => {
  const html = buildPaymentInvoiceHtml({ ...item, amountPaid: "700" }, { shopName: "Shop" });

  assert.match(html, /Balance/);
  assert.match(html, /₱250\.00/);
});

test("the Kargo mark is always an absolute URL so print views can load it", () => {
  const html = buildPaymentInvoiceHtml(item, branding);
  const kargo = html.match(/class="brand-kargo" src="([^"]+)"/);

  assert.ok(kargo, "Kargo mark is rendered");
  assert.match(kargo[1], /^https?:\/\//);
  assert.match(kargo[1], /kargo-logo-head\.png$/);
});

test("a seller logo renders as an escaped absolute image", () => {
  const html = buildPaymentInvoiceHtml(item, {
    ...branding,
    shopLogoUrl: "https://cdn.example.com/logo.png?a=1&b=2",
  });

  assert.match(
    html,
    /class="brand-logo" src="https:\/\/cdn\.example\.com\/logo\.png\?a=1&amp;b=2"/,
  );
  assert.doesNotMatch(html, /class="monogram"/);
});

test("no seller logo falls back to a monogram, never a broken image", () => {
  const html = buildPaymentInvoiceHtml(item, branding);

  assert.match(html, /class="monogram"/);
  assert.match(html, />KS</);
  assert.doesNotMatch(html, /class="brand-logo"/);
});

test("a malformed logo URL also falls back to the monogram", () => {
  const html = buildPaymentInvoiceHtml(item, { ...branding, shopLogoUrl: "javascript:alert(1)" });

  assert.match(html, /class="monogram"/);
  assert.doesNotMatch(html, /javascript:/);
});
