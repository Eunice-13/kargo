import type { EntityId } from "@/types";

export type SellerExtensionRequest = {
  id: EntityId;
  buyer: string;
  product: string;
  batch: string;
  requestedAt: string;
  reason?: string;
  status: "pending" | "approved" | "denied";
  orderStatus?: string;
  expiresAt?: string;
  deadlinePausedAt?: string | null;
  shippingState?: string | null;
};

export function extensionRequestStatus(request: SellerExtensionRequest, now = Date.now()) {
  if (request.status !== "pending") return request.status;
  if (request.orderStatus === "expired") return "expired";
  const deadline = request.expiresAt ? Date.parse(request.expiresAt) : NaN;
  const unpaid =
    !request.orderStatus ||
    ["payment_pending", "insufficient_payment"].includes(request.orderStatus);
  const paused =
    request.deadlinePausedAt ||
    ["waiting_for_seller", "correction_requested"].includes(request.shippingState ?? "");
  return unpaid && !paused && Number.isFinite(deadline) && deadline <= now ? "expired" : "pending";
}

export function countPendingExtensionRequests(
  requests: readonly SellerExtensionRequest[],
  now = Date.now(),
) {
  return requests.filter((request) => extensionRequestStatus(request, now) === "pending").length;
}

export function createDemoSellerExtensionRequests(): SellerExtensionRequest[] {
  return [
    {
      id: 1,
      buyer: "Carlo Reyes",
      product: "Laneige Lip Mask",
      batch: "Korea Haul",
      requestedAt: "Sep 9, 2026",
      status: "pending",
    },
    {
      id: 2,
      buyer: "Mia Santos",
      product: "SK-II Essence",
      batch: "Singapore Haul",
      requestedAt: "Sep 10, 2026",
      status: "pending",
    },
  ];
}
