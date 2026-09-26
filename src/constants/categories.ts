export const BATCH_CATEGORIES = [
  "Food",
  "Beauty",
  "Luxury",
  "Apparel",
  "Others",
] as const

export type BatchCategory = typeof BATCH_CATEGORIES[number]

// Cover art per active category. Legacy keys (Skincare, Grocery & Snacks,
// Mixed) are intentionally kept as fallbacks so any not-yet-migrated data still
// resolves to a sensible image instead of the "Others" default.
export const CATEGORY_IMAGES: Record<string, string> = {
  Food: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&h=700&fit=crop&auto=format",
  Beauty:
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=900&h=700&fit=crop&auto=format",
  Luxury:
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=900&h=700&fit=crop&auto=format",
  Apparel:
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=900&h=700&fit=crop&auto=format",
  Others:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=700&fit=crop&auto=format",
  // ── Legacy fallbacks (remapped in data, kept for safety) ──
  Skincare:
    "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=900&h=700&fit=crop&auto=format",
  "Grocery & Snacks":
    "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=900&h=700&fit=crop&auto=format",
  Mixed:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=700&fit=crop&auto=format",
}

const BATCH_IMAGE_VARIANTS = [
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&h=700&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=900&h=700&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&h=700&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=900&h=700&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&h=700&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=700&fit=crop&auto=format",
] as const

export function categoryImage(category: string) {
  return CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES.Others
}

export function batchImage(category: string, id: string | number) {
  const categoryIndex = Math.max(
    0,
    BATCH_CATEGORIES.indexOf(category as BatchCategory),
  )
  const numericId =
    typeof id === "number"
      ? id
      : [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return BATCH_IMAGE_VARIANTS[
    (categoryIndex + numericId) % BATCH_IMAGE_VARIANTS.length
  ]
}
