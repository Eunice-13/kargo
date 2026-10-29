// In-memory admin demo data for ?preview=admin. Mirrors the adminApi surface so
// a reviewer can exercise Dashboard + Users (suspend/restore, grant/revoke
// seller) without Supabase. Resets on reload. Kept out of the buyer/seller seed.

import type {
  AdminDashboardData,
  AdminListResult,
  AdminUserDetail,
  AdminUserFilters,
  AdminUserRow,
  AdminUserSearchResult,
} from "@/features/admin/adminTypes";

type DemoUser = AdminUserRow & {
  bio: string | null;
  accountStatusReason: string | null;
  buyerOrders: number;
  sellerOrders: number;
  sellerGmv30: number;
  buyerSpend30: number;
  liveBatches: number;
};

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

type DemoUserSeed = Omit<DemoUser, "lastSignInAt" | "gmvRole" | "buyerSpend30">;

const DEMO_USERS_SEED: DemoUserSeed[] = [
  {
    id: "demo-u-1",
    name: "Maria Santos",
    email: "maria@kargo.demo",
    shopName: "Maria's Japan Finds",
    avatarPath: null,
    canSell: true,
    isAdmin: false,
    accountStatus: "active",
    createdAt: iso(120),
    updatedAt: iso(1),
    orders: 4,
    gmv30: 48250,
    bio: "Monthly Japan hauls — snacks and skincare.",
    accountStatusReason: null,
    buyerOrders: 4,
    sellerOrders: 36,
    sellerGmv30: 48250,
    liveBatches: 3,
  },
  {
    id: "demo-u-2",
    name: "Ana Reyes",
    email: "ana@kargo.demo",
    shopName: "Seoul Glow by Ana",
    avatarPath: null,
    canSell: true,
    isAdmin: false,
    accountStatus: "active",
    createdAt: iso(95),
    updatedAt: iso(2),
    orders: 2,
    gmv30: 31900,
    bio: "Korean beauty, carefully packed.",
    accountStatusReason: null,
    buyerOrders: 2,
    sellerOrders: 22,
    sellerGmv30: 31900,
    liveBatches: 2,
  },
  {
    id: "demo-u-3",
    name: "Jcollo Dela Cruz",
    email: "jollo@kargo.demo",
    shopName: null,
    avatarPath: null,
    canSell: false,
    isAdmin: false,
    accountStatus: "active",
    createdAt: iso(40),
    updatedAt: iso(3),
    orders: 7,
    gmv30: 0,
    bio: null,
    accountStatusReason: null,
    buyerOrders: 7,
    sellerOrders: 0,
    sellerGmv30: 0,
    liveBatches: 0,
  },
  {
    id: "demo-u-4",
    name: "Rico Buenaventura",
    email: "rico@kargo.demo",
    shopName: null,
    avatarPath: null,
    canSell: false,
    isAdmin: false,
    accountStatus: "suspended",
    createdAt: iso(60),
    updatedAt: iso(5),
    orders: 1,
    gmv30: 0,
    bio: null,
    accountStatusReason: "Repeated payment chargebacks under review.",
    buyerOrders: 1,
    sellerOrders: 0,
    sellerGmv30: 0,
    liveBatches: 0,
  },
  {
    id: "demo-u-admin",
    name: "KARGO Admin",
    email: "admin@kargo.demo",
    shopName: null,
    avatarPath: null,
    canSell: false,
    isAdmin: true,
    accountStatus: "active",
    createdAt: iso(200),
    updatedAt: iso(0),
    orders: 0,
    gmv30: 0,
    bio: null,
    accountStatusReason: null,
    buyerOrders: 0,
    sellerOrders: 0,
    sellerGmv30: 0,
    liveBatches: 0,
  },
];

// Fill the derived fields so each seed becomes a full DemoUser.
const DEMO_USERS: DemoUser[] = DEMO_USERS_SEED.map((u, i) => ({
  ...u,
  gmvRole: u.canSell ? "seller" : "buyer",
  buyerSpend30: u.canSell ? 0 : ([0, 0, 2125, 350, 0][i] ?? 0),
  lastSignInAt: iso(i === 0 ? 0 : i),
}));

