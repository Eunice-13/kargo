import { useCallback, useState } from "react"
import type { UserInfo } from "@/types"
import { PrimaryBtn } from "@/components/shared"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import AuthInput from "./AuthInput"
import AuthLayout from "./AuthLayout"
import ResendConfirmation from "./ResendConfirmation"
import { authErrorMessage } from "./authErrors"

export default function Login({
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
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [forgotSending, setForgotSending] = useState(false)
  const [forgotNotice, setForgotNotice] = useState<
    { tone: "sent" | "error"; text: string } | null
  >(null)

  const submit = useCallback(async () => {
    let ok = true
    if (!email.trim() || !email.includes("@")) {
      setEmailErr("Enter a valid email address.")
      ok = false
    } else setEmailErr("")
    if (!password) {
      setPassErr("Password is required.")
      ok = false
    } else if (!isSupabaseConfigured && password !== "password123") {
      setPassErr("Incorrect email or password.")
      ok = false
    } else setPassErr("")
    if (!ok) return
    setNeedsConfirm(false)
    setLoading(true)
    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setLoading(false)
        onSuccess({ name: "Juan Dela Cruz", email, role: "Buyer" })
      }, 600)
      return
    }
    try {
      onSuccess(await kargoApi.signIn(email.trim(), password))
      setLoading(false)
    } catch (error) {
      setLoading(false)
      setPassErr(authErrorMessage(error, "Unable to sign in. Please try again."))
      // An unconfirmed account can never log in until a link is opened, so offer
      // a fresh one right where the user is stuck.
      const detail = `${(error as { code?: string } | null)?.code ?? ""} ${
        error instanceof Error ? error.message : ""
      }`.toLowerCase()
      setNeedsConfirm(
        detail.includes("email_not_confirmed") ||
          detail.includes("email not confirmed"),
      )
    }
  }, [email, password, onSuccess])

  const requestReset = useCallback(async () => {
    if (!email.includes("@")) {
      setForgotNotice({
        tone: "error",
        text: "Enter your email address above, then tap Forgot password again.",
      })

      return
    }

    if (!isSupabaseConfigured) {
      setForgotNotice({
        tone: "error",
        text: "Password recovery needs a connected KARGO account.",
      })

      return
    }

    setForgotSending(true)

    try {
      await kargoApi.requestPasswordReset(email.trim())

      // Deliberately says nothing about whether the address is registered.
      setForgotNotice({
        tone: "sent",
        text: "If this email is registered, recovery instructions will be sent shortly.",
      })
    } catch (error) {
      setForgotNotice({
        tone: "error",
        text: authErrorMessage(
          error,
          "We couldn't send the reset email. Please try again.",
        ),
      })
    } finally {
      setForgotSending(false)
    }
  }, [email])

  return (
    <AuthLayout page="login">
      <div className="auth-content pu">
        <header className="auth-heading">
          <h1>Your Budol, Our Kargo!</h1>
          <p>Sign in to your Kargo account</p>
        </header>

        <div className="auth-login-fields">
          <AuthInput
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            error={emailErr}
            placeholder="juan@gmail.com"
          />
          <div className="auth-password-group">
            <AuthInput
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={passErr}
              placeholder="••••••••"
            />
            <div className="auth-forgot-row">
              <button
                type="button"
                onClick={requestReset}
                disabled={forgotSending}
                className="auth-link-button"
              >
                {forgotSending ? "Sending…" : "Forgot password?"}
              </button>
              {forgotNotice && (
                <div
                  role="status"
                  className={`auth-recovery-status${
                    forgotNotice.tone === "error" ? " is-error" : ""
                  }`}
                >
                  {forgotNotice.text}
                </div>
              )}
            </div>
          </div>
          {needsConfirm && <ResendConfirmation email={email.trim()} />}
          <PrimaryBtn onClick={submit} loading={loading} style={{ width: "100%" }}>
            {loading ? "Signing in…" : "Login"}
          </PrimaryBtn>
        </div>

        <div className="auth-switch-copy">
          <span>Don’t have an account? </span>
          <button onClick={onSignUp} className="auth-link-button">
            Sign up
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}
