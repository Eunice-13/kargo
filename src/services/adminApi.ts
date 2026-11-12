import { requireSupabase } from "@/lib/supabase";
import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsFilters,
  FulfillmentAnalyticsOrders,
  FulfillmentAnalyticsStage,
  FulfillmentCurrentStatus,
  FulfillmentCurrentStatusStage,
} from "@/types/fulfillmentAnalytics";

import type {
  AdminAuditFilters,
  AdminAuditRow,
  AdminBatchDetail,
  AdminBatchFilters,
  AdminBatchRow,
  AdminCombinedListResult,
  AdminCombinedPaymentDetail,
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
} from "@/features/admin/adminTypes";

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
  demoGetCombinedPayment,
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
} from "@/data/admin";

// Thrown when the current session is not an active admin (Postgres 42501 or a
// matching message). Lets the UI show a clean "access required" state.
export class AdminAccessError extends Error {
  constructor(message = "Admin access required") {
    super(message);
    this.name = "AdminAccessError";
  }
}

// Demo mode (?preview=admin) runs entirely in-memory with no Supabase calls.
let demoMode = false;
export function setAdminDemoMode(on: boolean) {
  demoMode = on;
}

const DEMO_ANALYTICS_STAGES: FulfillmentAnalyticsStage[] = [
  "payment_pending", "payment_submitted", "insufficient_payment", "payment_confirmed",
  "preparing", "shipped", "in_transit", "delivered", "cancelled", "expired",
];
const DEMO_CURRENT_STAGES: FulfillmentCurrentStatusStage[] = [
  "payment_pending", "payment_submitted", "insufficient_payment", "payment_confirmed",
  "preparing", "shipped", "delivered", "cancelled", "expired", "other",
];

function demoAnalyticsDates() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 13);
  return { start, end, generatedAt: end.toISOString() };
}

function demoAnalyticsChart<T extends string>(
  stages: T[],
  totals: Record<T, number>,
) {
  const { start, end } = demoAnalyticsDates();
  return Array.from({ length: 14 }, (_, index) => {
    const bucketStart = new Date(start);
    bucketStart.setDate(start.getDate() + index);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketEnd.getDate() + 1);
    const counts = Object.fromEntries(stages.map((stage) => {
      const total = totals[stage];
      const daily = Math.floor(total / 14);
      const remainder = total % 14;
      return [stage, daily + (index < remainder ? 1 : 0)];
    })) as Record<T, number>;
    return { bucketStart: bucketStart.toISOString(), bucketEnd: bucketEnd.toISOString(), counts };
  }).map((bucket, index, rows) => index === rows.length - 1
    ? { ...bucket, bucketEnd: end.toISOString() }
    : bucket);
}

function demoFulfillmentAnalytics(filters: FulfillmentAnalyticsFilters): FulfillmentAnalytics {
  const { start, end, generatedAt } = demoAnalyticsDates();
  const stageTotals: Record<FulfillmentAnalyticsStage, number> = {
    payment_pending: 120, payment_submitted: 96, insufficient_payment: 8,
    payment_confirmed: 78, preparing: 70, shipped: 55, in_transit: 43,
    delivered: 32, cancelled: 7, expired: 5,
  };
  return {
    period: filters.period ?? "last_30_days", timezone: "Asia/Manila", startAt: start.toISOString(),
    endAt: end.toISOString(), grouping: "day", generatedAt,
    snapshot: generatedAt, captureStartedAt: start.toISOString(),
    historicalCoverage: "full_recorded_history",
    countingRule: "all_orders_reached_stages", totalEntries: 514, cohortSize: 120,
    uniqueOrders: 120, stageTotals,
    chart: demoAnalyticsChart(DEMO_ANALYTICS_STAGES, stageTotals),
  };
}

