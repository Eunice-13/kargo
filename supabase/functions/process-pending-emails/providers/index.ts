import type { SenderConfig } from "../email/config.ts"

export type OutgoingEmail = {
  /** Queue row id; doubles as the provider idempotency key where supported. */
  id: string
  to: { email: string; name?: string }
  subject: string
  html: string
  text: string
}

export type SendOutcome =
  | { ok: true; messageId: string | null; requestId: string | null }
  | { ok: false; status: number; error: string; requestId: string | null }

export function isRetryableStatus(status: number): boolean {
  return status >= 500 || [408, 409, 425, 429].includes(status)
}

export function sendEmail(email: OutgoingEmail, config: SenderConfig): Promise<SendOutcome> {
  return config.provider === "brevo"
    ? sendWithBrevo(email, config)
    : sendWithNylas(email, config)
}

/* ── Nylas ───────────────────────────────────────────────────────────────────
   POST /v3/grants/{grant_id}/messages/send. `body` is HTML unless is_plaintext
   is true, so the flag is sent explicitly rather than relied on as a default. */

type NylasResponse = {
  request_id?: string
  data?: { id?: string }
  error?: { message?: string; type?: string }
}

async function sendWithNylas(
  email: OutgoingEmail,
  config: Extract<SenderConfig, { provider: "nylas" }>,
): Promise<SendOutcome> {
  const endpoint = `${config.apiUri}/v3/grants/${encodeURIComponent(config.grantId)}/messages/send`

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": email.id,
    },
    body: JSON.stringify({
      to: [{ email: email.to.email, ...(email.to.name ? { name: email.to.name } : {}) }],
      subject: email.subject,
      body: email.html,
      is_plaintext: false,
    }),
  })

  const payload = (await response.json().catch(() => null)) as NylasResponse | null

  if (response.ok) {
    return { ok: true, messageId: payload?.data?.id ?? null, requestId: payload?.request_id ?? null }
  }

  const detail = payload?.error?.message || payload?.error?.type || "Unknown Nylas error"
  return {
    ok: false,
    status: response.status,
    error: `Nylas ${response.status}: ${detail}`.slice(0, 1000),
    requestId: payload?.request_id ?? null,
  }
}

/* ── Brevo ───────────────────────────────────────────────────────────────────
   POST /v3/smtp/email. Brevo takes htmlContent and textContent separately, so
   the plain-text part we already render ships as a real multipart alternative
   instead of being thrown away. */

type BrevoResponse = {
  messageId?: string
  message?: string
  code?: string
}

async function sendWithBrevo(
  email: OutgoingEmail,
  config: Extract<SenderConfig, { provider: "brevo" }>,
): Promise<SendOutcome> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: email.to.email, ...(email.to.name ? { name: email.to.name } : {}) }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    }),
  })

  const payload = (await response.json().catch(() => null)) as BrevoResponse | null

  if (response.ok) {
    return { ok: true, messageId: payload?.messageId ?? null, requestId: null }
  }

  const detail = payload?.message || payload?.code || "Unknown Brevo error"
  return {
    ok: false,
    status: response.status,
    error: `Brevo ${response.status}: ${detail}`.slice(0, 1000),
    requestId: null,
  }
}
