import type React from "react"

import type { KanbanCol } from "@/constants/fulfillment"

// ─── Types ───────────────────────────────────────────────────────────────────

export type AppStage = "login" | "signup" | "app"

export type EntityId = string | number

// BIR badge verification pipeline stages. Seller access is only granted at

// "Verified". Ordering reflects the flow:

//   None → Uploading → Scanning (QR decode) → Verifying (domain check)

//        → Verified | Flagged

export type BirState = "None" | "Uploading" | "Scanning" | "Verifying" | "Verified" | "Flagged"

// ─── Ratings ─────────────────────────────────────────────────────────────────

// A single review row, as stored in `public.reviews`. Both directions of a
// completed order are reviewable, so `reviewerId !== revieweeId` always.
export type ReviewRecord = {
  id: string

  orderId: string

  reviewerId: string

  revieweeId: string

  rating: number

  comment: string | null

  quickStatements: string[]

  createdAt: string

  updatedAt: string
}

// The computed aggregate for one user. `average` is `null` — never 0, never a
// placeholder like 5 — when the user has no reviews, so callers are forced to
// render an explicit "no ratings yet" state instead of a fabricated score.
export type RatingSummary = {
  average: number | null

  count: number

  breakdown: Record<1 | 2 | 3 | 4 | 5, number>
}

export type ReviewSummaryItem = {
  id: string

  reviewerName: string

  rating: number

  comment: string | null

  quickStatements: string[]

  createdAt: string
}

// The shared, read-only view of a user's review record: enough to render the
// average and list reviews without leaking reviewer ids.
export type UserRating = {
  average: number | null

  count: number

  breakdown: Record<1 | 2 | 3 | 4 | 5, number>

  reviews: ReviewSummaryItem[]

  // profiles.created_at, for "Member since …". Null when unknown, in which case
  // the line is omitted rather than filled with a placeholder date.

  memberSince?: string | null
}

// The empty aggregate. `average: null` is the signal for "no ratings yet", so
// no screen ever falls back to a fabricated 0 or 5.
export const EMPTY_RATING_SUMMARY: RatingSummary = {
  average: null,

  count: 0,

  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}

export type UserInfo = {
  id?: string

  name: string

  email: string

  role: Role

  bio?: string

  fb?: string

  avatarUrl?: string

  socialLinks?: Record<string, string>

  socialVisibility?: Record<string, boolean>

  sellerEnabled?: boolean

  // Verified seller status is the single source of truth for seller access.

  // A user is only a real Seller when birState === "Verified".

  birState?: BirState

  accountStatus?: "active" | "suspended"

  // Email/notification opt-outs, keyed by NOTIF_DEFAULTS keys (e.g. "waitlist",

  // "claims"). Missing key = opted in. Persisted to profiles.notification_preferences.

  notificationPreferences?: Record<string, boolean>

  // Seller-only: hours a waitlisted buyer has to respond to a partial-match offer.

  waitlistResponseHours?: number

  // profiles.created_at. Formatted for display by `memberSince()`; a profile
  // with no value shows no "Member since" text rather than an invented date.

  memberSince?: string
}

export type Tab = "Dashboard" | "Batches" | "My Claims" | "Payments" | "Orders" | "Settings"

export type Role = "Buyer" | "Seller"

export type ClaimStatus = "Pending" | "Paid and Reserved" | "Expired" | "Cancelled" | "Insufficient Payment"
export type PaymentHistoryStatus = ClaimStatus | "Rejected"
export type SettingsSection = "Profile" | "Linked Accounts" | "Notifications" | "Security"

export type ClaimRow = {
  id: EntityId

  productId?: string

  product: string

  batch: string

  seller: string

  // Seller's user id — used to load the methods THIS seller accepts when paying.

  sellerId?: string

  sellerBirVerified?: boolean

  qty: number

  amount: number

  status: ClaimStatus

  hours: number

  expiresAt?: string

  extensionRequested?: boolean

  // Who placed the order (seller's "Orders Received" view). Falls back to

  // `seller` for legacy rows. `buyerFb` is their contact/Facebook link.

  buyer?: string

  buyerFb?: string

  // Seller's contact/Facebook link (buyer's "My Claims" view).

  sellerFb?: string
}

