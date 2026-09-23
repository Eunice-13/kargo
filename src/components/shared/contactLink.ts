// Resolve a usable external contact URL from a person's social links.
// Preference order: Facebook, Messenger, Instagram, then the first link set.
// Returns undefined when the person has no contact link on file.
const PREFERENCE = ["Facebook", "Messenger", "Instagram", "Viber", "Website"]

export function resolveContactUrl(
  links?: Record<string, string>,
): string | undefined {
  if (!links) return undefined
  const entries = Object.entries(links).filter(([, url]) => url && url.trim())
  if (entries.length === 0) return undefined
  for (const preferred of PREFERENCE) {
    const hit = entries.find(([label]) => label === preferred)
    if (hit) return normalizeUrl(hit[1])
  }
  return normalizeUrl(entries[0][1])
}

// Ensure the value opens as an absolute URL in a new tab.
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
