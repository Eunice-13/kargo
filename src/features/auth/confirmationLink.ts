// A signup confirmation link returns to the app with the session tokens in the
// URL fragment, marked `type=signup`. The Supabase client strips the fragment as
// soon as it has parsed it, so this must be read once, as early as possible
// (App reads it at module load). Ordinary logins never carry this marker, which
// is what separates "just confirmed their new account" from "logged back in".
export function hasSignupConfirmationFragment() {
  if (typeof window === "undefined") return false
  return /(?:^|[#&])type=signup(?:&|$)/.test(window.location.hash)
}

// Belt-and-braces check against profiles.created_at: even when the marker is
// present, only treat the account as new if it was created recently. A missing
// or unparseable date defers to the link marker rather than blocking the tour.
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000

export function isNewAccount(createdAt?: string) {
  if (!createdAt) return true
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return true
  return Date.now() - created < NEW_ACCOUNT_WINDOW_MS
}
