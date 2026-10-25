# Auth SMTP split: take Supabase Auth mail off Brevo

**Problem.** Brevo rewrites every link in every message it sends through
`*.sendibt2.com` / `*.sendibt3.com`, and that click-tracking toggle cannot be
turned off below the Enterprise plan. Those tracking domains are blackholed by
ad blockers, corporate filters and some ISPs (`ERR_CONNECTION_TIMED_OUT`), and
security scanners prefetch the wrapped URL, which can consume the single-use
token inside a Supabase confirmation or recovery link.

**Fix (this phase).** Supabase Auth gets its own SMTP provider that does not
rewrite links. The `pending_emails` queue keeps using Brevo. The two paths are
independent — Auth SMTP lives in the Supabase dashboard, the queue provider lives
in Edge Function secrets (`EMAIL_PROVIDER`).

**Scope.** Auth mail only: `confirmation`, `recovery`, `magiclink`, `invite`,
`email_change`, `reauthentication`. Queue mail (payments, fulfillment, claims,
waitlist — see `EMAILS.md`) still goes through Brevo, so its CTAs are still
wrapped. Moving the queue too is a separate change (see *Phase 2*).

---

## Prerequisites

- [ ] A **domain you control** for the From address. Free-mail senders
      (`kargoph2026@gmail.com`) cannot be used: SPF and DMARC alignment fail
      through a relay, and no transactional provider will verify a domain you do
      not own. The app already advertises `support@kargo.ph`, so `kargo.ph` or a
      subdomain such as `mail.kargo.ph` is the natural choice.
- [ ] DNS access to add the records the provider prints (MX/TXT, DKIM, DMARC).
- [ ] Supabase project owner access to `leylmztbknmlwnwgvaud`.

## Pick a provider

All four leave links untouched by default.

| Provider | SMTP host · port | Username | Password | Free tier | Click tracking |
| --- | --- | --- | --- | --- | --- |
| **Resend** | `smtp.resend.com` · `587` (or `465`) | `resend` | API key | 3,000/mo, 100/day | off by default |
| **Postmark** | `smtp.postmarkapp.com` · `587` (or `2525`) | server API token | same token | 100/mo trial | not offered |
| **Mailgun** | `smtp.mailgun.org` · `587` | `postmaster@yourdomain` | SMTP password | 100/day | off by default |
| **Amazon SES** | `email-smtp.<region>.amazonaws.com` · `587` | SMTP username | SMTP password | 62k/mo from EC2 | off |

Resend is the shortest path (API key doubles as the SMTP password). Do **not**
enable its "click tracking" toggle when you verify the domain.

---

## Step 1 — Verify the domain at the provider (Resend example)

1. Sign in to Resend → **Domains → Add Domain** → `kargo.ph` (or `mail.kargo.ph`).
2. Copy the DNS records it prints into your registrar. Typical set, but always
   use the values shown in the dashboard — never the ones in a guide:
   - `MX` on the sending subdomain → `feedback-smtp.<region>.amazonses.com` (priority 10)
   - `TXT` (SPF) on the sending subdomain → `v=spf1 include:amazonses.com ~all`
   - `TXT` (DKIM) on `resend._domainkey` → `p=...`
   - Optional `TXT` on `_dmarc` → `v=DMARC1; p=none; rua=mailto:support@kargo.ph`
3. Click **Verify**. Wait for **Verified** on the domain row.
4. **Settings → API Keys → Create** → scope **Sending access** → copy the key.
   That key is the SMTP password; it is shown once.

## Step 2 — Point Supabase Auth at it

Supabase Dashboard → **Authentication → Emails → SMTP Settings**:

| Field | Value |
| --- | --- |
| Enable custom SMTP | **on** |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | the Resend API key |
| Sender email | `noreply@kargo.ph` (must be on the verified domain) |
| Sender name | `KARGO` |

Then **Authentication → Rate Limits** — keep the existing values:
`Emails per hour` = `30`, `SMTP max frequency` = `60`s.

Leave **`mailer_autoconfirm` off** — email confirmation must stay required.

Do not edit the auth templates as part of this change. The subjects and bodies
listed in `src/imports/pasted_text/kargo-branded-emails-prompt.md` are already
live and stay byte-identical; only the relay changes.

## Step 3 — Verify

- [ ] **Fresh signup** with a real inbox you can open.
- [ ] **Raw source check** — Gmail → ⋮ → *Show original* → search
      `sendibt`. The link must be the GoTrue URL
      (`https://leylmztbknmlwnwgvaud.supabase.co/auth/v1/verify?...`), not
      `*.sendibt2.com`. On Windows, against a saved `.eml`:

      ```powershell
      Select-String -Path .\message.eml -Pattern 'sendibt' -SimpleMatch
      ```

      No output = not wrapped.
- [ ] **Click it with your ad blocker on.** It must land on the app and confirm
      the account, first click.
- [ ] **Password reset** the same way → lands on `/reset-password`.
- [ ] **Auth logs** — Supabase → *Authentication → Logs* shows the send with no
      `smtp` error.
- [ ] **Queue still works** — Brevo was not touched, so confirm one row:

      ```sql
      select template, status, attempt_count, provider_message_id, last_error, sent_at
      from public.pending_emails
      order by created_at desc
      limit 5;
      ```

      `status = 'sent'` with a non-null `provider_message_id` is the pass
      condition.

## Step 4 — Rollback

Re-enter the previous values and save; the change applies to the next send.

| Field | Previous value |
| --- | --- |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Brevo SMTP login |
| Password | Brevo SMTP key |
| Sender email | `kargoph2026@gmail.com` |
| Sender name | `KARGO` |

## Step 5 — Clean up

Once a week of signups has passed without errors:

- Revoke the now-unused **Brevo SMTP key** (Brevo → *Transactional → SMTP & API
  → SMTP keys*). The API key used by `process-pending-emails` is separate — keep
  it.
- Rotate the Resend key if it was ever pasted into a shared channel.

---

## Phase 2 (not done here)

Auth links are fixed; **queue** links still go through Brevo. Two ways to finish
the job:

1. **Ask Brevo** to disable link tracking on the transactional scope, or to give
   us a custom tracking domain (Enterprise, see the support path in the operator
   notes). No code change; covers both paths at once.
2. **Add a `resend` adapter** to
   `supabase/functions/process-pending-emails/providers/index.ts` (mirroring
   `sendWithBrevo`, ~40 lines), add `"resend"` to `ProviderName` in
   `email/config.ts`, then set `EMAIL_PROVIDER=resend` plus `RESEND_API_KEY` /
   `RESEND_SENDER_EMAIL` / `RESEND_SENDER_NAME`. Resend accepts `html` **and**
   `text`, so unlike Nylas the plain-text part is preserved.

Until one of those lands, `order_shipped`, `payment_verified` and the other queue
emails can still fail on filtered networks. Their CTA only opens the app root,
so a failure costs a click, not an account.
