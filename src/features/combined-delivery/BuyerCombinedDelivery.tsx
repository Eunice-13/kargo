import DeliveryAvailabilityNotice from "./DeliveryAvailabilityNotice";
import { useState, type ReactNode } from "react";
import type { ClaimRow } from "@/types";
import type { CombinedDeliveryRequest } from "@/types/combinedDelivery";
import { isSupabaseConfigured } from "@/lib/supabase";
import SecondaryBtn from "@/components/shared/SecondaryBtn";
import useBuyerDeliveryRequests from "./useBuyerDeliveryRequests";
import { latestDeliveryRequestForOrder, potentialDeliveryRequests } from "./requestEligibility";
import CombinedPaymentCard from "./CombinedPaymentCard";
import CombinedDeliveryRequestDialog from "./CombinedDeliveryRequestDialog";

export default function BuyerCombinedDelivery({
  buyerId,
  claims,
  imageForOrder,
  onRecovered,
  children,
}: {
  buyerId?: string;
  claims: ClaimRow[];
  imageForOrder: (id: string) => string | undefined;
  onRecovered?: () => Promise<void>;
  children: (controls: {
    combinedPaymentOrder: (id: string) => boolean;
    requestForOrder: (id: string) => CombinedDeliveryRequest | undefined;
    openRequest: (request: CombinedDeliveryRequest) => void;
  }) => ReactNode;
}) {
  const revision = JSON.stringify(
    claims.map((claim) => [
      claim.id,
      claim.status,
      claim.shippingState,
      claim.shippingFee,
      claim.deliveryPinLat,
      claim.deliveryPinLng,
      claim.deliveryPinAddress,
      claim.deadlinePausedAt,
    ]),
  );
  const state = useBuyerDeliveryRequests(
    buyerId,
    isSupabaseConfigured && Boolean(buyerId),
    revision,
  );
  const [refreshError, setRefreshError] = useState("");
  const [dialog, setDialog] = useState<"new" | CombinedDeliveryRequest | null>(null);
  const options = potentialDeliveryRequests(state.candidates, buyerId ?? "");
  const hasRelevantClaims =
    claims.filter((claim) => claim.shippingState === "waiting_for_seller").length >= 2;
  const currentRequest =
    typeof dialog === "object" && dialog
      ? (state.requests.find((request) => request.id === dialog.id) ?? dialog)
      : undefined;
  return (
    <>
      {refreshError && (
        <p role="status" className="mb-3 text-xs text-[var(--kargo-muted)]">
          {refreshError}
        </p>
      )}
      {state.available && options.length > 0 && (
        <div className="combined-delivery-request-prompt mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[var(--kargo-muted)]">
            Some reservations may share one delivery.
          </span>
          <SecondaryBtn disabled={state.loading || state.busy} onClick={() => setDialog("new")}>
            Request Combined Delivery
          </SecondaryBtn>
        </div>
      )}
      {state.loading && hasRelevantClaims && (
        <p role="status" className="sr-only">
          Checking combined delivery availability…
        </p>
      )}
      {state.error && (hasRelevantClaims || dialog) && (
        <DeliveryAvailabilityNotice
          error={state.error}
          unavailable={state.unavailable}
          loading={state.loading}
          onRetry={() => void state.reload()}
        />
      )}
      <div className="pending-payments-list mb-3">
        {state.requests
          .filter(
            (request) =>
              state.available && request.payment && request.status === "shipping_fee_set",
          )
          .map((request) => (
            <CombinedPaymentCard
              key={request.id}
              request={request}
              actionsDisabled={state.loading || state.busy}
              seller={
                claims.find((claim) =>
                  request.members.some((member) => member.order_id === String(claim.id)),
                )?.seller ?? "Seller"
              }
              imageForOrder={imageForOrder}
              onDetails={() => setDialog(request)}
              onUpdated={async () => {
                await state.reload();
                await onRecovered?.();
              }}
            />
          ))}
      </div>
      {children({
        combinedPaymentOrder: (id) =>
          state.available &&
          state.requests.some(
            (request) =>
              request.status === "shipping_fee_set" &&
              request.payment &&
              ["ready", "pending_review", "rejected"].includes(request.payment.status) &&
              request.members.some((member) => member.order_id === id && !member.released_at),
          ),
        requestForOrder: (id) =>
          state.available ? latestDeliveryRequestForOrder(state.requests, id) : undefined,
        openRequest: (request) => {
          if (!state.available) return;
          setDialog(request);
          void state.reload();
        },
      })}
      {dialog && buyerId && state.available && (
        <CombinedDeliveryRequestDialog
          buyerId={buyerId}
          options={options}
          existing={currentRequest}
          busy={state.busy}
          actionsDisabled={state.loading}
          onSubmit={state.submit}
          onCancelRequest={state.cancel}
          onRecoverRequest={async (id) => {
            const recovered = await state.recover(id);
            if (recovered) {
              try {
                await onRecovered?.();
                setRefreshError("");
              } catch {
                setRefreshError(
                  "The request was recovered. Reload the page to refresh reservation details.",
                );
              }
            }
            return recovered;
          }}
          onClose={() => setDialog(null)}
          imageForOrder={imageForOrder}
        />
      )}
    </>
  );
}
