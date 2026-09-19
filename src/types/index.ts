import type React from "react"
import type { KanbanCol } from "@/constants/fulfillment"

// ─── Types ───────────────────────────────────────────────────────────────────
export type AppStage = "login" | "signup" | "app"
export type EntityId = string | number

// BIR badge verification pipeline stages. Seller access is only granted at
// "Verified". Ordering reflects the flow:
//   None → Uploading → Scanning (QR decode) → Verifying (domain check)
//        → Verified | Flagged
export type BirState =
  | "None"
  | "Uploading"
  | "Scanning"
  | "Verifying"
  | "Verified"
  | "Flagged"

export type UserInfo = {
  id?: string
  name: string
  email: string
  role: Role
  bio?: string
  fb?: string
  // Verified seller status is the single source of truth for seller access.
  // A user is only a real Seller when birState === "Verified".
  birState?: BirState
  accountStatus?: "active" | "suspended"
}
export type Tab = "Dashboard" | "Batches" | "My Claims" | "Payments" | "Orders" | "Settings"
export type Role = "Buyer" | "Seller"
export type ClaimStatus = "Pending" | "Paid and Reserved" | "Expired" | "Cancelled" | "Insufficient Payment"
export type SettingsSection = "Profile" | "Linked Accounts" | "Notifications" | "Payment Methods" | "Security"

export type ClaimRow = {
  id: EntityId
  productId?: string
  product: string
  batch: string
  seller: string
  qty: number
  amount: number
  status: ClaimStatus
  hours: number
  extensionRequested?: boolean
  // Who placed the order (seller's "Orders Received" view). Falls back to
  // `seller` for legacy rows. `buyerFb` is their contact/Facebook link.
  buyer?: string
  buyerFb?: string
}
export type ToPayRow = {
  id: EntityId
  orderId?: string
  product: string
  seller: string
  amount: number
  hours: number
}
export type PayHistRow = {
  id: EntityId
  product: string
  batch: string
  method: string
  amount: number
  date: string
  status: ClaimStatus
}
export type OrderRow = {
  id: string
  dbId?: string
  product: string
  batch: string
  seller: string
  amount: number
  step: number
  trackingNo: string | null
  eta: string
  rated: boolean
  rating?: number
}

// ─── Batch data models ────────────────────────────────────────────────────────
export interface BatchStoredProduct {
  id?: number
  dbId?: string
  name: string
  price: number
  basePrice?: number
  markup?: number
  qty: number
  claimed: number
  waitlist: number
  locked: boolean
}
export interface BatchItem {
  id: number
  dbId?: string
  live: boolean
  locked: boolean
  title: string
  seller: string
  rating: number
  trips: string
  items: number
  claimed: number
  category: string
  reserveHours: number
  notes?: string
  products: BatchStoredProduct[]
}
export type BatchType = BatchItem

// ─── Per-batch expenses (seller-only bookkeeping) ─────────────────────────────
// Private to the seller; never shown to buyers. `mode` picks how the total is
// entered: a single manual number, or an itemized list that auto-sums.
export type ExpenseMode = "single" | "itemized"
export type ExpenseItem = {
  id: string
  label: string
  amount: number
  category?: string
  date?: string
}
export type BatchExpenses = {
  batchDbId?: string
  mode: ExpenseMode
  total: number
  items: ExpenseItem[]
}

// ─── Fulfillment data model ───────────────────────────────────────────────────
export type FulfillmentOrder = {
  id: string
  col: KanbanCol
  buyer: string
  product: string
  qty: number
  amount: number
}

// ─── Shared types for cross-tab props ─────────────────────────────────────────
export type SharedState = {
  claims: ClaimRow[]
  setClaims: React.Dispatch<React.SetStateAction<ClaimRow[]>>
  toPay: ToPayRow[]
  setToPay: React.Dispatch<React.SetStateAction<ToPayRow[]>>
  payHistory: PayHistRow[]
  setPayHistory: React.Dispatch<React.SetStateAction<PayHistRow[]>>
  orders: OrderRow[]
  setOrders: React.Dispatch<React.SetStateAction<OrderRow[]>>
  batches: BatchType[]
  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>
  fulfillment: FulfillmentOrder[]
  setFulfillment: React.Dispatch<React.SetStateAction<FulfillmentOrder[]>>
  user: UserInfo
  setUser: React.Dispatch<React.SetStateAction<UserInfo>>
  setTab: (t: Tab) => void
  role: Role
}