const roleOf = (u: DemoUser): "admin" | "seller" | "buyer" =>
  u.isAdmin ? "admin" : u.canSell ? "seller" : "buyer";

export function demoListUsers(
  filters: AdminUserFilters,
  limit: number,
  offset: number,
): AdminListResult<AdminUserRow> {
  const search = filters.search?.trim().toLowerCase();
  const matched = DEMO_USERS.filter((u) => {
    if (
      search &&
      !(
        u.name.toLowerCase().includes(search) ||
        (u.email ?? "").toLowerCase().includes(search) ||
        (u.shopName ?? "").toLowerCase().includes(search)
      )
    )
      return false;
    if (filters.role && filters.role !== "all" && roleOf(u) !== filters.role) return false;
    if (filters.status && filters.status !== "all" && u.accountStatus !== filters.status)
      return false;
    return true;
  });
  const page = matched.slice(offset, offset + limit).map(stripDetail);
  return { rows: page, total: matched.length, nextOffset: offset + limit };
}

function stripDetail(u: DemoUser): AdminUserRow {
  const {
    bio: _bio,
    accountStatusReason: _r,
    buyerOrders: _b,
    sellerOrders: _s,
    sellerGmv30: _g,
    liveBatches: _l,
    ...row
  } = u;
  return row;
}

export function demoGetUser(userId: string): AdminUserDetail {
  const u = DEMO_USERS.find((x) => x.id === userId);
  if (!u) throw new Error("User not found");
  return {
    ...u,
    recentOrders: [
      {
        id: "demo-o-1",
        order_number: "ORD-2026-0199",
        status: "payment_confirmed",
        total_amount: 1775,
        created_at: iso(2),
      },
      {
        id: "demo-o-2",
        order_number: "ORD-2026-0184",
        status: "completed",
        total_amount: 480,
        created_at: iso(9),
      },
    ],
    moderationHistory: [],
  };
}

export function demoSearchUsers(query: string, limit: number): AdminUserSearchResult[] {
  const q = query.trim().toLowerCase();
  return DEMO_USERS.filter(
    (u) => u.name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q),
  )
    .slice(0, limit)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, avatar_path: null }));
}

export function demoSetAccountStatus(
  userId: string,
  status: "active" | "suspended",
  reason: string,
): { changed: boolean; status: string } {
  const u = DEMO_USERS.find((x) => x.id === userId);
  if (!u) throw new Error("User not found");
  const changed = u.accountStatus !== status;
  u.accountStatus = status;
  u.accountStatusReason = status === "suspended" ? reason : null;
  u.updatedAt = iso(0);
  return { changed, status };
}

export function demoSetSellerAccess(
  userId: string,
  enabled: boolean,
  _reason: string,
): { changed: boolean; canSell: boolean } {
  const u = DEMO_USERS.find((x) => x.id === userId);
  if (!u) throw new Error("User not found");
  const changed = u.canSell !== enabled;
  u.canSell = enabled;
  u.updatedAt = iso(0);
  return { changed, canSell: enabled };
}

export function demoAdminDashboard(): AdminDashboardData {
  const chart = Array.from({ length: 14 }, (_, i) => ({
    day: iso(13 - i).slice(0, 10),
    gmv: Math.round(4000 + Math.sin(i / 2) * 2500 + i * 180),
    orders: Math.max(0, Math.round(3 + Math.sin(i / 2) * 2 + i / 3)),
  }));
  return {
    gmv30: 268_400,
    orders30: 142,
    activeSellers: DEMO_USERS.filter((u) => u.canSell && u.accountStatus === "active").length,
    paymentsPending: 3,
    suspended: DEMO_USERS.filter((u) => u.accountStatus === "suspended").length,
    flaggedHidden: 1,
    stuckOrders: 2,
    chart,
    pipeline: [
      { status: "payment_pending", count: 6 },
      { status: "payment_submitted", count: 3 },
      { status: "payment_confirmed", count: 21 },
      { status: "preparing", count: 9 },
      { status: "completed", count: 46 },
      { status: "cancelled", count: 4 },
    ],
    recentActivity: [
      {
        id: "a1",
        actor_name: "KARGO Admin",
        action: "suspend_account",
        target_type: "user",
        target_label: "Rico Buenaventura",
        created_at: iso(0),
      },
      {
        id: "a2",
        actor_name: "KARGO Admin",
        action: "grant_seller",
        target_type: "user",
        target_label: "Ana Reyes",
        created_at: iso(1),
      },
    ],
    topSellers: [
      {
        id: "demo-u-1",
        shop: "Maria's Japan Finds",
        avatar_path: null,
        orders: 36,
        gmv: 48_250,
      },
      {
        id: "demo-u-2",
        shop: "Seoul Glow by Ana",
        avatar_path: null,
        orders: 22,
        gmv: 31_900,
      },
    ],
  };
}

