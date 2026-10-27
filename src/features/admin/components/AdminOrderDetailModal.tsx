import { useState } from "react";

import { Modal, SecondaryBtn, CardSkeleton } from "@/components/shared";
import { adminApi } from "@/services";
import { toneForStatus } from "@/constants/admin";

import { useAdminResource } from "../useAdminResource";
import AdminBadge from "./AdminBadge";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminEmptyText, AdminFact, AdminFactGrid, AdminModalSection } from "./AdminFacts";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export default function AdminOrderDetailModal({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, refresh } = useAdminResource(
    () => adminApi.getOrder(orderId),
    [orderId],
  );
  const [confirming, setConfirming] = useState(false);

  const canCancel = data && data.status !== "completed" && data.status !== "cancelled";
  const statusTone = data ? toneForStatus(data.status) : "info";

  return (
    <>
      <Modal
        title={data?.orderNumber ?? "Order"}
        variant="detail"
        width={640}
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
              <div className="admin-detail-hero__identity">
                <h2>{data.product}</h2>
                <p>
                  Qty {data.quantity} · {peso(data.amount)}
                </p>
              </div>
              <div className="admin-detail-hero__badges">
                <AdminBadge tone={statusTone} label={data.status.replace(/_/g, " ")} />
              </div>
            </div>

            <AdminModalSection title="Parties">
              <AdminFactGrid>
                <AdminFact label="Buyer" value={data.buyer} />
                <AdminFact label="Seller" value={data.seller} />
              </AdminFactGrid>
            </AdminModalSection>

            <AdminModalSection title="Timeline">
              <AdminFactGrid>
                <AdminFact label="Created" value={fmt(data.createdAt)} />
                <AdminFact label="Payment confirmed" value={fmt(data.paymentConfirmedAt)} />
                <AdminFact label="Completed" value={fmt(data.completedAt)} />
              </AdminFactGrid>
            </AdminModalSection>

            <AdminModalSection title="Delivery">
              <AdminFactGrid>
                <AdminFact label="Tracking" value={data.trackingNumber ?? "—"} />
                <AdminFact label="ETA" value={fmt(data.eta)} />
                <AdminFact label="Address" value={data.deliveryAddress ?? "—"} />
              </AdminFactGrid>
            </AdminModalSection>

            <AdminModalSection
              title="Payments"
              hint={`${data.payments.length} submission${data.payments.length === 1 ? "" : "s"}`}
            >
              {data.payments.length === 0 ? (
                <AdminEmptyText>No payment submissions yet.</AdminEmptyText>
              ) : (
                <ul className="admin-row-list">
                  {data.payments.map((p) => (
                    <li key={p.id} className="admin-row-list__item">
                      <span className="admin-row-list__main">
                        <strong>{p.method}</strong>
                        <span>
                          {p.status.replace(/_/g, " ")} · {p.referenceNumber ?? "no reference"}
                        </span>
                      </span>
                      <span className="admin-row-list__value">{peso(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminModalSection>

            <div className="admin-modal-footer">
              {canCancel ? (
                <SecondaryBtn
                  style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}
                  onClick={() => setConfirming(true)}
                >
                  Cancel order
                </SecondaryBtn>
              ) : (
                <p className="admin-footer-note">
                  {data.status === "completed"
                    ? "Completed orders cannot be cancelled."
                    : "This order is already cancelled."}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {confirming && data && (
        <AdminConfirmModal
          title="Cancel order"
          consequence="This cancels the order and notifies both parties. Any money already sent is refunded outside KARGO. Orders in an active combined payment must be handled through the combined record."
          confirmLabel="Cancel order"
          confirmWord={data.orderNumber}
          onConfirm={async (reason) => {
            await adminApi.cancelOrder(orderId, reason);
            setConfirming(false);
            refresh();
            onChanged();
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
