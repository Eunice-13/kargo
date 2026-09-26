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
      "Food": "linear-gradient(135deg,#D9A05A 0%,#B6533D 100%)",

      Beauty: "linear-gradient(135deg,#C98368 0%,#E4C19B 100%)",

      Luxury: "linear-gradient(135deg,#A84D38 0%,#D9A05A 100%)",
      Apparel: "linear-gradient(135deg,#8C6E63 0%,#D9C2A5 100%)",
      Others: "linear-gradient(135deg,#7DA294 0%,#DCE9DF 100%)",

      // Legacy fallbacks (data remapped, kept for safety)
      Skincare: "linear-gradient(135deg,#A8C4B4 0%,#DCE4D1 100%)",
      "Grocery & Snacks": "linear-gradient(135deg,#D9A05A 0%,#F1D58B 100%)",
      Mixed: "linear-gradient(135deg,#7DA294 0%,#DCE9DF 100%)",
    }
  : {
      "Food": "linear-gradient(135deg,#FFD9B3 0%,#FFBCB3 100%)",

      Beauty: "linear-gradient(135deg,#E8D3F7 0%,#F7D3E8 100%)",

      Luxury: "linear-gradient(135deg,#F7E8D3 0%,#F7D3D3 100%)",
      Apparel: "linear-gradient(135deg,#D9C7F7 0%,#C0D0F7 100%)",
      Others: "linear-gradient(135deg,#C0F7D9 0%,#C0EFF7 100%)",

      // Legacy fallbacks (data remapped, kept for safety)
      Skincare: "linear-gradient(135deg,#B3EDE8 0%,#B3D9F7 100%)",
      "Grocery & Snacks": "linear-gradient(135deg,#FFF7C0 0%,#FFE8B3 100%)",
      Mixed: "linear-gradient(135deg,#C0F7D9 0%,#C0EFF7 100%)",
    }

// ─── Category cover photos ────────────────────────────────────────────────────

// Default cover photo per category, mirroring how ProductThumb maps names to
// images. Used as the fallback banner for any batch whose seller didn't upload
// a custom cover, so the Home card and the batch detail hero both show a real
// photo instead of a flat gradient.
export const CATEGORY_COVER: Record<string, string> = {
  Food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop&auto=format",

  Beauty: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&h=400&fit=crop&auto=format",

  Luxury: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=400&fit=crop&auto=format",

  Apparel: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&h=400&fit=crop&auto=format",

  Others: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&h=400&fit=crop&auto=format",

  // Legacy fallbacks (data remapped, kept for safety)
  Skincare: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&h=400&fit=crop&auto=format",

  "Grocery & Snacks": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=400&fit=crop&auto=format",

  Electronics: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&h=400&fit=crop&auto=format",

  Fashion: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&h=400&fit=crop&auto=format",

  Mixed: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&h=400&fit=crop&auto=format",
}

// Resolve a batch's banner image: the seller's uploaded cover if present,
// otherwise the category default. Always returns a usable image URL.
export function batchCoverSrc(coverImage: string | undefined, category: string): string {
  if (coverImage && coverImage.trim()) return coverImage
  return CATEGORY_COVER[category] || CATEGORY_COVER["Others"]
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
