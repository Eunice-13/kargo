// Navigation intent — set before navigating to Batches so the tab can deep-link on mount
export const navIntent: { batchId: number | null; sellerName: string | null } = {
  batchId: null,
  sellerName: null,
}
