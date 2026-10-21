type DatabaseFailure = { code?: string; message?: string; constraint?: string };

/** A failed database transaction needs a fresh request, never an in-place retry. */
export function combinedDeliveryMutationError<T extends DatabaseFailure>(failure: T): T | Error {
  if (failure.code === "40001" || failure.code === "40P01") {
    return Object.assign(
      new Error(
        "Reservation data changed during this request. Refresh and try the entire action again.",
      ),
      { code: failure.code },
    );
  }
  if (
    (failure.code === "23503" || failure.code === "23001") &&
    /combined_delivery_batch_pin_(product|seller|order)_fk/.test(
      `${failure.constraint ?? ""} ${failure.message ?? ""}`,
    )
  ) {
    return Object.assign(
      new Error(
        /combined_delivery_batch_pin_order_fk/.test(
          `${failure.constraint ?? ""} ${failure.message ?? ""}`,
        )
          ? "An active combined delivery protects this reservation. Resolve the request, then refresh and try again."
          : "An active combined delivery protects this product's batch and seller. Resolve the request, then refresh and try again.",
      ),
      { code: failure.code },
    );
  }
  return failure;
}
