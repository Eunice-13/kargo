import { useState, useEffect, useRef } from "react"
import type { Tab, SharedState } from "@/types"
import { TABS } from "./TabBar"
import { Dashboard } from "@/features/dashboard"
import { Batches } from "@/features/batches"
import { MyClaims } from "@/features/claims"
import { Payments } from "@/features/payments"
import { Orders } from "@/features/orders"
import { Settings } from "@/features/settings"

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
      {map[displayed]}
    </div>
  )
}

