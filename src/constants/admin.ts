// Admin pill tones. Kept separate from STATUS_C (which is typed to payment
// history statuses) so admin statuses/roles don't get forced into that union.

export type AdminTone = {
  bg: string
  fg: string
  dot: string
}

export const ADMIN_TONES: Record<string, AdminTone> = {
  // account status
  active: { bg: "#E6F6EF", fg: "#0B7A59", dot: "#0B7A59" },
  suspended: { bg: "#FEECEC", fg: "#B42318", dot: "#B42318" },
  // roles
  admin: { bg: "#EEF0FB", fg: "#2E3192", dot: "#2E3192" },
  seller: { bg: "#E0E7FF", fg: "#3730A3", dot: "#6366F1" },
  buyer: { bg: "#F1F5F9", fg: "#475467", dot: "#94A3B8" },
  // generic severities (reused by queues)
  info: { bg: "#F1F5F9", fg: "#475467", dot: "#94A3B8" },
  warn: { bg: "#FDF2E3", fg: "#B4690E", dot: "#F0B400" },
  danger: { bg: "#FEECEC", fg: "#B42318", dot: "#B42318" },
  good: { bg: "#E6F6EF", fg: "#0B7A59", dot: "#0B7A59" },
}

export const USER_ROLE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "buyer", label: "Buyers" },
  { value: "seller", label: "Sellers" },
  { value: "admin", label: "Admins" },
] as const

export const USER_STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
] as const

// Human-readable labels for audit action codes written by the admin RPCs.
export const ADMIN_ACTION_LABELS: Record<string, string> = {
  suspend_account: "Suspended account",
  restore_account: "Restored account",
  grant_seller: "Granted seller access",
  revoke_seller: "Revoked seller access",
}
