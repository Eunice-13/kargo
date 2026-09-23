// Generates a decorative, NON-FUNCTIONAL GCash-style QR SVG for demo data.
// The module grid is pseudo-random noise (not a valid QR payload), so scanning
// it yields nothing — but it visually reads as a real GCash InstaPay QR.
// Output: scripts/out/maria-gcash-qr.svg
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, "out", "maria-gcash-qr.svg")
mkdirSync(dirname(outPath), { recursive: true })

// Deterministic PRNG so the image is stable across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(0x6a5c1a)

const MODULES = 33 // typical QR-ish density
const QUIET = 0 // no quiet border inside the QR box (card provides padding)
const CELL = 6 // px per module
const qrSize = MODULES * CELL // 198

// Which cells belong to a finder pattern (the 7x7 corner eyes)?
function inFinder(r, c) {
  const zones = [
    [0, 0],
    [0, MODULES - 7],
    [MODULES - 7, 0],
  ]
  for (const [fr, fc] of zones) {
    if (r >= fr && r < fr + 7 && c >= fc && c < fc + 7) return true
  }
  return false
}
function finderFill(r, c) {
  // Determine local coords within whichever finder this belongs to.
  const zones = [
    [0, 0],
    [0, MODULES - 7],
    [MODULES - 7, 0],
  ]
  for (const [fr, fc] of zones) {
    if (r >= fr && r < fr + 7 && c >= fc && c < fc + 7) {
      const lr = r - fr
      const lc = c - fc
      const onBorder = lr === 0 || lr === 6 || lc === 0 || lc === 6
      const inCore = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4
      return onBorder || inCore
    }
  }
  return false
}

let cells = ""
for (let r = 0; r < MODULES; r++) {
  for (let c = 0; c < MODULES; c++) {
    let filled
    if (inFinder(r, c)) filled = finderFill(r, c)
    else filled = rand() > 0.5
    if (filled) {
      const x = (QUIET + c) * CELL
      const y = (QUIET + r) * CELL
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}"/>`
    }
  }
}

// GCash card geometry.
const W = 324
const H = 620
const cardX = 26
const cardY = 118
const cardW = W - cardX * 2
const cardH = 360
const qrX = cardX + (cardW - qrSize) / 2
const qrY = cardY + 40

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GCash QR (sample)">
  <rect width="${W}" height="${H}" fill="#0056E0"/>
  <!-- GCash wordmark -->
  <g transform="translate(58,38)">
    <circle cx="20" cy="20" r="19" fill="none" stroke="#fff" stroke-width="5"/>
    <path d="M20 8 A12 12 0 1 0 32 20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <path d="M38 14 a10 10 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M44 9 a16 16 0 0 1 0 22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <text x="66" y="30" font-family="'Segoe UI',Arial,sans-serif" font-size="30" font-weight="700" fill="#fff">GCash</text>
  </g>
  <!-- White card -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="18" fill="#ffffff"/>
  <!-- QR modules -->
  <g transform="translate(${qrX},${qrY})" fill="#0a0a0a">
    ${cells}
  </g>
  <!-- InstaPay overlay logo (center) -->
  <g transform="translate(${W / 2},${qrY + qrSize / 2})">
    <rect x="-34" y="-15" width="68" height="30" rx="4" fill="#ffffff"/>
    <text x="0" y="-1" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="13" font-weight="800" fill="#1477D4">insta</text>
    <text x="0" y="12" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="13" font-weight="800" fill="#E11D48">Pay</text>
  </g>
  <!-- Caption + masked payee -->
  <text x="${W / 2}" y="${qrY + qrSize + 28}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="12" fill="#4B5563">Transfer fees may apply.</text>
  <text x="${W / 2}" y="${qrY + qrSize + 54}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="17" font-weight="800" fill="#0056E0">MA**A S.</text>
  <text x="${W / 2}" y="${qrY + qrSize + 76}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="12" fill="#9CA3AF">Mobile No.: 091\u2022 \u2022\u2022\u2022\u20221201</text>
  <text x="${W / 2}" y="${qrY + qrSize + 96}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="12" fill="#9CA3AF">User ID: \u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022KG204M</text>
  <!-- Faint SAMPLE watermark below the card so it's clearly not a live QR -->
  <text x="${W / 2}" y="${cardY + cardH + 28}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="10" letter-spacing="2" fill="#9FC0FF">SAMPLE \u2022 NOT FOR PAYMENT</text>
</svg>`

writeFileSync(outPath, svg, "utf8")
console.log("wrote", outPath, svg.length, "bytes")
