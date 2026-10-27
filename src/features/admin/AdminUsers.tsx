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

  // Honor a deep-link intent from the Dashboard (e.g. filter=seller, Suspended).
  useEffect(() => {
    const intent = consumeAdminIntent();
    if (intent.tab !== "Users") return;
    if (intent.filter === "seller") setRole("seller");
    if (intent.subtab === "Suspended") setStatus("suspended");
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
          <div style={{ overflowX: "auto" }}>
            <table
              className="admin-users-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#6892D5" }}>
                  {[
                    "Account",
                    "Type",
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
                    style={{ borderTop: "1px solid #F3F4F6", cursor: "pointer" }}
                    className="admin-users-row"
                  >
                    <td style={{ padding: "10px 14px" }}>
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
                    <td style={{ padding: "10px 14px" }}>
                      <AdminBadge tone={roleOf(u)} label={roleLabel(u)} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <AdminBadge
                        tone={u.accountStatus}
                        label={u.accountStatus === "active" ? "Active" : "Suspended"}
                      />
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--kargo-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDate(u.createdAt)}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151" }}>
                      {u.orders}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--kargo-ink)",
                      }}
                    >
                      {u.gmv30 > 0 ? peso(u.gmv30) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--kargo-muted)" }}>›</td>
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
