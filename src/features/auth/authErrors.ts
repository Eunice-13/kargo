// Supabase reports auth failures as short codes plus provider strings such as
// "Email rate limit exceeded" and "Email not confirmed". Those read like
// internal faults to a buyer or seller, so map the cases we know to copy that
// says what to do next. Anything unrecognized keeps the caller's fallback and is
// logged, so an unexpected failure stays diagnosable from the console.
const COPY: Array<[needles: string[], message: string]> = [
  [
    ["over_email_send_rate_limit", "email rate limit"],
    "We couldn't send the confirmation email just now. Please wait a few minutes and try again.",
  ],
  [
    ["user already registered", "user_already_exists", "email_exists"],
    "An account with this email already exists. Try logging in instead.",
  ],
  [
    ["email not confirmed", "email_not_confirmed"],
    "This account still needs confirming. Open the link in the email we sent you.",
  ],
  [
    ["over_request_rate_limit", "too many requests"],
    "Too many attempts. Please wait a minute and try again.",
  ],
  [
    ["weak_password", "password should be at least", "password is too short"],
    "Choose a stronger password of at least 8 characters.",
  ],
  [
    ["email_address_invalid", "unable to validate email", "invalid email"],
    "Enter a valid email address.",
  ],
  [
    ["signup_disabled", "signups not allowed"],
    "New sign-ups are currently closed. Please contact KARGO support.",
  ],
  [
    ["invalid login credentials", "invalid_credentials"],
    "That email and password don't match. Check them and try again.",
  ],
  [
    [
      "failed to fetch",
      "networkerror",
      "network request failed",
      "load failed",
    ],
    "We couldn't reach KARGO. Check your connection and try again.",
  ],
]

export function authErrorMessage(error: unknown, fallback: string): string {
  const code =
    typeof (error as { code?: unknown } | null)?.code === "string"
      ? (error as { code: string }).code
      : ""

  const message = error instanceof Error ? error.message : ""

  const haystack = `${code} ${message}`.toLowerCase()

  const mapped = COPY.find(([needles]) =>
    needles.some((needle) => haystack.includes(needle)),
  )

  if (mapped) return mapped[1]

  console.warn(
    `Unmapped auth error (${code || "no code"}): ${message || "no message"}`,
  )

  return fallback
}