// ─── Phase 3 demo data: batches, orders, payments, combined ─────────────────

import type {
  AdminBatchDetail,
  AdminBatchFilters,
  AdminBatchRow,
  AdminCombinedListResult,
  AdminOrderDetail,
  AdminOrderFilters,
  AdminOrderRow,
  AdminPaymentDetail,
  AdminPaymentFilters,
  AdminPaymentRow,
  BatchModeration,
  BatchModerationAction,
} from "@/features/admin/adminTypes";

type DemoBatch = AdminBatchRow & {
  reservationHours: number;
  notes: string | null;
  orderCount: number;
  confirmedGmv: number;
  // Detail product list (AdminBatchRow.products is the numeric count).
  productList: AdminBatchDetail["products"];
};

const DEMO_BATCHES: DemoBatch[] = [
  {
    id: "demo-b-1",
    title: "Japan Trip — March 2026",
    status: "live",
    category: "Food",
    moderationStatus: "visible",
    moderationReason: null,
    coverPath: null,
    startsOn: iso(5),
    endsOn: iso(-10),
    createdAt: iso(20),
    sellerId: "demo-u-1",
    sellerName: "Maria Santos",
    products: 2,
    productList: [
      {
        name: "Tokyo Banana",
        sellingPrice: 480,
        quantityTotal: 6,
        isLocked: false,
        claimed: 6,
        waitlist: 2,
      },
      {
        name: "KitKat Sakura",
        sellingPrice: 320,
        quantityTotal: 8,
        isLocked: false,
        claimed: 5,
        waitlist: 0,
      },
    ],
    totalQty: 14,
    claimedQty: 11,
    reservationHours: 48,
    notes: "Trip runs Mar 10–18.",
    orderCount: 11,
    confirmedGmv: 18_400,
  },
  {
    id: "demo-b-2",
    title: "PLM Thrift Drop — October 2026",
    status: "live",
    category: "Apparel",
    moderationStatus: "flagged",
    moderationReason: "Reported for unclear item condition photos.",
    coverPath: null,
    startsOn: iso(2),
    endsOn: iso(-6),
    createdAt: iso(8),
    sellerId: "demo-u-2",
    sellerName: "Ana Reyes",
    products: 1,
    productList: [
      {
        name: "Assorted Thrifted Denim",
        sellingPrice: 350,
        quantityTotal: 20,
        isLocked: false,
        claimed: 7,
        waitlist: 1,
      },
    ],
    totalQty: 20,
    claimedQty: 7,
    reservationHours: 48,
    notes: null,
    orderCount: 7,
    confirmedGmv: 2_450,
  },
];

export function demoListBatches(filters: AdminBatchFilters, limit: number, offset: number) {
  const search = filters.search?.trim().toLowerCase();
  const matched = DEMO_BATCHES.filter((b) => {
    if (
      search &&
      !(b.title.toLowerCase().includes(search) || b.sellerName.toLowerCase().includes(search))
    )
      return false;
    if (filters.status && filters.status !== "all" && b.status !== filters.status) return false;
    if (
      filters.moderation &&
      filters.moderation !== "all" &&
      (filters.moderation === "flagged_hidden"
        ? !["flagged", "hidden"].includes(b.moderationStatus)
        : b.moderationStatus !== filters.moderation)
    )
      return false;
    if (filters.category && filters.category !== "all" && b.category !== filters.category)
      return false;
    return true;
  });
  const rows: AdminBatchRow[] = matched.slice(offset, offset + limit).map((b) => {
    const {
      reservationHours: _h,
      notes: _n,
      orderCount: _o,
      confirmedGmv: _g,
      productList: _pl,
      ...row
    } = b;
    return row;
  });
  return { rows, total: matched.length, nextOffset: offset + limit };
}

