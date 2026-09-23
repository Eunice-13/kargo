// Build and share a deep link to a specific batch's claim page (3.1).
// The link carries ?batch=<id>; App.tsx reads it at boot and opens that batch.
export function buildBatchLink(batchId: number | string): string {
  if (typeof window === "undefined") return `?batch=${batchId}`
  const url = new URL(window.location.href)
  url.searchParams.set("batch", String(batchId))
  // Drop the preview flag so a shared link doesn't force demo mode.
  url.searchParams.delete("preview")
  return url.toString()
}

// Copy the link to the clipboard, falling back to the native share sheet on
// devices that support it. Returns "shared" | "copied" | "failed".
export async function shareBatchLink(
  batchId: number | string,
  title?: string,
): Promise<"shared" | "copied" | "failed"> {
  const link = buildBatchLink(batchId)
  const nav = typeof navigator !== "undefined" ? navigator : undefined
  try {
    if (nav?.share) {
      await nav.share({ title: title ?? "KARGO batch", url: link })
      return "shared"
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(link)
      return "copied"
    }
  } catch {
    // User cancelled the share sheet, or clipboard was blocked — fall through.
    return "failed"
  }
  return "failed"
}
