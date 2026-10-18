import { useEffect, useState } from "react"
import { kargoApi } from "@/services"
import { authErrorMessage } from "./authErrors"

// Matches the project's minimum gap between confirmation emails (smtp_max_frequency).
const COOLDOWN_SECONDS = 60

// Resend control for an unconfirmed signup. Supabase answers the same way whether
// or not the address has an unconfirmed account, so the success copy is worded to
// stay true either way ("if ... we've sent").
export default function ResendConfirmation({ email }: { email: string }) {
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [notice, setNotice] = useState<
    { tone: "sent" | "error"; text: string } | null
  >(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const resend = async () => {
    if (!email.includes("@")) {
      setNotice({ tone: "error", text: "Enter your email address first." })
      return
    }
    setSending(true)
    setNotice(null)
    try {
      await kargoApi.resendConfirmation(email)
      setNotice({
        tone: "sent",
        text: "If this email has an account waiting to be confirmed, we've sent a new link. Check your inbox and spam folder.",
      })
      setCooldown(COOLDOWN_SECONDS)
    } catch (error) {
      setNotice({
        tone: "error",
        text: authErrorMessage(
          error,
          "We couldn't resend the confirmation email. Please try again.",
        ),
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="auth-forgot-row">
      <button
        type="button"
        className="auth-link-button"
        onClick={resend}
        disabled={sending || cooldown > 0}
      >
        {sending
          ? "Sending…"
          : cooldown > 0
            ? `Resend email in ${cooldown}s`
            : "Resend confirmation email"}
      </button>
      {notice && (
        <div
          role="status"
          className={`auth-recovery-status${
            notice.tone === "error" ? " is-error" : ""
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  )
}
