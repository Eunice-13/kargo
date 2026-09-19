// ─── Types ───────────────────────────────────────────────────────────────────
export type AppStage = "login" | "signup" | "app"
export type UserInfo = { name: string; email: string; role: Role; bio?: string }
export type Tab = "Dashboard" | "Batches" | "My Claims" | "Payments" | "Orders" | "Reports" | "Settings"
export type Role = "Buyer" | "Seller"
export type ClaimStatus = "Pending" | "Paid and Reserved" | "Expired" | "Cancelled" | "Insufficient Payment"
export type ReportStatus = "Open" | "Under Review" | "Resolved"
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
export type ReportRow = {
  id: string
  order: string
  product: string
  seller: string
  issue: string
  date: string
  status: ReportStatus
  description?: string
}
