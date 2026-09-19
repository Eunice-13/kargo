import { useState, useRef, useEffect, useCallback } from "react"
import {
  Banknote,
  BarChart3,
  BadgeCheck,
  Bell,
  Check,
  Clock3,
  CreditCard,
  Gem,
  Globe2,
  HandCoins,
  Lock,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Star,
  Utensils,
  Unlock,
  UserRound,
  X,
} from "lucide-react"
import type {
  AppStage,
  UserInfo,
  Tab,
  Role,
  ClaimStatus,
  ReportStatus,
  SettingsSection,
  ClaimRow,
  ToPayRow,
  PayHistRow,
  OrderRow,
  ReportRow,
} from "@/types"
import {
  RETRO_THEME,
  INDIGO,
  CREAM,
  CYAN_L,
  SKY,
  CORAL,
  GREEN,
  AMBER,
  TODAY,
  CAT_GRAD,
  STATUS_C,
  REPORT_C,
} from "@/constants/theme"
import { navIntent } from "@/state/navIntent"
import { BATCHES_INIT } from "@/data/batches"
import { CLAIMS_INIT } from "@/data/claims"
import { TOPAY_INIT } from "@/data/toPay"
import { PAYHIST_INIT } from "@/data/payHistory"
import { ORDERS_INIT } from "@/data/orders"
import { REPORTS_INIT } from "@/data/reports"
import { NOTIF_BUYER, NOTIF_SELLER } from "@/data/notifications"
import type {
  BatchStoredProduct,
  BatchItem,
  BatchType,
  SharedState,
} from "@/types"
import {
  CategoryIcon,
  PaymentIcon,
  StatusBadge,
  Avatar,
  ProductThumb,
  PROD_IMG,
  Countdown,
  Card,
  SH,
  PrimaryBtn,
  SecondaryBtn,
  Toggle,
  BIRBadge,
  Modal,
  PayModal,
  PAY_METHODS,
  SELLER_PAY_DETAILS,
  TrackOrderModal,
  ORDER_STEPS,
  ContactSellerModal,
  BuyerProfileModal,
} from "@/components/shared"
import {
  KANBAN_COLS,
  KANBAN_COL_BG,
  PRIOR_FULFILLED,
  FULFILLMENT_INIT,
  useFulfillmentBoard,
  FulfillmentLiveRegion,
  FulfillmentDetails,
} from "@/features/fulfillment"
import type { KanbanCol, FulfillmentOrder } from "@/features/fulfillment"
import { Reports } from "@/features/reports"
import { Orders } from "@/features/orders"
import { MyClaims } from "@/features/claims"
import { Payments } from "@/features/payments"
import { Settings } from "@/features/settings"
import { Batches, NewBatchModal } from "@/features/batches"
import { Dashboard } from "@/features/dashboard"
import { Login, SignUp, Onboarding } from "@/features/auth"

