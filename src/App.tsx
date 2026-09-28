import { useCallback, useEffect, useRef, useState } from "react"

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
  SellerWaitlistGroup,
  SharedState,
} from "@/types"

import { CREAM } from "@/constants/theme"

import {
  navIntent,
  requestBatchOpen,
  requestSellerOpen,
} from "@/state/navIntent"

import { BATCHES_INIT } from "@/data/batches"

import { CLAIMS_INIT } from "@/data/claims"

import { TOPAY_INIT } from "@/data/toPay"

import { PAYHIST_INIT } from "@/data/payHistory"

import { ORDERS_INIT } from "@/data/orders"

import { WAITLIST_INIT } from "@/data/waitlist"

import { FULFILLMENT_INIT } from "@/features/fulfillment"

import { Login, SignUp, Onboarding, ApplyToSellModal } from "@/features/auth"

import { NewBatchModal } from "@/features/batches"

import { Footer, Header, TabBar, TabContent } from "@/components/layout"

import { isSupabaseConfigured, supabase } from "@/lib/supabase"

import { kargoApi } from "@/services"

import { deadlineHasPassed } from "@/features/claims/claimExpiry"

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null

  const originalPreview = searchParams?.get("preview") === "original"

  // Shareable batch deep link: ?batch=<id> boots into the Batches tab and opens

  // that batch's claim page via the existing navIntent hook (3.1).

  const sharedBatchId = (() => {
    const raw = searchParams?.get("batch")

    const n = raw ? Number(raw) : NaN

    return Number.isFinite(n) && n > 0 ? n : null
  })()

  if (sharedBatchId !== null) navIntent.batchId = sharedBatchId

  const [stage, setStage] = useState<AppStage>(
    originalPreview ? "app" : "login",
  )

  const [booting, setBooting] = useState(
    isSupabaseConfigured && !originalPreview,
  )

  const [showOnboarding, setOnboard] = useState(false)

  const [tab, setTab] = useState<Tab>(
    sharedBatchId !== null || !originalPreview ? "Batches" : "Dashboard",
  )
  const [user, setUser] = useState<UserInfo>({
    name: originalPreview ? "Alex Jordan" : "",

    email: originalPreview ? "alex@kargo.demo" : "",

    role: "Buyer",

    sellerEnabled: originalPreview,

    bio: originalPreview
      ? "Curated pasabuy finds with careful packing and clear trip updates."
      : "",

    socialLinks: originalPreview
      ? {
          Facebook: "https://facebook.com/alex.jordan",
          Instagram: "https://instagram.com/alexjordan",
        }
      : {},
  })

  const [showNewBatch, setShowNewBatch] = useState(false)

  const [showApplyToSell, setShowApplyToSell] = useState(false)

  // Role is fixed by seller capability (can_sell). There is no in-app role

  // switch: a seller-capable account is always a Seller, everyone else a Buyer.

  const role: Role = user.sellerEnabled ? "Seller" : "Buyer"

  // Shared mutable data

  const useSeeds = originalPreview || !isSupabaseConfigured

  const [claims, setClaims] = useState<ClaimRow[]>(useSeeds ? CLAIMS_INIT : [])

  const [toPay, setToPay] = useState<ToPayRow[]>(useSeeds ? TOPAY_INIT : [])

  const [payHistory, setPayHistory] = useState<PayHistRow[]>(
    useSeeds ? PAYHIST_INIT : [],
  )

  const [orders, setOrders] = useState<OrderRow[]>(useSeeds ? ORDERS_INIT : [])

  const [batches, setBatches] = useState<BatchType[]>(
    useSeeds ? BATCHES_INIT : [],
  )

  const [fulfillment, setFulfillment] = useState<FulfillmentOrder[]>(
    useSeeds ? FULFILLMENT_INIT : [],
  )

  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(
    useSeeds ? WAITLIST_INIT : [],
  )

  const expiringClaims = useRef(new Set<string>())

  useEffect(() => {
    const initializedAt = Date.now()

    setClaims((current) =>
      current.map((claim) =>
        claim.status === "Pending" && !claim.expiresAt
          ? {
              ...claim,
              expiresAt: new Date(
                initializedAt + Math.max(0, claim.hours) * 3_600_000,
              ).toISOString(),
            }
          : claim,
      ),
    )

    setToPay((current) =>
      current.map((item) =>
        item.expiresAt
          ? item
          : {
              ...item,
              expiresAt: new Date(
                initializedAt + Math.max(0, item.hours) * 3_600_000,
              ).toISOString(),
            },
      ),
    )
  }, [])

  useEffect(() => {
    const expireDueClaims = () => {
      const now = Date.now()

      const due = claims.filter(
        (claim) => claim.status === "Pending" && deadlineHasPassed(claim, now),
      )

      if (due.length === 0) return

      const dueIds = new Set(due.map((claim) => String(claim.id)))

      setClaims((current) =>
        current.map((claim) =>
          dueIds.has(String(claim.id))
            ? { ...claim, status: "Expired", hours: 0 }
            : claim,
        ),
      )

      setToPay((current) =>
        current.filter(
          (item) =>
            !due.some(
              (claim) =>
                dueIds.has(String(item.orderId ?? item.id)) ||
                (item.product === claim.product &&
                  item.seller === claim.seller),
            ),
        ),
      )

      setBatches((current) =>
        current.map((batch) => {
          // A claim belongs to this batch if it names the batch, or if it names
          // one of the batch's products. The product branch requires a real
          // productId: demo seed rows carry none, and an unguarded
          // `product.dbId === claim.productId` would compare undefined to
          // undefined, match every batch, and decrement all of them.
          const released = due.filter(
            (claim) =>
              claim.batch === batch.title ||
              (claim.productId != null &&
                batch.products.some(
                  (product) => product.dbId === claim.productId,
                )),
          )

          if (released.length === 0) return batch

          const releasedQty = released.reduce(
            (sum, claim) => sum + claim.qty,
            0,
          )

          return {
            ...batch,

            claimed: Math.max(0, batch.claimed - releasedQty),

            products: batch.products.map((product) => {
              const productQty = released
                .filter((claim) =>
                  claim.productId
                    ? product.dbId === claim.productId
                    : product.name === claim.product,
                )
                .reduce((sum, claim) => sum + claim.qty, 0)

              return productQty
                ? {
                    ...product,
                    claimed: Math.max(0, product.claimed - productQty),
                  }
                : product
            }),
          }
        }),
      )

      if (isSupabaseConfigured) {
        for (const claim of due) {
          const id = String(claim.id)

          if (expiringClaims.current.has(id)) continue

          expiringClaims.current.add(id)

          void kargoApi
            .expireClaim(id)
            .finally(() => expiringClaims.current.delete(id))
        }
      }
    }

    expireDueClaims()

    const timer = window.setInterval(expireDueClaims, 1000)

    return () => window.clearInterval(timer)
  }, [claims])

  const [sellerWaitlist, setSellerWaitlist] = useState<SellerWaitlistGroup[]>(
    [],
  )

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

    setSellerWaitlist(data.sellerWaitlist)

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

  // Keep orders, waitlists, and payment decisions synchronized across open
  // buyer and seller sessions. Related database changes can arrive as separate
  // realtime events, so each event reloads one coherent app snapshot.
  useEffect(() => {
    if (!isSupabaseConfigured || originalPreview || !supabase || !user.id) return
    const client = supabase

    let refreshQueued = false
    const refreshSoon = () => {
      if (refreshQueued) return
      refreshQueued = true
      window.setTimeout(() => {
        refreshQueued = false
        void refreshData().catch(() => {})
      }, 0)
    }

    const channel = client
      .channel(`app-order-payment-sync-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waitlist_entries" },
        refreshSoon,
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [originalPreview, refreshData, user.id])

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

    sellerWaitlist,

    setSellerWaitlist,

    user,

    setUser,

    setTab,

    role,

    refreshData,
  }

  const handleSignupSuccess = (u: UserInfo) => {
    setUser(u)
    setTab(u.sellerEnabled ? "Dashboard" : "Batches")
    setStage("app")

    setOnboard(true)
  }

  const handleLoginSuccess = (u: UserInfo) => {
    setUser(u)
    setTab(u.sellerEnabled ? "Dashboard" : "Batches")
    setStage("app")

    if (isSupabaseConfigured) refreshData()
  }

  if (booting) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: CREAM,
        }}
      >
        Loading KARGO…
      </div>
    )
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
          className="kargo-original-app"
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
            batches={batches}
            onNavigate={setTab}
            onBatchSelect={(id) => {
              requestBatchOpen(id)

              setTab("Batches")
            }}
            onSellerSelect={(name) => {
              requestSellerOpen(name)

              setTab("Batches")
            }}
          />
          <TabBar
            active={tab}
            setActive={setTab}
            role={role}
          />
          <main style={{ minHeight: "calc(100vh - 100px)" }}>
            <TabContent
              tab={tab}
              shared={shared}
              onNewBatch={() => setShowNewBatch(true)}
            />
          </main>
          <Footer />
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
              onEnableSeller={async () => {
                if (isSupabaseConfigured)
                  await kargoApi.updateProfile({ canSell: true })

                setUser((current) => ({
                  ...current,
                  sellerEnabled: true,
                  role: "Seller",
                }))

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
