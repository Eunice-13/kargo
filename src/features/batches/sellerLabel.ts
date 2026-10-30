// Buyer-facing seller label. Buyers shop at the seller's STORE, so prefer the
// seller's shop name when they set one, falling back to their display name.
// Only use this for DISPLAY — never for identity checks (ownership, shop
// navigation, matching), which must keep comparing the underlying `seller`.
export function sellerLabel(source: { seller?: string; sellerShopName?: string }): string {
  const shop = source.sellerShopName?.trim();
  if (shop) return shop;
  return source.seller?.trim() || "Seller";
}
