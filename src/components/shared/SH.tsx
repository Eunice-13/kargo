import type React from "react"

export default function SH({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2
        style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          color: "#111827",
        }}
        className="text-[15px] font-bold"
      >
        {title}
      </h2>
      {action}
    </div>
  )
}
