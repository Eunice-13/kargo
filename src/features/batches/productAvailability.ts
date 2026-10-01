// Capacity locks are derived so cancelled/expired claims can free stock again.
// `locked` remains the seller's explicit override for claims and waitlisting.
export function productAvailability(
  product: { qty: number; claimed: number; waitlist: number; waitlistLimit?: number; locked?: boolean },
  batchLocked = false,
) {
  const claimsFull = product.claimed >= product.qty
  const waitlistFull = product.waitlistLimit !== undefined && product.waitlist >= product.waitlistLimit
  const queuePending = product.waitlist > 0
  const manuallyLocked = batchLocked || Boolean(product.locked)
  return {
    claimsFull,
    queuePending,
    waitlistFull,
    canClaim: !manuallyLocked && !claimsFull && !queuePending,
    canWaitlist: !manuallyLocked && claimsFull && !waitlistFull,
    fullyLocked: manuallyLocked || (claimsFull && waitlistFull),
  }
}
