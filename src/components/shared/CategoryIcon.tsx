import { Banknote, Gem, Globe2, HandCoins, Shirt, ShoppingBasket, Smartphone, Sparkles, Utensils } from "lucide-react"

export default function CategoryIcon({
  category,
  size = 28,
  color = "currentColor",
}: {
  category: string
  size?: number
  color?: string
}) {
  const Icon = category === "Electronics"
    ? Smartphone
    : category === "Fashion"
      ? Shirt
      : category === "Luxury"
        ? Gem
        : category === "Skincare" || category === "Beauty"
          ? Sparkles
          : category === "Grocery & Snacks"
            ? ShoppingBasket
            : category === "Food & Beauty"
              ? Utensils
              : Globe2
  return <Icon size={size} color={color} strokeWidth={1.7} aria-label={`${category} category`} />
}
