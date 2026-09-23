import { useState, useCallback } from "react"
import type { UserInfo } from "@/types"
import { INDIGO, CREAM, CYAN_L, SKY } from "@/constants/theme"
import { PrimaryBtn } from "@/components/shared"
import AuthInput from "./AuthInput"
import LogoMark from "./LogoMark"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

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

  const [fbLoading, setFbLoading] = useState(false)
  // Facebook as a connected-account login option, consistent with the
  // "Linked Accounts" settings flow (#Task 13). Demo mode signs in a
  // Facebook-linked identity; real OAuth is out of scope for this build.
  const continueWithFacebook = useCallback(() => {
    if (isSupabaseConfigured) {
      setPassErr("Facebook sign-in isn't connected yet — use your email and password for now.")
      return
    }
    setFbLoading(true)
    setTimeout(() => {
      setFbLoading(false)
      onSuccess({
        name: "Juan Dela Cruz",
        email: email.trim() || "juan@facebook.demo",
        role: "Buyer",
        fb: "https://facebook.com/juan.delacruz",
      })
    }, 700)
  }, [email, onSuccess])

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
                  onClick={async () => {
                    setForgotSent(true)
                    if (isSupabaseConfigured && email.includes("@")) {
                      await kargoApi.requestPasswordReset(email)
                    }
                  }}
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "2px 0",
              }}
            >
              <span style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>or</span>
              <span style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            </div>
            <button
              type="button"
              onClick={continueWithFacebook}
              disabled={fbLoading}
              style={{
                width: "100%",
                padding: "11px 0",
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: "#1877F2",
                border: "none",
                borderRadius: 8,
                cursor: fbLoading ? "default" : "pointer",
                opacity: fbLoading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  color: "#1877F2",
                  fontSize: 13,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                f
              </span>
              {fbLoading ? "Connecting…" : "Continue with Facebook"}
            </button>
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
          {!isSupabaseConfigured && <div
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
          </div>}
        </div>
      </div>
    </div>
  )
}

