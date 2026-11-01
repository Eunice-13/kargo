import type { ClaimRow } from "@/types";

// Maximum number of payment extension requests a buyer can make for a single
// claim. Enforced in the UI; the migration 202611090001 adds backend enforcement.
export const MAX_EXTENSION_REQUESTS = 2;

// How many extension requests have been made for this claim. Falls back to
// estimating from extensionStatus until the backend RPC reports a real count.
export function extensionRequestCount(claim: ClaimRow) {
  return (
    claim.extensionRequestCount ??
    (claim.extensionStatus && claim.extensionStatus !== "none" ? 1 : 0)
  );
}

export function extensionLimitMessage() {
  return `You've used all ${MAX_EXTENSION_REQUESTS} extension requests for this claim.`;
}
