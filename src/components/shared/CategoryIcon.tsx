import {
  Gem,
  Globe2,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Utensils,
} from "lucide-react"

export default function CategoryIcon({
  category,

  size = 28,

  color = "currentColor",
}: {
  category: string

  size?: number

  color?: string
}) {
  const Icon =
    category === "Apparel" || category === "Fashion"
      ? Shirt
      : category === "Electronics"
        ? Smartphone
        : category === "Luxury"
          ? Gem
          : category === "Beauty" || category === "Skincare"
            ? Sparkles
            : category === "Grocery & Snacks"
              ? ShoppingBasket
              : category === "Food"
                ? Utensils
                : Globe2

  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={1.7}
      aria-label={`${category} category`}
    />
  )
}
