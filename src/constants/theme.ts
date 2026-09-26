import type { ClaimStatus } from "@/types"

// ─── Palette ──────────────────────────────────────────────────────────────────
export const RETRO_THEME = false
export const INDIGO = RETRO_THEME ? "#A84D38" : "#191BA9"
export const CREAM = RETRO_THEME ? "#FBF4E3" : "#F7F3F3"
export const CYAN_L = RETRO_THEME ? "#DDE9E0" : "#DEF3FA"
export const SKY = RETRO_THEME ? "#5B817A" : "#5CC2F2"
export const CORAL = RETRO_THEME ? "#D7982F" : "#FF8A65"
export const GREEN = RETRO_THEME ? "#507A69" : "#3FBF8F"
export const AMBER = RETRO_THEME ? "#D59B2C" : "#FFC24B"

export const TODAY = "Sep 10, 2026"

// ─── Buyer dashboard mockup palette (Buyer_-_Dashboard.png / Kargo 2.0 Figma) ─
// Values marked "confirmed" came from the Figma design spec; values marked
// [VERIFY] are estimated from the reference screenshot and should be
// reconciled against the Figma file (file key gogP2hBUGuDncq5X72GBYP) once the
// Figma MCP server is connected.

// Header + footer gradient (confirmed): deep indigo-violet -> mid periwinkle.
export const BUYER_GRADIENT = "linear-gradient(to right, #1B1EAA, #6690D4)"
export const BUYER_GRADIENT_DARK = "#1B1EAA" // confirmed dark stop (accent/buttons candidate)
export const BUYER_GRADIENT_LIGHT = "#6690D4" // confirmed light stop

// Recent Claims table header fill (confirmed): solid, white text on top.
export const TABLE_HEADER_BLUE = "#6892D5"
// Upcoming Deadlines sidebar panel fill (confirmed): pale lavender-blue.
export const SIDEBAR_PANEL = "#C7D8F4"

// Stat card muted boxes + bright accents. Accent is used ONLY for the icon
// glyph, subtext, and (cards 2-3) the leading dot — never the box fill. [VERIFY]
export const STAT_GREEN_BG = "#C9F2DE" // [VERIFY] Active Claims box (pale mint)
export const STAT_GREEN_FG = "#0B9E6E" // [VERIFY] Active Claims accent (green)
export const STAT_AMBER_BG = "#FBEFC6" // [VERIFY] Pending Payment box (pale cream)
export const STAT_AMBER_FG = "#C08A1E" // [VERIFY] Pending Payment accent (amber)
export const STAT_CORAL_BG = "#FBD9DE" // [VERIFY] Waitlist box (soft coral-pink)
export const STAT_CORAL_FG = "#E62B48" // [VERIFY] Waitlist accent (red-coral)
export const STAT_NEUTRAL_BG = "#F1F2F4" // [VERIFY] Completed Orders box (near-white)
export const STAT_NEUTRAL_FG = "#8B95A1" // [VERIFY] Completed Orders accent (muted gray)

// Bright saturated top-edge strip on each stat card (the vivid band above the
// muted box in the reference). Brighter/more saturated than the *_FG accents,
// which are used for text. [VERIFY] exact hues against Figma.
export const STAT_GREEN_EDGE = "#5FD39A" // Active Claims (bright green)
export const STAT_AMBER_EDGE = "#F5D64E" // Pending Payment (bright yellow)
export const STAT_CORAL_EDGE = "#E23B4E" // Waitlist Position (bright red)
export const STAT_NEUTRAL_EDGE = "#D8DBE0" // Completed Orders (light gray)

// Neutrals / text [VERIFY]
export const INK = "#161B22" // headings + large numbers
export const INK_BODY = "#2B3440" // body / table values
export const INK_META = "#8B95A1" // secondary / meta labels
export const CANVAS = "#F4F6F9" // page background (cool light gray)
export const ROW_STRIPE = "#F7F8FA" // table zebra alt row

// Circular search button (confirmed distinct teal, exact hex [VERIFY]).
export const SEARCH_TEAL = "#3FC5E0"

// ─── Category gradients ───────────────────────────────────────────────────────
export const CAT_GRAD: Record<string, string> = RETRO_THEME
  ? {
      "Food & Beauty": "linear-gradient(135deg,#D9A05A 0%,#B6533D 100%)",
      Skincare: "linear-gradient(135deg,#A8C4B4 0%,#DCE4D1 100%)",
      "Grocery & Snacks": "linear-gradient(135deg,#D9A05A 0%,#F1D58B 100%)",
      Beauty: "linear-gradient(135deg,#C98368 0%,#E4C19B 100%)",
      Electronics: "linear-gradient(135deg,#718F89 0%,#DDE9E0 100%)",
      Fashion: "linear-gradient(135deg,#D6B56E 0%,#F1E4C7 100%)",
      Mixed: "linear-gradient(135deg,#7DA294 0%,#DCE9DF 100%)",
      Luxury: "linear-gradient(135deg,#A84D38 0%,#D9A05A 100%)",
    }
  : {
      "Food & Beauty": "linear-gradient(135deg,#FFD9B3 0%,#FFBCB3 100%)",
      Skincare: "linear-gradient(135deg,#B3EDE8 0%,#B3D9F7 100%)",
      "Grocery & Snacks": "linear-gradient(135deg,#FFF7C0 0%,#FFE8B3 100%)",
      Beauty: "linear-gradient(135deg,#E8D3F7 0%,#F7D3E8 100%)",
      Electronics: "linear-gradient(135deg,#D3D9F7 0%,#D3EDF7 100%)",
      Fashion: "linear-gradient(135deg,#F7F0C0 0%,#F7DFB3 100%)",
      Mixed: "linear-gradient(135deg,#C0F7D9 0%,#C0EFF7 100%)",
      Luxury: "linear-gradient(135deg,#F7E8D3 0%,#F7D3D3 100%)",
    }

// ─── Status colours ───────────────────────────────────────────────────────────
export const STATUS_C: Record<ClaimStatus, { bg: string; text: string; dot: string }> = {
  Pending: { bg: "#FEF3C7", text: "#92400E", dot: AMBER },
  "Paid and Reserved": { bg: "#D4F5EA", text: "#0B7A59", dot: GREEN },
  Expired: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  Cancelled: { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  "Insufficient Payment": { bg: "#FFF7ED", text: "#92400E", dot: "#FCD34D" },
}
