import { useCallback, useRef, useState } from "react"
import { Camera, Plane, ShoppingBasket } from "lucide-react"
import type { Role, UserInfo } from "@/types"

// Signup can only ever create a Buyer or Seller; Admin is granted out-of-band.
type SignupRole = Exclude<Role, "Admin">
import { PrimaryBtn, Toggle } from "@/components/shared"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import AuthInput from "./AuthInput"
import AuthLayout from "./AuthLayout"
import ResendConfirmation from "./ResendConfirmation"
import { authErrorMessage } from "./authErrors"


const platforms = ["Facebook", "TikTok", "Instagram"] as const

export default function SignUp({
  onLogin,
  onSuccess,
  fromBatchLink = false,
}: {
  onLogin: () => void
  onSuccess: (u: UserInfo) => void
  fromBatchLink?: boolean
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<SignupRole>("Buyer")
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const photoRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState("")

  const [shopName, setShopName] = useState("")
  const [socials, setSocials] = useState<
    Record<string, { on: boolean; url: string }>
  >({
    Facebook: { on: false, url: "" },
    TikTok: { on: false, url: "" },
    Instagram: { on: false, url: "" },
  })

  const [terms, setTerms] = useState(false)

  // Outcome of a signup that needs the user to do something by email.
  const [notice, setNotice] = useState<
    { kind: "sent" | "exists"; email: string } | null
  >(null)

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
        socials,
        role,
      })
      setLoading(false)
      if (result.status === "already_registered") {
        // Supabase sends nothing for an address that already has an account, so
        // never claim an email is on its way.
        setErrs({})
        setNotice({ kind: "exists", email: email.trim() })
        return
      }
      if (result.status === "confirmation_sent") {
        setErrs({})
        setNotice({ kind: "sent", email: email.trim() })
        return
      }
      setNotice(null)
      onSuccess({ ...result.user, role })
    } catch (error) {
      setLoading(false)
      setErrs({
        general: authErrorMessage(
          error,
          "Unable to create account. Please try again.",
        ),
      })
    }
  }, [name, email, password, role, shopName, socials, terms, onSuccess])

  const socialIcon = (platform: (typeof platforms)[number]) => {
    if (platform === "Instagram") return <Camera size={18} strokeWidth={3} />
    return <span>{platform === "Facebook" ? "f" : "♪"}</span>
  }

  return (
    <AuthLayout page="signup">
      <div className="auth-content auth-signup-content pl py-6">
        <header className="auth-heading">
          <h1>Start your Pasabuy Journey!</h1>
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
            {fromBatchLink && role === "Buyer" && (
              <p className="mb-3 text-sm leading-5 text-gray-600">
                Recommended: helpers often check a social profile before confirming
                a reservation.
              </p>
            )}
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
              <div>
                <label className="auth-terms">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(event) => setTerms(event.target.checked)}
                  />
                  <span>
                    I agree to the <em>Terms of Service</em> and <em>Privacy Policy</em>.
                    Linked accounts are reference indicators only and are not
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
              {(["Buyer", "Seller"] as SignupRole[]).map((option) => (
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
            <p role="status" className="auth-general-message">
              {errs.general}
            </p>
          )}

          {notice?.kind === "sent" && (
            <>
              <p role="status" className="auth-general-message is-success">
                Account created. We sent a confirmation link to{" "}
                <strong>{notice.email}</strong>. Open it, then log in. If it
                hasn&apos;t arrived in a minute, check your spam folder or resend
                it below.
              </p>
              <ResendConfirmation email={notice.email} />
            </>
          )}

          {notice?.kind === "exists" && (
            <>
              <p role="status" className="auth-general-message">
                <strong>{notice.email}</strong> already has an account, so we
                didn&apos;t send a new email. Log in instead. If you never
                confirmed it, resend the confirmation link below.
              </p>
              <ResendConfirmation email={notice.email} />
            </>
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
