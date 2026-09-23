import { useState, useRef, useCallback } from "react"
import { ShoppingBasket, Plane } from "lucide-react"
import type { UserInfo, Role, BirState } from "@/types"
import { INDIGO, CREAM } from "@/constants/theme"
import { PrimaryBtn, Toggle } from "@/components/shared"
import AuthInput from "./AuthInput"
import LogoMark from "./LogoMark"
import BirVerifier from "./BirVerifier"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

export default function SignUp({
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
  const [birState, setBirState] = useState<BirState>("None")
  const [terms, setTerms] = useState(false)

  const submit = useCallback(async () => {
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
      if (!terms) e.terms = "You must agree to the Terms and Privacy Policy."
    }
    setErrs(e)
    if (Object.keys(e).length > 0) return
    setLoading(true)
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setLoading(false)
        onSuccess({
          name: name.trim(),
          email,
          role,
          sellerEnabled: role === "Seller",
          birState: role === "Seller" ? birState : "None",
          socialLinks: Object.fromEntries(Object.entries(socials).filter(([, value]) => value.on && value.url.trim()).map(([key, value]) => [key, value.url.trim()])),
        })
      }, 600)
      return
    }
    try {
      const result = await kargoApi.signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        shopName,
        phone,
        socials,
        role,
      })
      setLoading(false)
      if (result.needsEmailConfirmation || !result.user) {
        setErrs({ general: "Account created. Check your email to confirm it, then log in." })
        return
      }
      onSuccess({ ...result.user, role })
    } catch (error) {
      setLoading(false)
      setErrs({ general: error instanceof Error ? error.message : "Unable to create account." })
    }
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

                {/* BIR Registration Seal Badge verification */}
                <div>
                  {isSupabaseConfigured ? (
                    <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
                      BIR verification is optional. After creating your shop,
                      you can submit a badge from Settings to build buyer trust.
                    </div>
                  ) : (
                    <>
                    <div style={{ marginBottom: 8, fontSize: 11.5, color: "#6B7280", lineHeight: 1.5 }}>
                      Optional — a verified BIR badge can make your shop more trustworthy, but it is not required to start selling.
                    </div>
                    <BirVerifier birState={birState} setBirState={setBirState} />
                    </>
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
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {r === "Buyer" ? (
                        <ShoppingBasket size={14} aria-hidden="true" />
                      ) : (
                        <Plane size={14} aria-hidden="true" />
                      )}
                      {r}
                    </span>
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
            {errs.general && (
              <p role="status" style={{ fontSize: 12, color: errs.general.startsWith("Account created") ? "#0B7A59" : "#B91C1C" }}>
                {errs.general}
              </p>
            )}
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

