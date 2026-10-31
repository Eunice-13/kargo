import type {
  CombinedDeliveryRequest,
  CombinedDeliveryRequestCandidate,
} from "@/types/combinedDelivery";
import { combinedDeliveryEligibility } from "./eligibility.ts";

/** A potential request still requires explicit destination confirmation at submit.
 * Never infer address identity from proximity, names, links or partial strings.
 */
export function requestSelectionEligibility(
  orders: readonly CombinedDeliveryRequestCandidate[],
  buyerId: string,
) {
  const base = combinedDeliveryEligibility(orders, buyerId);
  const first = orders[0];
  const hasFullPin = (order: CombinedDeliveryRequestCandidate) =>
    order.pinLat !== null &&
    Number.isFinite(order.pinLat) &&
    Math.abs(order.pinLat) <= 90 &&
    order.pinLng !== null &&
    Number.isFinite(order.pinLng) &&
    Math.abs(order.pinLng) <= 180 &&
    Boolean(order.addressText?.trim());
  const sameSnapshot = Boolean(
    first &&
    orders.every(
      (order) =>
        hasFullPin(order) &&
        order.pinLat === first.pinLat &&
        order.pinLng === first.pinLng &&
        order.addressText === first.addressText,
    ),
  );
  const confirmedIds = new Set(
    orders.flatMap((order) => (order.destinationId ? [order.destinationId] : [])),
  );
  const staleConfirmation = orders.some(
    (order) => order.destinationId && !order.destinationMatches,
  );
  const reasons = base.reasons.filter(
    (reason) =>
      !(
        ["unconfirmed_destination", "different_destination", "destination_changed"] as string[]
      ).includes(reason),
  );
  const feedback = [...base.feedback];
  if (!sameSnapshot || confirmedIds.size > 1 || staleConfirmation) {
    reasons.push("different_destination");
    feedback.push(
      "Choose reservations with the same saved delivery pin and full address, including unit or building details.",
    );
  }
  return { eligible: reasons.length === 0, reasons, feedback };
}

export function potentialDeliveryRequests(
  orders: readonly CombinedDeliveryRequestCandidate[],
  buyerId: string,
) {
  const buckets = new Map<string, CombinedDeliveryRequestCandidate[]>();
  for (const order of orders) {
    // Ignore only missing destination confirmation and the single-row minimum;
    // all other eligibility rules must already pass before offering a request.
    const reasons = combinedDeliveryEligibility([order], buyerId).reasons;
    if (
      !reasons.every((reason) =>
        ["at_least_two_reservations", "unconfirmed_destination", "destination_changed"].includes(
          reason,
        ),
      ) ||
      (order.destinationId && !order.destinationMatches)
    )
      continue;
    const key = JSON.stringify([
      order.buyerId,
      order.sellerId,
      order.batchId.toLowerCase(),
      order.fulfillmentMethod,
      order.paymentMethod,
      order.pinLat,
      order.pinLng,
      order.addressText,
    ]);
    const bucket = buckets.get(key) ?? [];
    bucket.push(order);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].flatMap((bucket) => {
    const confirmedIds = [
      ...new Set(bucket.flatMap((order) => (order.destinationId ? [order.destinationId] : []))),
    ];
    // Distinct confirmed IDs never merge. Unconfirmed rows can be explicitly
    // confirmed with either matching saved context, but cannot join both groups.
    const selections =
      confirmedIds.length > 1
        ? confirmedIds.map((id) =>
            bucket.filter((order) => !order.destinationId || order.destinationId === id),
          )
        : [bucket];
    return selections.filter(
      (selection) => requestSelectionEligibility(selection, buyerId).eligible,
    );
  });
}

export function latestDeliveryRequestForOrder(
  requests: readonly CombinedDeliveryRequest[],
  orderId: string,
) {
  const associated = requests.filter((request) =>
    request.members.some((member) => member.order_id === orderId),
  );
  // Only an ACTIVE request belongs to the order. A cancelled (or otherwise
  // terminal) request must not be returned — falling back to associated[0]
  // kept a cancelled combined request attached to the claim, so it stayed
  // visible in the claims tab even though it was inactive.
  return associated.find((request) =>
    ["pending_approval", "awaiting_shipping_fee", "shipping_fee_set"].includes(request.status),
  );
}