export type ToPayRow = {
  id: EntityId

  orderId?: string

  product: string

  seller: string

  sellerId?: string

  qty?: number

  amount: number

  hours: number

  expiresAt?: string
}

export type PayHistRow = {
  id: EntityId

  product: string

  batch: string

  method: string

  amount: number

  date: string

  status: PaymentHistoryStatus
  referenceNumber?: string
  receiptPath?: string
  payerAccountName?: string
  payerPhone?: string
  buyerContactUrl?: string
  rejectionReason?: string
  rejectionDeadline?: string
}
export type OrderRow = {
  id: string

  dbId?: string

  product: string

  batch: string

  seller: string

  sellerFb?: string

  amount: number

  step: number

  trackingNo: string | null

  eta: string

  rated: boolean

  rating?: number

  reviewComment?: string

  reviewStatements?: string[]

  reviewCreatedAt?: string

  reviewUpdatedAt?: string
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

  // Optional cap on how many units a single buyer may claim for this item.

  // Undefined/0 means no per-user limit.

  limitPerUser?: number
}

export interface BatchItem {
  id: number
  dbId?: string
  createdAt?: string
  reactionCount?: number
  reactedByCurrentUser?: boolean
  live: boolean
  locked: boolean

  title: string

  seller: string

  sellerId?: string

  sellerFb?: string

  sellerBirVerified?: boolean

  // The seller's computed rating, carried from `public.profile_ratings`.

  // `null` when the seller has no reviews yet — never 0, never a placeholder.

  rating: number | null

  // How many reviews that average is computed from, so a lone 5★ on a new

  // seller is distinguishable from a well-established 5★.

  ratingCount: number

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

  dbId?: string

  col: KanbanCol

  buyer: string

  buyerFb?: string

  product: string

  qty: number

  amount: number

  rated?: boolean

  rating?: number

  reviewComment?: string

  reviewStatements?: string[]

  reviewCreatedAt?: string

  reviewUpdatedAt?: string
}

// Buyer's place in a sold-out product queue. Dashboard and BatchPage share

// the same live array so the overview card and the waitlist modal never

// snapshot a stale entry.

export type WaitlistStatus = "waiting" | "offered" | "converted" | "cancelled"

export type WaitlistEntry = {
  id: string

  productId?: string

  product: string

  batchId: number

  batch: string

  seller: string

  trips: string

  position: number

  queueSize: number

  amount: number

  // Quantity the buyer asked for when joining (Part 1 of the offer flow).

  desiredQuantity: number

  status: WaitlistStatus

  // Populated when status === "offered": the partial amount on offer and the

  // deadline (ISO) by which the buyer must accept/decline.

  offerQuantity?: number

  offerExpiresAt?: string
}

// Seller-facing view of who is waiting for one of their products, in join

// order. Buyers only ever see their own position (WaitlistEntry above).

export type SellerWaitlistEntry = {
  buyer: string

  buyerFb?: string

  position: number

  joinedAt: string

  desiredQuantity: number
}

export type SellerWaitlistGroup = {
  productId: string

  product: string

  batch: string

  queue: SellerWaitlistEntry[]
}

// ─── Shared types for cross-tab props ─────────────────────────────────────────

export type SharedState = {
  // Every user's computed rating, keyed by profile id. The single source of
  // truth every screen reads from — in Supabase mode it is loaded from
  // `public.profile_ratings`, in demo mode derived from the review seed, and
  // both go through the same `summarizeReviews` aggregation.

  ratings: Record<string, UserRating>

  setRatings: React.Dispatch<React.SetStateAction<Record<string, UserRating>>>

  // display name -> profile id, for every user this account transacts with.
  // Lets a surface that only knows a name (a claim's buyer, a kanban card)
  // still resolve the right computed rating instead of guessing.

  profileIdByName: Record<string, string>

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

  waitlist: WaitlistEntry[]

  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>

  sellerWaitlist: SellerWaitlistGroup[]

  setSellerWaitlist: React.Dispatch<React.SetStateAction<SellerWaitlistGroup[]>>

  user: UserInfo

  setUser: React.Dispatch<React.SetStateAction<UserInfo>>

  setTab: (t: Tab) => void

  role: Role

  // Re-pull all app data from the backend (no-op in demo mode). Used after

  // server-side cascades like accepting a waitlist offer.

  refreshData: () => Promise<void>
}
