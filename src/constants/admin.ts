// Admin pill tones. These mirror the buyer/seller status palette (STATUS_C in
// theme.ts) so the same state reads the same color everywhere in the app.

export type AdminTone = {
  bg: string;
  fg: string;
  dot: string;
};

// Canonical state colors, matching STATUS_C in constants/theme.ts.
const PENDING = { bg: "#FEF3C7", fg: "#92400E", dot: "#FFC24B" };
const AWAITING = { bg: "#E0E7FF", fg: "#3730A3", dot: "#6366F1" };
const SUCCESS = { bg: "#D4F5EA", fg: "#0B7A59", dot: "#3FBF8F" };
const DANGER = { bg: "#FEE2E2", fg: "#991B1B", dot: "#EF4444" };
const NEUTRAL = { bg: "#F3F4F6", fg: "#6B7280", dot: "#9CA3AF" };
const INSUFFICIENT = { bg: "#FFF7ED", fg: "#92400E", dot: "#FCD34D" };
const PRO = { bg: "#E8D3F7", fg: "#3730A3", dot: "#D9C7F7" };

export const ADMIN_TONES: Record<string, AdminTone> = {
  // account status
  active: SUCCESS,
  suspended: DANGER,
  // roles
  admin: { bg: "#E0E7FF", fg: "#191BA9", dot: "#191BA9" },
  seller: AWAITING,
  buyer: NEUTRAL,
  // generic severities (reused by queues / moderation / generic labels)
  info: NEUTRAL,
  warn: PENDING,
  danger: DANGER,
  good: SUCCESS,
  pro: PRO,
};

// Map a raw order_status / payment_status / batch_status to the matching tone,
// using the same colors buyers and sellers see for that state.
const STATUS_TONE: Record<string, AdminTone> = {
  // order_status
  payment_pending: PENDING,
  payment_submitted: AWAITING,
  insufficient_payment: INSUFFICIENT,
  payment_confirmed: SUCCESS,
  preparing: AWAITING,
  completed: SUCCESS,
  expired: DANGER,
  cancelled: NEUTRAL,
  incomplete: NEUTRAL,
  // payment_status
  pending_review: PENDING,
  verified: SUCCESS,
  rejected: DANGER,
  // batch_status
  draft: NEUTRAL,
  live: SUCCESS,
  locked: PENDING,
  closed: NEUTRAL,
};

// Returns a tone key resolvable by AdminBadge. Falls back to a neutral "info"
// for anything unmapped so a new status never crashes the UI.
export function toneForStatus(status: string): AdminTone {
  return STATUS_TONE[status] ?? NEUTRAL;
}

export const USER_ROLE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "buyer", label: "Buyers" },
  { value: "seller", label: "Sellers" },
  { value: "admin", label: "Admins" },
] as const;

export const USER_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
] as const;

// Human-readable labels for audit action codes written by the admin RPCs.
export const ADMIN_ACTION_LABELS: Record<string, string> = {
  suspend_account: "Suspended account",
  restore_account: "Restored account",
  grant_seller: "Granted seller access",
  revoke_seller: "Revoked seller access",
  grant_admin: "Invited admin",
  accept_admin: "Accepted admin invitation",
  decline_admin: "Declined admin invitation",
  revoke_admin: "Revoked admin access",
};
