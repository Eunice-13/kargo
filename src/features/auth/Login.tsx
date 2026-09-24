import { useCallback, useState } from "react"
import type { UserInfo } from "@/types"
import { PrimaryBtn } from "@/components/shared"
import {
  hasSupabaseCredentials,
  isDemoSession,
  isSupabaseConfigured,
  setDemoMode,
} from "@/lib/supabase"
import { kargoApi } from "@/services"
import AuthInput from "./AuthInput"
import AuthLayout from "./AuthLayout"

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
  const [forgotSent, setForgotSent] = useState(false)

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
      setPassErr(error instanceof Error ? error.message : "Unable to sign in.")
    }
  }, [email, password, onSuccess])

  return (
    <AuthLayout page="login">
      <div className="auth-content pu">
        <header className="auth-heading">
          <h1>Welcome back!</h1>
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
                onClick={async () => {
                  setForgotSent(true)
                  if (isSupabaseConfigured && email.includes("@")) {
                    await kargoApi.requestPasswordReset(email)
                  }
                }}
                className="auth-link-button"
              >
                Forgot password?
              </button>
              {forgotSent && (
                <div role="status" className="auth-recovery-status">
                  If this email is registered, recovery instructions will be sent shortly.
                </div>
              )}
            </div>
          </div>
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

        {/* When a real backend is configured, let the user choose per session
            between the seeded demo (password123, in-memory) and a live run
            against Supabase. Absent credentials, the app is always in demo mode
            and only the demo hint is shown. */}
        {hasSupabaseCredentials && (
          <div className="auth-mode-switch" role="group" aria-label="Choose sign-in mode">
            <button
              type="button"
              className={`auth-mode-option${isDemoSession ? " is-active" : ""}`}
              aria-pressed={isDemoSession}
              onClick={() => setDemoMode(true)}
            >
              <strong>Demo</strong>
              <small>Explore with seed data</small>
            </button>
            <button
              type="button"
              className={`auth-mode-option${!isDemoSession ? " is-active" : ""}`}
              aria-pressed={!isDemoSession}
              onClick={() => setDemoMode(false)}
            >
              <strong>Live</strong>
              <small>Sign in to Supabase</small>
            </button>
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className="auth-demo-note">
            <p>
              <strong>Demo:</strong> any email + password <code>password123</code>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
