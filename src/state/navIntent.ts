// Navigation intent — set before navigating to Batches so the tab can deep-link on mount
export const navIntent: {
  batchId: number | null;
  sellerName: string | null;
} = {
  batchId: null,
  sellerName: null,
}

type NavIntentListener = () => void
const listeners = new Set<NavIntentListener>()

export function requestBatchOpen(batchId: number) {
  navIntent.batchId = batchId
  navIntent.sellerName = null
  listeners.forEach((listener) => listener())
}

export function requestSellerOpen(sellerName: string) {
  navIntent.sellerName = sellerName
  navIntent.batchId = null
  listeners.forEach((listener) => listener())
}

export function subscribeNavIntent(listener: NavIntentListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
