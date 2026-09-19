// ─── BIR Registration Seal Badge verification ────────────────────────────────
//
// This module implements the verification pipeline that gates Seller access:
//
//   [Upload] → [QR Decode] → [Regex Checks Base Domain] → [Approve or Flag]
//
// IMPORTANT — trust boundary:
// The AUTHORITATIVE QR decode MUST run server-side (a client-only decode can be
// bypassed, so it can never be the thing that grants "Verified"). In this
// prototype there is no backend wired yet (state is in-memory in App.tsx and
// Supabase is only planned — see SUPABASE-WIRING-PLAN.md), so `decodeBadgeQr`
// below is written as the single seam that a Supabase Edge Function will own.
// When the backend exists, replace the body of `decodeBadgeQr` with a `fetch`
// to that function; everything else in the pipeline stays the same.
//
// The domain allow-list check (`isOfficialBirUrl`) is genuine, deterministic
// string/regex validation and is correct as-is — no AI needed for it.

// The one official base domain a valid badge QR must resolve to.
export const OFFICIAL_BIR_DOMAIN = "verify.bir.gov.ph"

/**
 * Strictly validate that a decoded QR URL points at the official BIR verify
 * domain. This matches the real base domain only — it rejects lookalikes and
 * subdomain tricks such as:
 *   - https://verify.bir.gov.ph.fake-site.com/... (suffix attack)
 *   - https://notverify.bir.gov.ph/...            (prefix attack)
 *   - https://verify-bir.gov.ph/...               (hyphen lookalike)
 *
 * We parse the URL and compare the hostname exactly (case-insensitive), rather
 * than doing a loose `includes()` check.
 */
export function isOfficialBirUrl(decoded: string): boolean {
  let url: URL
  try {
    url = new URL(decoded.trim())
  } catch {
    return false
  }
  // Must be https and the hostname must equal the official domain exactly.
  if (url.protocol !== "https:") return false
  const host = url.hostname.toLowerCase()
  return host === OFFICIAL_BIR_DOMAIN
}

/**
 * Client-side pre-check: can the browser even detect a QR code in this image?
 * Uses the built-in BarcodeDetector API when available. This is ONLY a fast
 * "please re-upload a clearer image" gate — it must never grant Verified.
 *
 * Returns:
 *   - true  → a QR was detected (or the API is unavailable, so we can't rule it
 *             out — defer to the server decode)
 *   - false → the API is available and found no QR → ask the user to re-upload
 */
export async function clientHasDetectableQr(file: File): Promise<boolean> {
  // If the API isn't available we can't pre-check; don't block — let the
  // server-side decode be the source of truth.
  const AnyWindow = window as unknown as {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => {
      detect: (src: CanvasImageSource | ImageBitmap) => Promise<unknown[]>
    }
  }
  if (typeof AnyWindow.BarcodeDetector === "undefined") return true
  try {
    const bitmap = await createImageBitmap(file)
    const detector = new AnyWindow.BarcodeDetector({ formats: ["qr_code"] })
    const codes = await detector.detect(bitmap)
    return codes.length > 0
  } catch {
    // On any error, don't hard-block on the client — defer to the server.
    return true
  }
}

export type DecodeResult =
  | { ok: true; decoded: string }
  | { ok: false; reason: "unreadable" }

/**
 * SERVER-OWNED STEP (trust boundary).
 *
 * Authoritative QR decode. In production this posts the uploaded image to a
 * Supabase Edge Function that runs a deterministic decoder — e.g. jsQR (+ sharp
 * for pixel data) on the Deno/JS runtime, or OpenCV `QRCodeDetector` / `pyzbar`
 * on a small Python function. A deterministic library is used deliberately: a
 * QR has exactly one correct decoding, so a real decoder is faster, cheaper and
 * more reliable than asking a vision LLM to read the pattern. Any API keys for
 * an optional downstream tamper-check stay server-side only.
 *
 * Production shape (documented, not active in this prototype):
 *
 *   const body = new FormData()
 *   body.append("badge", file)
 *   const res = await fetch("/functions/v1/verify-bir-badge", { method: "POST", body })
 *   return res.json()  // { ok: true, decoded } | { ok: false, reason: "unreadable" }
 *
 * Until the backend is wired, this prototype simulates the decode from the
 * uploaded file name so the multi-stage UX and the REAL domain check below can
 * be exercised end-to-end:
 *   - name contains "flag"/"fake"/"tamper" → simulate a counterfeit link
 *   - name contains "blur"/"empty"        → simulate an unreadable QR
 *   - otherwise                            → simulate a valid official-domain QR
 */
export async function decodeBadgeQr(file: File): Promise<DecodeResult> {
  await delay(900) // simulate server round-trip
  const n = file.name.toLowerCase()
  if (/(blur|empty|unreadable)/.test(n)) {
    return { ok: false, reason: "unreadable" }
  }
  if (/(flag|fake|tamper|counterfeit|altered)/.test(n)) {
    // Simulate an altered link that fails the domain allow-list.
    return { ok: true, decoded: "https://verify.bir.gov.ph.fake-site.com/x/123" }
  }
  // Simulate a legitimate badge whose QR resolves to the official domain.
  return { ok: true, decoded: "https://verify.bir.gov.ph/seal?ref=DEMO-9F2A1" }
}

export type PipelineOutcome =
  | { status: "Verified"; decoded: string }
  | { status: "Flagged"; reason: "unreadable" | "bad-domain" }

/**
 * Run the full verification pipeline for an uploaded badge image, reporting each
 * stage back via `onStage` so the UI can show progress (Scanning → Verifying)
 * instead of one opaque spinner.
 */
export async function runBirVerification(
  file: File,
  onStage: (stage: "Scanning" | "Verifying") => void,
): Promise<PipelineOutcome> {
  // Stage 1 — QR decode (server-owned, authoritative).
  onStage("Scanning")
  const decode = await decodeBadgeQr(file)
  if (!decode.ok) {
    return { status: "Flagged", reason: "unreadable" }
  }
  // Stage 2 — strict base-domain check (deterministic, real).
  onStage("Verifying")
  await delay(700)
  if (!isOfficialBirUrl(decode.decoded)) {
    return { status: "Flagged", reason: "bad-domain" }
  }
  // (Optional future step: server-side vision tamper-likelihood check.)
  return { status: "Verified", decoded: decode.decoded }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
