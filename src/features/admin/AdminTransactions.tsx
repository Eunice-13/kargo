import { useEffect, useMemo, useState } from "react";

import { Card, CardSkeleton, PrimaryBtn } from "@/components/shared";
import { INDIGO } from "@/constants/theme";
import { adminApi } from "@/services";
import { consumeAdminIntent } from "@/state/navIntent";
import type { AdminCombinedPaymentRow, AdminOrderRow, AdminPaymentRow } from "./adminTypes";

import { useAdminResource } from "./useAdminResource";
import { toneForStatus } from "@/constants/admin";
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminSelect,
  AdminBadge,
  AdminEmptyState,
  AdminSectionTabs,
} from "./components";
import { AdminErrorState } from "./components/AdminStates";
import AdminOrderDetailModal from "./components/AdminOrderDetailModal";
import AdminPaymentDetailModal from "./components/AdminPaymentDetailModal";

type Section = "Orders" | "Payments" | "Combined";
const PAGE = 25;
const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Client-side CSV from already-loaded rows. Excludes sensitive fields.
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTransactions() {
  const [section, setSection] = useState<Section>("Orders");

  useEffect(() => {
    const intent = consumeAdminIntent();
    if (intent.tab === "Transactions" && intent.subtab) {
      if (intent.subtab === "Payments") setSection("Payments");
      else if (intent.subtab === "Combined payments") setSection("Combined");
      else setSection("Orders");
    }
  }, []);

  return (
    <div className="p-6 admin-page">
      <AdminPageHeader
        title="Transactions"
        subtitle="Audit money and order state; help when a seller cannot act."
      />
      <AdminSectionTabs<Section>
        tabs={[
          { value: "Orders", label: "Orders" },
          { value: "Payments", label: "Payments" },
          { value: "Combined", label: "Combined payments" },
        ]}
        active={section}
        onChange={setSection}
      />
      {section === "Orders" && <OrdersSection />}
      {section === "Payments" && <PaymentsSection />}
      {section === "Combined" && <CombinedSection />}
    </div>
  );
}

const DATE_FILTERS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "0", label: "All time" },
];

