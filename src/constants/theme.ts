import type { PaymentHistoryStatus } from "@/types"

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

// ─── Category gradients ───────────────────────────────────────────────────────

export const CAT_GRAD: Record<string, string> = RETRO_THEME
  ? {
      Food: "linear-gradient(135deg,#D9A05A 0%,#B6533D 100%)",

      Skincare: "linear-gradient(135deg,#A8C4B4 0%,#DCE4D1 100%)",

      "Grocery & Snacks": "linear-gradient(135deg,#D9A05A 0%,#F1D58B 100%)",

      Beauty: "linear-gradient(135deg,#C98368 0%,#E4C19B 100%)",

      Mixed: "linear-gradient(135deg,#7DA294 0%,#DCE9DF 100%)",
      Luxury: "linear-gradient(135deg,#A84D38 0%,#D9A05A 100%)",
    }
  : {
      Food: "linear-gradient(135deg,#FFD9B3 0%,#FFBCB3 100%)",

      Skincare: "linear-gradient(135deg,#B3EDE8 0%,#B3D9F7 100%)",

      "Grocery & Snacks": "linear-gradient(135deg,#FFF7C0 0%,#FFE8B3 100%)",

      Beauty: "linear-gradient(135deg,#E8D3F7 0%,#F7D3E8 100%)",

      Mixed: "linear-gradient(135deg,#C0F7D9 0%,#C0EFF7 100%)",
      Luxury: "linear-gradient(135deg,#F7E8D3 0%,#F7D3D3 100%)",
    }

// ─── Status colours ───────────────────────────────────────────────────────────

export const STATUS_C: Record<PaymentHistoryStatus, {
  bg: string
  text: string
  dot: string
}> = {
  Pending: { bg: "#FEF3C7", text: "#92400E", dot: AMBER },

  "Paid and Reserved": { bg: "#D4F5EA", text: "#0B7A59", dot: GREEN },

  Expired: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },

  Cancelled: { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },

  "Insufficient Payment": { bg: "#FFF7ED", text: "#92400E", dot: "#FCD34D" },
  Rejected: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
}
