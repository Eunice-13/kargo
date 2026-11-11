import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Modal, Avatar, CardSkeleton } from "@/components/shared";
import { adminApi } from "@/services";
import { ADMIN_ACTION_LABELS, toneForStatus } from "@/constants/admin";

import { useAdminResource } from "../useAdminResource";
import useIsDesktop from "../useIsDesktop";
import AdminBadge from "./AdminBadge";
import AdminActionButton from "./AdminActionButton";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminEmptyText, AdminModalSection } from "./AdminFacts";
import type { AdminUserDetail } from "../adminTypes";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const shortId = (id: string) => (id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);

function DesktopBody({
  data,
  roleTone,
  roleLabel,
  copied,
  onCopy,
}: {
  data: AdminUserDetail;
  roleTone: string;
  roleLabel: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const seller = data.canSell;
  const stats = seller
    ? [
        { value: String(data.sellerOrders), label: "Orders · all-time" },
        { value: String(data.sellerBuyers), label: "Buyers · all-time" },
        { value: String(data.liveBatches), label: "Live batches" },
      ]
    : [
        { value: String(data.buyerOrders), label: "Orders · all-time" },
        { value: peso(data.buyerSpend30), label: "Spend · 30d" },
      ];
  return (
    <div className="admin-account">
      <aside className="admin-account__side">
        <Avatar name={data.name} size={76} imageUrl={undefined} />
        <h2 className="admin-account__name">{data.name}</h2>
        <p className="admin-account__email">{data.email}</p>
        <div className="admin-account__pills">
          <AdminBadge tone={roleTone} label={roleLabel} />
          <AdminBadge
            tone={data.accountStatus}
            label={data.accountStatus === "active" ? "Active" : "Suspended"}
          />
        </div>
        <dl className="admin-account__facts">
          {seller && (
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
            <dt>Last sign-in</dt>
            <dd>{data.lastSignInAt ? fmtDate(data.lastSignInAt) : "Never"}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd className="admin-account__id">
              <span title={data.id}>{shortId(data.id)}</span>
              <button type="button" aria-label="Copy user ID" onClick={onCopy}>
                {copied ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Copy size={15} aria-hidden="true" />
                )}
              </button>
            </dd>
          </div>
        </dl>
      </aside>

      <div className="admin-account__main">
        {data.accountStatus === "suspended" && data.accountStatusReason && (
          <div className="admin-callout admin-callout--danger">
            <p>
              <strong>Suspended.</strong> {data.accountStatusReason}
            </p>
          </div>
        )}

        <section aria-label={seller ? "As seller" : "As buyer"}>
          <p className="admin-account__eyebrow">{seller ? "As seller" : "As buyer"}</p>
          <div className="admin-account__stats" style={{ ["--stat-cols" as string]: stats.length }}>
            {stats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="admin-account__head">
            <h3>
              Recent orders
              <span> · {seller ? "as buyer or seller" : "as buyer"}</span>
            </h3>
            <p>
              Latest 5
              {seller && (
                <>
                  {" "}
                  · Buyer spend (30d) <strong>{peso(data.buyerSpend30)}</strong>
                </>
              )}
            </p>
          </div>
          {data.recentOrders.length === 0 ? (
            <AdminEmptyText>No recent orders for this account.</AdminEmptyText>
          ) : (
            <ul className="admin-account__orders">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <strong>{o.order_number}</strong>
                  <AdminBadge tone={toneForStatus(o.status)} label={o.status.replace(/_/g, " ")} />
                  <span>{peso(o.total_amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="admin-account__head">
            <h3>Moderation history</h3>
            <p>Newest first</p>
          </div>
          {data.moderationHistory.length === 0 ? (
            <AdminEmptyText>No admin actions recorded for this account.</AdminEmptyText>
          ) : (
            <ol className="admin-account__timeline">
              {data.moderationHistory.map((h) => (
                <li key={h.id}>
                  <div>
                    <strong>{ADMIN_ACTION_LABELS[h.action] ?? h.action}</strong>
                    {h.reason && <span>{h.reason}</span>}
                  </div>
                  <time dateTime={h.created_at}>{fmtDate(h.created_at)}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

type PendingAction = { kind: "suspend" } | { kind: "restore" } | { kind: "revoke" } | null;

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
  const isDesktop = useIsDesktop();
  const copyId = () => {
    if (!data) return;
    void navigator.clipboard?.writeText(data.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const roleTone = data?.isAdmin ? "admin" : data?.canSell ? "seller" : "buyer";
  const roleLabel = data?.isAdmin ? "Admin" : data?.canSell ? "Seller" : "Buyer";
  return (
    <>
      <Modal
        title="Account details"
        showTitleIcon={false}
        variant="detail"
        width={isDesktop ? 980 : 720}
        className="admin-modal admin-record-modal admin-account-modal"
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
              {data.canSell && (
                <AdminActionButton
                  action="revokeSeller"
                  size="sm"
                  onClick={() => setPending({ kind: "revoke" })}
                >
                  Revoke seller access
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
        {!loading && data && isDesktop && (
          <DesktopBody
            data={data}
            roleTone={roleTone}
            roleLabel={roleLabel}
            copied={copied}
            onCopy={copyId}
          />
        )}
        {!loading && data && !isDesktop && (
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

            <div className={`admin-user-stats${data.canSell ? " admin-user-stats--two" : ""}`}>
              <div>
                <strong>{data.canSell ? data.sellerOrders : data.buyerOrders}</strong>
                <span>Orders · all-time</span>
              </div>
              {!data.canSell && (
                <div>
                  <strong>{peso(data.buyerSpend30)}</strong>
                  <span>Spend · 30d</span>
                </div>
              )}
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
                : "Revoke seller access"
          }
          consequence={
            pending.kind === "suspend"
              ? "The account will be locked out of KARGO immediately and shown the suspended screen. They keep their data."
              : pending.kind === "restore"
                ? "The account regains access to KARGO."
                : "The account loses the ability to publish batches and sell. Existing orders are unaffected."
          }
          confirmLabel={
            pending.kind === "suspend"
              ? "Suspend"
              : pending.kind === "restore"
                ? "Restore"
                : "Revoke access"
          }
          action={
            pending.kind === "suspend"
              ? "suspend"
              : pending.kind === "restore"
                ? "restoreAccount"
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
