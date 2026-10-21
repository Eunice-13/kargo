import type {
  CombinedDeliveryCandidate,
  CombinedDeliveryEligibility,
  CombinedDeliveryIneligibility,
} from "@/types/combinedDelivery";

import { combinedDeliveryBatchReasons, combinedDeliveryBatchFeedback } from "./batchEligibility.ts";

/** Suggestions only: the database independently revalidates under row locks. */
export function combinedDeliveryEligibility(
  reservations: readonly CombinedDeliveryCandidate[],
  buyerId: string,
): CombinedDeliveryEligibility {
  const reasons = new Set<CombinedDeliveryIneligibility>(
    combinedDeliveryBatchReasons(reservations.map((order) => order.batchId)),
  );
  if (reservations.length < 2) reasons.add("at_least_two_reservations");
  if (new Set(reservations.map((order) => order.id)).size !== reservations.length)
    reasons.add("duplicate_reservation");
  const first = reservations[0];
  for (const order of reservations) {
    if (order.buyerId !== buyerId) reasons.add("different_buyer");
    if (first && order.sellerId !== first.sellerId) reasons.add("different_seller");
    if (!order.destinationId) reasons.add("unconfirmed_destination");
    if (first && order.destinationId !== first.destinationId) reasons.add("different_destination");
    if (!order.destinationMatches) reasons.add("destination_changed");
    if (!order.paymentMethod?.trim() || (first && order.paymentMethod !== first.paymentMethod))
      reasons.add("different_payment_method");
    if (order.fulfillmentMethod !== "delivery") reasons.add("not_delivery");
    if (order.orderStatus !== "payment_pending") reasons.add("not_unpaid");
    if (order.shippingFee !== null || order.shippingFeeSet) reasons.add("shipping_finalized");
    if (order.shippingState !== "waiting_for_seller") reasons.add("shipping_not_pending");
    if (!order.shippingAccepted) reasons.add("shipping_not_accepted");
    if (!order.deadlinePausedAt) reasons.add("not_paused");
    const pausedAt = Date.parse(order.deadlinePausedAt ?? "");
    const expiresAt = Date.parse(order.expiresAt);
    // Paused reservations can have a past wall-clock expiry while remaining valid.
    // Their original budget is expiresAt - pausedAt, not expiresAt - Date.now().
    if (!Number.isFinite(pausedAt) || !Number.isFinite(expiresAt) || expiresAt <= pausedAt)
      reasons.add("deadline_exhausted");
    if (order.groupOrderId || order.activeDeliveryGroupId) reasons.add("already_grouped");
    if (order.hasPaymentHistory) reasons.add("payment_history");
  }
  return {
    eligible: reasons.size === 0,
    reasons: [...reasons],
    feedback: combinedDeliveryBatchFeedback([...reasons]),
  };
}
