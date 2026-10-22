/** Supabase errors are plain objects, not necessarily Error instances. */
export function groupOrderErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  )
    return error.message.trim();
  return fallback;
}
export function groupCommitmentMaximum(
  product: { qty: number; claimed: number; limitPerUser?: number },
  ownSaved: number,
) {
  // Updating a commitment replaces its quantity: don't count that same saved
  // allocation against the available replacement quantity a second time.
  const stock = Math.max(0, product.qty - product.claimed + ownSaved);
  const limit =
    product.limitPerUser != null && product.limitPerUser > 0 ? product.limitPerUser : Infinity;
  return Math.floor(Math.min(stock, limit));
}
export function validGroupCommitmentQuantity(quantity: number, maximum: number) {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= maximum;
}
