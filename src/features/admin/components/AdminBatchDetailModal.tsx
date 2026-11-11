import { useState } from "react";
import { CalendarDays, Eye, EyeOff, Flag, Lock } from "lucide-react";

import { Modal, Avatar, CardSkeleton, BatchMedia } from "@/components/shared";
import { toneForStatus } from "@/constants/admin";
import { adminApi } from "@/services";
import type { AdminBatchDetail, BatchModerationAction } from "../adminTypes";

import { useAdminResource } from "../useAdminResource";
import useIsDesktop from "../useIsDesktop";
import AdminBadge from "./AdminBadge";
import AdminActionButton from "./AdminActionButton";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminEmptyText, AdminModalSection } from "./AdminFacts";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

const MOD_TONE: Record<string, string> = {
  visible: "good",
  flagged: "warn",
  hidden: "danger",
};

const MOD_ICON = { visible: Eye, hidden: EyeOff, flagged: Flag } as const;

// Desktop: cover and identity on the left, summary and products on the right.
function DesktopBody({ data }: { data: AdminBatchDetail }) {
  const ModIcon = MOD_ICON[data.moderationStatus] ?? Eye;
  const stats = [
    { value: String(data.orderCount), label: "Orders" },
    { value: String(data.products.length), label: "Products" },
  ];
  return (
    <div className="admin-batch">
      <aside className="admin-batch__side">
        {data.coverPath ? (
          <BatchMedia
            src={data.coverPath}
            alt=""
            width={1200}
            height={1200}
            className="admin-batch__cover"
          />
        ) : (
          <span className="admin-batch__cover admin-bcard__thumb" aria-hidden="true" />
        )}
        <h2 className="admin-batch__title">{data.title}</h2>
        <p className="admin-batch__seller">
          <Avatar name={data.sellerName} size={24} />
          <span>
            {data.sellerName} <em>· {data.category}</em>
          </span>
        </p>
        <div className="admin-batch__pills">
          <AdminBadge tone={toneForStatus(data.status)} label={data.status} />
          <AdminBadge
            tone={MOD_TONE[data.moderationStatus]}
            label={data.moderationStatus}
            icon={<ModIcon size={13} aria-hidden="true" />}
          />
        </div>
        {data.moderationReason && (
          <div className="admin-callout admin-callout--warn admin-batch__reason">
            <p>{data.moderationReason}</p>
          </div>
        )}
        <div className="admin-batch__window">
          <span>
            <CalendarDays size={16} aria-hidden="true" />
            Window
          </span>
          <strong>
            {data.startsOn.slice(0, 10)} → {data.endsOn.slice(0, 10)}
          </strong>
        </div>
      </aside>

      <div className="admin-batch__main">
        <section aria-label="Batch summary">
          <p className="admin-account__eyebrow">Batch summary</p>
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
            <h3>Products</h3>
            <p>
              {data.products.length} item{data.products.length === 1 ? "" : "s"}
            </p>
          </div>
          {data.products.length === 0 ? (
            <AdminEmptyText>No products in this batch.</AdminEmptyText>
          ) : (
            <div className="admin-batch__table" role="table" aria-label="Products">
              <div className="admin-batch__row admin-batch__row--head" role="row">
                <span role="columnheader">Product</span>
                <span role="columnheader">Price</span>
                <span role="columnheader">Claimed</span>
              </div>
              {data.products.map((p) => {
                const pct =
                  p.quantityTotal > 0 ? Math.min(100, (p.claimed / p.quantityTotal) * 100) : 0;
                return (
                  <div key={p.name} className="admin-batch__row" role="row">
                    <span role="cell" className="admin-batch__name">
                      {p.name}
                      {p.isLocked && <Lock size={13} aria-label="Locked" />}
                    </span>
                    <strong role="cell">{peso(p.sellingPrice)}</strong>
                    <span role="cell" className="admin-batch__claimed">
                      <span className="admin-bcard__bar" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span>
                        {p.claimed} of {p.quantityTotal}
                        {p.waitlist > 0 && <small>+{p.waitlist} waitlist</small>}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AdminBatchDetailModal({
  batchId,
  onClose,
  onChanged,
}: {
  batchId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, refresh } = useAdminResource(
    () => adminApi.getBatch(batchId),
    [batchId],
  );
  const [pending, setPending] = useState<BatchModerationAction | null>(null);
  const isDesktop = useIsDesktop();

  const statusTone = data ? toneForStatus(data.status) : "info";

  const consequenceFor = (a: BatchModerationAction) =>
    a === "hide"
      ? "The batch is removed from the buyer catalog and cannot be claimed. The seller still sees it with your reason."
      : a === "restore"
        ? "The batch becomes visible in the buyer catalog again."
        : a === "flag"
          ? "The batch stays visible to buyers but is marked internally for admin follow-up."
          : a === "close"
            ? "New claims are blocked. Existing orders are not cancelled."
            : a === "lock"
              ? "New claims and seller edits are blocked, per the existing lock behavior."
              : "The batch is unlocked and returns to live.";

  const needsReason = (a: BatchModerationAction) =>
    a === "flag" || a === "hide" || a === "restore" || a === "close";

  return (
    <>
      <Modal
        title="Batch details"
        showTitleIcon={false}
        variant="detail"
        width={isDesktop ? 980 : 680}
        className="admin-modal admin-record-modal admin-batch-modal"
        overlayClassName="admin-modal-overlay admin-record-modal-overlay"
        onClose={onClose}
        footer={
          !loading && data ? (
            <div className="admin-modal-footer admin-modal-footer--wrap">
              {data.status === "locked" ? (
                <AdminActionButton action="unlock" size="sm" onClick={() => setPending("unlock")}>
                  Unlock
                </AdminActionButton>
              ) : (
                <AdminActionButton action="lock" size="sm" onClick={() => setPending("lock")}>
                  Lock
                </AdminActionButton>
              )}
              {data.moderationStatus !== "flagged" && data.moderationStatus !== "hidden" && (
                <AdminActionButton action="flag" size="sm" onClick={() => setPending("flag")}>
                  Flag for review
                </AdminActionButton>
              )}
              {data.moderationStatus === "hidden" ? (
                <AdminActionButton action="show" size="sm" onClick={() => setPending("restore")}>
                  Restore to catalog
                </AdminActionButton>
              ) : (
                <AdminActionButton action="hide" size="sm" onClick={() => setPending("hide")}>
                  Hide from catalog
                </AdminActionButton>
              )}
              {data.status !== "closed" && (
                <AdminActionButton
                  action="closeBatch"
                  size="sm"
                  onClick={() => setPending("close")}
                >
                  Close batch
                </AdminActionButton>
              )}
            </div>
          ) : undefined
        }
      >
        {loading && <CardSkeleton />}
        {!loading && error && (
          <p role="alert" className="admin-form-error">
            {error}
          </p>
        )}
        {!loading && data && isDesktop && <DesktopBody data={data} />}
        {!loading && data && !isDesktop && (
          <div className="space-y-5">
            <div className="admin-detail-hero">
              {data.coverPath ? (
                <BatchMedia
                  src={data.coverPath}
                  alt=""
                  width={1200}
                  height={600}
                  className="admin-detail-hero__thumb"
                />
              ) : (
                <span className="admin-detail-hero__thumb admin-bcard__thumb" aria-hidden="true" />
              )}
              <div className="admin-detail-hero__identity">
                <h2>{data.title}</h2>
                <p className="admin-batch-seller">
                  <Avatar name={data.sellerName} size={22} />
                  <span>
                    {data.sellerName} · {data.category}
                  </span>
                </p>
                <div className="admin-detail-hero__badges">
                  <AdminBadge tone={statusTone} label={data.status} />
                  <AdminBadge
                    tone={MOD_TONE[data.moderationStatus]}
                    label={data.moderationStatus}
                  />
                </div>
              </div>
            </div>

            {data.moderationReason && (
              <div className="admin-callout admin-callout--warn">
                <p>{data.moderationReason}</p>
              </div>
            )}

            <AdminModalSection title="Batch summary">
              <div className="admin-batch-window">
                <span>
                  <CalendarDays size={16} aria-hidden="true" />
                  Window
                </span>
                <strong>
                  {data.startsOn.slice(0, 10)} → {data.endsOn.slice(0, 10)}
                </strong>
              </div>
              <div className="admin-user-stats admin-batch-stats">
                <div>
                  <strong>{data.orderCount}</strong>
                  <span>Orders</span>
                </div>
                <div>
                  <strong>{data.products.length}</strong>
                  <span>Products</span>
                </div>
              </div>
            </AdminModalSection>

            <AdminModalSection
              title="Products"
              hint={`${data.products.length} item${data.products.length === 1 ? "" : "s"}`}
            >
              <ul className="admin-batch-products">
                {data.products.map((p) => {
                  const pct =
                    p.quantityTotal > 0 ? Math.min(100, (p.claimed / p.quantityTotal) * 100) : 0;
                  return (
                    <li key={p.name}>
                      <div className="admin-batch-products__head">
                        <span>
                          {p.name}
                          {p.isLocked && (
                            <Lock
                              size={11}
                              aria-label="Locked"
                              style={{ marginLeft: 5, verticalAlign: "-1px" }}
                            />
                          )}
                        </span>
                        <strong>{peso(p.sellingPrice)}</strong>
                      </div>
                      <div className="admin-batch-products__claim">
                        <span>
                          Claimed {p.claimed}
                          {p.waitlist > 0 ? ` (+${p.waitlist} waitlist)` : ""}
                        </span>
                        <span className="admin-bcard__bar" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        <span>Total {p.quantityTotal}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </AdminModalSection>
          </div>
        )}
      </Modal>

      {pending && data && (
        <AdminConfirmModal
          title={`${pending[0].toUpperCase()}${pending.slice(1)} batch`}
          consequence={consequenceFor(pending)}
          confirmLabel={pending[0].toUpperCase() + pending.slice(1)}
          minReason={needsReason(pending) ? 8 : 0}
          action={pending === "restore" ? "show" : pending === "close" ? "closeBatch" : pending}
          onConfirm={async (reason) => {
            await adminApi.moderateBatch(batchId, pending, reason);
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
