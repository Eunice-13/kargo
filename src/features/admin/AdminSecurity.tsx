import { useEffect, useMemo, useState } from "react";

import { Card, CardSkeleton, Avatar, PrimaryBtn } from "@/components/shared";
import { INDIGO } from "@/constants/theme";
import { ADMIN_ACTION_LABELS } from "@/constants/admin";
import { adminApi } from "@/services";
import { consumeAdminIntent, navIntent, subscribeNavIntent } from "@/state/navIntent";
import type { AdminAuditRow, AdminTeamMember } from "./adminTypes";

import { useAdminResource } from "./useAdminResource";
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminSelect,
  AdminBadge,
  AdminEmptyState,
  AdminSectionTabs,
  AdminConfirmModal,
} from "./components";
import { AdminErrorState } from "./components/AdminStates";
import AdminAddAdminModal from "./components/AdminAddAdminModal";
import AuditDetailModal from "./components/AuditDetailModal";

type Section = "Team" | "Audit log";

export default function AdminSecurity() {
  const [section, setSection] = useState<Section>("Team");

  useEffect(() => {
    const intent = consumeAdminIntent();
    if (intent.tab === "Security" && intent.subtab === "Audit log") setSection("Audit log");
  }, []);

  // A notification can land on Security while this tab is already mounted. Only
  // consume intents addressed to Security so an intent for another admin tab is
  // left for that tab to pick up.
  useEffect(() => {
    const applyIntent = () => {
      if (navIntent.adminTab !== "Security") return;
      const intent = consumeAdminIntent();
      if (intent.subtab === "Audit log") setSection("Audit log");
    };
    return subscribeNavIntent(applyIntent);
  }, []);

  return (
    <div className="p-6 admin-page">
      <AdminPageHeader title="Security" subtitle="Admin team and the immutable audit trail." />
      <AdminSectionTabs<Section>
        tabs={[
          { value: "Team", label: "Team" },
          { value: "Audit log", label: "Audit log" },
        ]}
        active={section}
        onChange={setSection}
      />
      {section === "Team" ? <TeamSection /> : <AuditSection />}
    </div>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function TeamSection() {
  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.listTeam(),
    [],
  );
  const [adding, setAdding] = useState(false);
  const [revoke, setRevoke] = useState<AdminTeamMember | null>(null);

  return (
    <>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--kargo-canvas)",
          color: "var(--kargo-ink-soft)",
          fontSize: 12,
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        Every admin can do everything in this console: verify sellers, moderate batches, cancel
        orders, override payments, and manage the team. There are no read-only admins. Actions are
        recorded in the audit log with your name.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <PrimaryBtn size="sm" onClick={() => setAdding(true)}>
          Add admin
        </PrimaryBtn>
      </div>

      {loading && (
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}
      {!loading && error && (
        <AdminErrorState message={error} onRetry={refresh} accessDenied={accessDenied} />
      )}
      {!loading && data && data.rows.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
            <table
              className="admin-team-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#6892D5" }}>
                  {["Name", "Email", "Granted by", "Granted", ""].map((h) => (
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
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((m) => (
                  <tr key={m.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={m.name} size={28} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--kargo-ink)" }}>
                          {m.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {m.email ?? "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {m.grantedBy ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--kargo-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.acceptedAt === null ? (
                        <AdminBadge tone="warn" label="Invite pending" />
                      ) : (
                        fmtDate(m.grantedAt)
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button
                        className="admin-danger-link"
                        type="button"
                        onClick={() => setRevoke(m)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#B91C1C",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {m.acceptedAt === null ? "Cancel invite" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {adding && <AdminAddAdminModal onClose={() => setAdding(false)} onAdded={refresh} />}
      {revoke && (
        <AdminConfirmModal
          title={revoke.acceptedAt === null ? "Cancel admin invitation" : "Revoke admin access"}
          consequence={
            revoke.acceptedAt === null
              ? "This cancels the invitation before it was accepted. They never gain admin access and can be invited again later."
              : "This removes the account's admin access immediately. You cannot revoke your own access or the last active admin."
          }
          confirmLabel={revoke.acceptedAt === null ? "Cancel invitation" : "Revoke access"}
          confirmWord={revoke.acceptedAt === null ? undefined : revoke.name}
          tone={revoke.acceptedAt === null ? "default" : "danger"}
          onConfirm={async (reason) => {
            await adminApi.revokeAdmin(revoke.id, reason);
            setRevoke(null);
            refresh();
          }}
          onClose={() => setRevoke(null)}
        />
      )}
    </>
  );
}

const PAGE = 25;

function AuditSection() {
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("30");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [selected, setSelected] = useState<AdminAuditRow | null>(null);

  const filters = useMemo(
    () => ({ search: search.trim() || undefined, days: Number(days) }),
    [search, days],
  );
  useEffect(() => {
    setOffset(0);
    setRows([]);
  }, [search, days]);

  const { data, loading, error, accessDenied, refresh } = useAdminResource(
    () => adminApi.listAudit(filters, PAGE, offset),
    [filters.search, filters.days, offset],
  );
  useEffect(() => {
    if (data) setRows((prev) => (offset === 0 ? data.rows : [...prev, ...data.rows]));
  }, [data, offset]);

  const total = data?.total ?? 0;

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      ["When", "Actor", "Action", "Target", "Reason"].map(esc).join(","),
      ...rows.map((r) =>
        [r.createdAt, r.actorName, r.action, r.targetLabel ?? "", r.reason ?? ""]
          .map((v) => esc(String(v)))
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kargo-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AdminFilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search actor, target, or action"
      >
        <AdminSelect value={days} onChange={setDays} ariaLabel="Filter audit by date">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="0">All time</option>
        </AdminSelect>
        {rows.length > 0 && (
          <PrimaryBtn className="admin-action-primary" size="sm" onClick={exportCsv}>
            Export CSV
          </PrimaryBtn>
        )}
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
        <AdminEmptyState title="No audit entries" message="Admin actions will appear here." />
      )}
      {!error && rows.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div style={{ overflowX: "auto" }}>
            <table
              className="admin-audit-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#6892D5" }}>
                  {["When", "Actor", "Action", "Target", "Reason"].map((h) => (
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
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    style={{ borderTop: "1px solid #F3F4F6", cursor: "pointer" }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--kargo-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(a.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {a.actorName}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <AdminBadge tone="info" label={ADMIN_ACTION_LABELS[a.action] ?? a.action} />
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--kargo-muted)" }}>
                      {a.targetLabel ?? a.targetType}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--kargo-muted)",
                        maxWidth: 240,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length < total && (
            <button
              className="admin-load-more"
              type="button"
              onClick={() => setOffset(rows.length)}
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
              {loading ? "Loading…" : `Load more (${rows.length} of ${total})`}
            </button>
          )}
        </Card>
      )}

      {selected && <AuditDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