// ─── Role Toggle ──────────────────────────────────────────────────────────────
function RoleToggle({
  role,
  setRole,
}: {
  role: Role
  setRole: (r: Role) => void
}) {
  return (
    <div
      data-spotlight="role-toggle"
      style={{
        background: CREAM,
        border: "1px solid #E5E7EB",
        borderRadius: 999,
        padding: 2,
        position: "relative",
        display: "inline-flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: role === "Seller" ? "50%" : 2,
          width: "calc(50% - 2px)",
          bottom: 2,
          background: INDIGO,
          borderRadius: 999,
          transition: "left 0.22s cubic-bezier(.22,1,.36,1)",
          pointerEvents: "none",
        }}
      />
      {(["Buyer", "Seller"] as Role[]).map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          style={{
            position: "relative",
            zIndex: 1,
            color: role === r ? "#fff" : "#6B7280",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            transition: "color 0.2s",
            fontFamily: "'Plus Jakarta Sans',sans-serif",
          }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({
  user,
  onLogout,
  onSettings,
  role,
  batches,
  onNavigate,
  onBatchSelect,
  onSellerSelect,
}: {
  user: UserInfo
  onLogout: () => void
  onSettings: () => void
  role?: Role
  batches?: BatchType[]
  onNavigate?: (tab: Tab) => void
  onBatchSelect?: (id: number) => void
  onSellerSelect?: (name: string) => void
}) {
  const [showNotif, setShowNotif] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [notifRead, setNotifRead] = useState(false)
  const [readSet, setReadSet] = useState<Set<number>>(new Set())
  const [searchQ, setSearchQ] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setShowUser(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const notifSource = role === "Seller" ? NOTIF_SELLER : NOTIF_BUYER
  const notifs = notifSource.map((n) => ({
    icon: n.icon,
    text: n.text,
    time: n.time,
    unread: !n.read,
  }))
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotif(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const markAllRead = () => {
    setReadSet(new Set(notifs.map((_, i) => i)))
    setNotifRead(true)
  }
  const hasUnread = !notifRead && notifs.some((n) => n.unread)

  return (
    <header
      style={{
        background: "#fff",
        borderBottom: "1px solid #E5E7EB",
        height: 56,
        zIndex: 50,
      }}
      className="kargo-header flex items-center px-6 gap-6 sticky top-0"
    >
      <div
        className="kargo-brand-lockup flex items-center gap-2 flex-shrink-0"
        style={{ width: 160 }}
      >
        <div
          className="kargo-brand-mark"
          style={{
            background: INDIGO,
            width: 28,
            height: 28,
            borderRadius: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h12M2 8h8M2 12h10"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span
          className="kargo-brand-name"
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            color: INDIGO,
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: -0.5,
          }}
        >
          Kargo
        </span>
      </div>
      <div
        className="kargo-search-wrap flex-1 max-w-lg mx-auto"
        style={{ position: "relative" }}
      >
        <div
          style={{
            background: CREAM,
            border: "1px solid #E5E7EB",
            borderRadius: 8,
          }}
          className="kargo-search flex items-center gap-2 px-3 py-2"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
            <path
              d="M11 11l3 3"
              stroke="#9CA3AF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            aria-label="Search batches, products, and sellers"
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value)
              setSearchOpen(e.target.value.length > 0)
            }}
            placeholder="Search batches, products, sellers…"
            style={{
              background: "transparent",
              fontSize: 13,
              color: "#374151",
              outline: "none",
              width: "100%",
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        {searchOpen && searchQ && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              zIndex: 50,
              overflow: "hidden",
              marginTop: 4,
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: 0.5,
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              RESULTS FOR "{searchQ}"
            </div>
            {(() => {
              const q = searchQ.toLowerCase()
              const allBatches = batches || []
              const batchResults = allBatches
                .filter((b) => b.title.toLowerCase().includes(q))
                .slice(0, 3)
              const productResults: {
                name: string
                batchId: number
                batchTitle: string
              }[] = []
              for (const b of allBatches) {
                for (const p of b.products) {
                  if (
                    p.name.toLowerCase().includes(q) &&
                    productResults.length < 3
                  ) {
                    productResults.push({
                      name: p.name,
                      batchId: b.id,
                      batchTitle: b.title,
                    })
                  }
                }
              }
              const sellerSet = new Set<string>()
              const sellerResults: string[] = []
              for (const b of allBatches) {
                if (
                  b.seller.toLowerCase().includes(q) &&
                  !sellerSet.has(b.seller) &&
                  sellerResults.length < 3
                ) {
                  sellerSet.add(b.seller)
                  sellerResults.push(b.seller)
                }
              }
              const hasAny =
                batchResults.length ||
                productResults.length ||
                sellerResults.length
              if (!hasAny)
                return (
                  <div
                    style={{
                      padding: "14px",
                      fontSize: 13,
                      color: "#9CA3AF",
                      textAlign: "center",
                    }}
                  >
                    No results found.
                  </div>
                )
              return (
                <>
                  {batchResults.length > 0 && (
                    <>
                      <div
                        style={{
                          padding: "6px 14px 2px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#9CA3AF",
                          letterSpacing: 0.5,
                        }}
                      >
                        BATCHES
                      </div>
                      {batchResults.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onBatchSelect) {
                              onBatchSelect(b.id)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open batch ${b.title}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSearchOpen(false)
                              setSearchQ("")
                              if (onBatchSelect) {
                                onBatchSelect(b.id)
                              } else {
                                onNavigate && onNavigate("Batches")
                              }
                            }
                          }}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            color: "#374151",
                            cursor: "pointer",
                            borderBottom: "1px solid #F9FAFB",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "#F9FAFB")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "")
                          }
                        >
                          📦 {b.title}
                        </div>
                      ))}
                    </>
                  )}
                  {productResults.length > 0 && (
                    <>
                      <div
                        style={{
                          padding: "6px 14px 2px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#9CA3AF",
                          letterSpacing: 0.5,
                        }}
                      >
                        PRODUCTS
                      </div>
                      {productResults.map((p, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onBatchSelect) {
                              onBatchSelect(p.batchId)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open product ${p.name} in ${p.batchTitle}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSearchOpen(false)
                              setSearchQ("")
                              if (onBatchSelect) {
                                onBatchSelect(p.batchId)
                              } else {
                                onNavigate && onNavigate("Batches")
                              }
                            }
                          }}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            color: "#374151",
                            cursor: "pointer",
                            borderBottom: "1px solid #F9FAFB",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "#F9FAFB")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "")
                          }
                        >
                          🛍️ {p.name}{" "}
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                            in {p.batchTitle}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  {sellerResults.length > 0 && (
                    <>
                      <div
                        style={{
                          padding: "6px 14px 2px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#9CA3AF",
                          letterSpacing: 0.5,
                        }}
                      >
                        SELLERS
                      </div>
                      {sellerResults.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onSellerSelect) {
                              onSellerSelect(s)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open seller ${s}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSearchOpen(false)
                              setSearchQ("")
                              if (onSellerSelect) {
                                onSellerSelect(s)
                              } else {
                                onNavigate && onNavigate("Batches")
                              }
                            }
                          }}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            color: "#374151",
                            cursor: "pointer",
                            borderBottom: "1px solid #F9FAFB",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "#F9FAFB")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "")
                          }
                        >
                          👤 {s}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label={`Notifications${hasUnread ? " (unread)" : ""}`}
            onClick={() => setShowNotif((s) => !s)}
            style={{
              position: "relative",
              background: CREAM,
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            className="hover:bg-gray-100 transition-colors bp"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                fill="#6B7280"
              />
            </svg>
            {hasUnread && (
              <span
                style={{
                  background: "#EF4444",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  position: "absolute",
                  top: 6,
                  right: 7,
                  border: "2px solid #fff",
                }}
              />
            )}
          </button>
          {showNotif && (
            <div
              className="si"
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 340,
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 10,
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                zIndex: 60,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  Notifications
                </span>
                {hasUnread && (
                  <button
                    onClick={markAllRead}
                    style={{
                      fontSize: 11,
                      color: INDIGO,
                      fontWeight: 600,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifs.map((n, i) => {
                const isRead = readSet.has(i) || !n.unread
                return (
                  <div
                    key={i}
                    onClick={() => setReadSet((s) => new Set([...s, i]))}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.text}${isRead ? "" : " (unread)"}, mark as read`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setReadSet((s) => new Set([...s, i]))
                      }
                    }}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #F9FAFB",
                      background: isRead ? "#fff" : "#FAFBFF",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      cursor: "pointer",
                    }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        background: isRead ? "transparent" : INDIGO,
                        borderRadius: "50%",
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {n.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#374151",
                          lineHeight: 1.4,
                          fontWeight: isRead ? 400 : 500,
                        }}
                      >
                        {n.text}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                      >
                        {n.time}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div ref={userRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label={`Open profile menu for ${user.name || "User"}`}
            onClick={() => setShowUser((s) => !s)}
            className="flex items-center gap-2 bp"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 8,
            }}
          >
            <Avatar name={user.name || "User"} size={32} />
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
              {user.name.split(" ")[0] || "User"}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 4.5l3 3 3-3"
                stroke="#9CA3AF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {showUser && (
            <div
              className="si"
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 200,
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 10,
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                zIndex: 60,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <div
                  style={{
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {user.name || "User"}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                  {user.email}
                </div>
              </div>
              {[
                {
                  icon: "👤",
                  label: "View Profile",
                  action: () => {
                    onSettings()
                    setShowUser(false)
                  },
                },
                {
                  icon: "⚙️",
                  label: "Settings",
                  action: () => {
                    onSettings()
                    setShowUser(false)
                  },
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#374151",
                    textAlign: "left",
                  }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
              <div style={{ borderTop: "1px solid #F3F4F6" }}>
                <button
                  onClick={() => {
                    setShowUser(false)
                    onLogout()
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#EF4444",
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                  className="hover:bg-red-50 transition-colors"
                >
                  <span style={{ fontSize: 16 }}>🚪</span>Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TABS: Tab[] = ["Dashboard", "Batches", "My Claims", "Payments"]
function TabBar({
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

// ─── Tab content with direction-aware transition ───────────────────────────────
function TabContent({ tab, shared }: { tab: Tab; shared: SharedState }) {
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
    Reports: <Reports {...shared} />,
    Settings: <Settings {...shared} />,
  }
  return (
    <div key={displayed} className={animClass}>
      {map[displayed]}
    </div>
  )
}

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