function demoFulfillmentCurrentStatus(filters: FulfillmentAnalyticsFilters): FulfillmentCurrentStatus {
  const { start, end, generatedAt } = demoAnalyticsDates();
  const counts: Record<FulfillmentCurrentStatusStage, number> = {
    payment_pending: 12, payment_submitted: 15, insufficient_payment: 4,
    payment_confirmed: 10, preparing: 18, shipped: 18, delivered: 32,
    cancelled: 7, expired: 4, other: 0,
  };
  return {
    period: filters.period ?? "last_30_days", timezone: "Asia/Manila", startAt: start.toISOString(),
    endAt: end.toISOString(), grouping: "day", cohortSize: 120, generatedAt,
    counts, chart: demoAnalyticsChart(DEMO_CURRENT_STAGES, counts),
  };
}

function demoFulfillmentOrdersPage(
  stage: FulfillmentAnalyticsStage,
  generatedAt: string,
  limit: number,
  offset: number,
  current = false,
): FulfillmentAnalyticsOrders {
  const useDeliveredExample = stage === "delivered" || stage === "cancelled" || stage === "expired";
  const order = useDeliveredExample
    ? {
        id: "demo-o-2",
        number: "ORD-2026-0184",
        status: "completed",
        fulfillmentStage: "delivered",
        daysAgo: 9,
      }
    : {
        id: "demo-o-1",
        number: "ORD-2026-0199",
        status: "payment_confirmed",
        fulfillmentStage: "payment_confirmed",
        daysAgo: 2,
      };
  return {
    generatedAt,
    total: 1,
    nextOffset: offset + limit,
    rows: offset === 0
      ? [{
          order_id: order.id,
          order_number: order.number,
          stage,
          occurred_at: new Date(Date.now() - order.daysAgo * 86_400_000).toISOString(),
          source: current ? "current_status" : "transition",
          current_status: order.status,
          current_fulfillment_stage: order.fulfillmentStage,
        }]
      : [],
  };
}

async function callAdmin<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(fn, args);
  if (error) {
    if (error.code === "42501" || /admin access required/i.test(error.message)) {
      throw new AdminAccessError(error.message);
    }
    throw new Error(error.message);
  }
  return data as T;
}

