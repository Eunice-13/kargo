// Fulfillment is forward-only. Every order on the seller board has a confirmed
// payment, and a confirmed order can never be cancelled (by sellers or admins),
// so the board offers no transition into "Cancelled". The Cancelled column still
// exists to display orders cancelled while unpaid (buyer cancel / seller decline)
// and historical cancelled rows; it simply cannot be entered from the board.
const nextStage: Record<string, string | undefined> = {
  "Payment Confirmed": "Preparing",
  Preparing: "Shipped",
  Shipped: "Delivered",
};

export function canAdvanceFulfillment(current: string, next: string): boolean {
  return current === next || nextStage[current] === next;
}

export const FULFILLMENT_TRANSITION_MESSAGE =
  "Orders can only move to the next fulfillment stage. Confirmed orders cannot be cancelled, and delivered orders cannot be reopened.";
