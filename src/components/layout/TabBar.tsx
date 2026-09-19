import type { Role, Tab } from "@/types"
import { INDIGO } from "@/constants/theme"
import { PrimaryBtn } from "@/components/shared"
import RoleToggle from "./RoleToggle"

export const TABS: Tab[] = ["Dashboard", "Batches", "My Claims", "Payments"]
export default function TabBar({
  active,
  setActive,
  role,
  setRole,
  onNewBatch,
}: {
  active: Tab
  setActive: (t: Tab) => void
  role: Role
  setRole: (r: Role) => void
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
      className="kargo-tabbar flex items-center sticky top-14"
    >
      {/* Tabs — equally distributed across available width */}
      <div style={{ display: "flex", flex: 1, height: "100%", minWidth: 0 }}>
        {TABS.map((tab) => (
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
              fontFamily: "'Plus Jakarta Sans',sans-serif",
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
          >
            {tab === "My Claims"
              ? role === "Seller"
                ? "Orders Received"
                : "My Claims"
              : tab}
          </button>
        ))}
      </div>
      {/* Right group — clear separation via border + padding */}
      <div
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
        <RoleToggle role={role} setRole={setRole} />
        {role === "Seller" && (
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
        )}
      </div>
    </div>
  )
}
