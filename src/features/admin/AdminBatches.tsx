import { useEffect, useMemo, useState } from "react";

import { Card, CardSkeleton, Avatar, BatchMedia } from "@/components/shared";
import { INDIGO } from "@/constants/theme";
import { adminApi } from "@/services";
import { consumeAdminIntent } from "@/state/navIntent";
import type { AdminBatchFilters, AdminBatchRow } from "./adminTypes";

import { toneForStatus } from "@/constants/admin";
import { useAdminResource } from "./useAdminResource";
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminSelect,
  AdminBadge,
  AdminEmptyState,
} from "./components";
import { AdminErrorState } from "./components/AdminStates";
import AdminBatchDetailModal from "./components/AdminBatchDetailModal";

const PAGE = 25;
const MOD_TONE: Record<string, string> = { visible: "good", flagged: "warn", hidden: "danger" };

export default function AdminBatches() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [moderation, setModeration] = useState("all");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AdminBatchRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const intent = consumeAdminIntent();
    if (intent.tab === "Batches" && intent.filter === "flagged") setModeration("flagged");
  }, []);

  const filters: AdminBatchFilters = useMemo(
    () => ({ search: search.trim() || undefined, status, moderation }),
    [search, status, moderation],
  );

  useEffect(() => {
    setOffset(0);
    setRows([]);
  }, [search, status, moderation]);

  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.listBatches(filters, PAGE, offset),
    [filters.search, filters.status, filters.moderation, offset],
  );

  useEffect(() => {
    if (!data) return;
    setRows((prev) => (offset === 0 ? data.rows : [...prev, ...data.rows]));
  }, [data, offset]);

  const total = data?.total ?? 0;
  const hasMore = rows.length < total;

  return (
    <div className="p-6 admin-page">
      <AdminPageHeader
        title="Batches"
        subtitle="Moderate supply without editing the seller's business."
      />

      <AdminFilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search title, seller, or batch ID"
      >
        <AdminSelect value={status} onChange={setStatus} ariaLabel="Filter by status">
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="locked">Locked</option>
          <option value="closed">Closed</option>
        </AdminSelect>
        <AdminSelect value={moderation} onChange={setModeration} ariaLabel="Filter by moderation">
          <option value="all">All moderation</option>
          <option value="visible">Visible</option>
          <option value="flagged">Flagged</option>
          <option value="hidden">Hidden</option>
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
          title="No batches found"
          message="Try a different search or clear the filters."
        />
      )}

      {!error && rows.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
            <table
              className="admin-batches-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#6892D5" }}>
                  {["Batch", "Seller", "Category", "Claimed", "Status", "Moderation", ""].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 14px",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelected(b.id)}
                    style={{ borderTop: "1px solid #F3F4F6", cursor: "pointer" }}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <BatchMedia
                          src={b.coverPath ?? undefined}
                          alt=""
                          width={96}
                          height={64}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            objectFit: "cover",
                            flex: "0 0 auto",
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--kargo-ink)" }}>
                          {b.title}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={b.sellerName} size={24} />
                        <span style={{ fontSize: 12, color: "var(--kargo-muted)" }}>
                          {b.sellerName}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {b.category}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151" }}>
                      {b.claimedQty}/{b.totalQty}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <AdminBadge tone={toneForStatus(b.status)} label={b.status} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <AdminBadge tone={MOD_TONE[b.moderationStatus]} label={b.moderationStatus} />
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
        <AdminBatchDetailModal
          batchId={selected}
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
