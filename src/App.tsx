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

import {
  Login,
  SignUp,
  ResetPassword,
  Onboarding,
  ApplyToSellModal,
  ReservationGate,
  clearResetPasswordUrl,
  hasRecoveryFragment,
  hasSignupConfirmationFragment,
  isNewAccount,
  isResetPasswordPath,
} from "@/features/auth"

import { NewBatchModal } from "@/features/batches"

import { Footer, Header, TabBar, TabContent } from "@/components/layout"

import { isSupabaseConfigured, supabase } from "@/lib/supabase"

import { kargoApi } from "@/services"

import { deadlineHasPassed } from "@/features/claims/claimExpiry"

// True only when this page load came from clicking the signup confirmation link.
// Read at module load: the Supabase client strips the URL fragment right after.
const ARRIVED_VIA_CONFIRMATION_LINK = hasSignupConfirmationFragment()

// Email CTAs deep-link to the tab where the action lives (?tab=Orders). Accept
// the app's labels plus the few words a person might expect instead.
const TAB_DEEP_LINKS: Record<string, Tab> = {
  dashboard: "Dashboard",
  home: "Dashboard",
  batches: "Batches",
  shop: "Batches",
  "my claims": "My Claims",
  claims: "My Claims",
  cart: "My Claims",
  payments: "Payments",
  history: "Payments",
  orders: "Orders",
  settings: "Settings",
}

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

  const viaBatchLink = sharedBatchId !== null

  // A batch link outranks an email tab: it promises to open that batch's page.
  const linkedTab = (() => {
    const raw = searchParams?.get("tab")?.trim().toLowerCase().replace(/[_-]+/g, " ")
    return raw ? TAB_DEEP_LINKS[raw] ?? null : null
  })()

  const landingTab = (u: UserInfo): Tab =>
    sharedBatchId !== null
      ? "Batches"
      : linkedTab ?? (u.sellerEnabled ? "Dashboard" : "Batches")

  useEffect(() => {
    if (sharedBatchId !== null) requestBatchOpen(sharedBatchId)
  }, [sharedBatchId])

  const [stage, setStage] = useState<AppStage>(
    originalPreview ? "app" : "login",
  )

  // A recovery link can land either on the reset path or, when the redirect is
  // not allow-listed, on the root with the token in the fragment. Both are read
  // before the client has a chance to consume them.
  const [recoveryMode, setRecoveryMode] = useState(
    () => isResetPasswordPath() || hasRecoveryFragment(),
  )

  const [booting, setBooting] = useState(
    isSupabaseConfigured && !originalPreview,
  )

  const [showReservationGate, setShowReservationGate] = useState(
    viaBatchLink && !originalPreview,
  )

  const [showOnboarding, setOnboard] = useState(false)

  const [tab, setTab] = useState<Tab>(
    () =>
      sharedBatchId !== null
        ? "Batches"
        : linkedTab ?? (originalPreview ? "Dashboard" : "Batches"),
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

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setStage("login")

      // A recovery link also arrives as a session, so the second signal is what
      // keeps this correct when the link does not land on the reset path.
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true)

      // A confirmation link lands with the session tokens in the URL hash, which
      // the client parses asynchronously. If the mount-time refresh above ran
      // before they were stored, adopt the session here rather than stranding the
      // confirmed user on the login screen.
      if (event === "SIGNED_IN" && session) void refreshData().catch(() => {})
    })

    return () => data.subscription.unsubscribe()
  }, [originalPreview, refreshData])

  // Onboarding tour for brand-new accounts. Confirming by email signs the user in
  // through the session-restore path above (not handleSignupSuccess), so it is
  // started here instead: once, when the app has loaded the user that arrived via
  // the confirmation link. Regular logins never set the flag, so they never see it.
  const tourPendingRef = useRef(
    ARRIVED_VIA_CONFIRMATION_LINK && sharedBatchId === null,
  )
  useEffect(() => {
    if (!tourPendingRef.current) return
    if (stage !== "app" || !user.id) return
    tourPendingRef.current = false
    if (isNewAccount(user.memberSince)) setOnboard(true)
  }, [stage, user.id, user.memberSince])

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
    setTab(landingTab(u))
    setStage("app")

    // Shared-link buyers should reach the requested batch immediately; keep the
    // existing onboarding tour for normal signups only.
    setOnboard(sharedBatchId === null)
  }

  const handleLoginSuccess = (u: UserInfo) => {
    setUser(u)
    setTab(landingTab(u))
    setStage("app")

    if (isSupabaseConfigured) refreshData()
  }

  const linkedBatch = viaBatchLink
    ? batches.find((batch) => batch.id === sharedBatchId)
    : undefined

  // The recovery screen outranks the normal stage machine: a recovery link signs
  // the visitor in, so the usual bootstrap would otherwise drop them straight
  // into the app without ever setting a new password.
  if (recoveryMode) {
    const leaveRecovery = () => {
      clearResetPasswordUrl()
      setRecoveryMode(false)
    }

    return (
      <ResetPassword
        onDone={leaveRecovery}
        onBack={() => {
          leaveRecovery()
          setStage("login")
        }}
      />
    )
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
            fromBatchLink={viaBatchLink}
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
      {viaBatchLink &&
        stage !== "app" &&
        !booting &&
        !originalPreview &&
        showReservationGate && (
          <ReservationGate
            batchTitle={linkedBatch?.title}
            sellerName={linkedBatch?.seller}
            onLogin={() => {
              setShowReservationGate(false)
              setStage("login")
            }}
            onSignUp={() => {
              setShowReservationGate(false)
              setStage("signup")
            }}
            onDismiss={() => setShowReservationGate(false)}
          />
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
          {showOnboarding && (
            <Onboarding onDone={() => setOnboard(false)} role={role} />
          )}
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