export function demoGetBatch(batchId: string): AdminBatchDetail {
  const b = DEMO_BATCHES.find((x) => x.id === batchId);
  if (!b) throw new Error("Batch not found");
  return {
    id: b.id,
    title: b.title,
    status: b.status,
    category: b.category,
    moderationStatus: b.moderationStatus,
    moderationReason: b.moderationReason,
    coverPath: b.coverPath,
    startsOn: b.startsOn,
    endsOn: b.endsOn,
    reservationHours: b.reservationHours,
    notes: b.notes,
    sellerId: b.sellerId,
    sellerName: b.sellerName,
    createdAt: b.createdAt,
    orderCount: b.orderCount,
    confirmedGmv: b.confirmedGmv,
    products: b.productList,
    moderationHistory: [],
  };
}

export function demoModerateBatch(
  batchId: string,
  action: BatchModerationAction,
  reason: string,
): { changed: boolean } {
  const b = DEMO_BATCHES.find((x) => x.id === batchId);
  if (!b) throw new Error("Batch not found");
  const modMap: Record<string, BatchModeration> = {
    flag: "flagged",
    hide: "hidden",
    restore: "visible",
  };
  if (action in modMap) {
    b.moderationStatus = modMap[action];
    b.moderationReason = action === "restore" ? null : reason;
  } else if (action === "lock") b.status = "locked";
  else if (action === "unlock") b.status = "live";
  else if (action === "close") b.status = "closed";
  return { changed: true };
}

type DemoOrder = AdminOrderRow & { quantity: number; buyerId: string; sellerId: string };

const DEMO_ORDERS: DemoOrder[] = [
  {
    id: "demo-o-1",
    orderNumber: "ORD-2026-0199",
    product: "Tokyo Banana",
    buyer: "Jollo Dela Cruz",
    seller: "Maria Santos",
    amount: 1775,
    status: "payment_confirmed",
    trackingNumber: null,
    createdAt: iso(2),
    quantity: 2,
    buyerId: "demo-u-3",
    sellerId: "demo-u-1",
  },
  {
    id: "demo-o-2",
    orderNumber: "ORD-2026-0184",
    product: "Assorted Thrifted Denim",
    buyer: "Jollo Dela Cruz",
    seller: "Ana Reyes",
    amount: 350,
    status: "completed",
    trackingNumber: "JT-88213",
    createdAt: iso(9),
    quantity: 1,
    buyerId: "demo-u-3",
    sellerId: "demo-u-2",
  },
];

export function demoListOrders(filters: AdminOrderFilters, limit: number, offset: number) {
  const search = filters.search?.trim().toLowerCase();
  const matched = DEMO_ORDERS.filter((o) => {
    if (
      search &&
      !(
        o.orderNumber.toLowerCase().includes(search) ||
        o.product.toLowerCase().includes(search) ||
        o.buyer.toLowerCase().includes(search) ||
        o.seller.toLowerCase().includes(search)
      )
    )
      return false;
    if (filters.status && filters.status !== "all" && o.status !== filters.status) return false;
    return true;
  });
  const rows: AdminOrderRow[] = matched.slice(offset, offset + limit).map((o) => {
    const { quantity: _q, buyerId: _b, sellerId: _s, ...row } = o;
    return row;
  });
  return { rows, total: matched.length, nextOffset: offset + limit };
}

export function demoGetOrder(orderId: string): AdminOrderDetail {
  const o = DEMO_ORDERS.find((x) => x.id === orderId);
  if (!o) throw new Error("Order not found");
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    product: o.product,
    quantity: o.quantity,
    amount: o.amount,
    status: o.status,
    buyer: o.buyer,
    buyerId: o.buyerId,
    seller: o.seller,
    sellerId: o.sellerId,
    trackingNumber: o.trackingNumber,
    eta: null,
    deliveryAddress: "123 Demo St, Manila",
    reservationExpiresAt: null,
    paymentConfirmedAt: o.status === "payment_confirmed" ? iso(1) : null,
    completedAt: o.status === "completed" ? iso(3) : null,
    createdAt: o.createdAt,
    payments: [
      {
        id: "demo-pay-1",
        status: "verified",
        method: "GCash",
        amount: o.amount,
        referenceNumber: "GC123456",
        submittedAt: iso(2),
      },
    ],
  };
}

