import { useState, useEffect, useRef, lazy, Suspense } from "react"
import type { Tab, SharedState } from "@/types"
import { TABS } from "./TabBar"
import { Dashboard } from "@/features/dashboard"
import { Batches } from "@/features/batches"
import { MyClaims } from "@/features/claims"
import { Payments } from "@/features/payments"
import { Orders } from "@/features/orders"

// G18: Settings is a secondary destination reached from the profile menu, not
// part of the primary buy/pay flow. Code-split it so it is fetched only when a
// user actually opens it, trimming the initial (mobile) bundle. The named
// export is adapted to the default shape React.lazy expects.
const Settings = lazy(() =>
  import("@/features/settings").then((m) => ({ default: m.Settings })),
)

function TabFallback() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontSize: 13 }}>
      Loading…
    </div>
  )
}

export default function TabContent({ tab, shared }: { tab: Tab; shared: SharedState }) {
  const [displayed, setDisplayed] = useState(tab)
  const [animClass, setAnimClass] = useState("fi")
  const prev = useRef(tab)

  useEffect(() => {
    if (tab !== prev.current) {
      setAnimClass(TABS.indexOf(tab) > TABS.indexOf(prev.current) ? "pl" : "pr")
      setDisplayed(tab)
      prev.current = tab
    }
  }, [tab])

  const map: Record<Tab, React.ReactNode> = {
    Dashboard: <Dashboard {...shared} />,
    Batches: <Batches {...shared} />,
    "My Claims": <MyClaims {...shared} />,
    Payments: <Payments {...shared} />,
    Orders: <Orders {...shared} />,
    Settings: <Settings {...shared} />,
  }
  return (
    <div key={displayed} className={animClass}>
      <Suspense fallback={<TabFallback />}>{map[displayed]}</Suspense>
    </div>
  )
}
