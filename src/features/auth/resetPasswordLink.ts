import { PASSWORD_RESET_PATH } from "@/constants/auth"

// Recovery links return to their own path, so the screen can be recognized from

// the URL alone. The session tokens Supabase appends live in the fragment and it

// strips them as soon as it has parsed them, so they cannot be the signal.

export function isResetPasswordPath() {
  return window.location.pathname

    .replace(/\/+$/, "")

    .endsWith(PASSWORD_RESET_PATH)
}

// Drop the reset path (and any leftover tokens) so a refresh does not reopen the

// recovery screen.

export function clearResetPasswordUrl() {
  const path = window.location.pathname.replace(/\/+$/, "")

  const withoutReset = path.endsWith(PASSWORD_RESET_PATH)
    ? path.slice(0, -PASSWORD_RESET_PATH.length)
    : path

  window.history.replaceState(null, "", `${withoutReset}/`)
}

// Supabase silently falls back to the project's site URL when a redirect target

// is not allow-listed, and the recovery token then lands on the root instead. It

// arrives in the fragment, which the client strips as soon as it has parsed it,

// so the first render is the only chance to read it.

export function hasRecoveryFragment() {
  return /(?:^|[#&])type=recovery(?:&|$)/.test(window.location.hash)
}
