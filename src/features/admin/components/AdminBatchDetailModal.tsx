import { useState } from "react";
import { Lock } from "lucide-react";

import { Modal, PrimaryBtn, SecondaryBtn, CardSkeleton, BatchMedia } from "@/components/shared";
import { toneForStatus } from "@/constants/admin";
import { adminApi } from "@/services";
import type { BatchModerationAction } from "../adminTypes";

import { useAdminResource } from "../useAdminResource";
import AdminBadge from "./AdminBadge";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminFact, AdminFactGrid, AdminModalSection } from "./AdminFacts";

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

  const destructive = pending === "hide" || pending === "close";

  return (
    <>
      <Modal
        title={data?.title ?? "Batch"}
        variant="detail"
        width={680}
        className="admin-modal"
        overlayClassName="admin-modal-overlay"
        onClose={onClose}
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
              <BatchMedia
                src={data.coverPath ?? undefined}
                alt=""
                width={1200}
                height={600}
                className="admin-detail-hero__thumb"
              />
              <div className="admin-detail-hero__identity">
                <h2>{data.title}</h2>
                <p>
                  {data.sellerName} · {data.category}
                </p>
              </div>
              <div className="admin-detail-hero__badges">
                <AdminBadge tone={statusTone} label={data.status} />
                <AdminBadge tone={MOD_TONE[data.moderationStatus]} label={data.moderationStatus} />
              </div>
            </div>

            {data.moderationReason && (
              <div className="admin-callout admin-callout--warn">
                <p>{data.moderationReason}</p>
              </div>
            )}

            <AdminModalSection title="Batch summary">
              <AdminFactGrid>
                <AdminFact
                  label="Window"
                  value={`${data.startsOn.slice(0, 10)} → ${data.endsOn.slice(0, 10)}`}
                />
                <AdminFact label="Orders" value={String(data.orderCount)} />
                <AdminFact label="Confirmed GMV" value={peso(data.confirmedGmv)} />
                <AdminFact label="Products" value={String(data.products.length)} />
              </AdminFactGrid>
            </AdminModalSection>

            <AdminModalSection
              title="Products"
              hint={`${data.products.length} item${data.products.length === 1 ? "" : "s"}`}
            >
              <div className="admin-table-wrap">
                <table className="admin-mini-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Claimed</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.name}>
                        <td className="admin-mini-table__name">
                          {p.name}
                          {p.isLocked && (
                            <Lock
                              size={11}
                              aria-label="Locked"
                              style={{ marginLeft: 5, verticalAlign: "-1px" }}
                            />
                          )}
                        </td>
                        <td>{peso(p.sellingPrice)}</td>
                        <td>
                          {p.claimed}
                          {p.waitlist > 0 ? ` (+${p.waitlist} waitlist)` : ""}
                        </td>
                        <td>{p.quantityTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminModalSection>

            <div className="admin-modal-footer admin-modal-footer--wrap">
              {data.status === "locked" ? (
                <SecondaryBtn size="sm" onClick={() => setPending("unlock")}>
                  Unlock
                </SecondaryBtn>
              ) : (
                <SecondaryBtn size="sm" onClick={() => setPending("lock")}>
                  Lock
                </SecondaryBtn>
              )}
              {data.moderationStatus !== "flagged" && data.moderationStatus !== "hidden" && (
                <SecondaryBtn size="sm" onClick={() => setPending("flag")}>
                  Flag for review
                </SecondaryBtn>
              )}
              {data.moderationStatus === "hidden" ? (
                <PrimaryBtn size="sm" onClick={() => setPending("restore")}>
                  Restore to catalog
                </PrimaryBtn>
              ) : (
                <SecondaryBtn
                  size="sm"
                  style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}
                  onClick={() => setPending("hide")}
                >
                  Hide from catalog
                </SecondaryBtn>
              )}
              {data.status !== "closed" && (
                <SecondaryBtn size="sm" onClick={() => setPending("close")}>
                  Close batch
                </SecondaryBtn>
              )}
            </div>
          </div>
        )}
      </Modal>

      {pending && data && (
        <AdminConfirmModal
          title={`${pending[0].toUpperCase()}${pending.slice(1)} batch`}
          consequence={consequenceFor(pending)}
          confirmLabel={pending[0].toUpperCase() + pending.slice(1)}
          minReason={needsReason(pending) ? 8 : 0}
          tone={destructive ? "danger" : "default"}
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
