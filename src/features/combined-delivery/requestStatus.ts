import type { ClaimStatus } from "@/types";
import type { CombinedDeliveryRequest } from "@/types/combinedDelivery";

export function combinedRequestStatus(request: CombinedDeliveryRequest): ClaimStatus {
  return request.payment?.status === "pending_review"
    ? "Awaiting Verification"
    : "Pending";
}

export function combinedRequestHasOpenPayment(request: CombinedDeliveryRequest) {
  return (
    request.status === "shipping_fee_set" &&
    ["ready", "pending_review", "rejected"].includes(request.payment?.status ?? "")
  );
}
