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
    <div className="admin-filter-bar">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="admin-filter-control admin-filter-search"
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
      className="admin-filter-control"
    >
      {children}
    </select>
  )
}
