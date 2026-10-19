// Environment resolution for the mail worker. Kept separate from the renderer so
// previews and tests can run without Deno or any secrets.

import type { Branding } from "./layout.ts"
import { safeUrl } from "./format.ts"

export type EnvReader = (name: string) => string | undefined

// Keep this byte-identical to DEFAULT_LOGO in scripts/build-auth-emails.mjs.
// The query token is tied to the checked-in PNG so email clients do not keep
// showing an older mark after the asset changes.
export const DEFAULT_EMAIL_LOGO_URL =
  "https://kargo-eunice-13s-projects.vercel.app/kargo-logo-head.png?v=2750d019"

/**
 * Both providers deliberately use this exact versioned asset. Keeping the URL
 * out of deployment-specific environment variables prevents Auth and queued
 * emails from silently rendering different marks.
 */
export function brandingFrom(env: EnvReader): Branding {
  const appUrl =
    safeUrl(env("KARGO_APP_URL")) ??
    safeUrl(env("APP_URL")) ??
    safeUrl(env("SITE_URL")) ??
    null

  return { appUrl, logoUrl: DEFAULT_EMAIL_LOGO_URL, productName: "KARGO" }
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
