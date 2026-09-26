import type { Role, Tab } from "@/types"
import { INDIGO } from "@/constants/theme"
import { PrimaryBtn } from "@/components/shared"
import { ClipboardList, History, LayoutGrid, Package } from "lucide-react"

export const TABS: Tab[] = ["Dashboard", "Batches", "My Claims", "Payments"]
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
        {TABS.map((tab) => {
          const Icon = TAB_ICONS[tab as keyof typeof TAB_ICONS]
          return (
          <button
            key={tab}
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
              fontFamily: "'Josefin Sans',sans-serif",
              color: active === tab ? INDIGO : "#6B7280",
              fontWeight: active === tab ? 700 : 500,
              fontSize: 13,
              borderBottom:
                active === tab
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
            aria-label={tab === "My Claims" && role === "Seller" ? "Orders Received" : tab}
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
      {/* Right group — only shown for verified sellers (New Batch) */}
      {role === "Seller" && (
        <div
          className="seller-new-batch"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingLeft: 24,
            paddingRight: 20,
            borderLeft: "1px solid #E5E7EB",
            height: "100%",
            flexShrink: 0,
          }}
        >
          <PrimaryBtn
            size="sm"
            onClick={onNewBatch}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1v10M1 6h10"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            New Batch
          </PrimaryBtn>
        </div>
      )}
    </div>
  )
}
