import type { AdminTab, Tab } from "@/types"

// A record a notification wants the destination page to scroll to and
// highlight. Every field is a database uuid; a page matches whichever it shows.
export type RecordFocusTarget = {
  orderId?: string
  paymentId?: string
  groupOrderId?: string
  combinedGroupId?: string
}

// Navigation intent — set before navigating to Batches so the tab can deep-link on mount
export const navIntent: {
  openAddressSettings: boolean;
  openAccountStatus: boolean;
  openBatchCheckout: boolean;
  batchId: number | null;
  // Batch uuid (BatchType.dbId). Notifications only know the database id.
  batchDbId: string | null;
  // Group order the opened batch should show in its Group Order modal.
  batchGroupOrderId: string | null;
  sellerName: string | null;
  orderFilter: "Pending" | null;
  openExtensionRequests: boolean;
  // Buyer "My Group Orders" modal on My Claims. `groupOrdersFocusId` expands
  // that group's card when the modal opens.
  openGroupOrders: boolean;
  groupOrdersFocusId: string | null;
  // Scroll-to-and-highlight target. Tagged with its destination tab so the page
  // the user is leaving never consumes an intent meant for the next one.
  recordFocus: { tab: Tab; target: RecordFocusTarget } | null;
  // Admin deep-linking: a queue card / notification can target an admin tab,
  // sub-tab, filter, or a specific record. The admin shell consumes this once.
  adminTab: AdminTab | null;
  adminSubtab: string | null;
  adminFilter: string | null;
  adminTargetId: string | null;
} = {
  openAddressSettings: false,
  openAccountStatus: false,
  openBatchCheckout: false,
  batchId: null,
  batchDbId: null,
  batchGroupOrderId: null,
  sellerName: null,
  orderFilter: null,
  openExtensionRequests: false,
  openGroupOrders: false,
  groupOrdersFocusId: null,
  recordFocus: null,
  adminTab: null,
  adminSubtab: null,
  adminFilter: null,
  adminTargetId: null,
}

type NavIntentListener = () => void
const listeners = new Set<NavIntentListener>()

export function requestBatchOpen(batchId: number) {
  navIntent.batchId = batchId
  navIntent.batchDbId = null
  navIntent.batchGroupOrderId = null
  navIntent.sellerName = null
  listeners.forEach((listener) => listener())
}

// Open a batch by its database uuid, optionally with one of its group orders
// open in the Group Order modal.
export function requestBatchOpenByDbId(batchDbId: string, groupOrderId?: string) {
  navIntent.batchDbId = batchDbId
  navIntent.batchGroupOrderId = groupOrderId ?? null
  navIntent.batchId = null
  navIntent.sellerName = null
  listeners.forEach((listener) => listener())
}

export function requestSellerOpen(sellerName: string) {
  navIntent.sellerName = sellerName
  navIntent.batchId = null
  navIntent.batchDbId = null
  navIntent.batchGroupOrderId = null
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

// Deep-link into Settings → Account status (used by the restore notification,
// so "your account has been restored" opens the when/why details).
export function requestAccountStatusSettings() {
  navIntent.openAccountStatus = true;
  listeners.forEach(listener => listener());
}

// Open the seller's extension-request queue on Batches.
export function requestExtensionRequests() {
  navIntent.openExtensionRequests = true;
  listeners.forEach((listener) => listener());
}

// Open the buyer's My Group Orders modal (My Claims), optionally expanding one
// group's card.
export function requestGroupOrders(groupOrderId?: string) {
  navIntent.openGroupOrders = true
  navIntent.groupOrdersFocusId = groupOrderId ?? null
  listeners.forEach((listener) => listener())
}

// Ask a page to scroll to and highlight a record it shows.
export function requestRecordFocus(tab: Tab, target: RecordFocusTarget) {
  navIntent.recordFocus = { tab, target }
  listeners.forEach((listener) => listener())
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
