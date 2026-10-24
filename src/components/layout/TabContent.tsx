import { useState, useEffect, useRef } from "react"
import type { Tab, SharedState } from "@/types"
import { navIntent, subscribeNavIntent } from "@/state/navIntent"
import { tabsForRole } from "./TabBar"
import { Dashboard } from "@/features/dashboard"
import { Batches } from "@/features/batches"
import { MyClaims } from "@/features/claims"
import { Payments } from "@/features/payments"
import { Orders } from "@/features/orders"
import { NotificationsPage } from "@/features/notifications"
import { Settings } from "@/features/settings"
import {
  AdminDashboard,
  AdminUsers,
  AdminBatches,
  AdminTransactions,
  AdminSettings,
} from "@/features/admin"

export default function TabContent({
  tab,
  shared,
  onNewBatch,
}: {
  tab: Tab
  shared: SharedState
  onNewBatch: () => void
}) {
  const [displayed, setDisplayed] = useState(tab)
  const [animClass, setAnimClass] = useState("fi")
  const prev = useRef(tab)
  useEffect(() => subscribeNavIntent(() => {
    if (navIntent.openAddressSettings) shared.setTab("Settings")
  }), [shared.setTab])
  const isAdmin = shared.role === "Admin"
  const tabOrder = tabsForRole(shared.role)

  useEffect(() => {
    if (tab !== prev.current) {
      setAnimClass(tabOrder.indexOf(tab) > tabOrder.indexOf(prev.current) ? "pl" : "pr")
      setDisplayed(tab)
      prev.current = tab
    }
  }, [tab, tabOrder])

  // Admin and buyer/seller share some tab names (Dashboard, Batches, Settings).
  // Branch on role so the admin console never renders buyer/seller screens and
  // vice versa. Non-admin rendering is unchanged.
  const map: Record<Tab, React.ReactNode> = {
    Dashboard: isAdmin ? <AdminDashboard {...shared} /> : <Dashboard {...shared} />,
    Batches: isAdmin ? <AdminBatches /> : <Batches {...shared} onNewBatch={onNewBatch} />,
    "My Claims": <MyClaims {...shared} />,
    Payments: <Payments {...shared} />,
    Orders: <Orders {...shared} />,
    Settings: isAdmin ? <AdminSettings /> : <Settings {...shared} />,
    Notifications: <NotificationsPage onNavigate={shared.setTab} />,
    Users: <AdminUsers />,
    Transactions: <AdminTransactions />,
  }
  return (
    <div key={displayed} className={animClass}>
      {map[displayed]}
    </div>
  )
}
