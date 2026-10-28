// Cancellation is an existing terminal branch, not a delivery stage.
const nextStage: Record<string, string | undefined> = {
  "Payment Confirmed": "Preparing",
  Preparing: "Shipped",
  Shipped: "Delivered",
};

export function canAdvanceFulfillment(current: string, next: string): boolean {
  return (
    current === next ||
    nextStage[current] === next ||
    (next === "Cancelled" && nextStage[current] !== undefined)
  );
}

export const FULFILLMENT_TRANSITION_MESSAGE =
  "Orders can only move to the next fulfillment stage. Delivered and cancelled orders cannot be reopened.";
