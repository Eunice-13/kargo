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
} from "@/features/admin/adminTypes"

type DemoUser = AdminUserRow & {
  bio: string | null
  accountStatusReason: string | null
  buyerOrders: number
  sellerOrders: number
  sellerGmv30: number
  liveBatches: number
}

const iso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString()

const DEMO_USERS: DemoUser[] = [
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
]

const roleOf = (u: DemoUser): "admin" | "seller" | "buyer" =>
  u.isAdmin ? "admin" : u.canSell ? "seller" : "buyer"

export function demoListUsers(
  filters: AdminUserFilters,
  limit: number,
  offset: number,
): AdminListResult<AdminUserRow> {
  const search = filters.search?.trim().toLowerCase()
  const matched = DEMO_USERS.filter((u) => {
    if (
      search &&
      !(
        u.name.toLowerCase().includes(search) ||
        (u.email ?? "").toLowerCase().includes(search) ||
        (u.shopName ?? "").toLowerCase().includes(search)
      )
    )
      return false
    if (filters.role && filters.role !== "all" && roleOf(u) !== filters.role)
      return false
    if (
      filters.status &&
      filters.status !== "all" &&
      u.accountStatus !== filters.status
    )
      return false
    return true
  })
  const page = matched.slice(offset, offset + limit).map(stripDetail)
  return { rows: page, total: matched.length, nextOffset: offset + limit }
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
  } = u
  return row
}

export function demoGetUser(userId: string): AdminUserDetail {
  const u = DEMO_USERS.find((x) => x.id === userId)
  if (!u) throw new Error("User not found")
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
  }
}

export function demoSearchUsers(
  query: string,
  limit: number,
): AdminUserSearchResult[] {
  const q = query.trim().toLowerCase()
  return DEMO_USERS.filter(
    (u) =>
      u.name.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q),
  )
    .slice(0, limit)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, avatar_path: null }))
}

export function demoSetAccountStatus(
  userId: string,
  status: "active" | "suspended",
  reason: string,
): { changed: boolean; status: string } {
  const u = DEMO_USERS.find((x) => x.id === userId)
  if (!u) throw new Error("User not found")
  const changed = u.accountStatus !== status
  u.accountStatus = status
  u.accountStatusReason = status === "suspended" ? reason : null
  u.updatedAt = iso(0)
  return { changed, status }
}

export function demoSetSellerAccess(
  userId: string,
  enabled: boolean,
  _reason: string,
): { changed: boolean; canSell: boolean } {
  const u = DEMO_USERS.find((x) => x.id === userId)
  if (!u) throw new Error("User not found")
  const changed = u.canSell !== enabled
  u.canSell = enabled
  u.updatedAt = iso(0)
  return { changed, canSell: enabled }
}

export function demoAdminDashboard(): AdminDashboardData {
  const chart = Array.from({ length: 14 }, (_, i) => ({
    day: iso(13 - i).slice(0, 10),
    gmv: Math.round(4000 + Math.sin(i / 2) * 2500 + i * 180),
  }))
  return {
    gmv30: 268_400,
    orders30: 142,
    activeSellers: DEMO_USERS.filter(
      (u) => u.canSell && u.accountStatus === "active",
    ).length,
    paymentsPending: 3,
    suspended: DEMO_USERS.filter((u) => u.accountStatus === "suspended").length,
    flaggedHidden: 1,
    stuckOrders: 2,
    chart,
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
  }
}
