import type { CombinedDeliveryIneligibility } from "@/types/combinedDelivery";

export const BATCH_ELIGIBILITY_MESSAGES = {
  invalid_batch: "Each reservation must belong to a valid Pasabuy batch.",
  different_batch: "Only reservations from the same Pasabuy batch can be combined.",
} as const;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strict V1 policy: actual UUID identity only, with no seller override. */
export function combinedDeliveryBatchReasons(
  batchIds: readonly unknown[],
): CombinedDeliveryIneligibility[] {
  const reasons: CombinedDeliveryIneligibility[] = [];
  const validIds = batchIds.filter((id): id is string => typeof id === "string" && uuid.test(id));
  if (validIds.length !== batchIds.length || batchIds.length === 0) reasons.push("invalid_batch");
  if (new Set(validIds.map((id) => id.toLowerCase())).size > 1) reasons.push("different_batch");
  return reasons;
}

export function combinedDeliveryBatchFeedback(
  reasons: readonly CombinedDeliveryIneligibility[],
): string[] {
  return [
    ...new Set(
      reasons.flatMap((reason) =>
        reason in BATCH_ELIGIBILITY_MESSAGES
          ? [BATCH_ELIGIBILITY_MESSAGES[reason as keyof typeof BATCH_ELIGIBILITY_MESSAGES]]
          : [],
      ),
    ),
  ];
}
