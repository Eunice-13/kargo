import { useEffect, useRef, useState } from "react";
import type { CombinedDeliveryRequest } from "@/types/combinedDelivery";
import Card from "@/components/shared/Card";
import Countdown from "@/components/shared/Countdown";
import PrimaryBtn from "@/components/shared/PrimaryBtn";
import ProductThumb from "@/components/shared/ProductThumb";
import SecondaryBtn from "@/components/shared/SecondaryBtn";
import { PaymentSubmitModal } from "@/features/payments";
import { kargoApi } from "@/services";

const money = (value: number) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value)
    : "Unavailable";
const statusLabels = {
  ready: "Awaiting payment",
  pending_review: "Awaiting verification",
  rejected: "Payment rejected · submit a new proof",
  verified: "Payment verified",
  expired: "Expired",
  invalidated: "No longer eligible",
};

/** Uses the existing horizontal card classes and manual payment modal. */
export default function CombinedPaymentCard({
  request,
  seller,
  imageForOrder,
  onUpdated,
  onDetails,
  actionsDisabled = false,
}: {
  request: CombinedDeliveryRequest;
  seller: string;
  imageForOrder: (id: string) => string | undefined;
  onUpdated: () => Promise<void>;
  onDetails: () => void;
  actionsDisabled?: boolean;
}) {
  const [paying, setPaying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const submitting = useRef(false);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const account = request.payment;
  if (
    !account ||
    !["ready", "pending_review", "rejected"].includes(account.status) ||
    request.status !== "shipping_fee_set"
  )
    return null;
  const first = request.members[0];
  const deadline = new Date(account.deadline).getTime();
  const validDetails =
    Number.isFinite(deadline) &&
    request.members.length >= 2 &&
    request.members.every((member) => !member.released_at) &&
    [account.total, account.items_subtotal, account.shipping_fee].every(
      (value) => value !== null && Number.isFinite(Number(value)) && Number(value) >= 0,
    ) &&
    Number(account.total) > 0;
  const expired = Number.isFinite(deadline) && deadline <= now;
  const payable =
    validDetails && ["ready", "rejected"].includes(account.status) && !expired && !actionsDisabled;
  const product = request.members
    .map(
      (member) =>
        `${member.order?.batch_products?.name ?? "Reserved product"} × ${member.order?.quantity ?? "—"}`,
    )
    .join(", ");
  return (
    <>
      <article aria-label={`Combined delivery payment to ${seller}`}>
        <Card className="pending-product-card">
          <ProductThumb
            name={first?.order?.batch_products?.name ?? "Combined delivery"}
            imageUrl={first ? imageForOrder(first.order_id) : undefined}
          />
          <div className="pending-product-card__info">
            <h3 className="pending-product-card__name">Combined delivery</h3>
            <p className="pending-product-card__meta pending-product-card__secondary">
              {seller} · {request.payment_method}
            </p>
            <ul className="my-1 space-y-0.5 text-xs text-[var(--kargo-ink-soft)]">
              {request.members.map((member) => (
                <li key={member.order_id} className="break-words">
                  {member.order?.batch_products?.name ?? "Reserved product"}{" "}
                  <span className="text-[var(--kargo-muted)]">
                    × {member.order?.quantity ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="pending-product-card__status">
              <span role="status" className="pending-product-card__secondary">
                {!validDetails
                  ? "Payment details need refreshing"
                  : expired && account.status !== "pending_review"
                    ? "Payment deadline expired"
                    : statusLabels[account.status]}
              </span>
              {validDetails && account.status !== "pending_review" && (
                <Countdown
                  id={`combined-${request.id}`}
                  hours={0}
                  expiresAt={account.deadline}
                  compact
                />
              )}
            </div>
          </div>
          <div className="pending-product-card__amount">
            <span className="sr-only">Combined total </span>
            {Number.isFinite(Number(account.total)) ? money(Number(account.total)) : "Unavailable"}
            <span className="pending-product-card__note">
              Items subtotal {money(Number(account.items_subtotal))}
            </span>
            <span className="pending-product-card__note">
              Shared shipping fee {money(Number(account.shipping_fee))}
            </span>
          </div>
          <div
            role="group"
            aria-label={`Payment actions for ${seller}`}
            className="pending-product-card__actions flex flex-wrap gap-2"
          >
            <SecondaryBtn size="sm" disabled={actionsDisabled} onClick={onDetails}>
              View details
            </SecondaryBtn>
            <PrimaryBtn size="sm" disabled={!payable} onClick={() => setPaying(true)}>
              {account.status === "pending_review" ? "Awaiting verification" : "Pay Now"}
            </PrimaryBtn>
          </div>
        </Card>
      </article>
      {paying && validDetails && !expired && ["ready", "rejected"].includes(account.status) && (
        <PaymentSubmitModal
          requireProof
          submissionDisabled={!payable}
          item={{
            id: request.id,
            orderId: first.order_id,
            seller,
            sellerId: request.seller_id,
            product,
            amount: Number(account.total),
            hours: 0,
            expiresAt: account.deadline,
            reservedPaymentMethod: request.payment_method,
          }}
          imageUrl={imageForOrder(first.order_id)}
          onClose={() => {
            if (!submitting.current) setPaying(false);
          }}
          onConfirm={async (method, referenceNumber, receipt, details) => {
            if (submitting.current) return;
            if (!payable) throw new Error("Refresh payment details before submitting.");
            submitting.current = true;
            try {
              await kargoApi.submitPayment({
                orderId: first.order_id,
                combinedDeliveryGroupId: request.id,
                method,
                amount: details.amountPaid,
                referenceNumber,
                receipt,
                payerAccountName: details.payerAccountName,
                payerPhone: details.payerPhone,
                buyerContactUrl: details.buyerContactUrl,
              });
              setPaying(false);
              await onUpdated();
            } finally {
              submitting.current = false;
            }
          }}
        />
      )}
    </>
  );
}
