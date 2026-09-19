import { useState } from "react"
import type {
  AppStage,
  UserInfo,
  Tab,
  Role,
  ClaimRow,
  ToPayRow,
  PayHistRow,
  OrderRow,
  ReportRow,
  BatchType,
  FulfillmentOrder,
  SharedState,
} from "@/types"
import { CREAM } from "@/constants/theme"
import { navIntent } from "@/state/navIntent"
import { BATCHES_INIT } from "@/data/batches"
import { CLAIMS_INIT } from "@/data/claims"
import { TOPAY_INIT } from "@/data/toPay"
import { PAYHIST_INIT } from "@/data/payHistory"
import { ORDERS_INIT } from "@/data/orders"
import { REPORTS_INIT } from "@/data/reports"
import { FULFILLMENT_INIT } from "@/features/fulfillment"
import { Login, SignUp, Onboarding } from "@/features/auth"
import { NewBatchModal } from "@/features/batches"
import { Header, TabBar, TabContent } from "@/components/layout"

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const originalPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "original"
  const [stage, setStage] = useState<AppStage>(originalPreview ? "app" : "signup")
  const [showOnboarding, setOnboard] = useState(false)
  const [tab, setTab] = useState<Tab>("Dashboard")
  const [user, setUser] = useState<UserInfo>({
    name: originalPreview ? "Alex Jordan" : "",
    email: originalPreview ? "alex@kargo.demo" : "",
    role: "Buyer",
  })
  const [role, setRole] = useState<Role>("Buyer")
  const [showNewBatch, setShowNewBatch] = useState(false)

  // Shared mutable data
  const [claims, setClaims] = useState<ClaimRow[]>(CLAIMS_INIT)
  const [toPay, setToPay] = useState<ToPayRow[]>(TOPAY_INIT)
  const [payHistory, setPayHistory] = useState<PayHistRow[]>(PAYHIST_INIT)
  const [orders, setOrders] = useState<OrderRow[]>(ORDERS_INIT)
  const [reports, setReports] = useState<ReportRow[]>(REPORTS_INIT)
  const [batches, setBatches] = useState<BatchType[]>(BATCHES_INIT)
  const [fulfillment, setFulfillment] =
    useState<FulfillmentOrder[]>(FULFILLMENT_INIT)

  const shared: SharedState = {
    claims,
    setClaims,
    toPay,
    setToPay,
    payHistory,
    setPayHistory,
    orders,
    setOrders,
    reports,
    setReports,
    batches,
    setBatches,
    fulfillment,
    setFulfillment,
    user,
    setUser,
    setTab,
    role,
  }

  const handleSignupSuccess = (u: UserInfo) => {
    setUser(u)
    setRole(u.role)
    setStage("app")
    setOnboard(true)
  }
  const handleLoginSuccess = (u: UserInfo) => {
    setUser(u)
    setRole(u.role)
    setStage("app")
  }

  return (
    <>
      {stage === "signup" && (
        <div className="pu">
          <SignUp
            onLogin={() => setStage("login")}
            onSuccess={handleSignupSuccess}
          />
        </div>
      )}
      {stage === "login" && (
        <div className="pl">
          <Login
            onSignUp={() => setStage("signup")}
            onSuccess={handleLoginSuccess}
          />
        </div>
      )}
      {stage === "app" && (
        <div
          className="pu kargo-original-app"
          style={{
            background: CREAM,
            minHeight: "100vh",
            fontFamily: "'Inter',sans-serif",
          }}
        >
          <Header
            user={user}
            onLogout={() => setStage("login")}
            onSettings={() => setTab("Settings")}
            role={role}
            batches={batches}
            onNavigate={setTab}
            onBatchSelect={(id) => {
              navIntent.batchId = id
              setTab("Batches")
            }}
            onSellerSelect={(name) => {
              navIntent.sellerName = name
              setTab("Batches")
            }}
          />
          <TabBar
            active={tab}
            setActive={setTab}
            role={role}
            setRole={(r) => {
              setRole(r)
            }}
            onNewBatch={() => setShowNewBatch(true)}
          />
          <main style={{ minHeight: "calc(100vh - 100px)" }}>
            <TabContent tab={tab} shared={shared} />
          </main>
          {showOnboarding && <Onboarding onDone={() => setOnboard(false)} />}
          {showNewBatch && (
            <NewBatchModal
              onCreate={(b) => setBatches((prev) => [b, ...prev])}
              onClose={() => setShowNewBatch(false)}
              sellerName={user.name}
            />
          )}
        </div>
      )}
    </>
  )
}
