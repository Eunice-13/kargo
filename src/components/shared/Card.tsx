import type React from "react"

export default function Card({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        ...style,
      }}
      className={`kargo-card p-5 ${className}`}
    >
      {children}
    </div>
  )
}
