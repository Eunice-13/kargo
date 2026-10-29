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
import kargoLogoUrl from "@/assets/kargo-logo.png"

import {
  requestBatchOpen,
  requestSellerOpen,
} from "@/state/navIntent"

import { useScrollToTopOnRouteChange } from "@/state/routeScroll"

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

import { AdminInviteModal, AdminProfile } from "@/features/admin"

import { Footer, Header, TabBar, TabContent } from "@/components/layout"

import { isSupabaseConfigured, supabase } from "@/lib/supabase"

import { kargoApi, setAdminDemoMode } from "@/services"
import { NotificationsProvider } from "@/features/notifications"

import { deadlineHasPassed } from "@/features/claims/claimExpiry"

// True only when this page load came from clicking the signup confirmation link.
// Read at module load: the Supabase client strips the URL fragment right after.
const ARRIVED_VIA_CONFIRMATION_LINK = hasSignupConfirmationFragment()

// Email CTAs deep-link to the tab where the action lives (?tab=Orders). Accept
// the app's labels plus the few words a person might expect instead.
const TAB_DEEP_LINKS: Record<string, Tab> = {
  notifications: "Notifications",
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
  const loadingPreview = searchParams?.get("preview") === "loading"

  // Admin demo boot: ?preview=admin mounts the admin console in-memory (no
  // Supabase), mirroring ?preview=original for buyer/seller. Separate flag so
  // the buyer/seller demo is never affected.
  const adminPreview = searchParams?.get("preview") === "admin"

  // Reviewer boot for the admin invitation gate: ?preview=admin-invite is a
  // buyer with an unanswered admin invitation, so Accept/Decline can be tried
  // without a second real account.
  const invitePreview = searchParams?.get("preview") === "admin-invite"

  // Either demo bypasses auth/boot and seeds the app stage directly.
  const anyPreview = originalPreview || adminPreview || invitePreview

  // Route adminApi to its in-memory demo adapter for ?preview=admin (no DB).
  setAdminDemoMode(adminPreview || invitePreview)

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
    u.adminEnabled
      ? "Dashboard"
      : sharedBatchId !== null
      ? "Batches"
      : linkedTab ?? (u.sellerEnabled ? "Dashboard" : "Batches")

  useEffect(() => {
    if (sharedBatchId !== null) requestBatchOpen(sharedBatchId)
  }, [sharedBatchId])

  const [stage, setStage] = useState<AppStage>(
    anyPreview ? "app" : "login",
  )

  // A recovery link can land either on the reset path or, when the redirect is
  // not allow-listed, on the root with the token in the fragment. Both are read
  // before the client has a chance to consume them.
  const [recoveryMode, setRecoveryMode] = useState(
    () => isResetPasswordPath() || hasRecoveryFragment(),
  )

  const [booting, setBooting] = useState(
    isSupabaseConfigured && !anyPreview,
  )

  const [showReservationGate, setShowReservationGate] = useState(
    viaBatchLink && !originalPreview,
  )

  const [showOnboarding, setOnboard] = useState(false)

  const [tab, setTab] = useState<Tab>(
    () =>
      adminPreview
        ? "Dashboard"
        : sharedBatchId !== null
        ? "Batches"
        : linkedTab ?? (originalPreview ? "Dashboard" : "Batches"),
  )
  // Every page opens at the top. The shell owns this policy (see
  // state/routeScroll.ts); the key is the current stage plus tab, and tabs with
  // their own sub-pages extend it themselves.
  useScrollToTopOnRouteChange(`${stage}:${tab}`)

  const [user, setUser] = useState<UserInfo>(
    adminPreview
      ? {
          name: "KARGO Admin",
          email: "admin@kargo.demo",
          role: "Admin",
          adminEnabled: true,
          accountStatus: "active",
          socialLinks: {},
        }
      : invitePreview
        ? {
            name: "Alex Jordan",
            email: "alex@kargo.demo",
            role: "Buyer",
            adminInvitePending: true,
            accountStatus: "active",
            socialLinks: {},
          }
        : {
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
        },
  )

  const [showNewBatch, setShowNewBatch] = useState(false)

  const [showApplyToSell, setShowApplyToSell] = useState(false)

  const [showAdminProfile, setShowAdminProfile] = useState(false)

  // "Decide later" on an admin invitation is scoped to this sign-in: closing the
  // modal hides it until the next login, but the invitation stays pending in the
  // database (and is_admin() stays false) until it is answered.
  const [inviteDismissedFor, setInviteDismissedFor] = useState<string | null>(null)

  // Role is fixed by seller capability (can_sell). There is no in-app role

  // switch: a seller-capable account is always a Seller, everyone else a Buyer.

  const role: Role = user.adminEnabled
    ? "Admin"
    : user.sellerEnabled
      ? "Seller"
      : "Buyer"

  // Allowed-tab guard: keep admins inside the admin tab set and buyers/sellers
  // inside theirs. If the active tab isn't valid for the role (e.g. after a
  // role change or a stale deep link), snap back to the role's landing tab.
  const ADMIN_ALLOWED_TABS: Tab[] = [
    "Dashboard",
    "Users",
    "Batches",
    "Transactions",
    "Security",
    "Notifications",
  ]
  const NON_ADMIN_ALLOWED_TABS: Tab[] = [
    "Dashboard",
    "Batches",
    "My Claims",
    "Payments",
    "Orders",
    "Settings",
    "Notifications",
  ]
  useEffect(() => {
    if (stage !== "app") return
    const allowed = role === "Admin" ? ADMIN_ALLOWED_TABS : NON_ADMIN_ALLOWED_TABS
    if (!allowed.includes(tab)) setTab(landingTab(user))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tab, stage])

  // Shared mutable data

  // Admin demo doesn't use buyer/seller seed data; it has its own in-memory
  // surface, so keep the seed arrays empty for the admin preview.
  const useSeeds = originalPreview || (!isSupabaseConfigured && !adminPreview)

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
    if (!isSupabaseConfigured || anyPreview || !supabase) return

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
    if (!isSupabaseConfigured || anyPreview || !supabase || !user.id) return
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
    setInviteDismissedFor(null)

    // Shared-link buyers should reach the requested batch immediately; keep the
    // existing onboarding tour for normal signups only.
    setOnboard(sharedBatchId === null)
  }

  const handleLoginSuccess = (u: UserInfo) => {
    setUser(u)
    setTab(landingTab(u))
    setStage("app")
    setInviteDismissedFor(null)

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

  if (booting || loadingPreview) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "radial-gradient(ellipse at center, #3546D4 0%, #202BAE 58%, #151A78 100%)",
          color: "#fff",
          fontFamily: "'Quicksand',sans-serif",
        }}
      >
        <div
          className="kargo-loading-logo"
          style={{
            display: "grid",
            placeItems: "center",
            width: 148,
            height: 148,
          }}
        >
          <img
            src={kargoLogoUrl}
            alt="KARGO"
            style={{ width: 126, height: 126, objectFit: "contain" }}
          />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".04em" }}>
          Loading KARGO…
        </span>
        <span className="kargo-loading-progress" aria-hidden="true" />
      </div>
    )
  }

  // A suspended account never mounts the app shell, for any role. is_admin()
  // also requires an active account, so a suspended admin is locked out here too.
  if (stage === "app" && user.accountStatus === "suspended") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: CREAM,
          padding: 24,
          fontFamily: "'Inter',sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(18,30,71,.08)",
            padding: 28,
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: "0 0 10px",
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: "#171923",
            }}
          >
            Account suspended
          </h1>
          <p style={{ color: "#475467", fontSize: 14, lineHeight: 1.55, margin: "0 0 8px" }}>
            Your KARGO account is currently suspended and cannot access the app.
          </p>
          {user.accountStatusReason && (
            <p style={{ color: "#475467", fontSize: 13, lineHeight: 1.5, margin: "0 0 12px" }}>
              Reason: {user.accountStatusReason}
            </p>
          )}
          <p style={{ color: "#667085", fontSize: 13, margin: "0 0 20px" }}>
            Think this is a mistake? Contact{" "}
            <a href="mailto:support@kargo.ph" style={{ color: "#2e3192", fontWeight: 600 }}>
              support@kargo.ph
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => {
              if (isSupabaseConfigured) void kargoApi.signOut()
              setStage("login")
            }}
            style={{
              minHeight: 44,
              padding: "0 18px",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#fff",
              color: "#2e3192",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
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
        <NotificationsProvider
          key={`${user.id ?? user.email}:${role}`}
          role={role}
          onNavigate={setTab}
          onOpenAdminInvite={() => {
            // A pending invitee still has the popup pending; once accepted the
            // same notification should land on the Team page instead.
            if (user.adminInvitePending) setInviteDismissedFor(null)
            else setTab(user.adminEnabled ? "Security" : "Dashboard")
          }}
        >
        <div
          className={`kargo-original-app${role === "Admin" ? " admin-app" : ""}`}
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

              setInviteDismissedFor(null)

              setStage("login")
            }}
            onSettings={() =>
              role === "Admin" ? setShowAdminProfile(true) : setTab("Settings")
            }
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
          <Footer role={role} />
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
                // Phase-1 revoked direct can_sell updates; go through the RPC.
                if (isSupabaseConfigured) await kargoApi.enableSellerAccess()

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
          {showAdminProfile && (
            <AdminProfile user={user} onClose={() => setShowAdminProfile(false)} />
          )}
          {user.adminInvitePending &&
            inviteDismissedFor !== (user.id ?? user.email) && (
              <AdminInviteModal
                onDismiss={() => setInviteDismissedFor(user.id ?? user.email)}
                onResolved={(accepted) => {
                  setInviteDismissedFor(null)
                  // The RPC already committed, so clear the pending flag locally
                  // and let the refresh reconcile the rest (role, tabs, data).
                  setUser((current) => ({
                    ...current,
                    adminEnabled: accepted,
                    adminInvitePending: false,
                  }))
                  if (isSupabaseConfigured && !anyPreview) {
                    void refreshData().catch(() => {})
                  }
                }}
              />
            )}
        </div>
        </NotificationsProvider>
      )}
    </>
  )
}
