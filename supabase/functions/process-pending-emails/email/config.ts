// Environment resolution for the mail worker. Kept separate from the renderer so
// previews and tests can run without Deno or any secrets.

import type { Branding } from "./layout.ts"
import { safeUrl } from "./format.ts"

export type EnvReader = (name: string) => string | undefined

export const LOGO_FILE = "kargo-logo-head.png"
export const LOGO_BUCKET = "brand-assets"

/**
 * Where the logo lives, in priority order:
 *   1. KARGO_EMAIL_LOGO_URL          — an explicit, already-public image URL
 *   2. KARGO_EMAIL_ASSET_BASE_URL    — your deployed site origin
 *   3. SUPABASE_URL + the public brand-assets bucket
 * A missing logo is not fatal: the banner wordmark is live text.
 */
export function brandingFrom(env: EnvReader): Branding {
  const appUrl =
    safeUrl(env("KARGO_APP_URL")) ??
    safeUrl(env("APP_URL")) ??
    safeUrl(env("SITE_URL")) ??
    null

  const explicitLogo = safeUrl(env("KARGO_EMAIL_LOGO_URL"))
  const assetBase = safeUrl(env("KARGO_EMAIL_ASSET_BASE_URL"))
  const supabaseUrl = safeUrl(env("SUPABASE_URL"))

  const logoUrl =
    explicitLogo ??
    (assetBase ? `${assetBase.replace(/\/$/, "")}/${LOGO_FILE}` : null) ??
    (supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${LOGO_BUCKET}/${LOGO_FILE}` : null)

  return { appUrl, logoUrl, productName: "KARGO" }
}

export type ProviderName = "nylas" | "brevo"

export type SenderConfig =
  | { provider: "nylas"; apiKey: string; grantId: string; apiUri: string }
  | { provider: "brevo"; apiKey: string; senderEmail: string; senderName: string }

export type SenderResult =
  | { ok: true; config: SenderConfig }
  | { ok: false; error: string }

function required(env: EnvReader, name: string): string {
  const value = env(name)?.trim()
  if (!value) throw new Error(`Missing required secret: ${name}`)
  return value
}

/** EMAIL_PROVIDER defaults to nylas so existing deployments keep working untouched. */
export function senderFrom(env: EnvReader): SenderResult {
  const provider = (env("EMAIL_PROVIDER")?.trim().toLowerCase() || "nylas") as ProviderName

  try {
    if (provider === "nylas") {
      const apiUri = new URL(env("NYLAS_API_URI")?.trim() || "https://api.us.nylas.com")
      if (apiUri.protocol !== "https:") throw new Error("NYLAS_API_URI must use HTTPS")
      return {
        ok: true,
        config: {
          provider,
          apiKey: required(env, "NYLAS_API_KEY"),
          grantId: required(env, "NYLAS_GRANT_ID"),
          apiUri: apiUri.toString().replace(/\/$/, ""),
        },
      }
    }

    if (provider === "brevo") {
      const senderEmail = required(env, "BREVO_SENDER_EMAIL")
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
        throw new Error("BREVO_SENDER_EMAIL must be a valid email address")
      }
      return {
        ok: true,
        config: {
          provider,
          apiKey: required(env, "BREVO_API_KEY"),
          senderEmail,
          senderName: env("BREVO_SENDER_NAME")?.trim() || "KARGO",
        },
      }
    }

    return { ok: false, error: `Unknown EMAIL_PROVIDER: ${provider}. Use "nylas" or "brevo".` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid email configuration" }
  }
}
