export const KARGO_APP_URL = "https://kargo-psi.vercel.app"

export function authRedirectOrigin() {
  if (typeof window === "undefined") return KARGO_APP_URL

  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1" ? window.location.origin : KARGO_APP_URL
}
