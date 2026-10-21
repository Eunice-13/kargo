type BackendError = { code?: string; message?: string; details?: string };
const tables =
  /\b(combined_delivery_groups|combined_delivery_members|combined_delivery_payment_accounts|combined_delivery_payment_reservations|delivery_destinations)\b/;
const functions =
  /\b(combined_delivery_request_candidates|seller_combined_delivery_requests|request_combined_delivery|review_combined_delivery|cancel_combined_delivery_request|invalidate_combined_delivery_request|submit_combined_delivery_payment|review_combined_delivery_payment)\b/;

/** Match only explicit missing feature dependencies, never authorization or transport failures. */
export function unavailableDeliveryBackend(failure: unknown): boolean {
  if (!failure || typeof failure !== "object") return false;
  const error = failure as BackendError;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return (
    (["PGRST205", "42P01", "PGRST200"].includes(error.code ?? "") && tables.test(text)) ||
    (error.code === "PGRST202" && functions.test(text)) ||
    (["42703", "PGRST204"].includes(error.code ?? "") &&
      /\bcombined_delivery_group_id\b/.test(text))
  );
}
export const deliveryUnavailableMessage =
  "Combined delivery is not available yet. Your individual reservations are unchanged.";
export function deliveryFailureMessage(failure: unknown): string {
  if (unavailableDeliveryBackend(failure)) return deliveryUnavailableMessage;
  const detail =
    failure && typeof failure === "object" && "message" in failure
      ? String(failure.message)
      : "Please try again.";
  return `Unable to load combined delivery. ${detail}`;
}

/** A fast missing-schema error must never conceal another read's auth/network failure. */
export async function readDeliveryCapabilities<A, B>(
  first: Promise<A>,
  second: Promise<B>,
): Promise<[A, B]> {
  const results = await Promise.allSettled([first, second]);
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (failures.length) {
    const unexpected = failures.findIndex((failure) => !unavailableDeliveryBackend(failure));
    throw failures[unexpected >= 0 ? unexpected : 0];
  }
  return results.map((result) => (result as PromiseFulfilledResult<unknown>).value) as [A, B];
}
