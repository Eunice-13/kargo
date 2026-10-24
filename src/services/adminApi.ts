import { requireSupabase } from "@/lib/supabase"

import type {
  AdminDashboardData,
  AdminListResult,
  AdminUserDetail,
  AdminUserFilters,
  AdminUserRow,
  AdminUserSearchResult,
} from "@/features/admin/adminTypes"

import {
  demoAdminDashboard,
  demoGetUser,
  demoListUsers,
  demoSearchUsers,
  demoSetAccountStatus,
  demoSetSellerAccess,
} from "@/data/admin"

// Thrown when the current session is not an active admin (Postgres 42501 or a
// matching message). Lets the UI show a clean "access required" state.
export class AdminAccessError extends Error {
  constructor(message = "Admin access required") {
    super(message)
    this.name = "AdminAccessError"
  }
}

// Demo mode (?preview=admin) runs entirely in-memory with no Supabase calls.
let demoMode = false
export function setAdminDemoMode(on: boolean) {
  demoMode = on
}

async function callAdmin<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(fn, args)
  if (error) {
    if (error.code === "42501" || /admin access required/i.test(error.message)) {
      throw new AdminAccessError(error.message)
    }
    throw new Error(error.message)
  }
  return data as T
}

export const adminApi = {
  async dashboard(): Promise<AdminDashboardData> {
    if (demoMode) return demoAdminDashboard()
    return callAdmin<AdminDashboardData>("admin_dashboard", {})
  },

  async listUsers(
    filters: AdminUserFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminUserRow>> {
    if (demoMode) return demoListUsers(filters, limit, offset)
    return callAdmin<AdminListResult<AdminUserRow>>("admin_list_users", {
      p_search: filters.search ?? null,
      p_role: filters.role ?? "all",
      p_status: filters.status ?? "all",
      p_limit: limit,
      p_offset: offset,
    })
  },

  async getUser(userId: string): Promise<AdminUserDetail> {
    if (demoMode) return demoGetUser(userId)
    return callAdmin<AdminUserDetail>("admin_get_user", { p_user_id: userId })
  },

  async searchUsers(query: string, limit = 10): Promise<AdminUserSearchResult[]> {
    if (demoMode) return demoSearchUsers(query, limit)
    return callAdmin<AdminUserSearchResult[]>("admin_search_users", {
      p_query: query,
      p_limit: limit,
    })
  },

  async setAccountStatus(
    userId: string,
    status: "active" | "suspended",
    reason: string,
  ): Promise<{ changed: boolean; status: string }> {
    if (demoMode) return demoSetAccountStatus(userId, status, reason)
    return callAdmin("admin_set_account_status", {
      p_user_id: userId,
      p_status: status,
      p_reason: reason,
    })
  },

  async setSellerAccess(
    userId: string,
    enabled: boolean,
    reason: string,
  ): Promise<{ changed: boolean; canSell: boolean }> {
    if (demoMode) return demoSetSellerAccess(userId, enabled, reason)
    return callAdmin("admin_set_seller_access", {
      p_user_id: userId,
      p_enabled: enabled,
      p_reason: reason,
    })
  },
}
