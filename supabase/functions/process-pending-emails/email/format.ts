// Formatting helpers for transactional email. Everything here is pure so the
// preview script can render all templates without Deno.

const MANILA = "Asia/Manila"

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DATE = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  month: "short",
  day: "numeric",
  year: "numeric",
})

const DATE_TIME = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

/** Escape every interpolation that reaches HTML. Detail rows carry seller and product text. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/** Only http(s) links survive; anything else is dropped rather than rendered. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return url.toString()
  } catch {
    return null
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** "₱1,240.00" for the designed HTML and the plain-text part alike. */
export function pesos(value: unknown): string | null {
  const amount = toNumber(value)
  return amount === null ? null : PHP.format(amount)
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export function shortDate(value: unknown): string | null {
  const date = toDate(value)
  return date ? DATE.format(date) : null
}

export function dateTime(value: unknown): string | null {
  const date = toDate(value)
  return date ? DATE_TIME.format(date).replace(", ", " · ") : null
}

export function firstName(name: unknown): string | null {
  if (typeof name !== "string") return null
  const first = name.trim().split(/\s+/)[0]
  return first ? first : null
}

export function humanize(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const words = value.trim().replaceAll("_", " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function clampText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`
}

/** Append query parameters without assuming the app URL already has a query. */
export function withQuery(base: string | null, params: Record<string, string>): string | null {
  if (!base) return null
  try {
    const url = new URL(base)
    for (const [key, value] of Object.entries(params)) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value)
    }
    return url.toString()
  } catch {
    return null
  }
}

/** Platform wordmark used in the plain-text footer. */
export const TEXT_RULE = "------------------------------------------------------------"
