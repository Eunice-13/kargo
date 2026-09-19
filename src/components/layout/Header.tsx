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
      className="kargo-header flex items-center px-6 gap-6 sticky top-0"
    >
      <div
        className="kargo-brand-lockup flex items-center gap-2 flex-shrink-0"
        style={{ width: 160 }}
      >
        <div
          className="kargo-brand-mark"
          style={{
            background: INDIGO,
            width: 28,
            height: 28,
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h12M2 8h8M2 12h10"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span
          className="kargo-brand-name"
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            color: INDIGO,
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: -0.5,
          }}
        >
          Kargo
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
        />
      </div>
    </header>
  )
}
