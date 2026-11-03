import type { ClaimRow, ClaimStatus } from "@/types";
import type { CombinedDeliveryRequest } from "@/types/combinedDelivery";
import { combinedRequestStatus } from "@/features/combined-delivery";

export function getToPayTotal(claims: Pick<ClaimRow, "amount">[]) {
  return claims.reduce((sum, claim) => sum + claim.amount, 0);
}

export type CombinedClaimListRow = {
  type: "combined";
  request: CombinedDeliveryRequest;
  status: ClaimStatus;
};

export type ClaimListRow = ClaimRow | CombinedClaimListRow;

export function isOpenPaymentStatus(status: ClaimStatus) {
  return (
    status === "Pending" ||
    status === "Insufficient Payment" ||
    status === "Awaiting Verification"
  );
}

export function buildClaimsListRows(
  claims: ClaimRow[],
  filter: ClaimStatus | "All",
  combinedRequests: CombinedDeliveryRequest[],
): ClaimListRow[] {
  const memberOrderIds = new Set(
    combinedRequests.flatMap((request) =>
      request.members.map((member) => String(member.order_id)),
    ),
  );
  const combinedRows: CombinedClaimListRow[] = combinedRequests
    .filter((request) => filter === "All" || combinedRequestStatus(request) === filter)
    .map((request) => ({
      type: "combined",
      request,
      status: combinedRequestStatus(request),
    }));
  const claimRows = claims.filter(
    (claim) =>
      !memberOrderIds.has(String(claim.id)) &&
      (filter === "All" || claim.status === filter),
  );

  return [...combinedRows, ...claimRows];
}
