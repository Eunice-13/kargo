import type React from "react";

import type { FulfillmentColumn } from "@/constants/fulfillment";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AppStage = "login" | "signup" | "app";

export type EntityId = string | number;

export type UserInfo = {
  id?: string;

  name: string;

  // Seller's shop/store name (read-only in Settings; set at signup).
  shopName?: string;

  email: string;

  role: Role;

  bio?: string;

  fb?: string;

  avatarUrl?: string;

  socialLinks?: Record<string, string>;

  socialVisibility?: Record<string, boolean>;

  sellerEnabled?: boolean;

  // Governance capability: an accepted, non-revoked row in admin_members. Mapped
  // from a second query in profileFor; binary (there is exactly one admin role).
  adminEnabled?: boolean;

  // An admin invitation is waiting for this account's answer. Until it is
  // accepted, is_admin() is false and AdminInviteModal is shown on sign-in.
  adminInvitePending?: boolean;

  // Mirrors user_profiles.account_status. A suspended account sees the
  // AccountSuspended screen instead of the app shell, for every role.
  accountStatus?: "active" | "suspended";

  accountStatusReason?: string;

  // Email/notification opt-outs, keyed by NOTIF_DEFAULTS keys (e.g. "waitlist",

  // "claims"). Missing key = opted in. Persisted to profiles.notification_preferences.

  notificationPreferences?: Record<string, boolean>;

  // profiles.created_at. Formatted for display by `memberSince()`; a profile

  // with no value shows no "Member since" text rather than an invented date.

  memberSince?: string;
};

export type Tab =
  | "Dashboard"
  | "Batches"
  | "My Claims"
  | "Payments"
  | "Orders"
  | "Settings"
  | "Notifications"
  | "Users"
  | "Transactions"
  | "Security";

// The five admin top-level tabs (a subset of Tab, for role-aware helpers).
export type AdminTab = "Dashboard" | "Users" | "Batches" | "Transactions" | "Security";

export type Role = "Buyer" | "Seller" | "Admin";

export type ClaimStatus =
  | "Pending"
  | "Awaiting Verification"
  | "Paid and Reserved"
  | "Expired"
  | "Cancelled"
  | "Insufficient Payment";

export type ShippingState = "waiting_for_seller" | "fee_set" | "correction_requested" | "declined";

export type CourierCompany =
  | "Lalamove"
  | "J&T Express"
  | "LBC"
  | "Grab Express"
  | "2GO"
  | "Ninja Van"
  | "Others";

export type SellingUnit = "piece" | "box";

export type GroupDiscountType = "percentage" | "fixed";

export type ClaimReservationInput = {
  quantity: number;

  paymentMethod: string;

  pinLat?: number;

  pinLng?: number;

  pinUrl?: string;

  pinAddress?: string;

  acceptShipping: boolean;
};

export type PaymentHistoryStatus = ClaimStatus | "Rejected" | "Pending Payment";

export type SettingsSection =
  | "My Addresses"
  | "Profile"
  | "Account status"
  | "Linked Accounts"
  | "Notifications"
  | "Security";

export type ClaimRow = {
  id: EntityId;

  createdAt?: string;

  productId?: string;

  groupOrderId?: string;

  groupOrderCode?: string;

  groupItemCount?: number;

  groupMemberCount?: number;

  groupRegularSubtotal?: number;

  groupDiscountAmount?: number;

  product: string;

  batch: string;

  seller: string;

  // Seller's shop/store name for buyer-facing display, when they set one.
  sellerShopName?: string;

  // Seller's user id — used to load the methods THIS seller accepts when paying.

  sellerId?: string;

  qty: number;

  amount: number;

  status: ClaimStatus;

  hours: number;

  expiresAt?: string;

  extensionStatus?: "none" | "pending" | "approved" | "denied";

  extensionRequestedHours?: number;

  extensionDecidedAt?: string;

  extensionRequested?: boolean;

  // Who placed the order (seller's "Orders Received" view). Falls back to

  // `seller` for legacy rows. `buyerFb` is their contact/Facebook link.

  buyer?: string;

  buyerFb?: string;

  // All public social links for the buyer. `buyerFb` remains as the preferred
  // single-link fallback for older rows and direct-contact actions.
  buyerSocialLinks?: Record<string, string>;

  // Seller's contact/Facebook link (buyer's "My Claims" view).

  sellerFb?: string;

  sellerSocialLinks?: Record<string, string>;

  // Raw database status used for accurate buyer-history counters.
  orderStatus?: string;

  reservedPaymentMethod?: string;

  shippingApplies?: boolean;

  shippingState?: ShippingState;

  shippingFee?: number;

  deadlinePausedAt?: string;

  deliveryPinLat?: number;

  deliveryPinLng?: number;

  deliveryPinUrl?: string;

  deliveryPinAddress?: string;

  courierCompany?: string;

  riderName?: string;

  riderContact?: string;

  trackingNumber?: string;

  eta?: string;

  trackingUrl?: string;

  fulfillmentStage?: string;

  declineReason?: string;
};

