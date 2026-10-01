import { LockKeyhole } from "lucide-react"
import { Modal, PrimaryBtn } from "@/components/shared"
import { useState, useEffect, useRef, useCallback } from "react"
import type { Tab, SharedState } from "@/types"
import { TABS } from "./TabBar"
import { Dashboard } from "@/features/dashboard"
import { Batches } from "@/features/batches"
import { MyClaims } from "@/features/claims"
import { Payments } from "@/features/payments"
import { Orders } from "@/features/orders"
import { Settings } from "@/features/settings"

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
  const [showSellerNotice, setShowSellerNotice] = useState(false)
  const showBatchAccessDenied = useCallback(() => setShowSellerNotice(true), [])
  const prev = useRef(tab)
  const tabOrder = TABS

  useEffect(() => {
    if (tab !== prev.current) {
      setAnimClass(tabOrder.indexOf(tab) > tabOrder.indexOf(prev.current) ? "pl" : "pr")
      setDisplayed(tab)
      prev.current = tab
    }
  }, [tab, tabOrder])

  const map: Record<Tab, React.ReactNode> = {
    Dashboard: <Dashboard {...shared} />,
    Batches: <Batches {...shared} onNewBatch={onNewBatch} onBatchAccessDenied={showBatchAccessDenied} />,
    "My Claims": <MyClaims {...shared} />,
    Payments: <Payments {...shared} />,
    Orders: <Orders {...shared} />,
    Settings: <Settings {...shared} />,
  }
  return (
    <>
      <div key={displayed} className={animClass}>
        {map[displayed]}
      </div>
      {showSellerNotice && displayed === "Dashboard" && (
        <Modal title="You're signed in as a seller" onClose={() => setShowSellerNotice(false)} width={440}>
          <div className="space-y-5">
            <div className="flex items-start gap-4 rounded-xl bg-indigo-50 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-indigo-700">
                <LockKeyhole size={22} aria-hidden="true" />
              </div>
              <p className="text-sm leading-relaxed text-slate-700">
                You can’t open another seller’s batch while signed in as a seller.
                You can manage your own batches, or sign in with a buyer account to claim items. HAHAHAH
              </p>
            </div>
            <p className="text-xs text-slate-500">We’ve brought you back to your Dashboard.</p>
            <PrimaryBtn onClick={() => setShowSellerNotice(false)} style={{ width: "100%", justifyContent: "center" }}>
              Got it
            </PrimaryBtn>
          </div>
        </Modal>
      )}
    </>
  )
}
