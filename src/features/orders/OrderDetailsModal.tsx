import { useState } from "react";

import type { OrderRow, PayHistRow } from "@/types";
import { BUYER_COLUMNS } from "@/constants/fulfillment";

import {
  DeliveryPreviewCard,
  Modal,
  SecondaryBtn,
  StageProgress,
  safeTrackingUrl,
} from "@/components/shared";
import { TransactionDetailModal } from "@/features/payments";
import { formatMoney } from "@/lib/format";

export default function OrderDetailsModal({
  order: detailOrder,
  payHistory,
  onClose,
}: {
  order: OrderRow;

  payHistory: PayHistRow[];

  onClose: () => void;
}) {
  const [detailPayment, setDetailPayment] = useState<PayHistRow | null>(null);

  const orderPayments = payHistory.filter(
    (payment) => payment.orderId === (detailOrder.dbId ?? detailOrder.id),
  );
  const trackingReady =
    Boolean(detailOrder.trackingNumber) ||
    ["shipped", "in_transit", "delivered"].includes(detailOrder.fulfillmentStage ?? "");
  const currentStage =
    detailOrder.fulfillmentStage === "delivered"
      ? "Delivered"
      : ["shipped", "in_transit"].includes(detailOrder.fulfillmentStage ?? "")
        ? "Shipped"
        : detailOrder.fulfillmentStage === "preparing" || detailOrder.step === 4
          ? "Preparing"
          : detailOrder.step === 3
            ? "Payment Confirmed"
            : "Pending Payment";
  return (
    <>
      {detailOrder && !detailPayment && (
        <Modal
          title="Order Details"
          onClose={() => onClose()}
          width={520}
          maxHeight="calc(100dvh - 48px)"
          showTitleIcon={false}
          className="buyer-order-details-modal"
          overlayClassName="buyer-order-details-overlay"
          closeAriaLabel="Close"
        >
          <StageProgress stages={BUYER_COLUMNS} current={currentStage} />
          <dl className="buyer-order-details__details">
            {[
              ["Order ID", detailOrder.id],

              ["Product", detailOrder.product],
              ["Quantity", detailOrder.qty ? `×${detailOrder.qty}` : "—"],
              ["Batch", detailOrder.batch || "—"],
              ["Seller", detailOrder.seller],

              ["Total", `${formatMoney(detailOrder.amount)}`],
            ].map(([label, value]) => (
              <div
                key={label}
                className={`buyer-order-details__detail-row${
                  label === "Total" ? " buyer-order-details__detail-row--total" : ""
                }`}
              >
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {detailOrder.deliveryPinAddress && (
            <section className="buyer-order-details__section buyer-order-details__address">
              <h3>Delivery address</h3>
              <p className="buyer-order-details__soft-box">{detailOrder.deliveryPinAddress}</p>
            </section>
          )}
          <section className="buyer-order-details__section buyer-order-details__tracking">
            <h3>Delivery tracking</h3>
            {!trackingReady ? (
              <p className="buyer-order-details__soft-box">
                Tracking appears here once your order ships.
              </p>
            ) : (
              <div className="buyer-order-details__tracking-box">
                <DeliveryPreviewCard
                  company={detailOrder.courierCompany}
                  trackingNumber={detailOrder.trackingNumber}
                  trackingUrl={detailOrder.trackingUrl}
                  destinationLat={detailOrder.deliveryPinLat}
                  destinationLng={detailOrder.deliveryPinLng}
                  demo={!detailOrder.dbId}
                />
                <dl className="buyer-order-details__tracking-list">
                  {[
                    ["Courier", detailOrder.courierCompany || "—"],
                    ["Rider", detailOrder.riderName || "—"],
                    ["Rider contact", detailOrder.riderContact || "—"],
                    ["Tracking number", detailOrder.trackingNumber || "—"],
                    ["ETA", detailOrder.eta ? new Date(detailOrder.eta).toLocaleString() : "—"],
                    ["Status", (detailOrder.fulfillmentStage || "shipped").split("_").join(" ")],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                  {safeTrackingUrl(detailOrder.trackingUrl) && (
                    <div>
                      <dt>Tracking link</dt>
                      <dd className="buyer-order-details__tracking-link">
                        {detailOrder.trackingUrl}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </section>
          <section className="buyer-order-details__section buyer-order-details__payments">
            <h3>Payment records</h3>
            {orderPayments.length === 0 ? (
              <p className="buyer-order-details__empty">No payment records for this order yet.</p>
            ) : (
              <div className="buyer-order-details__payment-list">
                {orderPayments.map((payment) => (
                  <div key={payment.id} className="buyer-order-details__payment-row">
                    <span className="buyer-order-details__payment-copy">
                      <span className="buyer-order-details__payment-meta">
                        {payment.date} · {formatMoney(payment.amount)}
                      </span>
                      <span
                        className="buyer-order-details__payment-status"
                        data-status={payment.status}
                      >
                        {payment.status}
                      </span>
                    </span>
                    <SecondaryBtn
                      onClick={() => setDetailPayment(payment)}
                      style={{
                        height: 36,
                        minHeight: 36,
                        padding: "0 14px",
                        border: "1px solid #6B7280",
                        borderRadius: 8,
                        background: "transparent",
                      }}
                    >
                      View payment
                    </SecondaryBtn>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Modal>
      )}
      {detailPayment && (
        <TransactionDetailModal tx={detailPayment} onClose={() => setDetailPayment(null)} />
      )}
    </>
  );
}
