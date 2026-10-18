import type { OrderRow } from "@/types"

export const ORDERS_INIT: OrderRow[] = [
  {
    id: "ORD-2026-0043",
    product: "Trader Joe's Snacks",

    batch: "US Pasabuy — May 2026",

    seller: "Paolo Garcia",

    amount: 3600,
    qty: 3,
    step: 4,
    fulfillmentStage: "shipped",
    courierCompany: "Ninja Van",
    riderName: "Marco Dela Cruz",
    riderContact: "+63 917 555 0142",
    trackingNumber: "NVPHDMO0043",
    eta: "2026-10-20T17:00:00.000Z",
    deliveryPinLat: 14.5995,
    deliveryPinLng: 120.9842,
    deliveryPinAddress: "Manila, Metro Manila, Philippines",
  },
  {
    id: "ORD-2026-0031",

    product: "Meiji Chocolate",

    batch: "Japan Trip — March 2026",

    seller: "Maria Santos",

    amount: 1160,
    step: 5,
  },

  {
    id: "ORD-2026-0028",

    product: "Paldo Bibimmyeon",

    batch: "Korea Haul — April 2026",

    seller: "Ana Reyes",

    amount: 760,
    step: 5,
  },

  {
    id: "ORD-2026-0052",

    product: "SK-II Essence",

    batch: "Singapore Haul — Aug 2026",

    seller: "Jade Bautista",

    amount: 4800,
    step: 3,
  },

  {
    id: "ORD-2026-0047",

    product: "85\u00B0C Pastries",

    batch: "Taiwan Finds — July 2026",

    seller: "Rico Santos",

    amount: 1120,
    step: 4,
  },
]