export type ToPayRow = {
  id: EntityId;

  createdAt?: string;

  orderId?: string;

  groupOrderId?: string;

  product: string;

  seller: string;

  sellerId?: string;

  qty?: number;

  amount: number;

  hours: number;

  expiresAt?: string;

  reservedPaymentMethod?: string;

  shippingApplies?: boolean;

  shippingState?: ShippingState;

  shippingFee?: number;

  deadlinePausedAt?: string;
};

export type PayHistRow = {
  id: EntityId;
  combinedDeliveryGroupId?: string;
  reservationIds?: string[];

  orderId?: string;

  seller?: string;

  sellerShopName?: string;

  submittedAt?: string;

  product: string;

  imageUrl?: string;

  batch: string;

  method: string;

  amount: number;

  date: string;

  status: PaymentHistoryStatus;

  referenceNumber?: string;

  receiptPath?: string;

  payerAccountName?: string;

  payerPhone?: string;

  buyerContactUrl?: string;

  rejectionReason?: string;

  rejectionDeadline?: string;
};

export type OrderRow = {
  id: string;

  dbId?: string;

  product: string;

  batch: string;

  seller: string;

  sellerFb?: string;

  amount: number;

  step: number;

  qty?: number;

  fulfillmentStage?: string;

  courierCompany?: string;

  riderName?: string;

  riderContact?: string;

  trackingNumber?: string;

  eta?: string;

  trackingUrl?: string;

  deliveryPinLat?: number;

  deliveryPinLng?: number;

  deliveryPinUrl?: string;

  deliveryPinAddress?: string;
};

// ─── Batch data models ────────────────────────────────────────────────────────

export interface BatchStoredProduct {
  id?: number;

  dbId?: string;

  name: string;

  imageUrl?: string;

  sellingUnit?: SellingUnit;

  piecesPerBox?: number;

  price: number;

  basePrice?: number;

  markup?: number;

  qty: number;

  claimed: number;

  waitlist: number;

  locked: boolean;

  // Optional cap on how many units a single buyer may claim for this item.

  // Undefined/0 means no per-user limit.

  limitPerUser?: number;

  // Optional maximum number of buyers who may wait for this product.

  waitlistLimit?: number;
}

export interface BatchItem {
  id: number;

  dbId?: string;

  createdAt?: string;

  reactionCount?: number;

  reactedByCurrentUser?: boolean;

  live: boolean;

  locked: boolean;

  title: string;

  seller: string;

  // Seller's shop/store name for buyer-facing display, when they set one.
  sellerShopName?: string;

  sellerId?: string;

  sellerFb?: string;

  trips: string;

  // Philippine calendar date the batch runs through (`YYYY-MM-DD`). Orders and
  // group orders stop at the end of this day; see batchOrdersClosed().
  endsOn?: string;

  startsOn?: string;

  items: number;

  claimed: number;

  category: string;

  reserveHours: number;

  notes?: string;

  // Optional seller-set cover photo. A single image field used identically by

  // the Home batch card banner and the batch detail hero. When absent, both

  // fall back to the category gradient + CategoryIcon.

  coverImage?: string;

  // Additional seller-uploaded images for the batch gallery.
  galleryImages?: string[];

  groupOrdersEnabled?: boolean;

  groupDiscountType?: GroupDiscountType;

  groupDiscountValue?: number;

  groupDiscountMinSubtotal?: number;

  // Admin moderation state, surfaced to the owning seller so a hidden/flagged
  // batch shows a notice in their Batches tab. Buyers never see hidden batches.
  moderationStatus?: "visible" | "flagged" | "hidden";

  moderationReason?: string;

  products: BatchStoredProduct[];
}

export type BatchType = BatchItem;

export type GroupOrderMember = {
  userId: string;
  name: string;
  role: "leader" | "member";
  status: "active" | "left" | "removed";
};

