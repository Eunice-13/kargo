export const COURIER_COMPANIES = [
  "Lalamove",
  "J&T Express",
  "LBC",
  "Grab Express",
  "2GO",
  "Ninja Van",
  "Others",
] as const

export function courierTrackUrl(
  company?: string,
  trackingNumber?: string,
): string | null {
  const tracking = trackingNumber?.trim()
  if (!tracking) return null

  // Ninja Van is the only supported carrier that currently publishes a stable
  // number-bearing web URL. The others intentionally use the copy fallback
  // unless a seller supplies the courier's own share link.
  if (company === "Ninja Van") {
    return `https://www.ninjavan.co/en-ph/tracking?id=${encodeURIComponent(tracking)}`
  }

  return null
}

export function safeTrackingUrl(value?: string): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}
