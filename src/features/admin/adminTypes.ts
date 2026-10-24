// UI-facing shapes for adminApi results. These mirror the jsonb returned by the
// Phase 2 admin RPCs (202611010002_admin_users_dashboard.sql).

export type AdminAccountStatus = "active" | "suspended"

export type AdminDashboardData = {
  gmv30: number
  orders30: number
  activeSellers: number
  paymentsPending: number
  suspended: number
  flaggedHidden: number
  stuckOrders: number
  chart: { day: string; gmv: number }[]
  recentActivity: {
    id: string
    actor_name: string
    action: string
    target_type: string
    target_label: string | null
    created_at: string
  }[]
  topSellers: {
    id: string
    shop: string
    avatar_path: string | null
    orders: number
    gmv: number
  }[]
}

export type AdminUserRow = {
  id: string
  name: string
  email: string | null
  shopName: string | null
  avatarPath: string | null
  canSell: boolean
  isAdmin: boolean
  accountStatus: AdminAccountStatus
  createdAt: string
  updatedAt: string
  orders: number
  gmv30: number
}

export type AdminUserDetail = AdminUserRow & {
  bio: string | null
  accountStatusReason: string | null
  buyerOrders: number
  sellerOrders: number
  sellerGmv30: number
  liveBatches: number
  recentOrders: {
    id: string
    order_number: string
    status: string
    total_amount: number
    created_at: string
  }[]
  moderationHistory: {
    id: string
    actor_name: string
    action: string
    target_label: string | null
    reason: string | null
    created_at: string
  }[]
}

export type AdminUserSearchResult = {
  id: string
  name: string
  email: string | null
  avatar_path: string | null
}

export type AdminListResult<T> = {
  rows: T[]
  total: number
  nextOffset: number
}

export type AdminUserFilters = {
  search?: string
  role?: "all" | "buyer" | "seller" | "admin"
  status?: "all" | "active" | "suspended"
}
