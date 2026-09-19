import type { BatchExpenses } from "@/types"

// In-memory fallback store (demo mode, no Supabase): per-batch expenses persist
// across modal opens within the session. Keyed by the batch's local id. Kept in
// its own module (not a component file) so both the Batch Financial Summary and
// the Sales Report can read/write it without cross-importing components.
export const localExpenseStore = new Map<number, BatchExpenses>()
