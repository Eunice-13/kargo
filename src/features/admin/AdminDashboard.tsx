import { ArrowUpRight } from "lucide-react";

import { Card, CardSkeleton, Avatar } from "@/components/shared";
import { ADMIN_ACTION_LABELS } from "@/constants/admin";
import { adminApi } from "@/services";
import { requestAdminSection } from "@/state/navIntent";
import type { SharedState } from "@/types";

import AdminFulfillmentAnalytics from "./AdminFulfillmentAnalytics";
import AdminSectionBoundary from "./AdminSectionBoundary";
import "./adminDashboardCards.css";

import { useAdminResource } from "./useAdminResource";
import { AdminPageHeader, AdminPanelHeader } from "./components";
import { AdminEmptyText } from "./components/AdminFacts";
import { AdminErrorState } from "./components/AdminStates";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export default function AdminDashboard({ setTab }: SharedState) {
  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.dashboard(),
    [],
  );

  // Set the deep-link intent, then switch to the target admin tab.
  const goto = (opts: Parameters<typeof requestAdminSection>[0]) => {
    requestAdminSection(opts);
    setTab(opts.tab);
  };

  return (
    <div className="p-6 admin-page admin-page--dashboard">
      <AdminPageHeader title="Dashboard" subtitle="What needs attention across KARGO right now." />

      {loading && (
        <div className="admin-stats admin-stats--operational">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <AdminErrorState message={error} onRetry={refresh} accessDenied={accessDenied} />
      )}

      {!loading && !error && data && (
        <>
          <div className="admin-attention-metrics">
            {[
              {
                label: "Paid orders missing tracking",
                value: data.stuckOrders,
                go: () =>
                  goto({ tab: "Transactions", subtab: "Orders", filter: "paid_missing_tracking" }),
              },
              {
                label: "Payments to review",
                value: data.paymentsPending,
                go: () =>
                  goto({ tab: "Transactions", subtab: "Payments", filter: "pending_review" }),
              },
              {
                label: "Suspended",
                value: data.suspended,
                go: () => goto({ tab: "Users", subtab: "Suspended" }),
              },
              {
                label: "Flagged or hidden batches",
                value: data.flaggedHidden,
                go: () => goto({ tab: "Batches", filter: "flagged_hidden" }),
              },
            ].map((metric) => (
              <button
                key={metric.label}
                type="button"
                className="admin-attention-metric"
                onClick={metric.go}
                aria-label={`Open ${metric.label}`}
              >
                <ArrowUpRight size={20} aria-hidden="true" />
                <strong>{metric.value.toLocaleString()}</strong>
                <span>{metric.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <AdminSectionBoundary label="Order fulfillment analytics">
        <AdminFulfillmentAnalytics />
      </AdminSectionBoundary>

      {!loading && !error && data && (
        <>
          {/* Recent activity + top shops */}
          <div className="admin-grid">
            <Card className="admin-activity-card">
              <AdminPanelHeader
                title="Recent admin activity"
                hint="Actions taken in this console."
                actionLabel="View all"
                onAction={() => goto({ tab: "Security", subtab: "Audit log" })}
              />
              {data.recentActivity.length === 0 ? (
                <AdminEmptyText>No admin activity yet.</AdminEmptyText>
              ) : (
                <ul className="admin-activity-list">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="admin-activity-row">
                      <span className="admin-activity-row__main">
                        <strong>{a.actor_name || "Admin"}</strong>{" "}
                        {ADMIN_ACTION_LABELS[a.action] ?? a.action}
                        {a.target_label ? (
                          <span className="admin-activity-row__target"> · {a.target_label}</span>
                        ) : null}
                      </span>
                      <span className="admin-activity-row__time">{relativeTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="admin-seller-card">
              <AdminPanelHeader
                title="Top Shops (30d)"
                hint="Ranked by orders in the last 30 days."
                actionLabel="View all"
                onAction={() => goto({ tab: "Users", filter: "seller" })}
              />
              {data.topSellers.length === 0 ? (
                <AdminEmptyText>No seller sales in the last 30 days.</AdminEmptyText>
              ) : (
                <ul className="admin-seller-list">
                  {/* The RPC already returns sellers ranked by 30-day confirmed
                      order count (GMV breaks ties), so trust that order. */}
                  {data.topSellers.map((s, index) => (
                    <li key={s.id} className="admin-seller-row">
                      <button
                        type="button"
                        className="admin-seller-row__open"
                        onClick={() => goto({ tab: "Users", filter: "seller", targetId: s.id })}
                        aria-label={`Open ${s.shop} — ${s.orders} orders`}
                      >
                        <span className="admin-seller-row__rank" aria-hidden="true">
                          {index + 1}
                        </span>
                        <Avatar name={s.shop} size={28} />
                        <span className="admin-seller-row__shop">
                          {s.shop?.trim() || "Seller shop"}
                        </span>
                        <strong className="admin-seller-row__orders">
                          {s.orders.toLocaleString()} {s.orders === 1 ? "order" : "orders"}
                        </strong>
                        <span className="admin-seller-row__gmv">{peso(s.gmv)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
