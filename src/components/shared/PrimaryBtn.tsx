import type React from "react"
import { INDIGO } from "@/constants/theme"

export default function PrimaryBtn({
  children,
  onClick,
  size = "md",
  style = {},
  loading = false,
  disabled = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  size?: "sm" | "md"
  style?: React.CSSProperties
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: disabled ? "#9CA3AF" : INDIGO,
        color: "#fff",
        borderRadius: 7,
        fontFamily: "'Plus Jakarta Sans',sans-serif",
        transition: "opacity 0.15s,transform 0.1s",
        ...style,
      }}
      className={`kargo-primary font-semibold hover:opacity-90 bp ${
        size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]"
      } ${loading ? "lsh" : ""}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="3"
            />
            <path
              d="M12 2a10 10 0 0110 10"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
