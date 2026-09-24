import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()

// Whether real Supabase credentials are present in the build. This is fixed at
// startup and does not change at runtime.
export const hasSupabaseCredentials = Boolean(url && key)

// ─── Demo-session override ──────────────────────────────────────────────────
// Even when credentials exist, a user can choose "Demo mode" at the login
// screen to explore the app against the in-memory seed data (password123, no
// backend calls). The choice is stored per browser session so a reload keeps
// the selected mode. When demo mode is on, we force the whole app down the
// same path it uses when no credentials are configured — every consumer already
// branches on `isSupabaseConfigured`, so this single lever flips them all.
const DEMO_FLAG = "kargo.demoMode"

function readDemoMode(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(DEMO_FLAG) === "1"
  } catch {
    return false
  }
}

export const isDemoSession = hasSupabaseCredentials && readDemoMode()

/**
 * Switch the current browser session between demo (in-memory seed data) and
 * live (real Supabase) mode, then reload so the module-level flags below
 * re-evaluate. No-op when credentials are absent (the app is always in demo
 * mode then and there is nothing to switch to).
 */
export function setDemoMode(on: boolean): void {
  if (typeof window === "undefined" || !hasSupabaseCredentials) return
  try {
    if (on) window.sessionStorage.setItem(DEMO_FLAG, "1")
    else window.sessionStorage.removeItem(DEMO_FLAG)
  } catch {
    // Ignore storage failures; mode simply won't persist.
  }
  window.location.reload()
}

// The effective "backend is active" flag the rest of the app reads. True only
// when credentials exist AND the user has not opted into a demo session.
export const isSupabaseConfigured = hasSupabaseCredentials && !isDemoSession

export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    )
  }
  return supabase
}