export function demoCancelOrder(orderId: string, _reason: string): { changed: boolean } {
  const o = DEMO_ORDERS.find((x) => x.id === orderId);
  if (!o) throw new Error("Order not found");
  if (o.status === "completed") throw new Error("A completed order cannot be cancelled");
  // Once payment is confirmed, the order can no longer be cancelled by anyone.
  if (["payment_confirmed", "preparing", "completed"].includes(o.status))
    throw new Error("A confirmed order cannot be cancelled");
  o.status = "cancelled";
  return { changed: true };
}

type DemoPayment = AdminPaymentRow & {
  orderId: string;
  payerName: string | null;
  payerPhone: string | null;
  receiptPath: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
};

const DEMO_PAYMENTS: DemoPayment[] = [
  {
    id: "demo-pay-1",
    orderNumber: "ORD-2026-0199",
    buyer: "Jollo Dela Cruz",
    seller: "Maria Santos",
    method: "GCash",
    amount: 1775,
    referenceNumber: "GC123456",
    status: "pending_review",
    submittedAt: iso(2),
    reviewedBy: null,
    orderId: "demo-o-1",
    payerName: "Jollo Dela Cruz",
    payerPhone: "0917xxxxxxx",
    receiptPath: null,
    rejectionReason: null,
    reviewedAt: null,
  },
];

export function demoListPayments(filters: AdminPaymentFilters, limit: number, offset: number) {
  const search = filters.search?.trim().toLowerCase();
  const matched = DEMO_PAYMENTS.filter((p) => {
    if (
      search &&
      !(
        p.orderNumber.toLowerCase().includes(search) ||
        (p.referenceNumber ?? "").toLowerCase().includes(search) ||
        p.buyer.toLowerCase().includes(search) ||
        p.seller.toLowerCase().includes(search)
      )
    )
      return false;
    if (filters.status && filters.status !== "all" && p.status !== filters.status) return false;
    return true;
  });
  const rows: AdminPaymentRow[] = matched.slice(offset, offset + limit).map((p) => {
    const {
      orderId: _o,
      payerName: _n,
      payerPhone: _ph,
      receiptPath: _r,
      rejectionReason: _rr,
      reviewedAt: _ra,
      ...row
    } = p;
    return row;
  });
  return { rows, total: matched.length, nextOffset: offset + limit };
}

export function demoGetPayment(paymentId: string): AdminPaymentDetail {
  const p = DEMO_PAYMENTS.find((x) => x.id === paymentId);
  if (!p) throw new Error("Payment not found");
  return {
    id: p.id,
    orderId: p.orderId,
    orderNumber: p.orderNumber,
    buyer: p.buyer,
    seller: p.seller,
    method: p.method,
    amount: p.amount,
    payerName: p.payerName,
    payerPhone: p.payerPhone,
    referenceNumber: p.referenceNumber,
    receiptPath: p.receiptPath,
    status: p.status,
    rejectionReason: p.rejectionReason,
    submittedAt: p.submittedAt,
    reviewedAt: p.reviewedAt,
    reviewedBy: p.reviewedBy,
  };
}

export function demoReviewPayment(
  paymentId: string,
  decision: "verified" | "rejected",
  reason: string,
): { changed: boolean; status?: string } {
  const p = DEMO_PAYMENTS.find((x) => x.id === paymentId);
  if (!p) throw new Error("Payment not found");
  p.status = decision;
  p.reviewedBy = "KARGO Admin";
  p.reviewedAt = iso(0);
  p.rejectionReason = decision === "rejected" ? reason : null;
  return { changed: true, status: decision };
}

export function demoListCombinedPayments(
  _filters: { search?: string; status?: string },
  offsetLimit: number,
  offset: number,
): AdminCombinedListResult {
  // Demo shows a small combined-payments set to exercise the view.
  const rows = [
    {
      id: "demo-cd-1",
      buyer: "Jollo Dela Cruz",
      seller: "Maria Santos",
      shippingFee: 150,
      status: "shipping_fee_set",
      createdAt: iso(1),
      memberCount: 2,
    },
  ];
  const page = rows.slice(offset, offset + offsetLimit);
  return { available: true, rows: page, total: rows.length, nextOffset: offset + offsetLimit };
}

