import { CYAN_L } from "@/constants/theme"

// ─── Fulfillment Board constants (used in Dashboard + Orders) ────────────────
export const KANBAN_COLS = [
  "Claimed",
  "Pending Payment",
  "Payment Confirmed",
  "Preparing",
  "Completed",
  "Cancelled",
] as const
export type KanbanCol = typeof KANBAN_COLS[number]
export const KANBAN_COL_BG: Record<KanbanCol, string> = {
  Claimed: "#EEF0FF",
  "Pending Payment": "#FEF3C7",
  "Payment Confirmed": CYAN_L,
  Preparing: "#F0FDF4",
  Completed: "#D4F5EA",
  Cancelled: "#FEE2E2",
}
// Orders already fulfilled before the ones on the board (keeps the seller
// stat at 14 on first load, and lets it grow as cards move to "Completed").
export const PRIOR_FULFILLED = 13
