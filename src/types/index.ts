import type React from "react"
import type { KanbanCol } from "@/constants/fulfillment"

// ─── Types ───────────────────────────────────────────────────────────────────
export type AppStage = "login" | "signup" | "app"
export type UserInfo = { name: string; email: string; role: Role; bio?: string; fb?: string }
export type Tab = "Dashboard" | "Batches" | "My Claims" | "Payments" | "Orders" | "Settings"
export type Role = "Buyer" | "Seller"
export type ClaimStatus = "Pending" | "Paid and Reserved" | "Expired" | "Cancelled" | "Insufficient Payment"
export type SettingsSection = "Profile" | "Linked Accounts" | "Notifications" | "Payment Methods" | "Security"

export type ClaimRow = {
  id: number
  product: string
  batch: string
  seller: string
  qty: number
  amount: number
  status: ClaimStatus
  hours: number
  extensionRequested?: boolean
}
export type ToPayRow = {
  id: number
  product: string
  seller: string
  amount: number
  hours: number
}
export type PayHistRow = {
  id: number
  product: string
  batch: string
  method: string
  amount: number
  date: string
  status: ClaimStatus
}
export type OrderRow = {
  id: string
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
  name: string
  price: number
  qty: number
  claimed: number
  waitlist: number
  locked: boolean
}
export interface BatchItem {
  id: number
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
