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
  return (
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
        <div className="kargo-brand-mark">
          <img
            src="/kargo-logo-head.png"
            alt="Kargo Logo Header"
            width="35"
            height="35"
            style={{ objectFit: "contain" }}
          />
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
      <div className="flex items-center gap-3 flex-shrink-0">
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
  )
}
