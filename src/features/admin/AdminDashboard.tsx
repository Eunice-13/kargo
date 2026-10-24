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
} from "lucide-react"

import { Card, CardSkeleton, Avatar } from "@/components/shared"
import { INDIGO } from "@/constants/theme"
import { ADMIN_ACTION_LABELS } from "@/constants/admin"
import { adminApi } from "@/services"
import { requestAdminSection } from "@/state/navIntent"
import type { SharedState } from "@/types"

import { useAdminResource } from "./useAdminResource"
import { AdminPageHeader, AdminStatCard } from "./components"
import { AdminErrorState } from "./components/AdminStates"

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

type QueueItem = {
  key: string
  icon: typeof Package
  title: string
  count: number
  tone: "danger" | "warn" | "info"
  description: string
  go: () => void
}

export default function AdminDashboard({ setTab }: SharedState) {
  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.dashboard(),
    [],
  )

  // Set the deep-link intent, then switch to the target admin tab.
  const goto = (opts: Parameters<typeof requestAdminSection>[0]) => {
    requestAdminSection(opts)
    setTab(opts.tab)
  }

  const updated = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="p-6 mobile-data-page">
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
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
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
          {/* KPI row */}
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              marginBottom: 20,
            }}
          >
            <AdminStatCard
              icon={CircleDollarSign}
              label="GMV (30d)"
              value={peso(data.gmv30)}
              sub="Confirmed & completed"
            />
            <AdminStatCard icon={ReceiptText} label="Orders (30d)" value={String(data.orders30)} />
            <AdminStatCard
              icon={Store}
              label="Active sellers"
              value={String(data.activeSellers)}
              tint="#E6F6EF"
              ink="#0B7A59"
            />
            <AdminStatCard
              icon={BadgeCheck}
              label="Payments to review"
              value={String(data.paymentsPending)}
              tint="#FDF2E3"
              ink="#B4690E"
            />
            <AdminStatCard
              icon={UserX}
              label="Suspended"
              value={String(data.suspended)}
              tint="#FEECEC"
              ink="#B42318"
            />
          </div>

          {/* Needs attention + chart */}
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              marginBottom: 20,
            }}
          >
            <NeedsAttention data={data} goto={goto} />
            <GmvChart series={data.chart} />
          </div>

          {/* Recent activity + top sellers */}
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            }}
          >
            <Card>
              <SectionTitle
                title="Recent admin activity"
                onLink={() => goto({ tab: "Settings", subtab: "Audit log" })}
              />
              {data.recentActivity.length === 0 ? (
                <p style={{ color: "#748391", fontSize: 13 }}>No admin activity yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {data.recentActivity.map((a) => (
                    <li
                      key={a.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom: "1px solid #F3F4F6",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "#374151", minWidth: 0 }}>
                        <strong>{a.actor_name || "Admin"}</strong>{" "}
                        {ADMIN_ACTION_LABELS[a.action] ?? a.action}
                        {a.target_label ? ` · ${a.target_label}` : ""}
                      </span>
                      <span style={{ color: "#9aa3bd", flex: "0 0 auto" }}>
                        {relativeTime(a.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionTitle
                title="Top sellers (30d)"
                onLink={() => goto({ tab: "Users", filter: "seller" })}
              />
              {data.topSellers.length === 0 ? (
                <p style={{ color: "#748391", fontSize: 13 }}>No seller sales in the last 30 days.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {data.topSellers.map((s) => (
                    <li
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 0",
                        borderBottom: "1px solid #F3F4F6",
                      }}
                    >
                      <Avatar name={s.shop} size={28} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>
                        {s.shop}
                      </span>
                      <span style={{ fontSize: 12, color: "#9aa3bd" }}>{s.orders} orders</span>
                      <strong style={{ fontSize: 13, color: "#171923" }}>{peso(s.gmv)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function SectionTitle({ title, onLink }: { title: string; onLink: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "'Josefin Sans',sans-serif",
          fontSize: 14,
          fontWeight: 800,
          color: "#171923",
        }}
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onLink}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          background: "none",
          border: "none",
          color: INDIGO,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        View all <ArrowUpRight size={13} aria-hidden="true" />
      </button>
    </div>
  )
}

function NeedsAttention({
  data,
  goto,
}: {
  data: {
    paymentsPending: number
    stuckOrders: number
    flaggedHidden: number
    suspended: number
  }
  goto: (opts: Parameters<typeof requestAdminSection>[0]) => void
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
  ]

  return (
    <Card>
      <h2
        style={{
          margin: "0 0 10px",
          fontFamily: "'Josefin Sans',sans-serif",
          fontSize: 14,
          fontWeight: 800,
          color: "#171923",
        }}
      >
        Needs attention
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {items.map((item) => {
          const clear = item.count === 0
          const Icon = clear ? Check : item.icon
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={item.go}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  minHeight: 44,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #EEF0F4",
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    flex: "0 0 auto",
                    background: clear ? "#E6F6EF" : "#F7F8FC",
                    color: clear ? "#0B7A59" : INDIGO,
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#171923" }}>
                    {item.title}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "#748391" }}>
                    {clear ? "All clear" : item.description}
                  </span>
                </span>
                <strong
                  style={{
                    fontSize: 15,
                    color: clear ? "#0B7A59" : "#171923",
                    flex: "0 0 auto",
                  }}
                >
                  {clear ? "✓" : item.count}
                </strong>
                <ChevronRight size={16} color="#C7CDDB" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function GmvChart({ series }: { series: { day: string; gmv: number }[] }) {
  const max = Math.max(1, ...series.map((d) => d.gmv))
  const width = 100
  const barGap = 2
  const barWidth = (width - barGap * (series.length - 1)) / Math.max(1, series.length)

  return (
    <Card>
      <h2
        style={{
          margin: "0 0 10px",
          fontFamily: "'Josefin Sans',sans-serif",
          fontSize: 14,
          fontWeight: 800,
          color: "#171923",
        }}
      >
        GMV · last 14 days
      </h2>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 120, display: "block" }}
        role="img"
        aria-label="14-day GMV bar chart"
      >
        {series.map((d, i) => {
          const h = (d.gmv / max) * 38
          const x = i * (barWidth + barGap)
          const isToday = i === series.length - 1
          return (
            <rect
              key={d.day}
              x={x}
              y={40 - h}
              width={barWidth}
              height={Math.max(h, 0.5)}
              rx={0.8}
              fill={INDIGO}
              opacity={isToday ? 1 : 0.35}
            >
              <title>{`${d.day}: ₱${Math.round(d.gmv).toLocaleString()}`}</title>
            </rect>
          )
        })}
      </svg>
      {/* Accessible data table alternative. */}
      <table className="sr-only">
        <caption>GMV by day, last 14 days</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>GMV</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{peso(d.gmv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
