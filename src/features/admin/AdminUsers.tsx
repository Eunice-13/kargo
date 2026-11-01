import { useEffect, useMemo, useState } from "react";

import { Card, CardSkeleton, Avatar, PrimaryBtn } from "@/components/shared";
import { INDIGO } from "@/constants/theme";
import { USER_ROLE_FILTERS, USER_STATUS_FILTERS } from "@/constants/admin";
import { adminApi } from "@/services";
import { consumeAdminIntent } from "@/state/navIntent";
import type { AdminUserFilters, AdminUserRow } from "./adminTypes";

import { useAdminResource } from "./useAdminResource";
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminSelect,
  AdminBadge,
  AdminEmptyState,
} from "./components";
import { AdminErrorState } from "./components/AdminStates";
import AdminUserDetailModal from "./components/AdminUserDetailModal";

const PAGE = 25;
const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AdminUserFilters["role"]>("all");
  const [status, setStatus] = useState<AdminUserFilters["status"]>("all");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Honor a deep-link intent from the Dashboard (e.g. filter=seller, Suspended,
  // or a specific seller to open from the Top sellers card).
  useEffect(() => {
    const intent = consumeAdminIntent();
    if (intent.tab !== "Users") return;
    if (intent.filter === "seller") setRole("seller");
    if (intent.subtab === "Suspended") setStatus("suspended");
    if (intent.targetId) setSelected(intent.targetId);
  }, []);

  const filters: AdminUserFilters = useMemo(
    () => ({ search: search.trim() || undefined, role, status }),
    [search, role, status],
  );

  // Reset pagination whenever filters change.
  useEffect(() => {
    setOffset(0);
    setRows([]);
  }, [search, role, status]);

  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.listUsers(filters, PAGE, offset),
    [filters.search, filters.role, filters.status, offset],
  );

  // Append pages; replace on first page.
  useEffect(() => {
    if (!data) return;
    setRows((prev) => (offset === 0 ? data.rows : [...prev, ...data.rows]));
  }, [data, offset]);

  const total = data?.total ?? 0;
  const hasMore = rows.length < total;

  const roleOf = (u: AdminUserRow) => (u.isAdmin ? "admin" : u.canSell ? "seller" : "buyer");
  const roleLabel = (u: AdminUserRow) => (u.isAdmin ? "Admin" : u.canSell ? "Seller" : "Buyer");

  return (
    <div className="p-6 admin-page">
      <AdminPageHeader
        title="Users"
        subtitle="Find any account, verify sellers, and control access."
      />

      <AdminFilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name, email, shop, or user ID"
      >
        <AdminSelect
          value={role ?? "all"}
          onChange={(v) => setRole(v as AdminUserFilters["role"])}
          ariaLabel="Filter by type"
        >
          {USER_ROLE_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect
          value={status ?? "all"}
          onChange={(v) => setStatus(v as AdminUserFilters["status"])}
          ariaLabel="Filter by status"
        >
          {USER_STATUS_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </AdminSelect>
      </AdminFilterBar>

      {loading && offset === 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <AdminErrorState message={error} onRetry={refresh} accessDenied={accessDenied} />
      )}

      {!error && !loading && rows.length === 0 && (
        <AdminEmptyState
          title="No accounts found"
          message="Try a different search or clear the filters."
        />
      )}

      {!error && rows.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="admin-users-cards">
            {rows.map((u) => {
              const open = expanded === u.id;
              return (
                <article key={u.id} className={`admin-ucard${open ? " is-open" : ""}`}>
                  <div className="admin-ucard__top">
                    <Avatar name={u.name} size={40} />
                    <div className="admin-ucard__who">
                      <div className="admin-ucard__name">{u.name || "—"}</div>
                      <div className="admin-ucard__email">{u.email ?? u.id}</div>
                    </div>
                    <button
                      type="button"
                      className="admin-ucard__toggle"
                      aria-expanded={open}
                      aria-label={open ? `Collapse ${u.name}` : `Expand ${u.name}`}
                      onClick={() => setExpanded(open ? null : u.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <path
                          d={open ? "M3 10l5-5 5 5" : "M3 6l5 5 5-5"}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="admin-ucard__meta">
                    <div className="admin-ucard__badges">
                      <AdminBadge tone={roleOf(u)} label={roleLabel(u)} />
                      <AdminBadge
                        tone={u.accountStatus}
                        label={u.accountStatus === "active" ? "Active" : "Suspended"}
                      />
                    </div>
                    {!open && (
                      <div className="admin-ucard__gmv">
                        <strong>{u.gmv30 > 0 ? peso(u.gmv30) : "—"}</strong>
                        <span>{u.gmvRole === "seller" ? "GMV · 30d" : "Spend · 30d"}</span>
                      </div>
                    )}
                  </div>

                  {open && (
                    <div className="admin-ucard__body">
                      <div className="admin-ucard__shopline">
                        {u.canSell && (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M4 9l1.5-5h13L20 9M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <strong>{u.shopName ?? "—"}</strong>
                          </>
                        )}
                        <span>{u.canSell ? "· PH" : "PH"}</span>
                      </div>
                      <div className="admin-ucard__stats">
                        <div className="admin-ucard__stat">
                          <strong>{u.orders}</strong>
                          <span>Orders</span>
                        </div>
                        <div className="admin-ucard__stat">
                          <strong>{u.gmv30 > 0 ? peso(u.gmv30) : "—"}</strong>
                          <span>Spend / GMV · 30d</span>
                        </div>
                      </div>
                      <dl className="admin-ucard__facts">
                        <div>
                          <dt>Last sign-in</dt>
                          <dd className="is-muted">{fmtDate(u.lastSignInAt ?? u.createdAt)}</dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        className="admin-ucard__details"
                        onClick={() => setSelected(u.id)}
                      >
                        View details ›
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <div className="admin-users-table-wrap" style={{ overflowX: "auto" }}>
            <table
              className="admin-users-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#6892D5" }}>
                  {[
                    "Account",
                    "Type",
                    "Shop name",
                    "Status",
                    "Last sign-in",
                    "Orders",
                    "Spend / GMV 30d",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelected(u.id)}
                    tabIndex={0}
                    style={{ borderTop: "1px solid #F3F4F6", cursor: "pointer" }}
                    className="admin-users-row admin-clickable-row"
                  >
                    <td data-label="Account" style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <Avatar name={u.name} size={30} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--kargo-ink)" }}>
                            {u.name || "—"}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--kargo-muted)",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {u.email ?? u.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Type" style={{ padding: "10px 14px" }}>
                      <AdminBadge tone={roleOf(u)} label={roleLabel(u)} />
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        color: u.shopName ? "var(--kargo-ink)" : "var(--kargo-muted)",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.canSell ? (u.shopName ?? "—") : "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <AdminBadge
                        tone={u.accountStatus}
                        label={u.accountStatus === "active" ? "Active" : "Suspended"}
                      />
                    </td>
                    <td
                      data-label="Last sign-in"
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--kargo-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDate(u.createdAt)}
                    </td>
                    <td
                      data-label="Orders"
                      style={{ padding: "10px 14px", fontSize: 13, color: "#374151" }}
                    >
                      {u.orders}
                    </td>
                    <td
                      data-label="Spend / GMV 30d"
                      style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--kargo-ink)",
                      }}
                    >
                      {u.gmv30 > 0 ? peso(u.gmv30) : "—"}
                    </td>
                    <td
                      className="admin-card-detail-cell"
                      data-label=""
                      style={{ padding: "10px 14px", color: "var(--kargo-muted)" }}
                    >
                      ›
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button
              className="admin-load-more"
              type="button"
              onClick={() => setOffset(rows.length)}
              disabled={loading}
              style={{
                display: "block",
                width: "100%",
                padding: "12px",
                border: "none",
                borderTop: "1px solid var(--kargo-line)",
                background: "#fff",
                color: INDIGO,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {loading ? "Loading…" : `Load more (${rows.length} of ${total})`}
            </button>
          )}
        </Card>
      )}

      {selected && (
        <AdminUserDetailModal
          userId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setOffset(0);
            setRows([]);
            refresh();
          }}
        />
      )}
    </div>
  );
}