function LoadMore({
  rows,
  total,
  loading,
  onClick,
}: {
  rows: number;
  total: number;
  loading: boolean;
  onClick: () => void;
}) {
  if (rows >= total) return null;
  return (
    <button
      className="admin-load-more"
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: "block",
        width: "100%",
        padding: 12,
        border: "none",
        borderTop: "1px solid var(--kargo-line)",
        background: "#fff",
        color: INDIGO,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {loading ? "Loading…" : `Load more (${rows} of ${total})`}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
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
      {children}
    </th>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <PrimaryBtn className="admin-action-primary" size="sm" onClick={onClick}>
      Export CSV
    </PrimaryBtn>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function OrdersSection() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [days, setDays] = useState("30");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ search: search.trim() || undefined, status, days: Number(days) }),
    [search, status, days],
  );
  useEffect(() => {
    setOffset(0);
    setRows([]);
  }, [search, status, days]);

  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.listOrders(filters, PAGE, offset),
    [filters.search, filters.status, filters.days, offset],
  );
  useEffect(() => {
    if (data) setRows((prev) => (offset === 0 ? data.rows : [...prev, ...data.rows]));
  }, [data, offset]);

  const total = data?.total ?? 0;
  const exportCsv = () =>
    downloadCsv(
      `kargo-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Order #", "Product", "Buyer", "Seller", "Amount", "Status", "Created"],
      rows.map((o) => [
        o.orderNumber,
        o.product,
        o.buyer,
        o.seller,
        o.amount,
        o.status,
        o.createdAt,
      ]),
    );

  return (
    <>
      <AdminFilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search order #, product, buyer, seller"
      >
        <AdminSelect value={status} onChange={setStatus} ariaLabel="Filter orders by status">
          <option value="all">All statuses</option>
          <option value="payment_pending">Payment pending</option>
          <option value="payment_submitted">Payment submitted</option>
          <option value="payment_confirmed">Payment confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </AdminSelect>
        <AdminSelect value={days} onChange={setDays} ariaLabel="Filter orders by date">
          {DATE_FILTERS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </AdminSelect>
        {rows.length > 0 && <ExportButton onClick={exportCsv} />}
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
        <AdminEmptyState title="No orders found" message="Try a different search or date range." />
      )}
      {!error && rows.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
            <table
              className="admin-orders-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#6892D5" }}>
                  <Th>Order #</Th>
                  <Th>Product</Th>
                  <Th>Buyer</Th>
                  <Th>Seller</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o.id)}
                    style={{ borderTop: "1px solid #F3F4F6", cursor: "pointer" }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--kargo-ink)",
                      }}
                    >
                      {o.orderNumber}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#374151" }}>
                      {o.product}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {o.buyer}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {o.seller}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--kargo-ink)",
                      }}
                    >
                      {peso(o.amount)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <AdminBadge
                        tone={toneForStatus(o.status)}
                        label={o.status.replace(/_/g, " ")}
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
                      {fmtDate(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            rows={rows.length}
            total={total}
            loading={loading}
            onClick={() => setOffset(rows.length)}
          />
        </Card>
      )}

      {selected && (
        <AdminOrderDetailModal
          orderId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setOffset(0);
            setRows([]);
            refresh();
          }}
        />
      )}
    </>
  );
}

// ─── Payments ──────────────────────────────────────────────────────────────

function PaymentsSection() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [days, setDays] = useState("30");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ search: search.trim() || undefined, status, days: Number(days) }),
    [search, status, days],
  );
  useEffect(() => {
    setOffset(0);
    setRows([]);
  }, [search, status, days]);

  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.listPayments(filters, PAGE, offset),
    [filters.search, filters.status, filters.days, offset],
  );
  useEffect(() => {
    if (data) setRows((prev) => (offset === 0 ? data.rows : [...prev, ...data.rows]));
  }, [data, offset]);

  const total = data?.total ?? 0;
  const over24 = (p: AdminPaymentRow) =>
    p.status === "pending_review" && Date.now() - new Date(p.submittedAt).getTime() > 86_400_000;

  const exportCsv = () =>
    downloadCsv(
      `kargo-payments-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Order #", "Buyer", "Seller", "Method", "Amount", "Reference", "Status", "Submitted"],
      rows.map((p) => [
        p.orderNumber,
        p.buyer,
        p.seller,
        p.method,
        p.amount,
        p.referenceNumber ?? "",
        p.status,
        p.submittedAt,
      ]),
    );

  return (
    <>
      <AdminFilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search order #, reference, buyer, seller"
      >
        <AdminSelect value={status} onChange={setStatus} ariaLabel="Filter payments by status">
          <option value="all">All statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </AdminSelect>
        <AdminSelect value={days} onChange={setDays} ariaLabel="Filter payments by date">
          {DATE_FILTERS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </AdminSelect>
        {rows.length > 0 && <ExportButton onClick={exportCsv} />}
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
          title="No payments found"
          message="Try a different search or date range."
        />
      )}
      {!error && rows.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
            <table
              className="admin-payments-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#6892D5" }}>
                  <Th>Order #</Th>
                  <Th>Buyer</Th>
                  <Th>Seller</Th>
                  <Th>Method</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Submitted</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    style={{ borderTop: "1px solid #F3F4F6", cursor: "pointer" }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--kargo-ink)",
                      }}
                    >
                      {p.orderNumber}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {p.buyer}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {p.seller}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#374151" }}>
                      {p.method}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--kargo-ink)",
                      }}
                    >
                      {peso(p.amount)}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <AdminBadge
                        tone={toneForStatus(p.status)}
                        label={p.status.replace(/_/g, " ")}
                      />
                      {over24(p) && <AdminBadge tone="warn" label="24h+" />}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--kargo-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDate(p.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            rows={rows.length}
            total={total}
            loading={loading}
            onClick={() => setOffset(rows.length)}
          />
        </Card>
      )}

      {selected && (
        <AdminPaymentDetailModal
          paymentId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setOffset(0);
            setRows([]);
            refresh();
          }}
        />
      )}
    </>
  );
}

// ─── Combined payments (read-only) ───────────────────────────────────────────

function CombinedSection() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AdminCombinedPaymentRow[]>([]);

  const filters = useMemo(() => ({ search: search.trim() || undefined }), [search]);
  useEffect(() => {
    setOffset(0);
    setRows([]);
  }, [search]);

  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.listCombinedPayments(filters, PAGE, offset),
    [filters.search, offset],
  );
  useEffect(() => {
    if (data) setRows((prev) => (offset === 0 ? data.rows : [...prev, ...data.rows]));
  }, [data, offset]);

  if (!loading && data && !data.available) {
    return (
      <AdminEmptyState
        title="Combined payments unavailable"
        message="Combined delivery is not enabled in this environment."
      />
    );
  }

  const total = data?.total ?? 0;

  return (
    <>
      <AdminFilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search buyer, seller, or group ID"
      />

      {loading && offset === 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}
      {!loading && error && (
        <AdminErrorState message={error} onRetry={refresh} accessDenied={accessDenied} />
      )}
      {!error && !loading && rows.length === 0 && (
        <AdminEmptyState title="No combined payments" message="Nothing matches your search." />
      )}
      {!error && rows.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
            <table
              className="admin-combined-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#6892D5" }}>
                  <Th>Group</Th>
                  <Th>Buyer</Th>
                  <Th>Seller</Th>
                  <Th>Members</Th>
                  <Th>Shipping fee</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 11,
                        color: "var(--kargo-muted)",
                        fontFamily: "monospace",
                      }}
                    >
                      {c.id.slice(0, 8)}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {c.buyer}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {c.seller}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151" }}>
                      {c.memberCount}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--kargo-ink)" }}>
                      {c.shippingFee != null ? peso(c.shippingFee) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <AdminBadge
                        tone={toneForStatus(c.status)}
                        label={c.status.replace(/_/g, " ")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            rows={rows.length}
            total={total}
            loading={loading}
            onClick={() => setOffset(rows.length)}
          />
        </Card>
      )}
    </>
  );
}
