import type { VerifyItem } from "./verifyTypes";

// Decides what the seller's "Confirm Payment" popup should say. The warning is
// shared by individual, group, combined-delivery and partial payments, so it
// must stay accurate for each: only a payment that COVERS THE FULL AMOUNT DUE
// transitions the order to `payment_confirmed`, and a payment_confirmed order
// can no longer be cancelled. A short amount lands on `insufficient_payment`,
// which is still cancellable, so we must NOT claim it becomes uncancellable.
//
// "Cash on Meetup" has no submitted amount to compare, so confirming it is
// treated as a full confirmation (the seller is attesting cash was received).

export type ConfirmPaymentCopy = {
  /** True when confirming will fully confirm the order and lock it. */
  locksOrder: boolean;
  title: string;
  /** Lead sentence shown above the warning callout. */
  message: string;
  /** The cancellation warning, or null when confirming won't lock the order. */
  warning: string | null;
  confirmLabel: string;
};

export function amountCoversDue(
  item: Pick<VerifyItem, "amount" | "amountPaid" | "method">,
): boolean {
  // No amount to compare (e.g. Cash on Meetup) → treat as a full confirmation.
  if (item.method === "Cash on Meetup") return true;
  if (item.amountPaid == null || item.amountPaid === "") return true;
  const paid = Number(item.amountPaid);
  if (!Number.isFinite(paid)) return true;
  return paid >= item.amount;
}

export function confirmPaymentCopy(
  item: Pick<VerifyItem, "amount" | "amountPaid" | "method" | "product">,
): ConfirmPaymentCopy {
  const peso = (n: number) => `₱${n.toLocaleString()}`;
  const locksOrder = amountCoversDue(item);

  if (locksOrder) {
    return {
      locksOrder: true,
      title: "Confirm this payment?",
      message: `Confirm ${peso(item.amount)} for ${item.product}.`,
      warning:
        "Once this order's payment is fully confirmed, it can no longer be cancelled — by you, the buyer, or an admin — at any fulfillment stage.",
      confirmLabel: "Confirm Payment",
    };
  }

  const paid = Number(item.amountPaid);
  const paidText = Number.isFinite(paid) ? peso(paid) : "this amount";
  return {
    locksOrder: false,
    title: "Confirm a short payment?",
    message: `The buyer paid ${paidText} of ${peso(item.amount)} for ${item.product}.`,
    // Deliberately no "cannot be cancelled" warning: a short payment stays
    // insufficient and the order remains cancellable until it is paid in full.
    warning:
      "This amount is short of the total due, so the order stays marked insufficient and is not locked. It can still be cancelled until the full amount is confirmed.",
    confirmLabel: "Confirm Payment",
  };
}
