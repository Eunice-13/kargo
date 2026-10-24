import { useState } from "react"

import { Modal, PrimaryBtn, SecondaryBtn, Avatar, CardSkeleton } from "@/components/shared"
import { adminApi } from "@/services"
import { ADMIN_ACTION_LABELS } from "@/constants/admin"

import { useAdminResource } from "../useAdminResource"
import AdminBadge from "./AdminBadge"
import AdminConfirmModal from "./AdminConfirmModal"

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

type PendingAction =
  | { kind: "suspend" }
  | { kind: "restore" }
  | { kind: "grant" }
  | { kind: "revoke" }
  | null

export default function AdminUserDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string
  onClose: () => void
  onChanged: () => void
}) {
  const { data, loading, error, refresh } = useAdminResource(
    () => adminApi.getUser(userId),
    [userId],
  )
  const [pending, setPending] = useState<PendingAction>(null)

  const roleTone = data?.isAdmin ? "admin" : data?.canSell ? "seller" : "buyer"
  const roleLabel = data?.isAdmin ? "Admin" : data?.canSell ? "Seller" : "Buyer"

  return (
    <>
      <Modal title={data?.name ?? "Account"} variant="detail" width={720} onClose={onClose}>
        {loading && (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}
        {!loading && error && (
          <p role="alert" style={{ color: "#B42318", fontSize: 13 }}>
            {error}
          </p>
        )}
        {!loading && data && (
          <div className="space-y-5">
            {/* Identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={data.name} size={48} imageUrl={undefined} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#171923" }}>{data.name}</div>
                <div style={{ fontSize: 12, color: "#748391" }}>{data.email}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <AdminBadge tone={roleTone} label={roleLabel} />
                <AdminBadge
                  tone={data.accountStatus}
                  label={data.accountStatus === "active" ? "Active" : "Suspended"}
                />
              </div>
            </div>

            {data.accountStatus === "suspended" && data.accountStatusReason && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#FEECEC",
                  color: "#B42318",
                  fontSize: 12.5,
                }}
              >
                Suspended — {data.accountStatusReason}
              </div>
            )}

            {/* Facts grid */}
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              }}
            >
              <Fact label="User ID" value={data.id} mono />
              <Fact label="Joined" value={fmtDate(data.createdAt)} />
              <Fact label="Buyer orders" value={String(data.buyerOrders)} />
              <Fact label="Seller orders" value={String(data.sellerOrders)} />
              <Fact label="Seller GMV (30d)" value={peso(data.sellerGmv30)} />
              <Fact label="Live batches" value={String(data.liveBatches)} />
            </div>

            {/* Recent orders */}
            <Section title="Recent activity">
              {data.recentOrders.length === 0 ? (
                <Muted>No recent orders.</Muted>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {data.recentOrders.map((o) => (
                    <li
                      key={o.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom: "1px solid #F3F4F6",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "#374151" }}>
                        {o.order_number} · {o.status.replace(/_/g, " ")}
                      </span>
                      <strong style={{ color: "#171923" }}>{peso(o.total_amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Moderation history */}
            <Section title="Moderation history">
              {data.moderationHistory.length === 0 ? (
                <Muted>No admin actions recorded for this account.</Muted>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {data.moderationHistory.map((h) => (
                    <li
                      key={h.id}
                      style={{ padding: "6px 0", borderBottom: "1px solid #F3F4F6", fontSize: 12.5 }}
                    >
                      <strong>{ADMIN_ACTION_LABELS[h.action] ?? h.action}</strong>
                      {h.reason ? ` — ${h.reason}` : ""}{" "}
                      <span style={{ color: "#9aa3bd" }}>· {fmtDate(h.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Actions (hidden for admin targets; team is managed in Settings) */}
            {!data.isAdmin && (
              <div
                className="kargo-modal-actions"
                style={{ flexWrap: "wrap", justifyContent: "flex-start" }}
              >
                {data.accountStatus === "active" ? (
                  <DangerBtn onClick={() => setPending({ kind: "suspend" })}>
                    Suspend account
                  </DangerBtn>
                ) : (
                  <PrimaryBtn size="sm" onClick={() => setPending({ kind: "restore" })}>
                    Restore account
                  </PrimaryBtn>
                )}
                {data.canSell ? (
                  <SecondaryBtn size="sm" onClick={() => setPending({ kind: "revoke" })}>
                    Revoke seller access
                  </SecondaryBtn>
                ) : (
                  <SecondaryBtn size="sm" onClick={() => setPending({ kind: "grant" })}>
                    Grant seller access
                  </SecondaryBtn>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {pending && data && (
        <AdminConfirmModal
          title={
            pending.kind === "suspend"
              ? "Suspend account"
              : pending.kind === "restore"
                ? "Restore account"
                : pending.kind === "grant"
                  ? "Grant seller access"
                  : "Revoke seller access"
          }
          consequence={
            pending.kind === "suspend"
              ? "The account will be locked out of KARGO immediately and shown the suspended screen. They keep their data."
              : pending.kind === "restore"
                ? "The account regains access to KARGO."
                : pending.kind === "grant"
                  ? "The account will be able to publish batches and sell. Reflected at their next sign-in."
                  : "The account loses the ability to publish batches and sell. Existing orders are unaffected."
          }
          confirmLabel={
            pending.kind === "suspend"
              ? "Suspend"
              : pending.kind === "restore"
                ? "Restore"
                : pending.kind === "grant"
                  ? "Grant access"
                  : "Revoke access"
          }
          // Suspend/revoke are the destructive ones — require typing the name.
          confirmWord={
            pending.kind === "suspend" || pending.kind === "revoke" ? data.name : undefined
          }
          onConfirm={async (reason) => {
            if (pending.kind === "suspend") {
              await adminApi.setAccountStatus(userId, "suspended", reason)
            } else if (pending.kind === "restore") {
              await adminApi.setAccountStatus(userId, "active", reason)
            } else if (pending.kind === "grant") {
              await adminApi.setSellerAccess(userId, true, reason)
            } else {
              await adminApi.setSellerAccess(userId, false, reason)
            }
            setPending(null)
            refresh()
            onChanged()
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  )
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9aa3bd", letterSpacing: ".05em" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#171923",
          fontWeight: 600,
          overflowWrap: "anywhere",
          fontFamily: mono ? "monospace" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 800, color: "#171923" }}>{title}</h3>
      {children}
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#748391", fontSize: 12.5, margin: 0 }}>{children}</p>
}

function DangerBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: "0 14px",
        borderRadius: 7,
        border: "1px solid #FECACA",
        background: "#FEF2F2",
        color: "#B91C1C",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  )
}