export type GroupOrderCommitment = {
  userId: string;
  memberName: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export type GroupOrder = {
  id: string;
  batchId: string;
  leaderId: string;
  leaderName: string;
  referralCode: string;
  status:
    | "forming"
    | "waiting_for_seller"
    | "payment_pending"
    | "payment_submitted"
    | "payment_confirmed"
    | "cancelled"
    | "expired";
  formationDeadline: string;
  regularSubtotal: number;
  discountAmount: number;
  finalSubtotal: number;
  shippingFee?: number;
  shippingState?: ShippingState | "declined";
  paymentDeadline?: string;
  reservedPaymentMethod?: string;
  isLeader: boolean;
  currentUserId: string;
  members: GroupOrderMember[];
  commitments: GroupOrderCommitment[];
};

// ─── Per-batch expenses (seller-only bookkeeping) ─────────────────────────────

// Private to the seller; never shown to buyers. `mode` picks how the total is

// entered: a single manual number, or an itemized list that auto-sums.

export type ExpenseMode = "single" | "itemized";

export type ExpenseItem = {
  id: string;

  label: string;

  amount: number;

  category?: string;

  date?: string;
};

export type BatchExpenses = {
  batchDbId?: string;

  mode: ExpenseMode;

  total: number;

  items: ExpenseItem[];
};

// ─── Fulfillment data model ───────────────────────────────────────────────────

export type FulfillmentOrder = {
  id: string;

  dbId?: string;

  col: FulfillmentColumn;

  perspective: "seller" | "buyer";

  buyer: string;

  buyerFb?: string;

  buyerSocialLinks?: Record<string, string>;

  seller?: string;

  sellerFb?: string;

  sellerSocialLinks?: Record<string, string>;

  product: string;

  qty: number;

  amount: number;

  fulfillmentStage?: string;

  courierCompany?: string;

  riderName?: string;

  riderContact?: string;

  trackingNumber?: string;

  eta?: string;

  trackingUrl?: string;

  deliveryPinLat?: number;

  deliveryPinLng?: number;

  deliveryPinUrl?: string;

  deliveryPinAddress?: string;
};

// Buyer's place in a sold-out product queue. Dashboard and BatchPage share

// the same live array so the overview card and the waitlist modal never

// snapshot a stale entry.

export type WaitlistStatus = "waiting" | "converted" | "cancelled";

export type WaitlistEntry = {
  id: string;

  productId?: string;

  product: string;

  batchId: number;

  batch: string;

  seller: string;

  trips: string;

  position: number;

  queueSize: number;

  amount: number;

  // Quantity the buyer wants automatically claimed when stock becomes available.

  desiredQuantity: number;

  status: WaitlistStatus;
};

// Seller-facing view of who is waiting for one of their products, in join

// order. Buyers only ever see their own position (WaitlistEntry above).

export type SellerWaitlistEntry = {
  buyer: string;

  buyerFb?: string;

  position: number;

  joinedAt: string;

  desiredQuantity: number;
};

export type SellerWaitlistGroup = {
  productId: string;

  product: string;

  batch: string;

  queue: SellerWaitlistEntry[];
};

// ─── Shared types for cross-tab props ─────────────────────────────────────────

export type SharedState = {
  claims: ClaimRow[];

  setClaims: React.Dispatch<React.SetStateAction<ClaimRow[]>>;

  toPay: ToPayRow[];

  setToPay: React.Dispatch<React.SetStateAction<ToPayRow[]>>;

  payHistory: PayHistRow[];

  setPayHistory: React.Dispatch<React.SetStateAction<PayHistRow[]>>;

  orders: OrderRow[];

  setOrders: React.Dispatch<React.SetStateAction<OrderRow[]>>;

  batches: BatchType[];

  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>;

  fulfillment: FulfillmentOrder[];

  setFulfillment: React.Dispatch<React.SetStateAction<FulfillmentOrder[]>>;

  waitlist: WaitlistEntry[];

  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>;

  sellerWaitlist: SellerWaitlistGroup[];

  setSellerWaitlist: React.Dispatch<React.SetStateAction<SellerWaitlistGroup[]>>;

  user: UserInfo;

  setUser: React.Dispatch<React.SetStateAction<UserInfo>>;

  setTab: (t: Tab) => void;

  role: Role;

  // Re-pull all app data from the backend (no-op in demo mode). Used after

  // server-side cascades like automatically converting a waitlist entry.

  refreshData: () => Promise<void>;
};
