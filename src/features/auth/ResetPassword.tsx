import { useCallback, useEffect, useState } from "react"

import { PrimaryBtn } from "@/components/shared"

import { isSupabaseConfigured, supabase } from "@/lib/supabase"

import { kargoApi } from "@/services"

import AuthInput from "./AuthInput"

import AuthLayout from "./AuthLayout"

import { authErrorMessage } from "./authErrors"

export default function ResetPassword({
  onDone,

  onBack,
}: {
  onDone: () => void

  onBack: () => void
}) {
  const [password, setPassword] = useState("")

  const [confirm, setConfirm] = useState("")

  const [errs, setErrs] = useState<Record<string, string>>({})

  const [general, setGeneral] = useState("")

  const [loading, setLoading] = useState(false)

  const [saved, setSaved] = useState(false)

  // null while the session is still being read.

  const [linkValid, setLinkValid] = useState<boolean | null>(null)

  // Supabase signs the visitor in with a short-lived session when it processes a

  // recovery link, so the screen is only usable while that session is present.

  // Opening the path directly has no session and needs its own explanation.

  useEffect(() => {
    let active = true

    if (!isSupabaseConfigured || !supabase) {
      setLinkValid(false)

      return
    }

    supabase.auth

      .getSession()

      .then(({ data }) => {
        if (active) setLinkValid(Boolean(data.session))
      })

      .catch(() => {
        if (active) setLinkValid(false)
      })

    return () => {
      active = false
    }
  }, [])

  const submit = useCallback(async () => {
    const e: Record<string, string> = {}

    if (password.length < 8)
      e.password = "Password must be at least 8 characters."

    if (confirm !== password) e.confirm = "Passwords do not match."

    setErrs(e)

    setGeneral("")

    if (Object.keys(e).length > 0) return

    setLoading(true)

    try {
      await kargoApi.updatePassword(password)

      setLoading(false)

      setSaved(true)
    } catch (error) {
      setLoading(false)

      setGeneral(
        authErrorMessage(
          error,

          "We couldn't update your password. Please try again.",
        ),
      )
    }
  }, [password, confirm])

  if (linkValid === null) {
    return (
      <AuthLayout page="reset">
        <div className="auth-content">
          <header className="auth-heading">
            <h1>Checking your link</h1>
            <p>One moment while we confirm your reset link.</p>
          </header>
        </div>
      </AuthLayout>
    )
  }

  if (!linkValid) {
    return (
      <AuthLayout page="reset">
        <div className="auth-content">
          <header className="auth-heading">
            <h1>Link expired</h1>
            <p>
              This reset link is no longer valid. Log back in and choose "Forgot
              password?" to request a fresh one.
            </p>
          </header>
          <PrimaryBtn onClick={onBack} style={{ width: "100%" }}>
            Back to log in
          </PrimaryBtn>
        </div>
      </AuthLayout>
    )
  }

  if (saved) {
    return (
      <AuthLayout page="reset">
        <div className="auth-content">
          <header className="auth-heading">
            <h1>Password updated</h1>
            <p>Use your new password the next time you log in.</p>
          </header>
          <PrimaryBtn onClick={onDone} style={{ width: "100%" }}>
            Continue to KARGO
          </PrimaryBtn>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout page="reset">
      <div className="auth-content pu">
        <header className="auth-heading">
          <h1>Set a new password</h1>
          <p>Pick something you haven't used on KARGO before.</p>
        </header>

        <div className="auth-login-fields">
          <AuthInput
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            error={errs.password}
            placeholder="Min. 8 characters"
          />
          <AuthInput
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            error={errs.confirm}
            placeholder="Repeat your password"
          />

          {general && (
            <p role="status" className="auth-general-message">
              {general}
            </p>
          )}

          <PrimaryBtn
            onClick={submit}
            loading={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Updating…" : "Update password"}
          </PrimaryBtn>
        </div>

        <div className="auth-switch-copy">
          <button onClick={onBack} className="auth-link-button">
            Back to log in
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}
