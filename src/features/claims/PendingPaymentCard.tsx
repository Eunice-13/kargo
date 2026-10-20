import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import type { ClaimRow } from "@/types";
import Card from "@/components/shared/Card";
import Countdown from "@/components/shared/Countdown";
import ProductThumb from "@/components/shared/ProductThumb";
import "./pendingPayments.css";

/** Render each existing payment record independently; actions stay with their claim. */
export default function PendingPaymentCard({
  item,
  imageUrl,
  onPreview,
  children,
}: {
  item: ClaimRow;
  imageUrl?: string;
  onPreview: () => void;
  children: ReactNode;
}) {
  const waiting = item.shippingState === "waiting_for_seller";
  return (
    <Card className="pending-product-card">
      <button
        type="button"
        className="buyer-claim-item-preview-trigger"
        aria-label={`Enlarge photo of ${item.product}`}
        onClick={onPreview}
      >
        <ProductThumb name={item.product} imageUrl={imageUrl} />
      </button>
      <div className="pending-product-card__info">
        <div className="pending-product-card__name">{item.product}</div>
        <div className="pending-product-card__meta pending-product-card__secondary">
          <span>{item.seller}</span>
          <span aria-hidden="true">·</span>
          <span>{item.reservedPaymentMethod || "Payment method selected"}</span>
        </div>
        <div className="pending-product-card__quantity">Qty: {item.qty.toLocaleString()}</div>
        <div className="pending-product-card__status">
          {waiting ? (
            <span className="checkout-waiting">
              <Clock size={13} aria-hidden="true" />
              Waiting for seller
            </span>
          ) : item.shippingState === "correction_requested" ? (
            <span className="pending-product-card__secondary">
              Seller requested a corrected delivery location
            </span>
          ) : (
            <>
              <span className="pending-product-card__secondary">
                {item.status === "Pending" ? "Awaiting payment" : item.status}
              </span>
              <Countdown
                id={item.id}
                hours={item.hours}
                expiresAt={item.expiresAt}
                paused={Boolean(item.deadlinePausedAt)}
              />
            </>
          )}
        </div>
      </div>
      <div className="pending-product-card__amount">
        ₱{item.amount.toLocaleString()}
        {waiting ? (
          <span className="pending-product-card__note">Shipping fee pending</span>
        ) : item.shippingFee !== undefined ? (
          <span className="pending-product-card__note">
            Includes ₱{item.shippingFee.toLocaleString()} shipping
          </span>
        ) : null}
      </div>
      <div className="pending-product-card__actions">{children}</div>
    </Card>
  );
}
