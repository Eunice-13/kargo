import type { EntityId } from "@/types";

export type SellerExtensionRequest = {
  id: EntityId;
  buyer: string;
  product: string;
  batch: string;
  requestedAt: string;
  reason?: string;
  status: "pending" | "approved" | "denied";
};

export function countPendingExtensionRequests(
  requests: readonly Pick<SellerExtensionRequest, "status">[],
) {
  return requests.filter((request) => request.status === "pending").length;
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
