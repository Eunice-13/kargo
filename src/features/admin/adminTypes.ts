// UI-facing shapes for adminApi results. These mirror the jsonb returned by the
// Phase 2 admin RPCs (202611010002_admin_users_dashboard.sql).

export type AdminAccountStatus = "active" | "suspended";

export type AdminDashboardData = {
  gmv30: number;
  orders30: number;
  activeSellers: number;
  paymentsPending: number;
  suspended: number;
  flaggedHidden: number;
  stuckOrders: number;
  // `orders` is optional so the UI stays honest when an older deployed
  // admin_dashboard() returns only `gmv`; never coerce missing data to zero.
  chart: { day: string; gmv: number; orders?: number }[];
  // Order-status counts for the last 30 days, in pipeline order.
  pipeline: { status: string; count: number }[];
  recentActivity: {
    id: string;
    actor_name: string;
    action: string;
    target_type: string;
    target_label: string | null;
    created_at: string;
  }[];
  topSellers: {
    id: string;
    shop: string;
    avatar_path: string | null;
    orders: number;
    gmv: number;
  }[];
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string | null;
  shopName: string | null;
  avatarPath: string | null;
  canSell: boolean;
  isAdmin: boolean;
  accountStatus: AdminAccountStatus;
  createdAt: string;
  updatedAt: string;
  lastSignInAt: string | null;
  // "seller" => gmv30 is what they sold; "buyer" => what they spent.
  gmvRole: "seller" | "buyer";
  orders: number;
  gmv30: number;
};

export type AdminUserDetail = AdminUserRow & {
  bio: string | null;
  accountStatusReason: string | null;
  buyerOrders: number;
  sellerOrders: number;
  sellerGmv30: number;
  buyerSpend30: number;
  liveBatches: number;
  recentOrders: {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    created_at: string;
  }[];
  moderationHistory: {
    id: string;
    actor_name: string;
    action: string;
    target_label: string | null;
    reason: string | null;
    created_at: string;
  }[];
};

export type AdminUserSearchResult = {
  id: string;
  name: string;
  email: string | null;
  avatar_path: string | null;
};

export type AdminListResult<T> = {
  rows: T[];
  total: number;
  nextOffset: number;
};

export type AdminUserFilters = {
  search?: string;
  role?: "all" | "buyer" | "seller" | "admin";
  status?: "all" | "active" | "suspended";
};

// ─── Phase 3: Batches ───────────────────────────────────────────────────────

export type BatchModeration = "visible" | "flagged" | "hidden";

export type AdminBatchRow = {
  id: string;
  title: string;
  status: string;
  category: string;
  moderationStatus: BatchModeration;
  moderationReason: string | null;
  coverPath: string | null;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  sellerId: string;
  sellerName: string;
  products: number;
  totalQty: number;
  claimedQty: number;
};

export type AdminBatchDetail = {
  id: string;
  title: string;
  status: string;
  category: string;
  moderationStatus: BatchModeration;
  moderationReason: string | null;
  coverPath: string | null;
  startsOn: string;
  endsOn: string;
  reservationHours: number;
  notes: string | null;
  sellerId: string;
  sellerName: string;
  createdAt: string;
  orderCount: number;
  confirmedGmv: number;
  products: {
    name: string;
    sellingPrice: number;
    quantityTotal: number;
    isLocked: boolean;
    claimed: number;
    waitlist: number;
  }[];
  moderationHistory: {
    id: string;
    actor_name: string;
    action: string;
    reason: string | null;
    created_at: string;
  }[];
};

export type AdminBatchFilters = {
  search?: string;
  status?: string;
  moderation?: string;
  category?: string;
};

export type BatchModerationAction = "lock" | "unlock" | "flag" | "hide" | "restore" | "close";

// ─── Phase 3: Transactions ──────────────────────────────────────────────────

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  product: string;
  buyer: string;
  seller: string;
  amount: number;
  status: string;
  trackingNumber: string | null;
  createdAt: string;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  product: string;
  quantity: number;
  amount: number;
  status: string;
  buyer: string;
  buyerId: string;
  seller: string;
  sellerId: string;
  trackingNumber: string | null;
  eta: string | null;
  deliveryAddress: string | null;
  reservationExpiresAt: string | null;
  paymentConfirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  payments: {
    id: string;
    status: string;
    method: string;
    amount: number;
    referenceNumber: string | null;
    submittedAt: string;
  }[];
};

export type AdminPaymentRow = {
  id: string;
  orderNumber: string;
  buyer: string;
  seller: string;
  method: string;
  amount: number;
  referenceNumber: string | null;
  status: string;
  submittedAt: string;
  reviewedBy: string | null;
};

export type AdminPaymentDetail = {
  id: string;
  orderId: string;
  orderNumber: string;
  buyer: string;
  seller: string;
  method: string;
  amount: number;
  payerName: string | null;
  payerPhone: string | null;
  referenceNumber: string | null;
  receiptPath: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type AdminCombinedPaymentRow = {
  id: string;
  buyer: string;
  seller: string;
  shippingFee: number | null;
  status: string;
  createdAt: string;
  memberCount: number;
};

export type AdminCombinedListResult = {
  available: boolean;
  rows: AdminCombinedPaymentRow[];
  total: number;
  nextOffset: number;
};

export type AdminOrderFilters = {
  search?: string;
  status?: string;
  days?: number;
};

export type AdminPaymentFilters = {
  search?: string;
  status?: string;
  days?: number;
};

// ─── Phase 4: Team + Audit ──────────────────────────────────────────────────

export type AdminTeamMember = {
  id: string;
  name: string;
  email: string | null;
  avatarPath: string | null;
  grantedAt: string;
  // Null while the invitation is unanswered — the row exists, but is_admin()
  // is false until they accept, so this person is not an admin yet.
  acceptedAt: string | null;
  grantedBy: string | null;
  accountStatus: AdminAccountStatus;
};

// The caller's own pending invitation from admin_my_invite(). Null when there
// is nothing waiting for an answer.
export type AdminInvite = {
  pending: boolean;
  grantedAt: string | null;
  grantedBy: string | null;
};

export type AdminAuditRow = {
  id: string;
  actorName: string;
  action: string;
  targetType: string;
  targetLabel: string | null;
  reason: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminAuditFilters = {
  search?: string;
  action?: string;
  days?: number;
};
