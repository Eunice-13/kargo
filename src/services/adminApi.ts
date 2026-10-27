import { requireSupabase } from "@/lib/supabase"

import type {
  AdminAuditFilters,
  AdminAuditRow,
  AdminBatchDetail,
  AdminBatchFilters,
  AdminBatchRow,
  AdminCombinedListResult,
  AdminDashboardData,
  AdminInvite,
  AdminListResult,
  AdminOrderDetail,
  AdminOrderFilters,
  AdminOrderRow,
  AdminPaymentDetail,
  AdminPaymentFilters,
  AdminPaymentRow,
  AdminTeamMember,
  AdminUserDetail,
  AdminUserFilters,
  AdminUserRow,
  AdminUserSearchResult,
  BatchModerationAction,
} from "@/features/admin/adminTypes"

import {
  demoAcceptAdminInvite,
  demoAdminDashboard,
  demoCancelOrder,
  demoDeclineAdminInvite,
  demoGetBatch,
  demoGetMyInvite,
  demoGetOrder,
  demoGetPayment,
  demoGetUser,
  demoGrantAdmin,
  demoListAudit,
  demoListBatches,
  demoListCombinedPayments,
  demoListOrders,
  demoListPayments,
  demoListTeam,
  demoListUsers,
  demoModerateBatch,
  demoReviewPayment,
  demoRevokeAdmin,
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

  // ─── Batches ──────────────────────────────────────────────────────────────

  async listBatches(
    filters: AdminBatchFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminBatchRow>> {
    if (demoMode) return demoListBatches(filters, limit, offset)
    return callAdmin("admin_list_batches", {
      p_search: filters.search ?? null,
      p_status: filters.status ?? "all",
      p_moderation: filters.moderation ?? "all",
      p_category: filters.category ?? "all",
      p_limit: limit,
      p_offset: offset,
    })
  },

  async getBatch(batchId: string): Promise<AdminBatchDetail> {
    if (demoMode) return demoGetBatch(batchId)
    return callAdmin("admin_get_batch", { p_batch_id: batchId })
  },

  async moderateBatch(
    batchId: string,
    action: BatchModerationAction,
    reason: string,
  ): Promise<{ changed: boolean }> {
    if (demoMode) return demoModerateBatch(batchId, action, reason)
    return callAdmin("admin_moderate_batch", {
      p_batch_id: batchId,
      p_action: action,
      p_reason: reason,
    })
  },

  // ─── Orders ───────────────────────────────────────────────────────────────

  async listOrders(
    filters: AdminOrderFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminOrderRow>> {
    if (demoMode) return demoListOrders(filters, limit, offset)
    return callAdmin("admin_list_orders", {
      p_search: filters.search ?? null,
      p_status: filters.status ?? "all",
      p_days: filters.days ?? 30,
      p_limit: limit,
      p_offset: offset,
    })
  },

  async getOrder(orderId: string): Promise<AdminOrderDetail> {
    if (demoMode) return demoGetOrder(orderId)
    return callAdmin("admin_get_order", { p_order_id: orderId })
  },

  async cancelOrder(orderId: string, reason: string): Promise<{ changed: boolean }> {
    if (demoMode) return demoCancelOrder(orderId, reason)
    return callAdmin("admin_cancel_order", { p_order_id: orderId, p_reason: reason })
  },

  // ─── Payments ─────────────────────────────────────────────────────────────

  async listPayments(
    filters: AdminPaymentFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminPaymentRow>> {
    if (demoMode) return demoListPayments(filters, limit, offset)
    return callAdmin("admin_list_payments", {
      p_search: filters.search ?? null,
      p_status: filters.status ?? "all",
      p_days: filters.days ?? 30,
      p_limit: limit,
      p_offset: offset,
    })
  },

  async getPayment(paymentId: string): Promise<AdminPaymentDetail> {
    if (demoMode) return demoGetPayment(paymentId)
    return callAdmin("admin_get_payment", { p_payment_id: paymentId })
  },

  async reviewPayment(
    paymentId: string,
    decision: "verified" | "rejected",
    reason: string,
  ): Promise<{ changed: boolean; status?: string }> {
    if (demoMode) return demoReviewPayment(paymentId, decision, reason)
    return callAdmin("admin_review_payment", {
      p_payment_id: paymentId,
      p_decision: decision,
      p_reason: reason,
    })
  },

  // Short-lived signed URL for a private payment receipt. Never cached/logged.
  async receiptUrl(path: string): Promise<string | null> {
    if (demoMode || !path) return null
    const { data, error } = await requireSupabase()
      .storage.from("payment-receipts")
      .createSignedUrl(path, 60)
    if (error) return null
    return data?.signedUrl ?? null
  },

  // ─── Combined payments (read-only) ──────────────────────────────────────────

  async listCombinedPayments(
    filters: { search?: string; status?: string },
    limit = 25,
    offset = 0,
  ): Promise<AdminCombinedListResult> {
    if (demoMode) return demoListCombinedPayments(filters, limit, offset)
    return callAdmin("admin_list_combined_payments", {
      p_search: filters.search ?? null,
      p_status: filters.status ?? "all",
      p_limit: limit,
      p_offset: offset,
    })
  },

  // ─── Team ─────────────────────────────────────────────────────────────────

  async listTeam(): Promise<{ rows: AdminTeamMember[] }> {
    if (demoMode) return demoListTeam()
    return callAdmin("admin_list_team", {})
  },

  async grantAdmin(userId: string, reason: string): Promise<{ changed: boolean }> {
    if (demoMode) return demoGrantAdmin(userId, reason)
    return callAdmin("admin_grant_admin", { p_user_id: userId, p_reason: reason })
  },

  async revokeAdmin(userId: string, reason: string): Promise<{ changed: boolean }> {
    if (demoMode) return demoRevokeAdmin(userId, reason)
    return callAdmin("admin_revoke_admin", { p_user_id: userId, p_reason: reason })
  },

  // ─── The invitee's own invitation (no admin rights required) ───────────────

  async getMyInvite(): Promise<AdminInvite | null> {
    if (demoMode) return demoGetMyInvite()
    return callAdmin<AdminInvite | null>("admin_my_invite", {})
  },

  async acceptAdminInvite(): Promise<{ accepted: boolean; changed: boolean }> {
    if (demoMode) return demoAcceptAdminInvite()
    return callAdmin("admin_accept_invite", {})
  },

  async declineAdminInvite(
    reason?: string,
  ): Promise<{ declined: boolean; changed: boolean }> {
    if (demoMode) return demoDeclineAdminInvite(reason ?? null)
    return callAdmin("admin_decline_invite", { p_reason: reason?.trim() || null })
  },

  // ─── Audit log ──────────────────────────────────────────────────────────────

  async listAudit(
    filters: AdminAuditFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminAuditRow>> {
    if (demoMode) return demoListAudit(filters, limit, offset)
    return callAdmin("admin_list_audit", {
      p_search: filters.search ?? null,
      p_action: filters.action ?? "all",
      p_days: filters.days ?? 30,
      p_limit: limit,
      p_offset: offset,
    })
  },
}
