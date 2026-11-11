import test from "node:test"
import assert from "node:assert/strict"
import { buildPaymentInvoiceHtml } from "../src/features/payments/paymentInvoice.ts"
import type { VerifyItem } from "../src/features/payments/verifyTypes.ts"

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
}

test("invoice shows the shop, buyer, payment details, and paid status", () => {
  const html = buildPaymentInvoiceHtml(item, "Kristine's Shop")

  assert.match(html, /Kristine&#39;s Shop/)
  assert.match(html, /Anna Cruz/)
  assert.match(html, /Laneige Lip Mask/)
  assert.match(html, /GC-20260910-3821/)
  assert.match(html, /Paid and Reserved/)
  assert.match(html, /INV-ORDER123/)
  assert.match(html, /₱950/)
})

test("invoice escapes customer-provided values", () => {
  const html = buildPaymentInvoiceHtml(
    { ...item, buyer: "<script>alert(1)</script>", product: "A & B" },
    "Shop",
  )

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /A &amp; B/)
})

test("a partial verified payment shows the remaining balance", () => {
  const html = buildPaymentInvoiceHtml({ ...item, amountPaid: "700" }, "Shop")

  assert.match(html, /Balance/)
  assert.match(html, /₱250/)
})
