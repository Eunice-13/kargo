import { withSupabase } from "npm:@supabase/server"

import { brandingFrom, senderFrom } from "./email/config.ts"
import { renderEmail } from "./email/render.ts"
import { isRetryableStatus, sendEmail, type OutgoingEmail } from "./providers/index.ts"

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
  template: string | null
  context: Record<string, unknown> | null
  details: Record<string, unknown> | null
}

function batchSizeFrom(body: unknown) {
  if (!body || typeof body !== "object" || !("limit" in body)) {
    return DEFAULT_BATCH_SIZE
  }

  const value = Number((body as { limit: unknown }).limit)
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.floor(value), 100)) : DEFAULT_BATCH_SIZE
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

    const sender = senderFrom((name) => Deno.env.get(name))
    if (!sender.ok) {
      console.error(sender.error)
      return Response.json({ error: sender.error }, { status: 500 })
    }

    const branding = brandingFrom((name) => Deno.env.get(name))

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
    const provider = sender.config.provider

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

      let outgoing: OutgoingEmail
      try {
        const rendered = renderEmail(
          {
            template: email.template || "",
            subject: email.subject,
            body: email.body,
            recipientName: email.recipient_name,
            context: email.context ?? {},
            details: email.details ?? {},
          },
          branding,
        )
        outgoing = {
          id: email.id,
          to: {
            email: email.recipient_email,
            ...(email.recipient_name ? { name: email.recipient_name } : {}),
          },
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }
      } catch (error) {
        // A template that cannot render will never succeed on retry.
        const message = error instanceof Error ? error.message : "Email template failed to render"
        console.error(`Email ${email.id} failed to render`, error)
        await ctx.supabaseAdmin
          .from("pending_emails")
          .update({
            status: "failed",
            locked_at: null,
            claim_token: null,
            last_error: message.slice(0, 1000),
          })
          .eq("id", email.id)
          .eq("claim_token", email.claim_token)
        result.failed += 1
        continue
      }

      try {
        const outcome = await sendEmail(outgoing, sender.config)

        if (outcome.ok) {
          const { error: updateError } = await ctx.supabaseAdmin
            .from("pending_emails")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              locked_at: null,
              claim_token: null,
              last_error: null,
              provider_message_id: outcome.messageId,
              provider_request_id: outcome.requestId,
            })
            .eq("id", email.id)
            .eq("claim_token", email.claim_token)

          if (updateError) throw updateError
          result.sent += 1
          continue
        }

        const shouldRetry = isRetryableStatus(outcome.status) && email.attempt_count < MAX_ATTEMPTS
        const retryMinutes = Math.min(2 ** Math.max(email.attempt_count - 1, 0), 30)
        const { error: updateError } = await ctx.supabaseAdmin
          .from("pending_emails")
          .update({
            status: shouldRetry ? "pending" : "failed",
            next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
            locked_at: null,
            claim_token: null,
            last_error: outcome.error,
            provider_request_id: outcome.requestId,
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

    return Response.json({ ...result, provider })
  }),
}
