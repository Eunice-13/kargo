import { useCallback, useEffect, useState } from "react"
import type {
  AppStage,
  UserInfo,
  Tab,
  Role,
  ClaimRow,
  ToPayRow,
  PayHistRow,
  OrderRow,
  BatchType,
  FulfillmentOrder,
  WaitlistEntry,
  SharedState,
} from "@/types"
import { CREAM } from "@/constants/theme"
import { navIntent } from "@/state/navIntent"
import { BATCHES_INIT } from "@/data/batches"
import { CLAIMS_INIT } from "@/data/claims"
import { TOPAY_INIT } from "@/data/toPay"
import { PAYHIST_INIT } from "@/data/payHistory"
import { ORDERS_INIT } from "@/data/orders"
import { WAITLIST_INIT } from "@/data/waitlist"
import { FULFILLMENT_INIT } from "@/features/fulfillment"
import { Login, SignUp, Onboarding, ApplyToSellModal } from "@/features/auth"
import { NewBatchModal } from "@/features/batches"
import { Header, TabBar, TabContent } from "@/components/layout"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { kargoApi } from "@/services"

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const originalPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "original"
  const [stage, setStage] = useState<AppStage>(originalPreview ? "app" : "login")
  const [booting, setBooting] = useState(isSupabaseConfigured && !originalPreview)
  const [showOnboarding, setOnboard] = useState(false)
  const [tab, setTab] = useState<Tab>("Dashboard")
  const [user, setUser] = useState<UserInfo>({
    name: originalPreview ? "Alex Jordan" : "",
    email: originalPreview ? "alex@kargo.demo" : "",
    role: "Buyer",
    sellerEnabled: originalPreview,
    bio: originalPreview ? "Curated pasabuy finds with careful packing and clear trip updates." : "",
    socialLinks: originalPreview ? { Facebook: "https://facebook.com/alex.jordan", Instagram: "https://instagram.com/alexjordan" } : {},
    // The "original" preview retains seller access so the seller screens remain
    // viewable; real accounts start with no verified badge.
    birState: originalPreview ? "Verified" : "None",
  })
  const [showNewBatch, setShowNewBatch] = useState(false)
  const [showApplyToSell, setShowApplyToSell] = useState(false)

  // Workspace access is independent from the optional BIR trust badge.
  const role: Role = user.role === "Seller" && user.sellerEnabled ? "Seller" : "Buyer"

  // Shared mutable data
  const useSeeds = originalPreview || !isSupabaseConfigured
  const [claims, setClaims] = useState<ClaimRow[]>(useSeeds ? CLAIMS_INIT : [])
  const [toPay, setToPay] = useState<ToPayRow[]>(useSeeds ? TOPAY_INIT : [])
  const [payHistory, setPayHistory] = useState<PayHistRow[]>(useSeeds ? PAYHIST_INIT : [])
  const [orders, setOrders] = useState<OrderRow[]>(useSeeds ? ORDERS_INIT : [])
  const [batches, setBatches] = useState<BatchType[]>(useSeeds ? BATCHES_INIT : [])
  const [fulfillment, setFulfillment] =
    useState<FulfillmentOrder[]>(useSeeds ? FULFILLMENT_INIT : [])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(useSeeds ? WAITLIST_INIT : [])

  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const data = await kargoApi.loadCurrentAppData()
    if (!data) {
      setStage("login")
      return
    }
    setUser(data.user)
    setBatches(data.batches)
    setClaims(data.claims)
    setToPay(data.toPay)
    setPayHistory(data.payHistory)
    setOrders(data.orders)
    setFulfillment(data.fulfillment)
    setWaitlist(data.waitlist)
    setStage("app")
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || originalPreview || !supabase) return
    refreshData().finally(() => setBooting(false))
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setStage("login")
    })
    return () => data.subscription.unsubscribe()
  }, [originalPreview, refreshData])

  const shared: SharedState = {
    claims,
    setClaims,
    toPay,
    setToPay,
    payHistory,
    setPayHistory,
    orders,
    setOrders,
    batches,
    setBatches,
    fulfillment,
    setFulfillment,
    waitlist,
    setWaitlist,
    user,
    setUser,
    setTab,
    role,
  }

  const handleSignupSuccess = (u: UserInfo) => {
    setUser(u)
    setStage("app")
    setOnboard(true)
  }
  const handleLoginSuccess = (u: UserInfo) => {
    setUser(u)
    setStage("app")
    if (isSupabaseConfigured) refreshData()
  }

  if (booting) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: CREAM }}>Loading KARGO…</div>
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
            onLogout={() => {
              if (isSupabaseConfigured) void kargoApi.signOut()
              setStage("login")
            }}
            onSettings={() => setTab("Settings")}
            onApplyToSell={() => setShowApplyToSell(true)}
            role={role}
            sellerEnabled={Boolean(user.sellerEnabled)}
            onRoleChange={(nextRole) => {
              setUser((current) => ({ ...current, role: nextRole }))
              setTab("Dashboard")
            }}
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
          {showApplyToSell && (
            <ApplyToSellModal
              birState={user.birState ?? "None"}
              onBirState={(s) => setUser((u) => ({ ...u, birState: s }))}
              onEnableSeller={async () => {
                if (isSupabaseConfigured) await kargoApi.updateProfile({ canSell: true })
                setUser((current) => ({ ...current, sellerEnabled: true, role: "Seller" }))
                setTab("Dashboard")
              }}
              onClose={() => setShowApplyToSell(false)}
            />
          )}
        </div>
      )}
    </>
  )
}
