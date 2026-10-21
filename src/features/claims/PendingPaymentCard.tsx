import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import type { ClaimRow } from "@/types";
import type { CombinedDeliveryRequest } from "@/types/combinedDelivery";
import Card from "@/components/shared/Card";
import Countdown from "@/components/shared/Countdown";
import ProductThumb from "@/components/shared/ProductThumb";
import "./pendingPayments.css";

/** Render each existing payment record independently; actions stay with their claim. */
export default function PendingPaymentCard({
  item,
  imageUrl,
  deliveryRequest,
  onPreview,
  children,
}: {
  item: ClaimRow;
  imageUrl?: string;
  deliveryRequest?: Pick<CombinedDeliveryRequest, "status" | "decision_reason">;
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
          {deliveryRequest &&
          ["pending_approval", "awaiting_shipping_fee", "shipping_fee_set"].includes(
            deliveryRequest.status,
          ) ? (
            <span className="checkout-waiting">
              <Clock size={13} aria-hidden="true" />
              {deliveryRequest.status === "shipping_fee_set"
                ? "Shared shipping fee set"
                : deliveryRequest.status === "awaiting_shipping_fee"
                  ? "Combined delivery approved"
                  : "Combined delivery requested"}
            </span>
          ) : waiting ? (
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
        {deliveryRequest?.status === "rejected" && (
          <p className="pending-product-card__secondary">Combined delivery rejected</p>
        )}
        {deliveryRequest?.status === "cancelled" && (
          <p className="pending-product-card__secondary">Combined delivery cancelled</p>
        )}
        {deliveryRequest?.status === "invalidated" && (
          <p className="pending-product-card__secondary">Combined delivery no longer available</p>
        )}
      </div>
      <div className="pending-product-card__amount">
        ₱{item.amount.toLocaleString()}
        {deliveryRequest?.status === "shipping_fee_set" ? (
          <span className="pending-product-card__note">
            Item subtotal · View shared fee in request
          </span>
        ) : waiting ? (
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
