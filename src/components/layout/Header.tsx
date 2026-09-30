import { useState } from "react"
import type { UserInfo, Role, Tab, BatchType } from "@/types"

import { INDIGO } from "@/constants/theme"

import SearchBox from "./SearchBox"

import NotificationsMenu from "./NotificationsMenu"

import UserMenu from "./UserMenu"

export default function Header({
  user,

  onLogout,

  onSettings,

  onApplyToSell,

  role,

  batches,

  onNavigate,

  onBatchSelect,

  onSellerSelect,
}: {
  user: UserInfo

  onLogout: () => void

  onSettings: () => void

  onApplyToSell?: () => void

  role?: Role

  batches?: BatchType[]

  onNavigate?: (tab: Tab) => void

  onBatchSelect?: (id: number) => void

  onSellerSelect?: (name: string) => void
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  return (
    <>
    <header
      style={{
        background: "#fff",

        borderBottom: "1px solid #E5E7EB",

        height: 56,

        zIndex: 50,
      }}
      className="kargo-header seller-shell-header flex items-center px-6 gap-6 sticky top-0"
    >
      <div
        className="kargo-brand-lockup flex items-center gap-2 flex-shrink-0"
        style={{ width: 160 }}
      >
        <div className="kargo-brand-mark" style={{ color: "#fff" }}>
          <svg
            width="35"
            height="35"
            viewBox="0 0 42 42"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 23V11L21 3l13 8v12"
              stroke="currentColor"
              strokeWidth="2.4"
            />
            <path
              d="M21 8v3M16 14l5-3 5 3M13 19l8-4 8 4"
              stroke="currentColor"
              strokeWidth="2.4"
            />
            <path d="M10 24l11-3 11 3-3 9-8 3-8-3-3-9Z" fill="currentColor" />
            <path
              d="M4 36c7-2 11-1 17 1 6 1 11 1 17-1M7 40c6-1 9 0 14 1 5 0 9 0 14-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span
          className="kargo-brand-name"
          style={{
            fontFamily: "'Josefin Sans',sans-serif",
            color: INDIGO,

            fontWeight: 800,

            fontSize: 18,

            letterSpacing: -0.5,
          }}
        >
          KARGO
        </span>
      </div>
      <SearchBox
        batches={batches}
        onNavigate={onNavigate}
        onBatchSelect={onBatchSelect}
        onSellerSelect={onSellerSelect}
      />
      <div className="kargo-header-actions flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          className="kargo-mobile-search-toggle"
          aria-label={mobileSearchOpen ? "Close search" : "Open search"}
          aria-expanded={mobileSearchOpen}
          onClick={() => setMobileSearchOpen((open) => !open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <NotificationsMenu role={role} onNavigate={onNavigate} />
        <UserMenu
          user={user}
          onSettings={onSettings}
          onLogout={onLogout}
          onApplyToSell={onApplyToSell}
          displayLabel="User"
        />
      </div>
    </header>
    {mobileSearchOpen && (
      <div className="kargo-mobile-search-panel">
        <SearchBox
          batches={batches}
          onNavigate={(tab) => {
            onNavigate?.(tab)
            setMobileSearchOpen(false)
          }}
          onBatchSelect={(id) => {
            onBatchSelect?.(id)
            setMobileSearchOpen(false)
          }}
          onSellerSelect={(name) => {
            onSellerSelect?.(name)
            setMobileSearchOpen(false)
          }}
        />
      </div>
    )}
    </>
  )
}
