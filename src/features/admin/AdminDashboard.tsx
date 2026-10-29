import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Package,
  ReceiptText,
  ShieldAlert,
  Store,
  UserX,
} from "lucide-react";

import { Card, CardSkeleton, Avatar, PrimaryBtn } from "@/components/shared";
import { ADMIN_ACTION_LABELS } from "@/constants/admin";
import { adminApi } from "@/services";
import { requestAdminSection } from "@/state/navIntent";
import type { SharedState } from "@/types";

import AdminFulfillmentAnalytics from "./AdminFulfillmentAnalytics";

import { useAdminResource } from "./useAdminResource";
import { AdminPageHeader, AdminStatCard, AdminPanelHeader } from "./components";
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

type QueueItem = {
  key: string;
  icon: typeof Package;
  title: string;
  count: number;
  tone: "danger" | "warn" | "info";
  description: string;
  go: () => void;
};

// Buyer/seller dashboard palette, applied to the admin KPIs.
const STAT_STYLES = {
  green: {
    background: "linear-gradient(135deg, #E8F9F3 0%, #DDF7EC 55%, #CFF2E2 100%)",
    accent: "#3FBF8F",
    strip: "#75EEA3",
  },
  indigo: {
    background: "linear-gradient(135deg, #E0E7FF 0%, #DEF3FA 100%)",
    accent: "#191BA9",
    strip: "#191BA9",
  },
  amber: {
    background: "linear-gradient(135deg, #FFF8E8 0%, #FFF3D8 55%, #FFECC4 100%)",
    accent: "#B4690E",
    strip: "#FFE873",
  },
  red: {
    background: "linear-gradient(135deg, #FFF0F2 0%, #FCE2E6 55%, #F8D4DA 100%)",
    accent: "#B42318",
    strip: "#E52B49",
  },
  gray: {
    background: "linear-gradient(135deg, #FFFFFF 0%, #F5F7FB 55%, #E9EEF7 100%)",
    accent: "#4B5563",
    strip: "#C7CDDB",
  },
} as const;

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
            <PrimaryBtn className="admin-action-primary" size="sm" onClick={() => { refresh(); setAnalyticsRefresh(n => n + 1); }}>
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
          {/* KPI row — seller/buyer dashboard card treatment. */}
          <div className="admin-stats admin-stats--operational">
            <AdminStatCard
              icon={ReceiptText}
              label="Orders (30d)"
              value={data.orders30.toLocaleString()}
              sub="Payment confirmed"
              {...STAT_STYLES.indigo}
              onClick={() => goto({ tab: "Transactions", subtab: "Orders" })}
            />
            <AdminStatCard
              icon={Store}
              label="Active sellers"
              value={data.activeSellers.toLocaleString()}
              sub="Can sell today"
              {...STAT_STYLES.amber}
              onClick={() => goto({ tab: "Users", filter: "seller" })}
            />
            <AdminStatCard
              icon={BadgeCheck}
              label="Payments to review"
              value={data.paymentsPending.toLocaleString()}
              sub="Proofs awaiting a seller"
              {...STAT_STYLES.red}
              onClick={() => goto({ tab: "Transactions", subtab: "Payments" })}
            />
            <AdminStatCard
              icon={UserX}
              label="Suspended"
              value={data.suspended.toLocaleString()}
              sub="Accounts locked out"
              {...STAT_STYLES.gray}
              onClick={() => goto({ tab: "Users", subtab: "Suspended" })}
            />
          </div>

        </>
      )}

      <AdminFulfillmentAnalytics refreshKey={analyticsRefresh} />

      {!loading && !error && data && (
        <>
          <NeedsAttention data={data} goto={goto} />

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

const QUEUE_TONES: Record<QueueItem["tone"], { bg: string; fg: string }> = {
  warn: { bg: "#FDF2E3", fg: "#B4690E" },
  danger: { bg: "#FEECEC", fg: "#B42318" },
  info: { bg: "#E0E7FF", fg: "#191BA9" },
};

function NeedsAttention({
  data,
  goto,
}: {
  data: {
    paymentsPending: number;
    stuckOrders: number;
    flaggedHidden: number;
    suspended: number;
  };
  goto: (opts: Parameters<typeof requestAdminSection>[0]) => void;
}) {
  const items: QueueItem[] = [
    {
      key: "payments",
      icon: BadgeCheck,
      title: "Payments awaiting review",
      count: data.paymentsPending,
      tone: "warn",
      description: "Proofs submitted and not yet verified.",
      go: () => goto({ tab: "Transactions", subtab: "Payments" }),
    },
    {
      key: "stuck",
      icon: Package,
      title: "Paid, not shipped 7+ days",
      count: data.stuckOrders,
      tone: "danger",
      description: "Confirmed orders without tracking.",
      go: () => goto({ tab: "Transactions", subtab: "Orders" }),
    },
    {
      key: "flagged",
      icon: ShieldAlert,
      title: "Flagged or hidden batches",
      count: data.flaggedHidden,
      tone: "info",
      description: "Batches marked for moderation.",
      go: () => goto({ tab: "Batches", filter: "flagged" }),
    },
    {
      key: "suspended",
      icon: UserX,
      title: "Suspended accounts",
      count: data.suspended,
      tone: "info",
      description: "Accounts currently locked out.",
      go: () => goto({ tab: "Users", subtab: "Suspended" }),
    },
  ];

  const openCount = items.filter((item) => item.count > 0).length;

  return (
    <Card className="admin-queue-card">
      <AdminPanelHeader
        title="Needs attention"
        hint={
          openCount === 0
            ? "Everything is clear."
            : `${openCount} queue${openCount === 1 ? "" : "s"} need a decision.`
        }
      />
      <ul className="admin-queue">
        {items.map((item) => {
          const clear = item.count === 0;
          const Icon = clear ? Check : item.icon;
          const tone = QUEUE_TONES[item.tone];
          return (
            <li key={item.key}>
              <button type="button" className="admin-queue-row" onClick={item.go}>
                <span
                  className="admin-queue-row__icon"
                  style={{
                    background: clear ? "#E6F6EF" : tone.bg,
                    color: clear ? "#0B7A59" : tone.fg,
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="admin-queue-row__text">
                  <span className="admin-queue-row__title">{item.title}</span>
                  <span className="admin-queue-row__desc">
                    {clear ? "All clear" : item.description}
                  </span>
                </span>
                <span
                  className={`admin-queue-row__count${clear ? " is-clear" : ""}`}
                  style={clear ? undefined : { background: tone.bg, color: tone.fg }}
                >
                  {clear ? "0" : item.count}
                </span>
                <ChevronRight size={16} color="#6B7280" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
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
