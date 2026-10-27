# KARGO transactional email

Every application email KARGO sends is queued in `public.pending_emails`, rendered
into a branded HTML document plus a plain-text alternative, and delivered through
Nylas or Brevo. `process-pending-emails` drains that queue once per minute.

This document covers the design system, the queue contract, the provider switch,
and the local preview tools. Supabase Auth emails (confirmation, recovery) are a
separate path and are not part of this system.

## What sends

- A product action inserts a queue row with `template`, `subject`, `body`,
  `context`, and a `dedupe_key`. Nothing is sent inline, so a mail outage never
  blocks a claim, payment, or fulfillment action.
- Insertion is gated by `wants_email(user, category)`. If a buyer has email
  updates off for that category, no row is written.
- The worker claims a batch with `claim_pending_emails`, renders each row, sends
  it, and writes `status`, `sent_at`, provider IDs, or `last_error` back.
- `subject` and `body` stay on the row and remain the fallback. Unknown
  templates, older rows, and plain-text clients still get the full message.

### Templates

| Area | Templates |
| --- | --- |
| Payment | `payment_submitted`, `payment_verified`, `payment_insufficient`, `payment_rejected`, `payment_deadline_reminder` |
| Fulfillment | `order_shipped`, `order_in_transit`, `order_delivered` |
| Delivery coordination | `shipping_fee_needed`, `shipping_fee_added`, `location_correction`, `delivery_order_declined` |
| Claims and waitlist | `claim_expired`, `waitlist_auto_claimed`, `waitlist_partial_offer` |

`waitlist_partial_offer` is retained for rows queued before `202610010001`; the
current waitlist flow auto-claims any available quantity and sends
`waitlist_auto_claimed`.

## Email anatomy

Each email is the same waybill, filled with the event's facts:

1. **Banner** — indigo masthead, white ship mark, live-text `KARGO` wordmark,
   caption, and three waterline rules taken from the logo's wake. The mark is
   decorative; the wordmark and caption carry the brand with images blocked.
2. **Waybill strip** — `Order` + number on the left, status chip on the right.
   Waitlist offers without an order number show `Waitlist offer` + `2 of 5 units`
   instead.
3. **Headline and lead** — plain language about what changed and what to do.
4. **Focus panel** — the one number or identifier the reader came for (balance,
   new total, tracking number, deadline), tinted from its semantic tone.
5. **Manifest rows** — hairline-separated label/value pairs with tabular numerals.
6. **Stage rail** — `Claimed → Paid → Shipped → Delivered`. Earlier stages are
   indigo, the current stage coral with heavier weight, later stages hairline
   grey. A delivered order fills all four.
7. **Note** — reasons, pauses, and cautions as a tinted block, never a colored
   side border.
8. **CTA** — one indigo button with a single next step, resolved against
   `KARGO_APP_URL`.
9. **Footer** — why the message arrived, the recipient's name, and links to
   settings and the app. No invented postal address and no one-click unsubscribe
   promise the product cannot keep.

Tokens live in `email/brand.ts` (indigo `#191BA9`, cream `#F7F3F3`, coral
`#FF8A65`, sky, green, amber; Manrope for display, DM Sans for body). Muted body
text uses `COLOR.mutedText` (`#5B6B79`) so it clears 4.5:1 on cream.

The document is a table shell with a 480px breakpoint, a hidden preheader, VML
for the Outlook button, and a `prefers-color-scheme: dark` block. Tinted focus
panels keep their pale fill in dark mode by design: dark ink on a printed stub
stays readable inside the dark card.

## Preview and verify locally

```powershell
npm run preview:emails      # 15 HTML files + text parts + gallery in scripts/out/emails
npm run screenshot:emails   # headless Chrome/Edge screenshots into scripts/out/emails/shots
npm run test:emails         # node:test coverage of every template
```

Screenshot options:

```powershell
node scripts/screenshot-emails.mjs --width=390
node scripts/screenshot-emails.mjs --dark=true
node scripts/screenshot-emails.mjs --templates=order_shipped,payment_rejected
```

`preview:emails` uses synthetic fixtures from `email/samples.ts`; it needs no
Supabase connection and no secrets. The preview points CTAs at
`https://kargo.example` and the logo at `public/kargo-logo-head.png`.

## Providers

`EMAIL_PROVIDER` selects the sender. It defaults to `nylas`, so existing
deployments keep working without changes.

| Provider | Required secrets |
| --- | --- |
| `nylas` (default) | `NYLAS_API_KEY`, `NYLAS_GRANT_ID`, optional `NYLAS_API_URI` |
| `brevo` | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, optional `BREVO_SENDER_NAME` |

Both adapters live in `providers/index.ts`:

- Nylas receives `body` as HTML with `is_plaintext: false` and the queue row id
  as `Idempotency-Key`.
