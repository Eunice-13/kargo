import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Modal, Avatar, CardSkeleton } from "@/components/shared";
import { adminApi } from "@/services";
import { ADMIN_ACTION_LABELS, toneForStatus } from "@/constants/admin";

import { useAdminResource } from "../useAdminResource";
import AdminBadge from "./AdminBadge";
import AdminActionButton from "./AdminActionButton";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminEmptyText, AdminModalSection } from "./AdminFacts";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const shortId = (id: string) => (id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);

type PendingAction =
  | { kind: "suspend" }
  | { kind: "restore" }
  | { kind: "grant" }
  | { kind: "revoke" }
  | null;

export default function AdminUserDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, refresh } = useAdminResource(
    () => adminApi.getUser(userId),
    [userId],
  );
  const [pending, setPending] = useState<PendingAction>(null);
  const [copied, setCopied] = useState(false);

  const roleTone = data?.isAdmin ? "admin" : data?.canSell ? "seller" : "buyer";
  const roleLabel = data?.isAdmin ? "Admin" : data?.canSell ? "Seller" : "Buyer";
  return (
    <>
      <Modal
        title="Account details"
        variant="detail"
        width={720}
        className="admin-modal admin-record-modal"
        overlayClassName="admin-modal-overlay admin-record-modal-overlay"
        onClose={onClose}
        footer={
          !loading && data && !data.isAdmin ? (
            <div className="admin-modal-footer">
              {data.accountStatus === "active" ? (
                <AdminActionButton
                  action="suspend"
                  size="sm"
                  onClick={() => setPending({ kind: "suspend" })}
                >
                  Suspend
                </AdminActionButton>
              ) : (
                <AdminActionButton
                  action="restoreAccount"
                  size="sm"
                  onClick={() => setPending({ kind: "restore" })}
                >
                  Restore account
                </AdminActionButton>
              )}
              {data.canSell ? (
                <AdminActionButton
                  action="revokeSeller"
                  size="sm"
                  onClick={() => setPending({ kind: "revoke" })}
                >
                  Revoke seller access
                </AdminActionButton>
              ) : (
                <AdminActionButton
                  action="grantSeller"
                  size="sm"
                  onClick={() => setPending({ kind: "grant" })}
                >
                  Grant seller access
                </AdminActionButton>
              )}
            </div>
          ) : undefined
        }
      >
        {loading && (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}
        {!loading && error && (
          <p role="alert" className="admin-form-error">
            {error}
          </p>
        )}
        {!loading && data && (
          <div className="space-y-5">
            <div className="admin-detail-hero">
              <Avatar name={data.name} size={52} imageUrl={undefined} />
              <div className="admin-detail-hero__identity">
                <h2>{data.name}</h2>
                <p>{data.email}</p>
                <div className="admin-detail-hero__badges">
                  <AdminBadge tone={roleTone} label={roleLabel} />
                  <AdminBadge
                    tone={data.accountStatus}
                    label={data.accountStatus === "active" ? "Active" : "Suspended"}
                  />
                </div>
              </div>
            </div>

            {data.accountStatus === "suspended" && data.accountStatusReason && (
              <div className="admin-callout admin-callout--danger">
                <p>
                  <strong>Suspended.</strong> {data.accountStatusReason}
                </p>
              </div>
            )}

            <div className="admin-user-stats">
              <div>
                <strong>{data.canSell ? data.sellerOrders : data.buyerOrders}</strong>
                <span>Orders · all-time</span>
              </div>
              <div>
                <strong>{peso(data.canSell ? data.sellerGmv30 : data.buyerSpend30)}</strong>
                <span>{data.canSell ? "GMV · 30d" : "Spend · 30d"}</span>
              </div>
              <div>
                <strong>{data.lastSignInAt ? fmtDate(data.lastSignInAt) : "Never"}</strong>
                <span>Last sign-in</span>
              </div>
            </div>

            <dl className="admin-user-rows">
              {data.canSell && (
                <div>
                  <dt>Shop name</dt>
                  <dd>{data.shopName ?? "—"}</dd>
                </div>
              )}
              <div>
                <dt>Joined</dt>
                <dd>{fmtDate(data.createdAt)}</dd>
              </div>
              <div>
                <dt>User ID</dt>
                <dd className="admin-user-rows__id">
                  <span title={data.id}>{shortId(data.id)}</span>
                  <button
                    type="button"
                    aria-label="Copy user ID"
                    onClick={() => {
                      void navigator.clipboard?.writeText(data.id);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Copy size={16} aria-hidden="true" />
                    )}
                  </button>
                </dd>
              </div>
              {data.canSell && (
                <>
                  <div>
                    <dt>Buyers (all-time)</dt>
                    <dd>{data.sellerBuyers}</dd>
                  </div>
                  <div>
                    <dt>Live batches</dt>
                    <dd>{data.liveBatches}</dd>
                  </div>
                  <div>
                    <dt>Buyer spend (30d)</dt>
                    <dd>{peso(data.buyerSpend30)}</dd>
                  </div>
                </>
              )}
            </dl>

            <AdminModalSection title="Recent orders" hint="Latest 5">
              {data.recentOrders.length === 0 ? (
                <AdminEmptyText>No recent orders for this account.</AdminEmptyText>
              ) : (
                <ul className="admin-row-list admin-user-orders">
                  {data.recentOrders.map((o) => (
                    <li key={o.id} className="admin-row-list__item">
                      <strong className="admin-user-orders__num">{o.order_number}</strong>
                      <AdminBadge
                        tone={toneForStatus(o.status)}
                        label={o.status.replace(/_/g, " ")}
                      />
                      <span className="admin-row-list__value">{peso(o.total_amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminModalSection>

            <AdminModalSection title="Moderation history" hint="Newest first">
              {data.moderationHistory.length === 0 ? (
                <AdminEmptyText>No admin actions recorded for this account.</AdminEmptyText>
              ) : (
                <ul className="admin-row-list">
                  {data.moderationHistory.map((h) => (
                    <li key={h.id} className="admin-row-list__item">
                      <span className="admin-row-list__main">
                        <strong>{ADMIN_ACTION_LABELS[h.action] ?? h.action}</strong>
                        {h.reason && <span>{h.reason}</span>}
                      </span>
                      <span className="admin-row-list__meta">{fmtDate(h.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminModalSection>
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
          action={
            pending.kind === "suspend"
              ? "suspend"
              : pending.kind === "restore"
                ? "restoreAccount"
                : pending.kind === "grant"
                  ? "grantSeller"
                  : "revokeSeller"
          }
          // Suspend/revoke are the destructive ones — require typing the name.
          confirmWord={
            pending.kind === "suspend" || pending.kind === "revoke" ? data.name : undefined
          }
          onConfirm={async (reason) => {
            if (pending.kind === "suspend") {
              await adminApi.setAccountStatus(userId, "suspended", reason);
            } else if (pending.kind === "restore") {
              await adminApi.setAccountStatus(userId, "active", reason);
            } else if (pending.kind === "grant") {
              await adminApi.setSellerAccess(userId, true, reason);
            } else {
              await adminApi.setSellerAccess(userId, false, reason);
            }
            setPending(null);
            refresh();
            onChanged();
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
