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

function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          display: "block",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          fontSize: 13.5,
          border: `1.5px solid ${
            error ? "#EF4444" : focused ? INDIGO : "#E5E7EB"
          }`,
          borderRadius: 8,
          padding: "10px 13px",
          outline: "none",
          color: "#111827",
          background: "#fff",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
        className="placeholder:text-gray-400"
      />
      {error && (
        <p
          className="fi"
          style={{
            fontSize: 11.5,
            color: "#EF4444",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
            <path
              d="M6 3.5v3M6 8h.01"
              stroke="#EF4444"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Logo mark ────────────────────────────────────────────────────────────────
function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: INDIGO,
          borderRadius: size * 0.22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(25,27,169,0.28)",
        }}
      >
        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M2 5h16M2 10h10M2 15h13"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          color: INDIGO,
          fontWeight: 800,
          fontSize: size * 0.52,
          letterSpacing: -0.8,
          lineHeight: 1,
        }}
      >
        Kargo
      </span>
    </div>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────
function Login({
  onSignUp,
  onSuccess,
}: {
  onSignUp: () => void
  onSuccess: (u: UserInfo) => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailErr, setEmailErr] = useState("")
  const [passErr, setPassErr] = useState("")
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const submit = useCallback(() => {
    let ok = true
    if (!email.trim() || !email.includes("@")) {
      setEmailErr("Enter a valid email address.")
      ok = false
    } else setEmailErr("")
    if (!password) {
      setPassErr("Password is required.")
      ok = false
    } else if (password !== "password123") {
      setPassErr("Incorrect email or password.")
      ok = false
    } else setPassErr("")
    if (!ok) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSuccess({ name: "Juan Dela Cruz", email, role: "Buyer" })
    }, 1600)
  }, [email, password, onSuccess])

  return (
    <div
      style={{
        minHeight: "100vh",
        background: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="pu" style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <LogoMark size={52} />
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
            padding: 32,
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            Welcome back
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#9CA3AF",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Sign in to your Kargo account
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AuthInput
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              error={emailErr}
              placeholder="juan@email.com"
            />
            <div>
              <AuthInput
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                error={passErr}
                placeholder="••••••••"
              />
              <div style={{ textAlign: "right", marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setForgotSent(true)}
                  style={{
                    fontSize: 12,
                    color: INDIGO,
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Forgot password?
                </button>
                {forgotSent && (
                  <div role="status" style={{ marginTop: 7, color: "#0B7A59", fontSize: 11 }}>
                    If this email is registered, recovery instructions will be sent shortly.
                  </div>
                )}
              </div>
            </div>
            <PrimaryBtn
              onClick={submit}
              loading={loading}
              style={{
                width: "100%",
                padding: "11px 0",
                fontSize: 14,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {loading ? "Signing in…" : "Log In"}
            </PrimaryBtn>
          </div>
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>
              Don't have an account?{" "}
            </span>
            <button
              onClick={onSignUp}
              style={{
                fontSize: 13,
                color: INDIGO,
                fontWeight: 700,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Sign up
            </button>
          </div>
          <div
            style={{
              background: CYAN_L,
              border: `1px solid ${SKY}`,
              borderRadius: 7,
              padding: "8px 12px",
              marginTop: 16,
            }}
          >
            <p
              style={{ fontSize: 11.5, color: "#0369A1", textAlign: "center" }}
            >
              <strong>Demo:</strong> any email + password{" "}
              <code
                style={{
                  background: "rgba(0,0,0,0.07)",
                  borderRadius: 3,
                  padding: "1px 4px",
                }}
              >
                password123
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────
function SignUp({
  onLogin,
  onSuccess,
}: {
  onLogin: () => void
  onSuccess: (u: UserInfo) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("Buyer")
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Buyer extras
  const photoRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState("")

  // Seller extras
  const [shopName, setShopName] = useState("")
  const [phone, setPhone] = useState("")
  const [socials, setSocials] = useState<Record<string, {
    on: boolean
    url: string
  }>>({
    Facebook: { on: false, url: "" },
    TikTok: { on: false, url: "" },
    Instagram: { on: false, url: "" },
  })
  const [birState, setBirState] = useState<"none" | "uploading" | "submitted">(
    "none",
  )
  const birRef = useRef<HTMLInputElement>(null)
  const [terms, setTerms] = useState(false)

  const submit = useCallback(() => {
    const e: Record<string, string> = {}
    if (!name.trim() || name.trim().split(" ").length < 2)
      e.name = "Enter your full name (first and last)."
    if (!email.includes("@")) e.email = "Enter a valid email address."
    if (password.length < 8)
      e.password = "Password must be at least 8 characters."
    if (role === "Seller") {
      if (!shopName.trim()) e.shopName = "Shop name is required."
      if (!Object.values(socials).some((s) => s.on))
        e.social = "Link at least one social account."
      if (birState !== "submitted")
        e.bir = "Please upload your BIR Certificate."
      if (!terms) e.terms = "You must agree to the Terms and Privacy Policy."
    }
    setErrs(e)
    if (Object.keys(e).length > 0) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSuccess({ name: name.trim(), email, role })
    }, 1800)
  }, [
    name,
    email,
    password,
    role,
    shopName,
    socials,
    birState,
    terms,
    onSuccess,
  ])

  const socialIcons: Record<string, React.ReactNode> = {
    Facebook: (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#1877F2",
          color: "#fff",
          fontSize: 12,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        f
      </span>
    ),
    TikTok: (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#000",
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        T
      </span>
    ),
    Instagram: (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
          color: "#fff",
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        📷
      </span>
    ),
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        overflowY: "auto",
      }}
    >
      <div
        className="pl"
        style={{
          width: "100%",
          maxWidth: 460,
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <LogoMark size={48} />
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
            padding: 32,
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            Create your account
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#9CA3AF",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Join Kargo to buy or sell pasabuy items
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <AuthInput
              label="Full Name"
              value={name}
              onChange={setName}
              error={errs.name}
              placeholder="Juan Dela Cruz"
            />
            <AuthInput
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              error={errs.email}
              placeholder="juan@email.com"
            />
            <AuthInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errs.password}
              placeholder="Min. 8 characters"
            />

            {/* Buyer: profile photo */}
            {role === "Buyer" && (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#374151",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  Profile Photo (optional)
                </label>
                <div
                  onClick={() => photoRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload profile photo"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      photoRef.current?.click()
                    }
                  }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "2px dashed #D1D5DB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    background: CREAM,
                    overflow: "hidden",
                  }}
                >
                  {photo ? (
                    <span
                      style={{
                        fontSize: 9,
                        color: "#374151",
                        textAlign: "center",
                        padding: 4,
                        wordBreak: "break-all",
                      }}
                    >
                      {photo}
                    </span>
                  ) : (
                    <span style={{ fontSize: 22, color: "#D1D5DB" }}>+</span>
                  )}
                </div>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) setPhoto(e.target.files[0].name)
                  }}
                />
              </div>
            )}

            {/* Seller: extra fields */}
            {role === "Seller" && (
              <div
                className="fi"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  borderTop: "1px solid #F3F4F6",
                  paddingTop: 14,
                }}
              >
                <AuthInput
                  label="Shop Name"
                  value={shopName}
                  onChange={setShopName}
                  error={errs.shopName}
                  placeholder="e.g. Maria's Japan Haul Shop"
                />
                {errs.shopName && <span />}
                <AuthInput
                  label="Contact Number"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+63 9XX XXX XXXX"
                />

                {/* Social accounts */}
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Linked Social Accounts{" "}
                    <span style={{ color: "#6B7280", fontWeight: 400 }}>
                      (at least one required)
                    </span>
                  </label>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {(["Facebook", "TikTok", "Instagram"] as const).map(
                      (platform) => (
                        <div
                          key={platform}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {socialIcons[platform]}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#374151",
                              flex: 1,
                            }}
                          >
                            {platform}
                          </span>
                          <Toggle
                            on={socials[platform].on}
                            onChange={(v) =>
                              setSocials((s) => ({
                                ...s,
                                [platform]: { ...s[platform], on: v },
                              }))
                            }
                          />
                          {socials[platform].on && (
                            <input
                              value={socials[platform].url}
                              onChange={(e) =>
                                setSocials((s) => ({
                                  ...s,
                                  [platform]: {
                                    ...s[platform],
                                    url: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Profile URL or @username"
                              style={{
                                fontSize: 12,
                                border: "1px solid #E5E7EB",
                                borderRadius: 6,
                                padding: "5px 9px",
                                outline: "none",
                                color: "#374151",
                                width: 180,
                              }}
                            />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                  {errs.social && (
                    <p
                      className="fi"
                      style={{
                        fontSize: 11.5,
                        color: "#EF4444",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
                        <path
                          d="M6 3.5v3M6 8h.01"
                          stroke="#EF4444"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {errs.social}
                    </p>
                  )}
                </div>

                {/* BIR Certificate */}
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    BIR Certificate{" "}
                    <span style={{ color: "#6B7280", fontWeight: 400 }}>
                      (required for Verification Badge)
                    </span>
                  </label>
                  <input
                    ref={birRef}
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setBirState("uploading")
                        setTimeout(() => setBirState("submitted"), 1500)
                      }
                    }}
                  />
                  {birState === "none" && (
                    <div
                      onClick={() => birRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      aria-label="Upload BIR Certificate"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          birRef.current?.click()
                        }
                      }}
                      style={{
                        border: "2px dashed #D1D5DB",
                        borderRadius: 8,
                        padding: "18px 0",
                        textAlign: "center",
                        cursor: "pointer",
                        background: CREAM,
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>
                        Click to upload BIR Certificate
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                      >
                        PDF or image file
                      </div>
                    </div>
                  )}
                  {birState === "uploading" && (
                    <div
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 8,
                        padding: "14px",
                        textAlign: "center",
                        color: "#6B7280",
                        fontSize: 13,
                      }}
                    >
                      <span className="animate-spin inline-block mr-2">⏳</span>
                      Uploading…
                    </div>
                  )}
                  {birState === "submitted" && (
                    <div
                      style={{
                        background: "#D4F5EA",
                        border: "1px solid #6EE7B7",
                        borderRadius: 8,
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>✅</span>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#065F46",
                        }}
                      >
                        BIR Certificate Uploaded — Pending Review
                      </div>
                    </div>
                  )}
                  {errs.bir && (
                    <p
                      className="fi"
                      style={{
                        fontSize: 11.5,
                        color: "#EF4444",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
                        <path
                          d="M6 3.5v3M6 8h.01"
                          stroke="#EF4444"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {errs.bir}
                    </p>
                  )}
                </div>

                {/* Terms */}
                <div>
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      fontSize: 12,
                      color: "#6B7280",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      I agree to the{" "}
                      <span style={{ color: INDIGO }}>Terms of Service</span>{" "}
                      and <span style={{ color: INDIGO }}>Privacy Policy</span>.
                      Linked accounts and BIR badge are reference indicators
                      only, not automatically verified by Kargo.
                    </span>
                  </label>
                  {errs.terms && (
                    <p
                      className="fi"
                      style={{
                        fontSize: 11.5,
                        color: "#EF4444",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle cx="6" cy="6" r="5.5" stroke="#EF4444" />
                        <path
                          d="M6 3.5v3M6 8h.01"
                          stroke="#EF4444"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {errs.terms}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                I want to join as…
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                {(["Buyer", "Seller"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `2px solid ${role === r ? INDIGO : "#E5E7EB"}`,
                      background: role === r ? "#EEF0FF" : "#fff",
                      color: role === r ? INDIGO : "#6B7280",
                      transition: "all 0.15s",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    {r === "Buyer" ? "🛍 Buyer" : "✈️ Seller"}
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 400,
                        color: role === r ? "#5B5FC7" : "#9CA3AF",
                        marginTop: 2,
                      }}
                    >
                      {r === "Buyer"
                        ? "Claim items from batches"
                        : "Run pasabuy batches"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <PrimaryBtn
              onClick={submit}
              loading={loading}
              style={{
                width: "100%",
                padding: "11px 0",
                fontSize: 14,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {loading
                ? role === "Seller"
                  ? "Creating shop…"
                  : "Creating account…"
                : role === "Seller"
                  ? "Create Shop"
                  : "Create Account"}
            </PrimaryBtn>
          </div>
          <p
            style={{
              fontSize: 11,
              color: "#9CA3AF",
              textAlign: "center",
              marginTop: 14,
            }}
          >
            By signing up, you agree to our{" "}
            <span style={{ color: INDIGO, cursor: "pointer" }}>Terms</span> and{" "}
            <span style={{ color: INDIGO, cursor: "pointer" }}>
              Privacy Policy
            </span>
            .
          </p>
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>
              Already have an account?{" "}
            </span>
            <button
              onClick={onLogin}
              style={{
                fontSize: 13,
                color: INDIGO,
                fontWeight: 700,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Onboarding spotlight ─────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    selector: "[data-spotlight='dashboard-tab']",
    headline: "Welcome to Kargo 👋",
    copy: "Your pasabuy command center. The Dashboard shows your active claims, deadlines, and order status at a glance.",
  },
  {
    selector: "[data-spotlight='batches-tab']",
    headline: "Claim items from batches",
    copy: "Sellers post trip batches here. Browse items, claim your slot before it fills up, and track status in real time.",
  },
  {
    selector: "[data-spotlight='payments-tab']",
    headline: "Pay before the countdown hits zero",
    copy: "All pending payments and deadlines are here. Upload your GCash or bank receipt to lock in your order.",
  },
  {
    selector: "[data-spotlight='role-toggle']",
    headline: "One account, two roles",
    copy: "Toggle to Seller mode to create your own pasabuy batch and manage buyers — no separate account needed.",
  },
]
function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [dir, setDir] = useState<"l" | "r">("l")
  const [contentKey, setContentKey] = useState(0)

  useEffect(() => {
    const el = document.querySelector(
      TOUR_STEPS[step].selector,
    ) as HTMLElement | null
    if (el) setRect(el.getBoundingClientRect())
  }, [step])

  const go = (next: number, d: "l" | "r") => {
    setDir(d)
    setContentKey((k) => k + 1)
    setStep(next)
  }

  const PAD = 10
  const sw = rect ? rect.width + PAD * 2 : 0
  const sh = rect ? rect.height + PAD * 2 : 0
  const sx = rect ? rect.left - PAD : 0
  const sy = rect ? rect.top - PAD : 0
  const tooltipW = 340
  const tooltipX = rect
    ? Math.max(
        12,
        Math.min(
          window.innerWidth - tooltipW - 12,
          rect.left + rect.width / 2 - tooltipW / 2,
        ),
      )
    : 0
  const tooltipY = rect ? sy + sh + 14 : 0
  const arrowX = rect ? rect.left + rect.width / 2 - tooltipX : tooltipW / 2
  const isLast = step === TOUR_STEPS.length - 1

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 198 }} />
      <div
        style={{
          position: "fixed",
          zIndex: 199,
          pointerEvents: "none",
          top: sy,
          left: sx,
          width: sw,
          height: sh,
          borderRadius: 10,
          boxShadow: "0 0 0 9999px rgba(10,10,30,0.68)",
          transition:
            "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          opacity: rect ? 1 : 0,
        }}
      />
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 200,
            pointerEvents: "none",
            top: sy - 4,
            left: sx - 4,
            width: sw + 8,
            height: sh + 8,
            borderRadius: 14,
            border: `2px solid ${CORAL}`,
            animation: "ping 1.8s ease-out infinite",
            transition:
              "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          }}
        />
      )}
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 200,
            pointerEvents: "none",
            top: sy - 4,
            left: sx - 4,
            width: sw + 8,
            height: sh + 8,
            borderRadius: 14,
            border: `2px solid ${CORAL}`,
            animation: "ping 1.8s ease-out 0.7s infinite",
            transition:
              "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          }}
        />
      )}
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 201,
            top: tooltipY,
            left: tooltipX,
            width: tooltipW,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.24)",
            border: "1px solid #E5E7EB",
            transition: "top 0.3s ease-in-out,left 0.3s ease-in-out",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -7,
              left: Math.max(14, Math.min(tooltipW - 24, arrowX - 7)),
              width: 14,
              height: 14,
              background: "#fff",
              transform: "rotate(45deg)",
              border: "1px solid #E5E7EB",
              borderRight: "none",
              borderBottom: "none",
            }}
          />
          <div
            style={{
              height: 3,
              background: "#F3F4F6",
              borderRadius: "12px 12px 0 0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: INDIGO,
                width: `${((step + 1) / TOUR_STEPS.length) * 100}%`,
                transition: "width 0.3s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
          <div style={{ padding: "16px 18px 14px" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => go(i, i > step ? "l" : "r")}
                    role="button"
                    tabIndex={0}
                    aria-label={`Go to tour step ${i + 1} of ${TOUR_STEPS.length}`}
                    aria-current={i === step ? "step" : undefined}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        go(i, i > step ? "l" : "r")
                      }
                    }}
                    style={{
                      width: i === step ? 16 : 6,
                      height: 6,
                      borderRadius: 999,
                      background: i === step ? INDIGO : "#E5E7EB",
                      transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={onDone}
                style={{
                  fontSize: 11,
                  color: "#9CA3AF",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Skip tour
              </button>
            </div>
            <div key={contentKey} className={dir === "l" ? "pl" : "pr"}>
              <h3
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#111827",
                  marginBottom: 6,
                }}
              >
                {TOUR_STEPS[step].headline}
              </h3>
              <p
                style={{
                  fontSize: 12.5,
                  color: "#6B7280",
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}
              >
                {TOUR_STEPS[step].copy}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => go(step - 1, "r")}
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  visibility: step === 0 ? "hidden" : "visible",
                }}
              >
                ← Back
              </button>
              <PrimaryBtn
                onClick={() => (isLast ? onDone() : go(step + 1, "l"))}
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {isLast ? (
                  "Get Started 🚀"
                ) : (
                  <>
                    Next{" "}
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path
                        d="M3 6.5h7M8 4l2.5 2.5L8 9"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

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

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  batches,
  claims,
  setClaims,
  toPay,
  setToPay,
  payHistory,
  setPayHistory,
  setTab,
  role,
  orders,
  fulfillment,
  setFulfillment,
}: SharedState) {
  const [showPayAll, setShowPayAll] = useState(false)
  const [buyerProfile, setBuyerProfile] = useState<string | null>(null)
  const board = useFulfillmentBoard(setFulfillment)
  const pending = claims.filter((c) => c.status === "Pending")
  const pendingTotal = toPay.reduce((s, t) => s + t.amount, 0)

  const buyerStats = [
    {
      label: "Active Claims",
      value: String(claims.filter((c) => c.status === "Pending").length),
      icon: "📦",
      sub: "+3 this week",
      sc: GREEN,
      bg: "#E8F9F3",
    },
    {
      label: "Pending Payments",
      value: `₱${pendingTotal.toLocaleString()}`,
      icon: "💳",
      sub: `${toPay.length} items due soon`,
      sc: AMBER,
      bg: "#FFF8E8",
    },
    {
      label: "Waitlist Position",
      value: "#3",
      icon: "⏳",
      sub: "Laneige Lip Mask",
      sc: "#6B7280",
      bg: CYAN_L,
    },
    {
      label: "Completed Orders",
      value: "47",
      icon: "✅",
      sub: "All time",
      sc: "#6B7280",
      bg: "#F0EEFF",
    },
  ]
  const sellerStats = [
    {
      label: "Active Batches",
      value: String(batches.filter((b) => b.live).length),
      icon: "✈️",
      sub: "(open + scheduled)",
      sc: GREEN,
      bg: CREAM,
    },
    {
      label: "Awaiting Verification",
      value: "3",
      icon: "📋",
      sub: "Payment proofs to review",
      sc: AMBER,
      bg: CYAN_L,
    },
    {
      label: "Extension Requests",
      value: "2",
      icon: "⏳",
      sub: "Awaiting your approval",
      sc: "#6B7280",
      bg: "#FFF7ED",
    },
    {
      label: "Orders Fulfilled",
      value: String(
        PRIOR_FULFILLED + fulfillment.filter((o) => o.col === "Completed").length,
      ),
      icon: "✅",
      sub: "Completed this quarter",
      sc: "#6B7280",
      bg: "#F0FDF4",
    },
  ]
  const stats = role === "Seller" ? sellerStats : buyerStats
  const upcoming = toPay.slice(0, 4)

  const handlePayAll = (method: string) => {
    const newHist: PayHistRow[] = toPay.map((t, i) => ({
      id: payHistory.length + i + 1,
      product: t.product,
      batch: "",
      method,
      amount: t.amount,
      date: TODAY,
      status: "Paid and Reserved" as ClaimStatus,
    }))
    setPayHistory((h) => [...newHist, ...h])
    setClaims((prev) =>
      prev.map((c) =>
        toPay.some((t) => t.product === c.product) && c.status === "Pending"
          ? { ...c, status: "Paid and Reserved" as ClaimStatus }
          : c,
      ),
    )
    setToPay([])
    setShowPayAll(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="fi"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              style={{
                background: s.bg,
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xl">{s.icon}</span>
              </div>
              <div
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1,
                }}
                className="mb-1"
              >
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: s.sc,
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {s.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
      {role === "Seller" && (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "1fr 340px" }}
        >
          <Card>
            <SH
              title="Recent Orders"
              action={
                <SecondaryBtn onClick={() => setTab("My Claims")}>
                  View All
                </SecondaryBtn>
              }
            />
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {["Product", "Buyer", "Amount", "Status", "Deadline"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          color: "#9CA3AF",
                          fontWeight: 600,
                          fontSize: 11,
                          paddingBottom: 8,
                          textAlign: "left",
                          paddingRight: 12,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {claims.slice(0, 5).map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: "1px solid #F9FAFB" }}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setTab("My Claims")}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <ProductThumb name={c.product} />
                        <span style={{ color: "#111827", fontWeight: 500 }}>
                          {c.product}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={c.seller} size={20} />
                        <span style={{ color: "#374151", fontSize: 12 }}>
                          {c.seller}
                        </span>
                      </div>
                    </td>
                    <td
                      className="py-2.5 pr-3"
                      style={{
                        color: "#111827",
                        fontWeight: 700,
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{c.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5">
                      {c.status === "Pending" && c.hours > 0 ? (
                        <Countdown hours={c.hours} />
                      ) : (
                        <span style={{ color: "#D1D5DB", fontSize: 12 }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card style={{ background: "#FFFBF5", border: "1px solid #FCE4C8" }}>
            <SH title="Pending Actions" />
            <div className="space-y-3">
              {[
                {
                  icon: "📋",
                  label: "Payments to Verify",
                  count: 3,
                  tab: "Payments" as Tab,
                },
                {
                  icon: "⏳",
                  label: "Extension Requests",
                  count: 2,
                  tab: "My Claims" as Tab,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}
                    >
                      {item.count} pending
                    </div>
                  </div>
                  <SecondaryBtn onClick={() => setTab(item.tab)}>
                    View All
                  </SecondaryBtn>
                </div>
              ))}
              <div
                style={{
                  background: "#D4F5EA",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#065F46",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                ✅ No "Pay All Pending" needed — sellers verify, not pay.
              </div>
            </div>
          </Card>
        </div>
      )}
      {role === "Seller" && (
        <Card>
          <SH
            title="Fulfillment Board"
            action={
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                Track all orders across fulfillment stages
              </span>
            }
          />
          <div
            style={{
              display: "flex",
              gap: 16,
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {KANBAN_COLS.map((col) => {
              const colColors: Record<string, string> = {
                Claimed: "#EEF0FF",
                "Pending Payment": "#FFF7ED",
                "Payment Confirmed": CYAN_L,
                Preparing: "#F0FDF4",
                Completed: "#D4F5EA",
                Cancelled: "#FEE2E2",
              }
              const colOrders = fulfillment.filter((o) => o.col === col)
              return (
                <div key={col} style={{ minWidth: 180, flexShrink: 0 }}>
                  <div
                    style={{
                      background: colColors[col] || CREAM,
                      borderRadius: "8px 8px 0 0",
                      padding: "8px 12px",
                      marginBottom: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#374151",
                      }}
                    >
                      {col}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#6B7280",
                        background: "rgba(255,255,255,0.6)",
                        borderRadius: 999,
                        padding: "1px 7px",
                      }}
                    >
                      {colOrders.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {colOrders.map((o) => {
                      const isExpanded = board.expandedId === o.id
                      return (
                        <div
                          key={o.id}
                          style={{
                            background: "#fff",
                            borderRadius: 8,
                            border: "1px solid #E5E7EB",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div
                            onClick={() => board.toggle(o.id)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} order for ${o.buyer} — ${o.product}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                board.toggle(o.id)
                              }
                            }}
                            style={{ padding: "9px 10px", cursor: "pointer" }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar name={o.buyer} size={18} />
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "#374151",
                                }}
                              >
                                {o.buyer}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7280" }}>
                              {o.product}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: INDIGO,
                                marginTop: 4,
                                fontFamily: "'Plus Jakarta Sans',sans-serif",
                              }}
                            >
                              ₱{o.amount.toLocaleString()}
                            </div>
                          </div>
                          {isExpanded && (
                            <FulfillmentDetails order={o} onMove={board.move} />
                          )}
                        </div>
                      )
                    })}
                    {colOrders.length === 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9CA3AF",
                          textAlign: "center",
                          padding: "16px 0",
                        }}
                      >
                        —
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <FulfillmentLiveRegion text={board.announcement} />
        </Card>
      )}
      {role !== "Seller" && (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "1fr 340px" }}
        >
          <Card>
            <SH
              title="Recent Claims"
              action={
                <SecondaryBtn onClick={() => setTab("My Claims")}>
                  View All
                </SecondaryBtn>
              }
            />
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {[
                    "Product",
                    "Batch",
                    "Seller",
                    "Amount",
                    "Status",
                    "Deadline",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        color: "#9CA3AF",
                        fontWeight: 600,
                        fontSize: 11,
                        paddingBottom: 8,
                        textAlign: "left",
                        paddingRight: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claims.slice(0, 5).map((c) => {
                  return (
                    <tr
                      key={c.id}
                      style={{ borderBottom: "1px solid #F9FAFB" }}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setTab("My Claims")}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <ProductThumb name={c.product} />
                          <span style={{ color: "#111827", fontWeight: 500 }}>
                            {c.product}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: "#6B7280", fontSize: 12 }}>
                            {c.batch}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={c.seller} size={20} />
                          <span style={{ color: "#374151", fontSize: 12 }}>
                            {c.seller}
                          </span>
                        </div>
                      </td>
                      <td
                        className="py-2.5 pr-3"
                        style={{
                          color: "#111827",
                          fontWeight: 700,
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                        }}
                      >
                        ₱{c.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="py-2.5">
                        {c.status === "Pending" && c.hours > 0 ? (
                          <Countdown hours={c.hours} />
                        ) : (
                          <span style={{ color: "#D1D5DB", fontSize: 12 }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
          <Card style={{ background: "#FFFBF5", border: "1px solid #FCE4C8" }}>
            <SH title="Upcoming Deadlines" />
            <div className="space-y-3">
              {upcoming.map((d, i) => (
                <div
                  key={i}
                  style={{
                    background:
                      d.hours < 6
                        ? "#FFF7ED"
                        : d.hours < 24
                          ? "#FFFBF0"
                          : "#fff",
                    borderRadius: 8,
                    border: `1px solid ${
                      d.hours < 6
                        ? "#FED7AA"
                        : d.hours < 24
                          ? "#FDE68A"
                          : "#F3F4F6"
                    }`,
                  }}
                  className="p-3 flex items-center justify-between"
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {d.product}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {d.seller}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}
                    >
                      ₱{d.amount.toLocaleString()}
                    </div>
                    <Countdown hours={d.hours} />
                  </div>
                </div>
              ))}
              {toPay.length > 0 ? (
                <PrimaryBtn
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 4,
                  }}
                  onClick={() => setShowPayAll(true)}
                >
                  Pay All Pending
                </PrimaryBtn>
              ) : (
                <div
                  style={{
                    background: "#D4F5EA",
                    borderRadius: 8,
                    padding: "10px 14px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "#065F46",
                    fontWeight: 600,
                  }}
                >
                  ✅ All payments cleared!
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
      {showPayAll && (
        <PayModal
          items={toPay.map((t) => ({ product: t.product, amount: t.amount }))}
          onConfirm={handlePayAll}
          onClose={() => setShowPayAll(false)}
        />
      )}
      {buyerProfile && (
        <BuyerProfileModal
          buyer={buyerProfile}
          onClose={() => setBuyerProfile(null)}
        />
      )}
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
