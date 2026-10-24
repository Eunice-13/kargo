import type { ReactNode } from "react"

// Search input + select filters that wrap on mobile. Selects are passed as
// children so each tab composes its own set.
export default function AdminFilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  children,
}: {
  search: string
  onSearch: (value: string) => void
  searchPlaceholder?: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 14,
        alignItems: "center",
      }}
    >
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        style={{
          flex: "1 1 220px",
          minWidth: 0,
          minHeight: 40,
          padding: "8px 12px",
          border: "1px solid #E5E7EB",
          borderRadius: 7,
          fontSize: 13,
        }}
      />
      {children}
    </div>
  )
}

// Shared select styling helper so every admin filter select matches.
export function AdminSelect({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={{
        minHeight: 40,
        padding: "8px 10px",
        border: "1px solid #E5E7EB",
        borderRadius: 7,
        fontSize: 13,
        background: "#fff",
        color: "#374151",
      }}
    >
      {children}
    </select>
  )
}