export const adminApi = {
  async fulfillmentAnalytics(
    filters: FulfillmentAnalyticsFilters = {},
  ): Promise<FulfillmentAnalytics> {
    if (demoMode) return demoFulfillmentAnalytics(filters);
    return callAdmin("admin_fulfillment_analytics", {
      p_period: filters.period ?? "last_30_days",
      p_start: filters.start ?? null,
      p_end: filters.end ?? null,
    });
  },

  async fulfillmentCurrentStatus(
    filters: FulfillmentAnalyticsFilters = {},
  ): Promise<FulfillmentCurrentStatus> {
    if (demoMode) return demoFulfillmentCurrentStatus(filters);
    return callAdmin("admin_fulfillment_current_status", {
      p_period: filters.period ?? "last_30_days",
      p_start: filters.start ?? null,
      p_end: filters.end ?? null,
    });
  },

  async fulfillmentCurrentStatusOrders(
    filters: FulfillmentAnalyticsFilters,
    stage: FulfillmentCurrentStatusStage,
    limit = 25,
    offset = 0,
  ): Promise<FulfillmentAnalyticsOrders> {
    if (demoMode) {
      const analyticsStage: FulfillmentAnalyticsStage =
        stage === "other" ? "payment_confirmed" : stage as FulfillmentAnalyticsStage;
      return demoFulfillmentOrdersPage(analyticsStage, new Date().toISOString(), limit, offset, true);
    }
    return callAdmin("admin_fulfillment_current_status_orders", {
      p_period: filters.period ?? "last_30_days",
      p_start: filters.start ?? null,
      p_end: filters.end ?? null,
      p_stage: stage,
      p_limit: limit,
      p_offset: offset,
    });
  },

  async fulfillmentOrders(
    filters: FulfillmentAnalyticsFilters,
    point: {
      stage: FulfillmentAnalyticsStage;
      bucket?: string;
      generatedAt: string;
      snapshot: string;
    },
    limit = 25,
    offset = 0,
  ): Promise<FulfillmentAnalyticsOrders> {
    if (demoMode) return demoFulfillmentOrdersPage(point.stage, point.generatedAt, limit, offset);
    return callAdmin("admin_fulfillment_orders", {
      p_period: filters.period ?? "last_30_days",
      p_start: filters.start ?? null,
      p_end: filters.end ?? null,
      p_stage: point.stage,
      p_bucket: point.bucket ?? null,
      p_as_of: point.generatedAt,
      p_snapshot: point.snapshot,
      p_limit: limit,
      p_offset: offset,
    });
  },

  async dashboard(): Promise<AdminDashboardData> {
    if (demoMode) return demoAdminDashboard();
    return callAdmin<AdminDashboardData>("admin_dashboard", {});
  },

  async listUsers(
    filters: AdminUserFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminUserRow>> {
    if (demoMode) return demoListUsers(filters, limit, offset);
    return callAdmin<AdminListResult<AdminUserRow>>("admin_list_users", {
      p_search: filters.search ?? null,
      p_role: filters.role ?? "all",
      p_status: filters.status ?? "all",
      p_limit: limit,
      p_offset: offset,
    });
  },

  async getUser(userId: string): Promise<AdminUserDetail> {
    if (demoMode) return demoGetUser(userId);
    return callAdmin<AdminUserDetail>("admin_get_user", { p_user_id: userId });
  },

  async searchUsers(query: string, limit = 10): Promise<AdminUserSearchResult[]> {
    if (demoMode) return demoSearchUsers(query, limit);
    return callAdmin<AdminUserSearchResult[]>("admin_search_users", {
      p_query: query,
      p_limit: limit,
    });
  },

  async setAccountStatus(
    userId: string,
    status: "active" | "suspended",
    reason: string,
  ): Promise<{ changed: boolean; status: string }> {
    if (demoMode) return demoSetAccountStatus(userId, status, reason);
    return callAdmin("admin_set_account_status", {
      p_user_id: userId,
      p_status: status,
      p_reason: reason,
    });
  },

  async setSellerAccess(
    userId: string,
    enabled: boolean,
    reason: string,
  ): Promise<{ changed: boolean; canSell: boolean }> {
    if (demoMode) return demoSetSellerAccess(userId, enabled, reason);
    return callAdmin("admin_set_seller_access", {
      p_user_id: userId,
      p_enabled: enabled,
      p_reason: reason,
    });
  },

  // ─── Batches ──────────────────────────────────────────────────────────────

  async listBatches(
    filters: AdminBatchFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminBatchRow>> {
    if (demoMode) return demoListBatches(filters, limit, offset);
    return callAdmin("admin_list_batches", {
      p_search: filters.search ?? null,
      p_status: filters.status ?? "all",
      p_moderation: filters.moderation ?? "all",
      p_category: filters.category ?? "all",
      p_limit: limit,
      p_offset: offset,
    });
  },

  async getBatch(batchId: string): Promise<AdminBatchDetail> {
    if (demoMode) return demoGetBatch(batchId);
    return callAdmin("admin_get_batch", { p_batch_id: batchId });
  },

  async moderateBatch(
    batchId: string,
    action: BatchModerationAction,
    reason: string,
  ): Promise<{ changed: boolean }> {
    if (demoMode) return demoModerateBatch(batchId, action, reason);
    return callAdmin("admin_moderate_batch", {
      p_batch_id: batchId,
      p_action: action,
      p_reason: reason,
    });
  },

  // ─── Orders ───────────────────────────────────────────────────────────────

  async listOrders(
    filters: AdminOrderFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminOrderRow>> {
    if (demoMode) return demoListOrders(filters, limit, offset);
    return callAdmin("admin_list_orders", {
      p_search: filters.search ?? null,
      p_status: filters.status ?? "all",
      p_days: filters.days ?? 30,
      p_limit: limit,
      p_offset: offset,
    });
  },

  async getOrder(orderId: string): Promise<AdminOrderDetail> {
    if (demoMode) return demoGetOrder(orderId);
    return callAdmin("admin_get_order", { p_order_id: orderId });
  },

  async cancelOrder(orderId: string, reason: string): Promise<{ changed: boolean }> {
    if (demoMode) return demoCancelOrder(orderId, reason);
    return callAdmin("admin_cancel_order", { p_order_id: orderId, p_reason: reason });
  },

  // ─── Payments ─────────────────────────────────────────────────────────────

  async listPayments(
    filters: AdminPaymentFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminPaymentRow>> {
    if (demoMode) return demoListPayments(filters, limit, offset);
    return callAdmin("admin_list_payments", {
      p_search: filters.search ?? null,
      p_status: filters.status ?? "all",
      p_days: filters.days ?? 30,
      p_limit: limit,
      p_offset: offset,
    });
  },

  async getPayment(paymentId: string): Promise<AdminPaymentDetail> {
    if (demoMode) return demoGetPayment(paymentId);
    return callAdmin("admin_get_payment", { p_payment_id: paymentId });
  },

  async reviewPayment(
    paymentId: string,
    decision: "verified" | "rejected",
    reason: string,
  ): Promise<{ changed: boolean; status?: string }> {
    if (demoMode) return demoReviewPayment(paymentId, decision, reason);
    return callAdmin("admin_review_payment", {
      p_payment_id: paymentId,
      p_decision: decision,
      p_reason: reason,
    });
  },

  // Short-lived signed URL for a private payment receipt. Never cached/logged.
  async receiptUrl(path: string): Promise<string | null> {
    if (demoMode || !path) return null;
    const { data, error } = await requireSupabase()
      .storage.from("payment-receipts")
      .createSignedUrl(path, 60);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  // ─── Combined payments (read-only) ──────────────────────────────────────────

  async listCombinedPayments(
    filters: { search?: string; status?: string },
    limit = 25,
    offset = 0,
  ): Promise<AdminCombinedListResult> {
    if (demoMode) return demoListCombinedPayments(filters, limit, offset);
    return callAdmin("admin_list_combined_payments", {
      p_search: filters.search ?? null,
      p_status: filters.status ?? "all",
      p_limit: limit,
      p_offset: offset,
    });
  },

  async getCombinedPayment(groupId: string): Promise<AdminCombinedPaymentDetail> {
    if (demoMode) return demoGetCombinedPayment(groupId);
    return callAdmin("admin_get_combined_payment", { p_group_id: groupId });
  },

  // ─── Team ─────────────────────────────────────────────────────────────────

  async listTeam(): Promise<{ rows: AdminTeamMember[] }> {
    if (demoMode) return demoListTeam();
    return callAdmin("admin_list_team", {});
  },

  async grantAdmin(userId: string, reason: string): Promise<{ changed: boolean }> {
    if (demoMode) return demoGrantAdmin(userId, reason);
    return callAdmin("admin_grant_admin", { p_user_id: userId, p_reason: reason });
  },

  async revokeAdmin(userId: string, reason: string): Promise<{ changed: boolean }> {
    if (demoMode) return demoRevokeAdmin(userId, reason);
    return callAdmin("admin_revoke_admin", { p_user_id: userId, p_reason: reason });
  },

  // ─── The invitee's own invitation (no admin rights required) ───────────────

  async getMyInvite(): Promise<AdminInvite | null> {
    if (demoMode) return demoGetMyInvite();
    return callAdmin<AdminInvite | null>("admin_my_invite", {});
  },

  async acceptAdminInvite(): Promise<{ accepted: boolean; changed: boolean }> {
    if (demoMode) return demoAcceptAdminInvite();
    return callAdmin("admin_accept_invite", {});
  },

  async declineAdminInvite(reason?: string): Promise<{ declined: boolean; changed: boolean }> {
    if (demoMode) return demoDeclineAdminInvite(reason ?? null);
    return callAdmin("admin_decline_invite", { p_reason: reason?.trim() || null });
  },

  // ─── Audit log ──────────────────────────────────────────────────────────────

  async listAudit(
    filters: AdminAuditFilters,
    limit = 25,
    offset = 0,
  ): Promise<AdminListResult<AdminAuditRow>> {
    if (demoMode) return demoListAudit(filters, limit, offset);
    return callAdmin("admin_list_audit", {
      p_search: filters.search ?? null,
      p_action: filters.action ?? "all",
      p_days: filters.days ?? 30,
      p_limit: limit,
      p_offset: offset,
    });
  },
};
