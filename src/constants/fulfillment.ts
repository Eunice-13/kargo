import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Clock3,
  PackageCheck,
  Truck,
} from "lucide-react"

import { CYAN_L } from "@/constants/theme"

export const SELLER_COLUMNS = [
  "Payment Confirmed",
  "Preparing",
  "Shipped",
  "Delivered",
  "Cancelled",
] as const

export const BUYER_COLUMNS = [
  "Pending Payment",
  "Payment Confirmed",
  "Preparing",
  "Shipped",
  "Delivered",
] as const

export type SellerColumn = (typeof SELLER_COLUMNS)[number]
export type BuyerColumn = (typeof BUYER_COLUMNS)[number]
export type FulfillmentColumn = SellerColumn | BuyerColumn

export const STAGE_COLORS: Record<
  FulfillmentColumn,
  { background: string; foreground: string; accent: string }
> = {
  "Pending Payment": {
    background: "#FEF3C7",
    foreground: "#92400E",
    accent: "#D97706",
  },
  "Payment Confirmed": {
    background: CYAN_L,
    foreground: "#155E75",
    accent: "#0891B2",
  },
  Preparing: {
    background: "#F0FDF4",
    foreground: "#166534",
    accent: "#16A34A",
  },
  Shipped: {
    background: "#DBEAFE",
    foreground: "#1E40AF",
    accent: "#2563EB",
  },
  Delivered: {
    background: "#D4F5EA",
    foreground: "#065F46",
    accent: "#059669",
  },
  Cancelled: {
    background: "#FEE2E2",
    foreground: "#991B1B",
    accent: "#DC2626",
  },
}

export const STAGE_ICONS = {
  "Pending Payment": Clock3,
  "Payment Confirmed": BadgeCheck,
  Preparing: PackageCheck,
  Shipped: Truck,
  Delivered: CircleCheck,
  Cancelled: CircleX,
} satisfies Record<FulfillmentColumn, typeof Clock3>
