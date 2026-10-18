import type { FulfillmentOrder } from "@/types"

// Seed data for the Fulfillment Board. The live copy lives in App() state
// (`fulfillment`) so the Dashboard board and the Orders board stay in sync.
export const FULFILLMENT_INIT: FulfillmentOrder[] = [
  {
    id: "ful-5",
    col: "Payment Confirmed",
    perspective: "seller",
    buyer: "Anna Bautista",
    product: "Shiseido Sunscreen",
    qty: 1,
    amount: 1650,
  },
  {
    id: "ful-6",
    col: "Shipped",
    perspective: "seller",
    buyer: "Ben Torres",
    product: "COSRX Snail Cream",
    qty: 2,
    amount: 1560,
    fulfillmentStage: "shipped",
    courierCompany: "Ninja Van",
    riderName: "Marco Dela Cruz",
    riderContact: "+63 917 555 0142",
    trackingNumber: "NVPHDMO0043",
    eta: "2026-10-20T17:00:00.000Z",
    deliveryPinLat: 14.5995,
    deliveryPinLng: 120.9842,
  },
  {
    id: "ful-7",
    col: "Delivered",
    perspective: "seller",
    buyer: "Jade Garcia",
    product: "Meiji Chocolate",
    qty: 4,
    amount: 1160,
  },
  {
    id: "ful-8",
    col: "Cancelled",
    perspective: "seller",
    buyer: "Rico Mendoza",
    product: "MAC Lipstick Set",
    qty: 1,
    amount: 3200,
  },
]
