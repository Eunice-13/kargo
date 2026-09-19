import type { FulfillmentOrder } from "@/types"

// Seed data for the Fulfillment Board. The live copy lives in App() state
// (`fulfillment`) so the Dashboard board and the Orders board stay in sync.
export const FULFILLMENT_INIT: FulfillmentOrder[] = [
  {
    id: "ful-1",
    col: "Claimed",
    buyer: "Trisha Lim",
    product: "Laneige Lip Mask",
    qty: 2,
    amount: 1900,
  },
  {
    id: "ful-2",
    col: "Claimed",
    buyer: "Grace Reyes",
    product: "KitKat Sakura",
    qty: 3,
    amount: 960,
  },
  {
    id: "ful-3",
    col: "Pending Payment",
    buyer: "Carlo Santos",
    product: "SK-II Essence",
    qty: 1,
    amount: 4800,
  },
  {
    id: "ful-4",
    col: "Pending Payment",
    buyer: "Mia Cruz",
    product: "Tokyo Banana",
    qty: 2,
    amount: 960,
  },
  {
    id: "ful-5",
    col: "Payment Confirmed",
    buyer: "Anna Bautista",
    product: "Shiseido Sunscreen",
    qty: 1,
    amount: 1650,
  },
  {
    id: "ful-6",
    col: "Preparing",
    buyer: "Ben Torres",
    product: "COSRX Snail Cream",
    qty: 2,
    amount: 1560,
  },
  {
    id: "ful-7",
    col: "Completed",
    buyer: "Jade Garcia",
    product: "Meiji Chocolate",
    qty: 4,
    amount: 1160,
  },
  {
    id: "ful-8",
    col: "Cancelled",
    buyer: "Rico Mendoza",
    product: "MAC Lipstick Set",
    qty: 1,
    amount: 3200,
  },
]