- Brevo receives `htmlContent` and `textContent`, so the plain-text part ships as
  a real multipart alternative.

Supabase Auth mail (`confirmation`, `recovery`, `magiclink`, `invite`,
`email_change`, `reauthentication`) does **not** go through `EMAIL_PROVIDER`. It
is sent by GoTrue over the SMTP relay configured in the Supabase dashboard, which
is a separate setting. That relay must not rewrite links — see
`docs/auth-smtp-split.md`. Brevo rewrites every URL through `*.sendibt2.com`
regardless of which adapter sent it.

Retries are shared: `5xx`, `408`, `409`, `425`, and `429` return the row to
`pending` with exponential backoff. Other failures are permanent. Rows stop after
five attempts. A render failure is permanent by definition.

## Branding and links

| Secret | Effect |
| --- | --- |
| `KARGO_APP_URL` | Absolute base for CTAs and footer links. Also checked: `APP_URL`, `SITE_URL`. |
| `KARGO_EMAIL_LOGO_URL` | Explicit public logo URL. Highest priority. |
| `KARGO_EMAIL_ASSET_BASE_URL` | Site origin serving `kargo-logo-head.png`. |
| `SUPABASE_URL` | Fallback: the public `brand-assets` bucket. |

CTAs deep-link to the tab where the action lives:

```
{KARGO_APP_URL}/?tab=My+Claims
{KARGO_APP_URL}/?tab=Orders
{KARGO_APP_URL}/?tab=Settings
{KARGO_APP_URL}/?tab=Batches
```

The app reads `tab` on load and after login/signup, so an email can land a buyer
directly on the right screen. A `?batch=` share link still outranks `tab`.

When `KARGO_APP_URL` is unset, CTAs render as a bordered instruction ("Open
KARGO and go to **My Claims** to pay now") instead of a dead link.

## Deploy

1. Apply `202610190002_branded_email_design.sql` in the Supabase SQL editor. It
   extends `claim_pending_emails` with `template`, `context`, and the resolved
   `details` bag, and creates the public `brand-assets` bucket.
2. Upload the banner mark once:

   ```powershell
   node scripts/upload-brand-assets.mjs
   ```

   The script uses `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or
   `SUPABASE_SERVICE_ROLE_KEY`) from `.env.local`, creates the bucket if needed,
   and prints the public URLs.
3. Set the worker secrets:

   ```powershell
   supabase secrets set KARGO_APP_URL="https://your-app-origin"
   ```

4. Deploy: `supabase functions deploy process-pending-emails`.
5. Keep the existing Vault secrets from `NYLAS_SETUP.md`; the minute cron is
   already in place.

## Queue row contract

`claim_pending_emails` returns the raw row plus a resolved `details` object:

```json
{
  "template": "payment_insufficient",
  "subject": "KARGO payment needs another look",
  "body": "…legacy copy, used as fallback…",
  "recipient_name": "Maria Santos",
  "context": { "order_id": "…", "payment_id": "…" },
  "details": {
    "orderNumber": "ORD-2026-000148",
    "productName": "SK-II Facial Treatment Essence",
    "totalAmount": 4800,
    "verifiedAmount": 3000,
    "balanceDue": 1800,
    "deadline": "2026-10-20T11:42:00Z",
    "paymentMethod": "GCash"
  }
}
```

Only non-null details are returned. Templates read defensively: a partial row
still renders, and missing facts simply omit their row. `details` is rebuilt from
the live order, so a queued email shows current amounts and deadlines rather than
a stale snapshot.

## Adding a template

1. Add a builder in `email/templates.ts` and register it in `BUILDERS`.
2. Add a fixture to `SAMPLE_EMAILS` in `email/samples.ts` (tests assert full
   coverage).
3. Queue the event with that `template`, plus `context` ids that
   `202610190002_branded_email_design.sql` can resolve.
4. Run `npm run test:emails` and `npm run preview:emails`.
5. If the template deserves its own CTA destination, use an existing tab name so
   `?tab=` deep links keep working.

## Troubleshooting

- **Logo box is empty** — the image must be public HTTPS. Check
  `KARGO_EMAIL_LOGO_URL`, then the `brand-assets` bucket policy, then run
  `node scripts/upload-brand-assets.mjs`. The wordmark still renders without it.
- **CTA says "Open KARGO and go to…"** — `KARGO_APP_URL` is unset or not HTTPS.
- **Email shows old copy** — the row was queued before the template existed or
  uses an unknown template name. It renders through the branded fallback.
- **Row stuck in `failed`** — read `last_error`. Repeated `5xx` or `429` is the
  provider; `Missing required secret` is configuration; a render error is a bug
  in the template and will not succeed on retry.
- **Wrong tab opens** — the CTA tab must be one of `Dashboard`, `Batches`,
  `My Claims`, `Payments`, `Orders`, `Settings`. Unknown values fall back to the
  normal landing tab.
