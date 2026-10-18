// Synthetic fixtures used by the preview gallery and the template tests.
// Every name, amount, and tracking number below is demonstration data.

import type { RenderInput } from "./templates.ts"

const ORDER = "ORD-2026-000148"
const DEADLINE = "2026-10-20T11:42:00Z"
const ETA = "2026-10-22T09:00:00Z"

export const MARIA = "Maria Santos"

const deliveryDetails = {
  orderNumber: ORDER,
  productName: "SK-II Facial Treatment Essence",
  quantity: 1,
  totalAmount: 4800,
  shippingFee: 180,
  orderStatus: "preparing",
  fulfillmentStage: "shipped",
  deadline: DEADLINE,
  paymentMethod: "GCash",
  courier: "J&T Express",
  riderName: "Rodel Cruz",
  riderContact: "0917 555 0142",
  trackingNumber: "JT9821045567",
  trackingUrl: "https://www.jtexpress.ph/track?billcode=JT9821045567",
  eta: ETA,
}

export const SAMPLE_EMAILS: RenderInput[] = [
  {
    template: "payment_submitted",
    subject: "KARGO received your payment submission",
    body: "Your payment submission for order ORD-2026-000148 (SK-II Facial Treatment Essence) was received and is waiting for seller verification.",
    recipientName: MARIA,
    context: { order_id: "0b6f0f2e-1a8c-4e64-9a3d-6f1f2f9b1c11" },
    details: {
      ...deliveryDetails,
      fulfillmentStage: "payment_submitted",
      paymentMethod: "GCash",
    },
  },
  {
    template: "payment_verified",
    subject: "Your KARGO payment was verified",
    body: "Your payment for order ORD-2026-000151 (Torriden Dive-In Serum) was verified. Your order is now confirmed.",
    recipientName: MARIA,
    context: { order_id: "2d8a4c1e-51b7-4a02-8f3e-90c2b7d4a6f2" },
    details: {
      orderNumber: "ORD-2026-000151",
      productName: "Torriden Dive-In Serum",
      quantity: 2,
      totalAmount: 3480,
      shippingFee: 160,
      orderStatus: "confirmed",
      fulfillmentStage: null,
      deadline: DEADLINE,
      paymentMethod: "Maya",
      verifiedAmount: 3480,
      balanceDue: 0,
    },
  },
  {
    template: "payment_insufficient",
    subject: "Your KARGO payment was verified, but a balance remains",
    body: "Your payment for order ORD-2026-000148 (SK-II Facial Treatment Essence) was verified. A remaining balance of PHP 1800.00 still needs to be paid.",
    recipientName: MARIA,
    context: { order_id: "0b6f0f2e-1a8c-4e64-9a3d-6f1f2f9b1c11" },
    details: {
      ...deliveryDetails,
      totalAmount: 4800,
      verifiedAmount: 3000,
      balanceDue: 1800,
      paymentMethod: "GCash",
    },
  },
  {
    template: "payment_rejected",
    subject: "Your KARGO payment was rejected",
    body: "Your payment for order ORD-2026-000148 (SK-II Facial Treatment Essence) was rejected. Reason: The reference number on the receipt is cut off. Submit a new payment proof before the updated deadline shown in KARGO.",
    recipientName: MARIA,
    context: { order_id: "0b6f0f2e-1a8c-4e64-9a3d-6f1f2f9b1c11" },
    details: {
      ...deliveryDetails,
      deadline: "2026-10-21T04:30:00Z",
      paymentRejectionReason: "The reference number on the receipt is cut off. Send a full screenshot of the confirmation.",
    },
  },
  {
    template: "payment_deadline_reminder",
    subject: "One hour left to pay for your KARGO claim",
    body: "Your payment deadline for order ORD-2026-000148 (SK-II Facial Treatment Essence) is less than one hour away. Submit payment in KARGO to keep your reservation.",
    recipientName: MARIA,
    context: { order_id: "0b6f0f2e-1a8c-4e64-9a3d-6f1f2f9b1c11" },
    details: {
      ...deliveryDetails,
      fulfillmentStage: null,
      deadline: "2026-10-19T13:42:00Z",
    },
  },
  {
    template: "order_shipped",
    subject: "Your KARGO order has shipped",
    body: "Your order ORD-2026-000148 for SK-II Facial Treatment Essence has been marked as shipped by the seller.",
    recipientName: MARIA,
    context: { order_id: "0b6f0f2e-1a8c-4e64-9a3d-6f1f2f9b1c11" },
    details: deliveryDetails,
  },
  {
    template: "order_in_transit",
    subject: "Your KARGO order is in transit",
    body: "Your order ORD-2026-000148 for SK-II Facial Treatment Essence is now in transit.",
    recipientName: MARIA,
    context: { order_id: "0b6f0f2e-1a8c-4e64-9a3d-6f1f2f9b1c11" },
    details: { ...deliveryDetails, fulfillmentStage: "in_transit" },
  },
  {
    template: "order_delivered",
    subject: "Your KARGO order was delivered",
    body: "Your order ORD-2026-000148 for SK-II Facial Treatment Essence has been marked as delivered. Open KARGO to review your completed order.",
    recipientName: MARIA,
    context: { order_id: "0b6f0f2e-1a8c-4e64-9a3d-6f1f2f9b1c11" },
    details: { ...deliveryDetails, orderStatus: "completed", fulfillmentStage: "delivered" },
  },
  {
    template: "shipping_fee_needed",
    subject: "A delivery order needs a shipping fee",
    body: "A buyer reserved Seoul Beauty Bundle. The payment deadline is paused until you review the location and set the shipping fee.",
    recipientName: "Jade Bautista",
    context: { order_id: "9c1d5a72-3f4b-4c8e-b1a0-77e5d2c9b3a1" },
    details: {
      orderNumber: "ORD-2026-000152",
      productName: "Seoul Beauty Bundle",
      quantity: 2,
      totalAmount: 2400,
      orderStatus: "payment_pending",
      shippingFee: null,
      deadline: "2026-10-21T02:10:00Z",
    },
  },
  {
    template: "shipping_fee_added",
    subject: "Shipping fee added",
    body: "The seller added a shipping fee of PHP 180.00. Your new total is PHP 2580.00, and your payment deadline has resumed.",
    recipientName: MARIA,
    context: { order_id: "9c1d5a72-3f4b-4c8e-b1a0-77e5d2c9b3a1" },
    details: {
      orderNumber: "ORD-2026-000152",
      productName: "Seoul Beauty Bundle",
      quantity: 2,
      totalAmount: 2400,
      shippingFee: 180,
      orderStatus: "payment_pending",
      deadline: "2026-10-21T02:10:00Z",
    },
  },
  {
    template: "location_correction",
    subject: "Seller requested a location correction",
    body: "Update the delivery pin for ORD-2026-000152. Your payment deadline remains paused.",
    recipientName: MARIA,
    context: { order_id: "9c1d5a72-3f4b-4c8e-b1a0-77e5d2c9b3a1" },
    details: {
      orderNumber: "ORD-2026-000152",
      productName: "Seoul Beauty Bundle",
      quantity: 2,
      totalAmount: 2400,
      orderStatus: "payment_pending",
    },
  },
  {
    template: "delivery_order_declined",
    subject: "Order declined by seller",
    body: "The seller declined ORD-2026-000153. Reason: The pin lands in a different barangay. Please rebook with the correct delivery address.",
    recipientName: MARIA,
    context: {
      order_id: "5e3b8a10-2c7d-4f19-8a6e-13b9c0d7e4f8",
      reason: "The pin lands in a different barangay. Please rebook with the correct delivery address.",
    },
    details: {
      orderNumber: "ORD-2026-000153",
      productName: "Laneige Water Sleeping Mask",
      quantity: 1,
      totalAmount: 1650,
      orderStatus: "cancelled",
      declineReason: "The pin lands in a different barangay. Please rebook with the correct delivery address.",
    },
  },
  {
    template: "claim_expired",
    subject: "Your KARGO claim was cancelled (no payment)",
    body: "Your reservation for SK-II Facial Treatment Essence x1 (ORD-2026-000148) expired because no payment was submitted before the deadline. The stock has been released.",
    recipientName: MARIA,
    context: { order_id: "0b6f0f2e-1a8c-4e64-9a3d-6f1f2f9b1c11" },
    details: {
      orderNumber: ORDER,
      productName: "SK-II Facial Treatment Essence",
      quantity: 1,
      totalAmount: 4800,
      orderStatus: "expired",
    },
  },
  {
    template: "waitlist_auto_claimed",
    subject: "A KARGO waitlist item was added to My Claims",
    body: "3 unit(s) of Torriden Dive-In Serum were automatically added to My Claims. Please submit payment before your reservation timer ends.",
    recipientName: MARIA,
    context: {
      order_id: "2d8a4c1e-51b7-4a02-8f3e-90c2b7d4a6f2",
      product_id: "7f2a9c44-8b1e-4d3a-9c6f-52e8a1b7d3c9",
    },
    details: {
      orderNumber: "ORD-2026-000154",
      productName: "Torriden Dive-In Serum",
      quantity: 3,
      totalAmount: 5220,
      orderStatus: "payment_pending",
      deadline: "2026-10-20T08:00:00Z",
    },
  },
  {
    template: "waitlist_partial_offer",
    subject: "A partial amount of your KARGO waitlist item is available",
    body: "2 unit(s) of Seoul Beauty Bundle are available now, though you asked for 5. Open KARGO to accept or decline before the response window closes.",
    recipientName: MARIA,
    context: {
      waitlist_id: "3a7c2e91-6d4f-4b8a-a2c5-9e1f0d7b6c34",
      product_id: "7f2a9c44-8b1e-4d3a-9c6f-52e8a1b7d3c9",
      offer_quantity: 2,
    },
    details: {
      productName: "Seoul Beauty Bundle",
      offerQuantity: 2,
      desiredQuantity: 5,
    },
  },
]

export const SAMPLE_BRANDING = {
  appUrl: "https://kargo.example",
  logoUrl: "../../../public/kargo-logo-head.png",
  productName: "KARGO",
}
