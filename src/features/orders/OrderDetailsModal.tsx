import { useState } from "react"

import type { OrderRow, PayHistRow } from "@/types"

import {
  DeliveryPreviewCard,
  Modal,
  SecondaryBtn,
  safeTrackingUrl,
} from "@/components/shared"
import { TransactionDetailModal } from "@/features/payments"

export default function OrderDetailsModal({
  order: detailOrder,
  payHistory,
  onClose,
}: {
  order: OrderRow

  payHistory: PayHistRow[]

  onClose: () => void
}) {
  const [detailPayment, setDetailPayment] = useState<PayHistRow | null>(null)

  const orderPayments = payHistory.filter(
    (payment) => payment.orderId === (detailOrder.dbId ?? detailOrder.id),
  )
  const trackingReady =
    Boolean(detailOrder.trackingNumber) ||
    ["shipped", "in_transit", "delivered"].includes(
      detailOrder.fulfillmentStage ?? "",
    )
  return (
    <>
      {detailOrder && !detailPayment && (
        <Modal title="Order Details" onClose={() => onClose()} width={480}>
          <dl className="space-y-3">
            {[
              ["Order ID", detailOrder.id],

              ["Product", detailOrder.product],
              ["Quantity", detailOrder.qty ? `×${detailOrder.qty}` : "—"],
              ["Batch", detailOrder.batch || "—"],
              ["Seller", detailOrder.seller],

              ["Total", `₱${detailOrder.amount.toLocaleString()}`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-b border-gray-100 pb-2 text-sm"
              >
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-right font-semibold break-words min-w-0">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {detailOrder.deliveryPinAddress && (
            <section className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <h3 className="text-xs font-semibold text-gray-700">
                Delivery address
              </h3>
              <p className="mt-1 text-sm leading-5 text-gray-700">
                {detailOrder.deliveryPinAddress}
              </p>
            </section>
          )}
          <section className="mt-5 space-y-3 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold">Delivery tracking</h3>
            {!trackingReady ? (
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                Tracking appears here once your order ships.
              </p>
            ) : (
              <>
                <DeliveryPreviewCard
                  company={detailOrder.courierCompany}
                  trackingNumber={detailOrder.trackingNumber}
                  trackingUrl={detailOrder.trackingUrl}
                  destinationLat={detailOrder.deliveryPinLat}
                  destinationLng={detailOrder.deliveryPinLng}
                  demo={!detailOrder.dbId}
                />
                <dl className="space-y-2">
                  {[
                    ["Courier", detailOrder.courierCompany || "â€”"],
                    ["Rider", detailOrder.riderName || "â€”"],
                    ["Rider contact", detailOrder.riderContact || "â€”"],
                    ["Tracking number", detailOrder.trackingNumber || "â€”"],
                    [
                      "ETA",
                      detailOrder.eta
                        ? new Date(detailOrder.eta).toLocaleString()
                        : "â€”",
                    ],
                    [
                      "Status",
                      (detailOrder.fulfillmentStage || "shipped")
                        .split("_")
                        .join(" "),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="min-w-0 break-words text-right font-semibold capitalize">
                        {value}
                      </dd>
                    </div>
                  ))}
                  {safeTrackingUrl(detailOrder.trackingUrl) && (
                    <div className="flex justify-between gap-4 text-sm">
                      <dt className="text-gray-500">Tracking link</dt>
                      <dd className="min-w-0 break-all text-right font-semibold">
                        {detailOrder.trackingUrl}
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            )}
          </section>
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold">Payment records</h3>
            {orderPayments.length === 0 ? (
              <p className="text-sm text-gray-500">
                No payment records for this order yet.
              </p>
            ) : (
              orderPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>
                    {payment.date} · ₱{payment.amount.toLocaleString()} ·{" "}
                    {payment.status}
                  </span>
                  <SecondaryBtn onClick={() => setDetailPayment(payment)}>
                    View payment
                  </SecondaryBtn>
                </div>
              ))
            )}
            <SecondaryBtn onClick={() => onClose()}>Close</SecondaryBtn>
          </div>
        </Modal>
      )}
      {detailPayment && (
        <TransactionDetailModal
          tx={detailPayment}
          onClose={() => setDetailPayment(null)}
        />
      )}
    </>
  )
}
