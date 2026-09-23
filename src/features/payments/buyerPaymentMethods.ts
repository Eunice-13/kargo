// Fixed catalog of payment methods a buyer can save (Q15). Buyers pick from
// this set — no free-form method names. Session-only: not persisted to the DB,
// since no server flow consumes a buyer's saved methods (payment submission
// captures method details per-transaction).
export const BUYER_METHOD_CATALOG = [
  "GCash",
  "Maya",
  "Bank Transfer",
  "Cash on Meetup",
  "Cash on Delivery",
  "Others",
] as const

export type BuyerMethodType = (typeof BUYER_METHOD_CATALOG)[number]

export type BuyerPaymentMethod = {
  id: number
  type: BuyerMethodType
  // Account number / mobile / free note depending on type. Optional for the
  // cash methods which need no detail.
  detail: string
}

export const METHOD_COLORS: Record<string, string> = {
  GCash: "#007AFF",
  Maya: "#6B21A8",
  "Bank Transfer": "#065F46",
  "Cash on Meetup": "#92400E",
  "Cash on Delivery": "#92400E",
  Others: "#4B5563",
}

// Cash methods carry no account number/QR — they're label-only and settle
// in person. Kept as one list so every surface treats them consistently.
export const CASH_METHODS = ["Cash on Meetup", "Cash on Delivery"] as const

export function isCashMethod(name: string): boolean {
  return CASH_METHODS.includes(name as (typeof CASH_METHODS)[number])
}

// Whether a method needs an account name/number + QR (false for cash methods).
export function methodNeedsDetails(name: string): boolean {
  return !isCashMethod(name)
}

// Buyer-facing reminder shown when a cash method is selected at checkout.
export function cashCoordinationReminder(name: string): string {
  return `${name}: no online payment needed. Coordinate the handoff and exact amount directly with the seller through their contact link.`
}
