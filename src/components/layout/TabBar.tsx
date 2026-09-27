import type { Role, Tab } from "@/types"
import { INDIGO } from "@/constants/theme"
import { PrimaryBtn } from "@/components/shared"
import { ClipboardList, History, LayoutGrid, Package } from "lucide-react"

export const TABS: Tab[] = ["Dashboard", "Batches", "My Claims", "Payments"]
export const SELLER_TABS: Tab[] = ["Dashboard", "My Claims", "Batches", "Payments"]
const SELLER_TAB_ICONS = [LayoutGrid, Package, ClipboardList, History] as const
const TAB_ICONS = {
  Dashboard: LayoutGrid,
  Batches: Package,
  "My Claims": ClipboardList,
  Payments: History,
} as const
export default function TabBar({
  active,
  setActive,
  role,
  onNewBatch,
}: {
  active: Tab
  setActive: (t: Tab) => void
  role: Role
  onNewBatch: () => void
}) {
  const tabs = role === "Seller" ? SELLER_TABS : TABS
  return (
    <div
      style={{
        background: "#fff",
        borderBottom: "1px solid #E5E7EB",
        zIndex: 40,
        height: 44,
      }}
      className={`kargo-tabbar flex items-center ${
        role === "Seller"
          ? "seller-tabbar"
          : "sticky top-14"
      }`}
    >
      {/* Tabs — equally distributed across available width */}
      <div style={{ display: "flex", flex: 1, height: "100%", minWidth: 0 }}>
        {tabs.map((tab, index) => {
          const Icon = role === "Seller"
            ? SELLER_TAB_ICONS[index]
            : TAB_ICONS[tab as keyof typeof TAB_ICONS]
          const visuallyActive = active === tab
          return (
          <button
            key={tab}
            data-seller-active={visuallyActive ? "true" : undefined}
            data-spotlight={
              tab === "Dashboard"
                ? "dashboard-tab"
                : tab === "Batches"
                  ? "batches-tab"
                  : tab === "Payments"
                    ? "payments-tab"
                    : undefined
            }
            onClick={() => setActive(tab)}
            aria-current={active === tab ? "page" : undefined}
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              color: visuallyActive ? INDIGO : "#6B7280",
              fontWeight: visuallyActive ? 700 : 500,
              fontSize: 13,
              borderBottom:
                visuallyActive
                  ? `2px solid ${INDIGO}`
                  : "2px solid transparent",
              height: 44,
              flex: 1,
              paddingLeft: 4,
              paddingRight: 4,
              borderRadius: 0,
              background: "transparent",
              transition: "color 0.15s,border-color 0.15s",
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            className="hover:text-gray-800"
            aria-label={
              role === "Seller"
                ? tab === "My Claims"
                  ? "Orders Received"
                  : tab === "Batches"
                    ? "My Batches"
                    : tab
                : tab
            }
          >
            {role === "Seller" ? (
              <Icon size={25} strokeWidth={2.2} aria-hidden="true" />
            ) : tab === "My Claims"
              ? "My Claims"
              : tab}
          </button>
          )
        })}
        </div>
    </div>
  )
}