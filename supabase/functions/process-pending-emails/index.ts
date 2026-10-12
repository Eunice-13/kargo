import { withSupabase } from "npm:@supabase/server"

const MAX_ATTEMPTS = 5
const DEFAULT_BATCH_SIZE = 25

type QueueEmail = {
  id: string
  claim_token: string
  attempt_count: number
  recipient_email: string | null
  recipient_name: string | null
  subject: string
  body: string
}

type NylasResponse = {
  request_id?: string
  data?: { id?: string }
  error?: { message?: string; type?: string }
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing required secret: ${name}`)
  return value
}

function batchSizeFrom(body: unknown) {
  if (!body || typeof body !== "object" || !("limit" in body)) {
    return DEFAULT_BATCH_SIZE
  }

  const value = Number((body as { limit: unknown }).limit)
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.floor(value), 100)) : DEFAULT_BATCH_SIZE
}

function retryableStatus(status: number) {
  return status >= 500 || [408, 409, 425, 429].includes(status)
}

function errorMessage(status: number, response: NylasResponse | null) {
  const detail = response?.error?.message || response?.error?.type || "Unknown Nylas error"
  return `Nylas ${status}: ${detail}`.slice(0, 1000)
}

export default {
  fetch: withSupabase({ auth: "secret:email_worker" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 })
    }

    let input: unknown = null
    try {
      input = await req.json()
    } catch {
      // An empty body uses the default batch size.
    }

    let apiKey: string
    let grantId: string
    let apiUri: URL
    try {
      apiKey = requiredEnv("NYLAS_API_KEY")
      grantId = requiredEnv("NYLAS_GRANT_ID")
      apiUri = new URL(Deno.env.get("NYLAS_API_URI")?.trim() || "https://api.us.nylas.com")
      if (apiUri.protocol !== "https:") throw new Error("NYLAS_API_URI must use HTTPS")
    } catch (error) {
      console.error(error)
      return Response.json({ error: error instanceof Error ? error.message : "Invalid configuration" }, { status: 500 })
    }

    const { data, error: claimError } = await ctx.supabaseAdmin.rpc("claim_pending_emails", {
      p_limit: batchSizeFrom(input),
      p_lease_seconds: 300,
    })

    if (claimError) {
      console.error("Unable to claim pending emails", claimError)
      return Response.json({ error: "Unable to claim pending emails" }, { status: 500 })
    }

    const emails = (data || []) as QueueEmail[]
    const result = { claimed: emails.length, sent: 0, retried: 0, failed: 0 }
    const endpoint = `${apiUri.toString().replace(/\/$/, "")}/v3/grants/${encodeURIComponent(grantId)}/messages/send`

    for (const email of emails) {
      if (!email.recipient_email) {
        await ctx.supabaseAdmin
          .from("pending_emails")
          .update({
            status: "failed",
            locked_at: null,
            claim_token: null,
            last_error: "Recipient has no email address",
          })
          .eq("id", email.id)
          .eq("claim_token", email.claim_token)
        result.failed += 1
        continue
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": email.id,
          },
          body: JSON.stringify({
            to: [{
              email: email.recipient_email,
              ...(email.recipient_name ? { name: email.recipient_name } : {}),
            }],
            subject: email.subject,
            body: email.body,
          }),
        })

        const payload = await response.json().catch(() => null) as NylasResponse | null
        if (response.ok) {
          const { error: updateError } = await ctx.supabaseAdmin
            .from("pending_emails")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              locked_at: null,
              claim_token: null,
              last_error: null,
              provider_message_id: payload?.data?.id || null,
              provider_request_id: payload?.request_id || null,
            })
            .eq("id", email.id)
            .eq("claim_token", email.claim_token)

          if (updateError) throw updateError
          result.sent += 1
          continue
        }

        const shouldRetry = retryableStatus(response.status) && email.attempt_count < MAX_ATTEMPTS
        const retryMinutes = Math.min(2 ** Math.max(email.attempt_count - 1, 0), 30)
        const { error: updateError } = await ctx.supabaseAdmin
          .from("pending_emails")
          .update({
            status: shouldRetry ? "pending" : "failed",
            next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
            locked_at: null,
            claim_token: null,
            last_error: errorMessage(response.status, payload),
            provider_request_id: payload?.request_id || null,
          })
          .eq("id", email.id)
          .eq("claim_token", email.claim_token)

        if (updateError) throw updateError
        result[shouldRetry ? "retried" : "failed"] += 1
      } catch (error) {
        const shouldRetry = email.attempt_count < MAX_ATTEMPTS
        const retryMinutes = Math.min(2 ** Math.max(email.attempt_count - 1, 0), 30)
        const message = error instanceof Error ? error.message : "Unexpected email worker error"

        console.error(`Email ${email.id} failed`, error)
        await ctx.supabaseAdmin
          .from("pending_emails")
          .update({
            status: shouldRetry ? "pending" : "failed",
            next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
            locked_at: null,
            claim_token: null,
            last_error: message.slice(0, 1000),
          })
          .eq("id", email.id)
          .eq("claim_token", email.claim_token)
        result[shouldRetry ? "retried" : "failed"] += 1
      }
    }

    return Response.json(result)
  }),
}
