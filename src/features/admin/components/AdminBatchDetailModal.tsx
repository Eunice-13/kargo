import { useState } from "react";
import { CalendarDays, Lock } from "lucide-react";

import { Modal, Avatar, CardSkeleton, BatchMedia } from "@/components/shared";
import { toneForStatus } from "@/constants/admin";
import { adminApi } from "@/services";
import type { BatchModerationAction } from "../adminTypes";

import { useAdminResource } from "../useAdminResource";
import AdminBadge from "./AdminBadge";
import AdminActionButton from "./AdminActionButton";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminModalSection } from "./AdminFacts";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

const MOD_TONE: Record<string, string> = {
  visible: "good",
  flagged: "warn",
  hidden: "danger",
};

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
        width={680}
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
        {!loading && data && (
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
                  <strong>{peso(data.confirmedGmv)}</strong>
                  <span>Confirmed GMV</span>
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