// ─── Phase 4 demo: team + audit ─────────────────────────────────────────────

import type {
  AdminAuditFilters,
  AdminAuditRow,
  AdminInvite,
  AdminTeamMember,
} from "@/features/admin/adminTypes";

const DEMO_TEAM: AdminTeamMember[] = [
  {
    id: "demo-u-admin",
    name: "KARGO Admin",
    email: "admin@kargo.demo",
    avatarPath: null,
    grantedAt: iso(200),
    acceptedAt: iso(200),
    grantedBy: null,
    accountStatus: "active",
  },
];

const DEMO_AUDIT: AdminAuditRow[] = [
  {
    id: "demo-audit-1",
    actorName: "KARGO Admin",
    action: "grant_seller",
    targetType: "user",
    targetLabel: "Ana Reyes",
    reason: "Verified shop details over a call.",
    beforeState: { can_sell: false },
    afterState: { can_sell: true },
    createdAt: iso(1),
  },
  {
    id: "demo-audit-2",
    actorName: "KARGO Admin",
    action: "batch_hide",
    targetType: "batch",
    targetLabel: "PLM Thrift Drop — October 2026",
    reason: "Listing photos did not show item condition clearly.",
    beforeState: { moderation: "visible" },
    afterState: { moderation: "hidden" },
    createdAt: iso(2),
  },
];

export function demoListTeam(): { rows: AdminTeamMember[] } {
  return { rows: DEMO_TEAM };
}

export function demoGrantAdmin(userId: string, _reason: string): { changed: boolean } {
  if (DEMO_TEAM.some((m) => m.id === userId)) return { changed: false };
  const u = DEMO_USERS.find((x) => x.id === userId);
  if (!u) throw new Error("User not found");
  DEMO_TEAM.push({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarPath: u.avatarPath,
    grantedAt: iso(0),
    acceptedAt: null,
    grantedBy: "KARGO Admin",
    accountStatus: u.accountStatus,
  });
  return { changed: true };
}

export function demoRevokeAdmin(userId: string, _reason: string): { changed: boolean } {
  const active = DEMO_TEAM.filter((m) => m.acceptedAt !== null);
  if (active.length <= 1 && active.some((m) => m.id === userId)) {
    throw new Error("Cannot revoke the last active admin");
  }
  if (userId === "demo-u-admin") throw new Error("You cannot revoke your own admin access");
  const index = DEMO_TEAM.findIndex((m) => m.id === userId);
  if (index < 0) return { changed: false };
  DEMO_TEAM.splice(index, 1);
  return { changed: true };
}

// The demo admin preview is always the signed-in admin, so there is never a
// pending invitation to answer — except in ?preview=admin-invite, where the
// modal fetches this to show who the invitation came from.
export function demoGetMyInvite(): AdminInvite | null {
  return { pending: true, grantedAt: iso(0), grantedBy: "KARGO Admin" };
}

export function demoAcceptAdminInvite(): { accepted: boolean; changed: boolean } {
  return { accepted: true, changed: true };
}

export function demoDeclineAdminInvite(_reason: string | null): {
  declined: boolean;
  changed: boolean;
} {
  return { declined: true, changed: true };
}

export function demoListAudit(
  filters: AdminAuditFilters,
  limit: number,
  offset: number,
): AdminListResult<AdminAuditRow> {
  const search = filters.search?.trim().toLowerCase();
  const matched = DEMO_AUDIT.filter((a) => {
    if (
      search &&
      !(
        a.actorName.toLowerCase().includes(search) ||
        (a.targetLabel ?? "").toLowerCase().includes(search) ||
        a.action.toLowerCase().includes(search)
      )
    )
      return false;
    if (filters.action && filters.action !== "all" && a.action !== filters.action) return false;
    return true;
  });
  return {
    rows: matched.slice(offset, offset + limit),
    total: matched.length,
    nextOffset: offset + limit,
  };
}
