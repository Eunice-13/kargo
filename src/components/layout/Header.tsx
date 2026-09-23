import type { UserInfo, Role, Tab, BatchType } from "@/types"
import { BarChart3 } from "lucide-react"
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
      <div className="kargo-brand-lockup flex items-center gap-2 flex-shrink-0" style={{ width: 160 }}>
        <div
          className="kargo-brand-mark"
          style={{
            background: INDIGO,
            width: 32,
            height: 32,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <BarChart3 size={17} color="#fff" strokeWidth={2.2} aria-hidden="true" />
        </div>
        <span
          className="kargo-brand-name"
          style={{
            color: INDIGO,
            fontFamily: "'Manrope',sans-serif",
            fontWeight: 800,
            fontSize: 18,
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
