import type React from "react"
import { INDIGO } from "@/constants/theme"

export default function SecondaryBtn({
  children,
  onClick,
  style = {},
  size = "md",
  ariaLabel,
}: {
  children: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  style?: React.CSSProperties
  size?: "sm" | "md"
  ariaLabel?: string
}) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        background: "#fff",
        color: "#374151",
        border: "1px solid #D1D5DB",
        borderRadius: 7,
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        transition: "background 0.15s,transform 0.1s",
        ...style,
      }}
      className={`kargo-secondary font-semibold hover:bg-gray-50 bp ${
        size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-3 py-1.5 text-[12px]"
      }`}
    >
      {children}
    </button>
  )
}
