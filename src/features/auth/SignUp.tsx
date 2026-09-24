import { useCallback, useRef, useState } from "react"
import { Camera, Plane, ShoppingBasket } from "lucide-react"
import type { BirState, Role, UserInfo } from "@/types"
import { PrimaryBtn, Toggle } from "@/components/shared"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import AuthInput from "./AuthInput"
import AuthLayout from "./AuthLayout"
import BirVerifier from "./BirVerifier"

const platforms = ["Facebook", "TikTok", "Instagram"] as const

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

  const photoRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState("")

  const [shopName, setShopName] = useState("")
  const [phone, setPhone] = useState("")
  const [socials, setSocials] = useState<
    Record<string, { on: boolean; url: string }>
  >({
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
          socialLinks: Object.fromEntries(
            Object.entries(socials)
              .filter(([, value]) => value.on && value.url.trim())
              .map(([key, value]) => [key, value.url.trim()]),
          ),
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
        setErrs({
          general: "Account created. Check your email to confirm it, then log in.",
        })
        return
      }
      onSuccess({ ...result.user, role })
    } catch (error) {
      setLoading(false)
      setErrs({
        general: error instanceof Error ? error.message : "Unable to create account.",
      })
    }
  }, [name, email, password, role, shopName, socials, birState, terms, onSuccess])

  const socialIcon = (platform: (typeof platforms)[number]) => {
    if (platform === "Instagram") return <Camera size={18} strokeWidth={3} />
    return <span>{platform === "Facebook" ? "f" : "♪"}</span>
  }

  return (
    <AuthLayout page="signup" condensed={role === "Seller"}>
      <div className="auth-content auth-signup-content pl">
        <header className="auth-heading">
          <h1>Create your account</h1>
          <p>Join Kargo to buy or sell pasabuy items</p>
        </header>

        <div className="auth-signup-fields">
          {role === "Buyer" && (
            <div className="auth-photo-field">
              <button
                type="button"
                className="auth-photo-button"
                aria-label="Upload profile photo"
                onClick={() => photoRef.current?.click()}
              >
                {photo ? <span>{photo}</span> : <b>＋</b>}
              </button>
              <label>
                Profile Photo <span>(optional)</span>
              </label>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  if (event.target.files?.[0]) setPhoto(event.target.files[0].name)
                }}
              />
            </div>
          )}

          <AuthInput
            label="Full Name"
            value={name}
            onChange={setName}
            error={errs.name}
            placeholder="Juan Dela Cruz"
          />
          <AuthInput
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            error={errs.email}
            placeholder="juan@gmail.com"
          />
          <AuthInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            error={errs.password}
            placeholder="Min. 8 characters"
          />

          <div className="auth-socials">
            <label className="auth-section-label">
              Contact &amp; Social Links{" "}
              <span>{role === "Seller" ? "(at least one required)" : "(optional)"}</span>
            </label>
            <div className="auth-social-list">
              {platforms.map((platform) => (
                <div className="auth-social-row" key={platform}>
                  <span className={`auth-social-icon auth-social-icon--${platform.toLowerCase()}`}>
                    {socialIcon(platform)}
                  </span>
                  <span className="auth-social-name">{platform}</span>
                  <Toggle
                    on={socials[platform].on}
                    onChange={(on) =>
                      setSocials((current) => ({
                        ...current,
                        [platform]: { ...current[platform], on },
                      }))
                    }
                    label={`Connect ${platform}`}
                    compact
                  />
                  <input
                    value={socials[platform].url}
                    onChange={(event) =>
                      setSocials((current) => ({
                        ...current,
                        [platform]: { ...current[platform], url: event.target.value },
                      }))
                    }
                    placeholder="Profile URL or @username"
                    aria-label={`${platform} profile`}
                    disabled={!socials[platform].on}
                  />
                </div>
              ))}
            </div>
            {errs.social && <p className="auth-error fi">{errs.social}</p>}
          </div>

          {role === "Seller" && (
            <div className="auth-seller-fields fi">
              <AuthInput
                label="Shop Name"
                value={shopName}
                onChange={setShopName}
                error={errs.shopName}
                placeholder="e.g. Maria's Japan Haul Shop"
              />
              <AuthInput
                label="Contact Number"
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="+63 9XX XXX XXXX"
              />
              <div className="auth-bir-field">
                {isSupabaseConfigured ? (
                  <p>
                    BIR verification is optional. After creating your shop, you can submit
                    a badge from Settings to build buyer trust.
                  </p>
                ) : (
                  <>
                    <p>
                      Optional — a verified BIR badge can make your shop more trustworthy,
                      but it is not required to start selling.
                    </p>
                    <BirVerifier birState={birState} setBirState={setBirState} />
                  </>
                )}
              </div>
              <div>
                <label className="auth-terms">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(event) => setTerms(event.target.checked)}
                  />
                  <span>
                    I agree to the <em>Terms of Service</em> and <em>Privacy Policy</em>.
                    Linked accounts and BIR badge are reference indicators only, not
                    automatically verified by Kargo.
                  </span>
                </label>
                {errs.terms && <p className="auth-error fi">{errs.terms}</p>}
              </div>
            </div>
          )}

          <div className="auth-role-field">
            <label className="auth-section-label">I want to join as a...</label>
            <div className="auth-role-options">
              {(["Buyer", "Seller"] as Role[]).map((option) => (
                <button
                  type="button"
                  key={option}
                  className={role === option ? "is-selected" : ""}
                  onClick={() => setRole(option)}
                  aria-pressed={role === option}
                >
                  <strong>
                    {option === "Buyer" ? (
                      <ShoppingBasket size={17} aria-hidden="true" />
                    ) : (
                      <Plane size={17} aria-hidden="true" />
                    )}
                    {option}
                  </strong>
                  <small>
                    {option === "Buyer" ? "Claim items from batches" : "Run pasabuy batches"}
                  </small>
                </button>
              ))}
            </div>
          </div>

          {errs.general && (
            <p
              role="status"
              className={`auth-general-message${
                errs.general.startsWith("Account created") ? " is-success" : ""
              }`}
            >
              {errs.general}
            </p>
          )}

          <PrimaryBtn onClick={submit} loading={loading} style={{ width: "100%" }}>
            {loading
              ? role === "Seller"
                ? "Creating shop…"
                : "Creating account…"
              : role === "Seller"
                ? "Create Shop"
                : "Create account"}
          </PrimaryBtn>
        </div>

        <div className="auth-switch-copy auth-signup-switch">
          <span>Already have an account? </span>
          <button onClick={onLogin} className="auth-link-button">
            Log in
          </button>
        </div>
        <p className="auth-legal-copy">
          By signing up, you agree to our <span>Terms</span> and <span>Privacy Policy</span>.
        </p>
      </div>
    </AuthLayout>
  )
}
