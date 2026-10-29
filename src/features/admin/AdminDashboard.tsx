import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { Card, CardSkeleton, Avatar, PrimaryBtn } from "@/components/shared";
import { ADMIN_ACTION_LABELS } from "@/constants/admin";
import { adminApi } from "@/services";
import { requestAdminSection } from "@/state/navIntent";
import type { SharedState } from "@/types";

import AdminFulfillmentAnalytics from "./AdminFulfillmentAnalytics";
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

const PIPELINE_META: Record<string, { label: string; tone: string }> = {
  payment_pending: { label: "Awaiting payment", tone: "#B4690E" },
  payment_submitted: { label: "Awaiting review", tone: "#191BA9" },
  insufficient_payment: { label: "Insufficient payment", tone: "#B42318" },
  payment_confirmed: { label: "Payment confirmed", tone: "#0B7A59" },
  preparing: { label: "Preparing", tone: "#0E7490" },
  completed: { label: "Completed", tone: "#15803D" },
  cancelled: { label: "Cancelled", tone: "#9CA3AF" },
  expired: { label: "Expired", tone: "#9CA3AF" },
  incomplete: { label: "Incomplete", tone: "#B42318" },
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

  const [analyticsRefresh, setAnalyticsRefresh] = useState(0);

  const pipeline = data?.pipeline ?? [];

  return (
    <div className="p-6 admin-page admin-page--dashboard">
      <AdminPageHeader
        title="Dashboard"
        subtitle="What needs attention across KARGO right now."
        actions={
          <>
            <PrimaryBtn
              className="admin-action-primary"
              size="sm"
              onClick={() => {
                refresh();
                setAnalyticsRefresh((n) => n + 1);
              }}
            >
              Refresh
            </PrimaryBtn>
          </>
        }
      />

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
                description: "Payment confirmed over 7 days ago; still awaiting tracking.",
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
                aria-label={`Open ${metric.label}${metric.description ? `. ${metric.description}` : ""}`}
              >
                <ArrowUpRight size={20} aria-hidden="true" />
                <strong>{metric.value.toLocaleString()}</strong>
                <span>{metric.label}</span>
                {metric.description && <small>{metric.description}</small>}
              </button>
            ))}
          </div>
        </>
      )}

      <AdminFulfillmentAnalytics refreshKey={analyticsRefresh} />

      {!loading && !error && data && (
        <>
          {/* Order pipeline + recent activity + top sellers */}
          <div className="admin-grid">
            <PipelineChart
              rows={pipeline}
              onViewOrders={() => goto({ tab: "Transactions", subtab: "Orders" })}
            />

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
                title="Top sellers (30d)"
                hint="Ranked by payments confirmed in the last 30 days."
                actionLabel="View all"
                onAction={() => goto({ tab: "Users", filter: "seller" })}
              />
              {data.topSellers.length === 0 ? (
                <AdminEmptyText>No seller sales in the last 30 days.</AdminEmptyText>
              ) : (
                <ul className="admin-seller-list">
                  {data.topSellers.map((s, index) => (
                    <li key={s.id} className="admin-seller-row">
                      <span className="admin-seller-row__rank" aria-hidden="true">
                        {index + 1}
                      </span>
                      <Avatar name={s.shop} size={28} />
                      <span className="admin-seller-row__shop">{s.shop}</span>
                      <span className="admin-seller-row__orders">{s.orders} orders</span>
                      <strong className="admin-seller-row__gmv">{peso(s.gmv)}</strong>
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

function PipelineChart({
  rows,
  onViewOrders,
}: {
  rows: { status: string; count: number }[];
  onViewOrders: () => void;
}) {
  const visible = rows.filter((row) => row.count > 0);
  const total = visible.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...visible.map((row) => row.count));

  return (
    <Card className="admin-pipeline-card">
      <div className="admin-chart-head">
        <div>
          <h2 className="admin-chart-title">Where orders stand</h2>
          <p className="admin-chart-sub">
            {total > 0
              ? `${total.toLocaleString()} orders created in the last 30 days.`
              : "Orders created in the last 30 days."}
          </p>
        </div>
        <button type="button" className="admin-chart-link" onClick={onViewOrders}>
          View orders <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </div>

      {visible.length === 0 ? (
        <p style={{ color: "var(--kargo-muted)", fontSize: 13 }}>No orders in the last 30 days.</p>
      ) : (
        <ul className="admin-pipeline">
          {visible.map((row) => {
            const meta = PIPELINE_META[row.status] ?? {
              label: row.status.replace(/_/g, " "),
              tone: "#9CA3AF",
            };
            const share = total > 0 ? Math.round((row.count / total) * 100) : 0;
            return (
              <li key={row.status} className="admin-pipeline__row">
                <div className="admin-pipeline__labels">
                  <span>{meta.label}</span>
                  <span>
                    {row.count.toLocaleString()} · {share}%
                  </span>
                </div>
                <div className="admin-pipeline__track">
                  <div
                    className="admin-pipeline__fill"
                    style={{
                      width: `${Math.max((row.count / max) * 100, 2)}%`,
                      background: meta.tone,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
