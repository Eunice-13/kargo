import { useState } from "react";

import { MapPin } from "lucide-react";

import { Modal, Avatar, CardSkeleton, ProductThumb } from "@/components/shared";
import { adminApi } from "@/services";
import { toneForStatus } from "@/constants/admin";

import { useAdminResource } from "../useAdminResource";
import AdminBadge from "./AdminBadge";
import AdminActionButton from "./AdminActionButton";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminEmptyText, AdminModalSection } from "./AdminFacts";

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

  // Once payment is confirmed, no one — including admins — may cancel the order,
  // regardless of fulfillment stage. paymentConfirmedAt is the stage-independent
  // signal (set at confirmation, never cleared). Already-cancelled orders and
  // terminal states remain non-cancellable too.
  const paymentConfirmed =
    data != null &&
    (data.paymentConfirmedAt != null ||
      ["payment_confirmed", "preparing", "completed"].includes(data.status));
  // Expired orders are final, so they can never be cancelled either.
  const isFinal = data != null && data.status === "expired";
  const canCancel =
    data != null &&
    data.status !== "completed" &&
    data.status !== "cancelled" &&
    !isFinal &&
    !paymentConfirmed;
  const statusTone = data ? toneForStatus(data.status) : "info";

  return (
    <>
      <Modal
        title="Order details"
        showTitleIcon={false}
        variant="detail"
        width={640}
        className="admin-modal admin-record-modal"
        overlayClassName="admin-modal-overlay admin-record-modal-overlay"
        onClose={onClose}
        footer={
          !loading && data ? (
            <div className="admin-modal-footer">
              {canCancel ? (
                <AdminActionButton action="cancelOrder" onClick={() => setConfirming(true)}>
                  Cancel order
                </AdminActionButton>
              ) : (
                <p className="admin-footer-note">
                  {data.status === "cancelled"
                    ? "This order is already cancelled."
                    : data.status === "completed"
                      ? "Completed orders cannot be cancelled."
                      : isFinal
                        ? "Expired orders cannot be cancelled."
                        : "Confirmed orders cannot be cancelled. Payment has already been verified."}
                </p>
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
            <div className="admin-detail-hero admin-order-hero">
              <span className="admin-order-hero__thumb">
                <ProductThumb name={data.product} />
              </span>
              <div className="admin-detail-hero__identity">
                <h2>{data.product}</h2>
                <p>
                  {data.orderNumber} · Qty {data.quantity}
                </p>
                <div className="admin-detail-hero__badges">
                  <AdminBadge tone={statusTone} label={data.status.replace(/_/g, " ")} />
                </div>
              </div>
              <strong className="admin-order-hero__amount">{peso(data.amount)}</strong>
            </div>

            <div className="admin-order-parties">
              <div>
                <Avatar name={data.buyer} size={36} />
                <span>
                  <small>Buyer</small>
                  <strong>{data.buyer || "—"}</strong>
                </span>
              </div>
              <div>
                <Avatar name={data.seller} size={36} />
                <span>
                  <small>Seller</small>
                  <strong>{data.seller || "—"}</strong>
                </span>
              </div>
            </div>

            <AdminModalSection title="Timeline">
              <ul className="admin-order-timeline">
                {(
                  [
                    ["Created", data.createdAt],
                    ["Payment confirmed", data.paymentConfirmedAt],
                    ["Completed", data.completedAt],
                  ] as const
                ).map(([label, at]) => (
                  <li key={label} className={at ? "is-done" : undefined}>
                    <span className="admin-order-timeline__box" aria-hidden="true" />
                    <span className="admin-order-timeline__label">{label}</span>
                    <span className="admin-order-timeline__value">{fmt(at)}</span>
                  </li>
                ))}
              </ul>
            </AdminModalSection>

            <AdminModalSection title="Delivery">
              <div className="admin-order-delivery">
                <div>
                  <span>Tracking</span>
                  <strong>{data.trackingNumber ?? "—"}</strong>
                </div>
                <div>
                  <span>ETA</span>
                  <strong>{fmt(data.eta)}</strong>
                </div>
              </div>
              <p className="admin-order-address">
                <MapPin size={16} aria-hidden="true" />
                <span>{data.deliveryAddress ?? "—"}</span>
              </p>
            </AdminModalSection>

            <AdminModalSection
              title="Payments"
              hint={`${data.payments.length} submission${data.payments.length === 1 ? "" : "s"}`}
            >
              {data.payments.length === 0 ? (
                <AdminEmptyText>No payment submissions yet.</AdminEmptyText>
              ) : (
                <ul className="admin-order-payments">
                  {data.payments.map((p) => (
                    <li key={p.id}>
                      <div className="admin-order-payments__head">
                        <strong>{p.method}</strong>
                        <strong>{peso(p.amount)}</strong>
                      </div>
                      <div className="admin-order-payments__meta">
                        <AdminBadge
                          tone={toneForStatus(p.status)}
                          label={p.status.replace(/_/g, " ")}
                        />
                        <span>· {p.referenceNumber ?? "no reference"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminModalSection>
          </div>
        )}
      </Modal>

      {confirming && data && (
        <AdminConfirmModal
          title="Cancel order"
          consequence="This cancels the order and notifies both parties. Any money already sent is refunded outside KARGO. Orders in an active combined payment must be handled through the combined record."
          confirmLabel="Cancel order"
          confirmWord={data.orderNumber}
          action="cancelOrder"
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
