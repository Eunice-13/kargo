import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleDollarSign,
  Package,
  ReceiptText,
  ShieldAlert,
  Store,
  UserX,
} from "lucide-react";

import { Card, CardSkeleton, Avatar } from "@/components/shared";
import { INDIGO } from "@/constants/theme";
import { ADMIN_ACTION_LABELS } from "@/constants/admin";
import { adminApi } from "@/services";
import { requestAdminSection } from "@/state/navIntent";
import type { SharedState } from "@/types";

import { useAdminResource } from "./useAdminResource";
import { AdminPageHeader, AdminStatCard, AdminPanelHeader } from "./components";
import { AdminEmptyText } from "./components/AdminFacts";
import { AdminErrorState } from "./components/AdminStates";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

const shortDay = (day?: string) => {
  if (!day) return "";
  const date = new Date(`${day}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const longDay = (day?: string) => {
  if (!day) return "";
  const date = new Date(`${day}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return day;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

// Keep axis ticks short enough to sit beside a narrow plot.
const compactPeso = (value: number) => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `₱${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `₱${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return `₱${value.toLocaleString(undefined, {
    maximumFractionDigits: value < 10 ? 1 : 0,
  })}`;
};

// Round the top of the GMV scale so bars never touch the edge.
const niceCeil = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(
    (candidate) => normalized <= candidate,
  );
  return Math.round((step ?? 10) * magnitude);
};

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
    accent: "#07684B",
    strip: "#75EEA3",
  },
  indigo: {
    background: "linear-gradient(135deg, #EEF0FB 0%, #E4E6F8 55%, #D8DBF4 100%)",
    accent: "#2E3192",
    strip: "#8C90F2",
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
  payment_submitted: { label: "Awaiting review", tone: "#2E3192" },
  insufficient_payment: { label: "Insufficient payment", tone: "#B42318" },
  payment_confirmed: { label: "Payment confirmed", tone: "#0B7A59" },
  preparing: { label: "Preparing", tone: "#0E7490" },
  completed: { label: "Completed", tone: "#15803D" },
  cancelled: { label: "Cancelled", tone: "#98A2B3" },
  expired: { label: "Expired", tone: "#98A2B3" },
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

  const updated = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const pipeline = data?.pipeline ?? [];
  const chart = data?.chart ?? [];

  return (
    <div className="p-6 admin-page">
      <AdminPageHeader
        title="Dashboard"
        subtitle="What needs attention across KARGO right now."
        actions={
          <>
            <span style={{ fontSize: 12, color: "#9aa3bd" }}>Updated {updated}</span>
            <button
              type="button"
              onClick={refresh}
              style={{
                minHeight: 36,
                padding: "0 14px",
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                background: "#fff",
                color: INDIGO,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </>
        }
      />

      {loading && (
        <div className="admin-stats">
          {Array.from({ length: 5 }).map((_, i) => (
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
          <div className="admin-stats">
            <AdminStatCard
              icon={CircleDollarSign}
              label="GMV (30d)"
              value={peso(data.gmv30)}
              sub="Approved payment proofs"
              {...STAT_STYLES.green}
              onClick={() => goto({ tab: "Transactions", subtab: "Payments" })}
            />
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

          {/* Needs attention + performance trend */}
          <div className="admin-grid admin-grid--wide">
            <NeedsAttention data={data} goto={goto} />
            <PerformanceChart
              series={chart}
              onViewOrders={() => goto({ tab: "Transactions", subtab: "Orders" })}
            />
          </div>

          {/* Order pipeline + recent activity + top sellers */}
          <div className="admin-grid">
            <PipelineChart
              rows={pipeline}
              onViewOrders={() => goto({ tab: "Transactions", subtab: "Orders" })}
            />

            <Card>
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

            <Card>
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
  info: { bg: "#EEF0FB", fg: "#2E3192" },
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
                <ChevronRight size={16} color="#C7CDDB" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function PerformanceChart({
  series,
  onViewOrders,
}: {
  series: { day: string; gmv: number; orders?: number }[];
  onViewOrders: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);

  const totalGmv = series.reduce((sum, d) => sum + d.gmv, 0);
  // Older deployed functions return only `gmv`. Show "—" instead of a false 0.
  const hasOrderData = series.some((d) => typeof d.orders === "number");
  const totalOrders = hasOrderData ? series.reduce((sum, d) => sum + (d.orders ?? 0), 0) : null;
  const avgOrder = totalOrders != null && totalOrders > 0 ? totalGmv / totalOrders : null;

  const peakIndex = series.reduce((best, d, i) => (d.gmv > (series[best]?.gmv ?? 0) ? i : best), 0);
  const requestedIndex = hovered ?? focused;
  const selectedIndex =
    requestedIndex != null && series[requestedIndex] ? requestedIndex : peakIndex;
  const isManual = requestedIndex != null && series[requestedIndex] != null;
  const selected = series[selectedIndex];

  const peakGmv = series.length > 0 ? Math.max(...series.map((d) => d.gmv)) : 0;
  const maxGmv = niceCeil(peakGmv);
  const maxOrders = Math.max(1, ...series.map((d) => d.orders ?? 0));
  const nonZeroDays = series.filter((d) => d.gmv > 0).length;
  const hasActivity = totalGmv > 0 || (totalOrders ?? 0) > 0;

  const chartColumns = {
    gridTemplateColumns: `repeat(${Math.max(series.length, 1)}, minmax(0, 1fr))`,
  };

  const tickStep = Math.max(1, Math.ceil(series.length / 7));
  const tickIndices = new Set<number>();
  for (let i = series.length - 1; i >= 0; i -= tickStep) tickIndices.add(i);
  tickIndices.add(0);
  if (series.length > 7) tickIndices.delete(1);
  if (selectedIndex >= 0 && series[selectedIndex] && !tickIndices.has(selectedIndex)) {
    tickIndices.delete(selectedIndex - 1);
    tickIndices.delete(selectedIndex + 1);
    tickIndices.add(selectedIndex);
  }
  const firstTick = tickIndices.size > 0 ? Math.min(...Array.from(tickIndices)) : 0;

  return (
    <Card className="admin-chart-card">
      <div className="admin-chart-head">
        <div>
          <h2 className="admin-chart-title">Performance · last 14 days</h2>
          <p className="admin-chart-sub">
            {hasOrderData
              ? "GMV and confirmed orders by day. Both count when payment is confirmed."
              : "GMV by day. Payments count when confirmed."}
          </p>
        </div>
        <button type="button" className="admin-chart-link" onClick={onViewOrders}>
          View orders <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </div>

      <div className="admin-chart-summary">
        <div>
          <span>14-day GMV</span>
          <strong>{peso(totalGmv)}</strong>
        </div>
        <div>
          <span>Confirmed orders</span>
          <strong>{totalOrders == null ? "—" : totalOrders.toLocaleString()}</strong>
        </div>
        <div>
          <span>Avg order value</span>
          <strong>{avgOrder == null ? "—" : peso(avgOrder)}</strong>
        </div>
      </div>

      {!hasActivity ? (
        <div className="admin-chart-empty">
          <span className="admin-chart-empty__icon" aria-hidden="true">
            <CircleDollarSign size={18} />
          </span>
          <div>
            <strong>No confirmed GMV in the last 14 days</strong>
            <p>GMV appears when a seller confirms a payment.</p>
          </div>
        </div>
      ) : selected ? (
        <div className="admin-chart-shell">
          <div className="admin-chart-readout">
            <span className="admin-chart-readout__label">
              {isManual ? "Selected day" : "Peak day"}
            </span>
            <strong className="admin-chart-readout__date">{longDay(selected.day)}</strong>
            <span className="admin-chart-readout__sep" aria-hidden="true">
              ·
            </span>
            <strong>{peso(selected.gmv)}</strong>
            <span>GMV</span>
            {hasOrderData ? (
              <>
                <span className="admin-chart-readout__sep" aria-hidden="true">
                  ·
                </span>
                <strong>{(selected.orders ?? 0).toLocaleString()}</strong>
                <span>{(selected.orders ?? 0) === 1 ? "order" : "orders"}</span>
              </>
            ) : (
              <span className="admin-chart-readout__muted">Order count unavailable</span>
            )}
            <span className="admin-chart-readout__hint" aria-hidden="true">
              Hover or focus a day
            </span>
          </div>

          <div className="admin-chart-rows">
            <div className="admin-chart-row">
              <div className="admin-chart-row__head">
                <span className="admin-chart-row__name">GMV</span>
                <span className="admin-chart-row__meta">Peak {peso(peakGmv)}</span>
              </div>
              <div className="admin-chart-row__body">
                <div className="admin-chart-yaxis" aria-hidden="true">
                  <span style={{ bottom: "100%" }}>{compactPeso(maxGmv)}</span>
                  <span style={{ bottom: "50%" }}>{compactPeso(maxGmv / 2)}</span>
                  <span style={{ bottom: "0%" }}>₱0</span>
                </div>
                <div className="admin-chart-plot" style={chartColumns}>
                  <span
                    className="admin-chart-gridline"
                    style={{ bottom: "50%" }}
                    aria-hidden="true"
                  />
                  <span
                    className="admin-chart-gridline"
                    style={{ bottom: "100%" }}
                    aria-hidden="true"
                  />
                  {series.map((d, i) => {
                    const isActive = i === selectedIndex;
                    const height = maxGmv > 0 ? (d.gmv / maxGmv) * 100 : 0;
                    const orders = d.orders ?? 0;
                    return (
                      <button
                        key={d.day}
                        type="button"
                        className={`admin-chart-col${isActive ? " is-active" : ""}`}
                        aria-label={`${longDay(d.day)}: ${peso(d.gmv)} GMV${
                          hasOrderData
                            ? `, ${orders} ${orders === 1 ? "order" : "orders"}`
                            : ", order count unavailable"
                        }`}
                        onClick={() => setFocused(i)}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setFocused(i)}
                        onBlur={() => setFocused(null)}
                      >
                        {d.gmv > 0 ? (
                          <span
                            className="admin-chart-bar"
                            style={{ height: `${height}%`, background: INDIGO }}
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {hasOrderData ? (
              <div className="admin-chart-row admin-chart-row--orders">
                <div className="admin-chart-row__head">
                  <span className="admin-chart-row__name">Orders</span>
                </div>
                <div className="admin-chart-row__body">
                  <div className="admin-chart-yaxis" aria-hidden="true">
                    <span style={{ bottom: "100%" }}>{maxOrders}</span>
                    <span style={{ bottom: "0%" }}>0</span>
                  </div>
                  <div className="admin-chart-plot admin-chart-plot--orders" style={chartColumns}>
                    {series.map((d, i) => {
                      const isActive = i === selectedIndex;
                      const orders = d.orders ?? 0;
                      const height = maxOrders > 0 ? (orders / maxOrders) * 100 : 0;
                      return (
                        <span
                          key={d.day}
                          className={`admin-chart-col${isActive ? " is-active" : ""}`}
                          aria-hidden="true"
                        >
                          {orders > 0 ? (
                            <span
                              className="admin-chart-bar admin-chart-bar--orders"
                              style={{ height: `${height}%` }}
                            />
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="admin-chart-xaxis" style={chartColumns} aria-hidden="true">
            {series.map((d, i) => {
              const isActive = i === selectedIndex;
              const isEnd = i === 0 || i === series.length - 1 || i === firstTick;
              return (
                <span
                  key={d.day}
                  className={[isActive ? "is-active" : "", isEnd ? "is-end" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {tickIndices.has(i) ? shortDay(d.day) : ""}
                </span>
              );
            })}
          </div>

          {nonZeroDays === 1 ? (
            <p className="admin-chart-note">
              Only one day has confirmed payments in this period, so the chart shows a single bar.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Accessible data-table alternative. */}
      <table className="sr-only">
        <caption>Confirmed GMV and orders by day, last 14 days</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>GMV</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{peso(d.gmv)}</td>
              <td>{d.orders == null ? "—" : d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <Card>
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
        <p style={{ color: "#748391", fontSize: 13 }}>No orders in the last 30 days.</p>
      ) : (
        <ul className="admin-pipeline">
          {visible.map((row) => {
            const meta = PIPELINE_META[row.status] ?? {
              label: row.status.replace(/_/g, " "),
              tone: "#98A2B3",
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
