import type { AdminTab } from "@/types"

// Navigation intent — set before navigating to Batches so the tab can deep-link on mount
export const navIntent: {
  openAddressSettings: boolean;
  openBatchCheckout: boolean;
  batchId: number | null;
  sellerName: string | null;
  orderFilter: "Pending" | null;
  openExtensionRequests: boolean;
  // Admin deep-linking: a queue card / notification can target an admin tab,
  // sub-tab, filter, or a specific record. The admin shell consumes this once.
  adminTab: AdminTab | null;
  adminSubtab: string | null;
  adminFilter: string | null;
  adminTargetId: string | null;
} = {
  openAddressSettings: false,
  openBatchCheckout: false,
  batchId: null,
  sellerName: null,
  orderFilter: null,
  openExtensionRequests: false,
  adminTab: null,
  adminSubtab: null,
  adminFilter: null,
  adminTargetId: null,
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

export function requestAddressSettings() {
  navIntent.openAddressSettings = true;
  listeners.forEach(listener => listener());
}

export function requestAdminSection(opts: {
  tab: AdminTab
  subtab?: string
  filter?: string
  targetId?: string
}) {
  navIntent.adminTab = opts.tab
  navIntent.adminSubtab = opts.subtab ?? null
  navIntent.adminFilter = opts.filter ?? null
  navIntent.adminTargetId = opts.targetId ?? null
  listeners.forEach((listener) => listener())
}

export function consumeAdminIntent() {
  const intent = {
    tab: navIntent.adminTab,
    subtab: navIntent.adminSubtab,
    filter: navIntent.adminFilter,
    targetId: navIntent.adminTargetId,
  }
  navIntent.adminTab = null
  navIntent.adminSubtab = null
  navIntent.adminFilter = null
  navIntent.adminTargetId = null
  return intent
}
