# KARGO Prompt: Branded Transactional Emails - "The Waybill" Banners for Brevo (Supabase Auth) and Nylas

## Context

This is a **new-surface prompt** for the existing KARGO pasabuy / order-fulfillment app (React 19 + Vite + Tailwind v4 + Supabase). It changes **only the HTML of the emails KARGO sends**. It does not touch the app UI, the auth flow, the database triggers, or the delivery machinery.

Today every KARGO email is unstyled HTML or bare text:

- **Brevo SMTP (Supabase Auth)** sends confirmation, recovery, magic-link, invite, email-change, and reauthentication emails. Each template is 124-270 characters: an `<h2>`, a `<p>`, and a bare `<a>`.
- **Nylas** sends 16 app emails (payments, fulfillment, claims, waitlist, shipping). Each is a single plain-text sentence pushed from `public.pending_emails` into the Nylas `/messages/send` body.

The result is a brand that looks considered everywhere except the one channel a buyer sees when they are anxious: their inbox. This prompt gives both pipelines **one shared visual identity** that reads as KARGO at a glance, survives every email client, and never invents a fact.

**This prompt describes changes only. It is not a redesign of the product and it does not add a new email.** Subject lines, recipients, triggers, copy, timing, dedupe keys, and retry behaviour stay exactly as they are.

---

## 1. DO NOT CHANGE (preserve exactly as-is)

- **Every `pending_emails` trigger and every email body string in SQL.** The `body` column is the canonical sentence. The renderer wraps it; it does not rewrite, shorten, or paraphrase it. Do not edit past migrations.
- **The Supabase SMTP configuration** (Brevo, `smtp-relay.brevo.com:587`, sender `KARGO <kargoph2026@gmail.com>`) and `mailer_autoconfirm: false`. Email confirmation must stay required.
- **Every subject line.** They are in production and already tested. `mailer_subjects_*` and `pending_emails.subject` stay byte-identical.
- **Recipients, conditions, and `wants_email()` checks.** No new email is sent to anyone who is not already receiving one.
- **The queue contract:** `claim_pending_emails()` claim/lease semantics, `claim_token` guards, attempt counting, backoff, and the `Idempotency-Key` header.
- **The retry loop in `process-pending-emails`.** Only the two lines that build the Nylas request body change.
- **The app's design tokens.** Colors, fonts, and radii come from `src/constants/theme.ts`, `src/index.css`, and the auth brand panel. Do not invent a second palette.
- **The auth flow, the `?preview=original` bypass, routing, and every app-side component.** Zero edits under `src/features/` or `src/components/`.

---

## 2. Current state (verified against the live project on Oct 19, 2026)

Read the real files before editing. Line numbers drift; the facts below are the contract.

### 2.1 Brevo / Supabase Auth

| Fact | Value |
|---|---|
| Project | `leylmztbknmlwnwgvaud` |
| SMTP | `smtp-relay.brevo.com`, port `587`, sender name `KARGO`, admin `kargoph2026@gmail.com` |
| `mailer_autoconfirm` | `false` (confirmation required) |
| `rate_limit_email_sent` | `30`/hour, `smtp_max_frequency` `60` |
| `mailer_secure_email_change_enabled` | `true` |
| Notification emails (`password_changed`, `email_changed`, `identity_*`, `mfa_*`, `phone_changed`) | **all disabled** - do not design or enable them |

Templates that actually send, with their live subjects:

| Template | Subject | Live HTML today | Length |
|---|---|---|---|
| `confirmation` | `Confirm your email address` | `<h2>`, `<p>`, `<a>` | 184 chars |
| `recovery` | `Reset your password` | `<h2>`, 2x `<p>`, `<a>` | 254 chars |
| `magic_link` | `Your sign-in link` | `<h2>`, `<p>`, `<a>` | 173 chars |
| `invite` | `You've been invited` | same shape | 173 chars |
| `email_change` | `Confirm your new email address` | same shape | 270 chars |
| `reauthentication` | `{{ .Token }} is your verification code` | 124 chars, OTP only | 124 chars |

Every one of these is a full HTML document fragment rendered by GoTrue. Supabase variables available: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .RedirectTo }}`. Use only these exact tokens.

### 2.2 Nylas

Flow: SQL trigger -> `public.pending_emails` -> `pg_cron` (`kargo_process_pending_emails`, every minute) -> Edge Function `process-pending-emails` -> `POST /v3/grants/{grant}/messages/send`.

The worker currently sends:

```ts
body: JSON.stringify({
  to: [{ email: email.recipient_email, ...(email.recipient_name ? { name: email.recipient_name } : {}) }],
  subject: email.subject,
  body: email.body,          // <- plain text, no HTML, no is_plaintext flag
})
```

Per Nylas v3 docs, `body` is **HTML unless `is_plaintext: true`**, and `is_plaintext` defaults to `false`. So today's plain-text sentences are already being interpreted as HTML - any `<`, `&`, or newline in a product name is at the mercy of the client. Adding real HTML fixes this; it is not a new capability.

`claim_pending_emails()` currently returns:

```
id, claim_token, attempt_count, recipient_email, recipient_name, subject, body
```

It does **not** return `template` or `context`, even though both columns exist on `pending_emails`. The renderer needs them.

### 2.3 The 16 live Nylas templates

Verified in the SQL and in live rows (`pending_emails` has sent: `claim_expired`, `waitlist_auto_claimed`, `shipping_fee_needed`, `shipping_fee_added`, `payment_verified`, `order_shipped`, `payment_submitted`).

| Template | Sent to | Context keys |
|---|---|---|
| `payment_submitted` | buyer | `order_id`, `payment_id` |
| `payment_verified` | buyer | `order_id`, `payment_id` |
| `payment_insufficient` | buyer | `order_id`, `payment_id` |
| `payment_rejected` | buyer | `order_id`, `payment_id` |
| `payment_deadline_reminder` | buyer | `order_id`, `deadline` |
| `shipping_fee_needed` | **seller** | `order_id` |
| `shipping_fee_added` | buyer | `order_id`, `shipping_fee` |
| `order_shipped` | buyer | `order_id`, `fulfillment_stage` |
| `order_in_transit` | buyer | `order_id`, `fulfillment_stage` |
| `order_delivered` | buyer | `order_id`, `fulfillment_stage` |
| `claim_expired` | buyer | `order_id` |
| `waitlist_auto_claimed` | buyer | `order_id`, `product_id` |
| `waitlist_partial_offer` | buyer | `waitlist_id`, `product_id`, `offer_quantity` |
| `location_correction` | buyer | `order_id` |
| `delivery_order_declined` | buyer | `order_id`, `reason` |

The `order_id` is a UUID. The **human** order number (`ORD-2026-000246`) appears only inside `body`. See 6.3 for how to surface it without parsing text.

### 2.4 Assets (already public, already correct)

Both files are in `public/`, are excluded from Git LFS by `.gitattributes` (so Vercel's checkout always has them), and are served from the production domain:

| Asset | Size | Intrinsic | URL (verified 200, `image/png`) |
|---|---|---|---|
| Full lockup | 40 KB | 242x242 | `https://kargo-eunice-13s-projects.vercel.app/kargo-logo.png` |
| Ship badge | 10.5 KB | 80x92 | `https://kargo-eunice-13s-projects.vercel.app/kargo-logo-head.png` |

**Critical fact:** both PNGs are **white/near-white with alpha** (sampled opaque pixels are `#EFF1F4`). On a white background the logo is **invisible**. It is designed for the dark indigo auth panel. Any email banner must put it on a dark field.

### 2.5 The brand surface to echo

`src/index.css` `.auth-brand` is the app's most recognisable brand moment:

```css
background: linear-gradient(180deg, #171bb5 0%, #3548bd 43%, #6995d8 100%);
```

That is the field the white ship sits on. The email banner inherits it.

---

## 3. The direction: "The Waybill"

### 3.1 Why this direction

The category default for a transactional email is a rounded hero, a centred logo, a big gradient button, and three icon columns. KARGO must not do that. KARGO is a **cargo manifest for pasabuy** - the buyer's mental model is a waybill: a header, a reference number, a status stamp, a plain sentence about where the parcel is, one action, and a footer. The logo is literally a ship inside a hex badge over water lines.

So the email is designed as a **printed shipping document**, not a marketing page. That choice earns four things the generic hero cannot:

1. **Brand recognition without a hero image.** The band, the tracked wordmark, and the stamp read as KARGO even with images blocked.
2. **A real job for colour.** The accent is not decoration; it is the status stamp and the rule that encodes what the email is about.
3. **A place for the order number** that is useful rather than ornamental.
4. **Restraint that matches the voice.** Warm, direct, operational. No exclamation marks, no urgency theatre.

This is a **document**, so: near-square corners (4px), hairline rules, tabular labels, generous white space, and one accent. Not an app card with soft radii and shadows.

### 3.2 Tokens (use these exact values)

From `src/index.css` `:root` and `src/constants/theme.ts`. Do not add a new hue.

| Role | Value | Source | Use |
|---|---|---|---|
| Ink | `#111827` | `--kargo-ink` | Headline, amount, primary text |
| Ink soft | `#374151` | `--kargo-ink-soft` | Body copy |
| Muted | `#6B7280` | `--kargo-muted` | Labels, footer |
| Line | `#E5E7EB` | `--kargo-line` | Hairlines, table borders |
| Surface | `#FFFFFF` | `--kargo-surface` | The card |
| Canvas | `#F7F3F3` | `--kargo-canvas` | Page background, facts strip |
| Warm | `#FFFBF5` | `--kargo-warm` | Optional inset panel |
| Navy / brand | `#191BA9` | `--kargo-navy`, `INDIGO` | Wordmark, CTA, account accent |
| Banner gradient | `#171BB5` -> `#3548BD` -> `#6995D8` | `.auth-brand` | Banner background |
| Green | `#3FBF8F` | `GREEN` | Confirmed / delivered accent |
| Amber | `#FFC24B` | `AMBER` | Pending / action-needed accent |
| Coral | `#FF8A65` | `CORAL` | Rejected / declined / expired accent |
| Sky | `#5CC2F2` | `SKY` | Fulfillment / in-transit accent |
| Cyan light | `#DEF3FA` | `CYAN_L` | Tint fill only |

**Accent vs ink.** The accents above are fill colours, not text colours. `#FFC24B` on white is ~1.6:1 and fails. Every piece of accent text uses a dark ink variant of the same hue, so contrast holds:

| Family | Accent (fill, rule, tint) | Ink (text) | Contrast on white |
|---|---|---|---|
| Account | `#191BA9` | `#191BA9` | 11.4:1 |
| Positive | `#3FBF8F` | `#0F7A55` | 5.2:1 |
| Attention | `#FFC24B` | `#8A5A00` | 5.6:1 |
| Negative | `#FF8A65` | `#B4402A` | 5.1:1 |
| Transit | `#5CC2F2` | `#0D6E92` | 5.4:1 |

**Type.** The app loads four families (`src/index.css` line 1). Email clients will not load webfonts reliably, so specify the real face first and accept a graceful fallback:

- Display / wordmark / h1: `'Josefin Sans', 'Trebuchet MS', Helvetica, Arial, sans-serif`
- Body / labels: `'DM Sans', Helvetica, Arial, sans-serif`
- Reference numbers / OTP: `'SFMono-Regular', Consolas, 'Liberation Mono', monospace`

Do not use Manrope or Quicksand in email - two display faces in one document is the tell.

### 3.3 The banner (exact specification)

600px envelope. Banner is full-bleed across the card.

| Property | Value |
|---|---|
| Height | 96px desktop, 84px at `<=480px` |
| Padding | `24px 28px` |
| Background | `bgcolor="#171BB5"` **plus** `background-image:linear-gradient(135deg,#171BB5 0%,#3548BD 52%,#6995D8 100%)` |
| Ship badge | `kargo-logo-head.png`, `40x46`, `display:block`, `border:0`, `alt=""` (decorative - the wordmark is real text) |
| Wordmark | `KARGO`, `24px/1`, weight `700`, `letter-spacing:5px`, `#FFFFFF`, uppercase, Josefin stack |
| Left cluster gap | `14px` |
| Right cluster | label `10px/1` weight `700`, `letter-spacing:2px`, `rgba(255,255,255,.72)`, uppercase + value `13px/1` mono, `#FFFFFF` |
| Accent rule | a separate `<tr><td height="4" bgcolor="{accent}">` directly under the banner, full width, no radius |

The gradient is a **progressive enhancement**. Outlook desktop ignores `background-image` and paints `#171BB5`, which is the gradient's own start colour - the banner still looks intentional. Never let the banner depend on the gradient existing.

**Right cluster content:** the family label (`PAYMENT`, `FULFILLMENT`, `CLAIM`, `ACCOUNT`) on top and the human order number beneath it when known. No order number -> label only, vertically centred. Do not print a UUID.

### 3.4 The stamp and the waybill row

Inside the white card, above the headline, right-aligned:

**Stamp** - the signature element. A waybill rubber stamp.

| Property | Value |
|---|---|
| Text | `10px/1`, weight `700`, `letter-spacing:2px`, uppercase |
| Box | `display:inline-block`, `padding:5px 9px`, `border-radius:2px`, `border:1px solid {accent}`, `background:{accent at 10%}` |
| Colour | the family ink value from 3.2 |

Recommended implementation for the tint: a solid pre-mixed hex (e.g. `#FFF6E3` for amber, `#EAF8F2` for green, `#FDEEE9` for coral, `#E8F6FD` for sky, `#ECEDFB` for navy) because `rgba()` in `background` is stripped by Outlook.

**Waybill row** - directly under the stamp, above the headline, only when the order number is known:

```
ORDER        ORD-2026-000246
```

Label `10px` muted tracked uppercase; value `13px` mono ink; `1px dashed #E5E7EB` rule underneath, `12px` above and below. This is the one dashed rule in the email - it is the document's tear line. Do not use dashes anywhere else.

### 3.5 Body, facts, action, footer

| Block | Rule |
|---|---|
| Card padding | `28px` desktop, `20px` at `<=480px` |
| Optional greeting | `Hi {first name},` - `16px` ink-soft, `0 0 10px`. First token of `recipient_name` only. Omit entirely when absent. Never invent a name. |
| Headline | `24px/1.3`, Josefin `700`, `#111827`, `0 0 12px`. Two to five words. It states the outcome, not the category: `Your order shipped.` / `Confirm your email.` / `Payment needs attention.` |
| Lede | **The `body` column, verbatim and escaped.** `16px/1.62`, `#374151`, `0 0 20px`. This is the only place facts about the order are stated. |
| Facts strip | Optional. Only when the context carries a value. `#F7F3F3` fill, `3px` left border in the accent, `1px` border `#E5E7EB` elsewhere, `14px 16px` padding, `2px` radius. Rows of label (`10px` muted tracked uppercase) + value (`14px` ink, mono for numbers). Max 3 rows. |
| CTA | Bulletproof padded anchor in a `<td>`, `background:#191BA9`, text `#FFFFFF`, `16px` weight `700`, `padding:14px 22px`, `border-radius:4px`, `min-height:48px`, `display:inline-block`. One CTA only. Below it, a `12px` muted fallback line: `Button not working? Paste this into your browser: {url}` with the URL in `11px` mono, `word-break:break-all`. |
| Footer | `1px dashed #E5E7EB` top rule, `20px` top margin, `12px/1.5` muted. Two lines: `KARGO - pasabuy order fulfillment` and `This is a transactional message about your account or order.` No unsubscribe (these are transactional), no social icons, no address unless the user supplies one. |

### 3.6 Wireframe

```
+----------------------------------------------------------+
|  [#] KARGO                        PAYMENT                 |  indigo band
|                                   ORD-2026-000246         |
+==========================================================+  4px accent rule
|                                          [ CONFIRMED ]    |  stamp
|  ORDER        ORD-2026-000246                             |  waybill row
|  - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
|                                                           |
|  Your payment was verified.                               |  h1
|                                                           |
|  Your payment for order ORD-2026-000246 (Uniqlo U         |  lede = body
|  Collection Tee) was verified. Your order is now          |
|  confirmed.                                               |
|                                                           |
|  +-----------------------------------------------------+  |
|  | AMOUNT VERIFIED            PHP 890.00               |  |  facts (optional)
|  +-----------------------------------------------------+  |
|                                                           |
|  [ View your order ]                                      |  CTA
|  Button not working? Paste this into your browser:        |
|  https://kargo-...vercel.app/                             |
|                                                           |
|  - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
|  KARGO - pasabuy order fulfillment                        |
|  This is a transactional message about your account       |
|  or order.                                                |
+----------------------------------------------------------+
```

### 3.7 Copy rules

- **Do not rewrite a single email body.** The `body` in SQL is the lede. If a sentence reads badly, report it; do not fix it inside this change.
- Headlines are the only new copy. Keep them to the outcome, sentence case, no period-stacking, no exclamation marks.
- **Banned words:** `excited`, `thrilled`, `oops`, `uh oh`, `whoops`, `sorry for the inconvenience`, `valued customer`, `dear customer`, `just a heads up`, `don't forget`, `act now`, `hurry`.
- **Banned devices:** emoji, gradient text, drop shadows on text, letter-spaced body copy, ALL-CAPS sentences longer than the stamp, "This is an automated message" in the hero, three-column icon grids, background images behind text.
- Do not write a sentence that adds a fact the `body` and `context` do not contain. No invented deadlines, amounts, tracking numbers, courier names, or delivery windows.

---

## 4. Per-template matrix

Stamp text, accent family, and CTA label per template. The **lede is always `body`**, so it is not repeated here.

### 4.1 Nylas (16)

| Template | Banner label | Stamp | Family | CTA label | Facts |
|---|---|---|---|---|---|
| `payment_submitted` | `PAYMENT` | `AWAITING REVIEW` | Attention | `Track your order` | - |
| `payment_verified` | `PAYMENT` | `CONFIRMED` | Positive | `View your order` | - |
| `payment_insufficient` | `PAYMENT` | `BALANCE DUE` | Attention | `Submit payment` | - |
| `payment_rejected` | `PAYMENT` | `REJECTED` | Negative | `Submit a new proof` | - |
| `payment_deadline_reminder` | `PAYMENT` | `DEADLINE` | Attention | `Pay now` | `DUE` -> formatted `deadline` |
| `shipping_fee_needed` | `PAYMENT` | `ACTION NEEDED` | Attention | `Set the shipping fee` | - |
| `shipping_fee_added` | `PAYMENT` | `TOTAL UPDATED` | Attention | `Review your total` | `SHIPPING FEE` -> `PHP {shipping_fee}` |
| `order_shipped` | `FULFILLMENT` | `SHIPPED` | Transit | `View order` | - |
| `order_in_transit` | `FULFILLMENT` | `IN TRANSIT` | Transit | `View order` | - |
| `order_delivered` | `FULFILLMENT` | `DELIVERED` | Positive | `Review your order` | - |
| `claim_expired` | `CLAIM` | `EXPIRED` | Negative | `Browse live batches` | - |
| `waitlist_auto_claimed` | `CLAIM` | `CLAIMED` | Attention | `Pay for your claim` | - |
| `waitlist_partial_offer` | `CLAIM` | `PARTIAL OFFER` | Attention | `Review the offer` | `OFFERED` -> `{offer_quantity} unit` |
| `location_correction` | `CLAIM` | `PIN UPDATE` | Attention | `Update your delivery pin` | - |
| `delivery_order_declined` | `CLAIM` | `DECLINED` | Negative | `Browse live batches` | `REASON` -> `reason` (escaped, truncated at 140 chars) |

`shipping_fee_needed` goes to the **seller**. Its CTA label is the only seller-facing string; everything else in that template is unchanged.

**Unknown template fallback:** render the same shell with banner label `KARGO`, no stamp, no waybill row, no facts, CTA `Open KARGO`, lede = `body`. A renderer that throws on an unexpected template breaks delivery; it must degrade.

### 4.2 Supabase Auth (6)

Same shell. The right cluster has no order number; it carries the address instead.

| Template | Banner label | Right value | Stamp | Family | h1 | CTA |
|---|---|---|---|---|---|---|
| `confirmation` | `ACCOUNT` | `{{ .Email }}` | `VERIFY` | Account | `Confirm your email.` | `Confirm email address` -> `{{ .ConfirmationURL }}` |
| `recovery` | `ACCOUNT` | `{{ .Email }}` | `RESET` | Account | `Set a new password.` | `Choose a new password` -> `{{ .ConfirmationURL }}` |
| `magic_link` | `ACCOUNT` | `{{ .Email }}` | `SIGN IN` | Account | `Your sign-in link.` | `Sign in to KARGO` -> `{{ .ConfirmationURL }}` |
| `invite` | `ACCOUNT` | `{{ .Email }}` | `INVITE` | Account | `You're invited.` | `Accept the invite` -> `{{ .ConfirmationURL }}` |
| `email_change` | `ACCOUNT` | `{{ .NewEmail }}` | `CONFIRM` | Account | `Confirm your new email.` | `Confirm new address` -> `{{ .ConfirmationURL }}` |
| `reauthentication` | `ACCOUNT` | `{{ .Email }}` | `CODE` | Account | `Your verification code.` | none - the OTP is the content |

`reauthentication` is the one template without a button: render `{{ .Token }}` as `28px` mono, weight `700`, `letter-spacing:6px`, `#111827`, centred, inside a `#FFFBF5` panel with a `1px solid #E5E7EB` border and `16px` padding. Below it, muted `12px`: `This code expires shortly. Do not share it.`

`recovery` keeps its security line, promoted out of the body into the footer position: `If you didn't request this, you can safely ignore this email.` No other auth email gets extra copy.

**Do not add a "Resend" link, a support address, or a tracking pixel to any auth template.**

---

## 5. Email-client constraints (non-negotiable)

These are the difference between "designed" and "shipped". Every one is checkable.

| Constraint | Requirement |
|---|---|
| Layout | `<table role="presentation" cellpadding="0" cellspacing="0" border="0">` only. No flexbox, no grid, no `position`, no `float`, no `display:flex`. |
| CSS | All presentation inline on the element. One `<style>` block is allowed **only** for the media query and the `light only` declaration. |
| Width | Outer table `width="100%"`; inner card `width="600"` with `max-width:600px`. MSO conditional comment or a fixed 600px table for Outlook. |
| Images | Absolute HTTPS, `display:block`, `border:0`, `outline:none`, explicit `width`/`height`, `alt` set (empty for decorative). Exactly **one** image per email. |
| Weight | Rendered HTML under **40 KB** and total images under **100 KB** - Gmail clips past ~102 KB and the CTA can vanish. |
| Fonts | No `@font-face`, no Google Fonts link. Declare the real face first, fall back to Trebuchet/Helvetica/Arial. Bump letter-spacing slightly on the wordmark only. |
| Dark mode | `<meta name="color-scheme" content="light only">` + `<meta name="supported-color-schemes" content="light only">` + `:root { color-scheme: light only; }` in the `<style>`. The band must stay indigo, not invert to a pale tint. Never use `#FFFFFF` for the page background - use `#F7F3F3`, which stays tolerable if inversion wins. |
| Images blocked | The email must still read: wordmark is text, stamp is text, order number is text, lede is text, CTA is a CSS-coloured cell. Only the 40x46 badge disappears. |
| Preheader | Hidden `<div>` immediately after `<body>`: `display:none;font-size:1px;color:#F7F3F3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;` plus `&#847;&zwnj;&nbsp;` padding. Content: the first ~90 chars of `body`, stripped of the greeting, escaped. Then a hidden spacer so the client does not pull footer text forward. |
| Accessibility | `lang="en"`, one `<h1>`, real text for every fact, `16px` minimum body, CTA `>=48px` tall, `#111827` or darker for text, accent never the sole carrier of meaning (the stamp also says the words). |
| Links | One CTA link per email (auth: the single Supabase link; Nylas: `APP_BASE_URL`). No tracking parameters, no redirect wrappers, no `target` beyond `_blank` with `rel="noopener"`. |
| Language | `lang="en"`. Amounts render as `PHP 890.00` (matching the app's copy), never the peso glyph and never a bare number. |

---

## 6. Implementation

### 6.1 New shared renderer

Create `supabase/functions/process-pending-emails/emailLayout.ts`:

```ts
export type EmailInput = {
  template: string
  subject: string
  body: string
  context: Record<string, unknown> | null
  recipientName: string | null
}

export function renderEmail(input: EmailInput): string
```

One function, one shell, a lookup table keyed by `template` (section 4.1). No per-template HTML files: the shell is shared, and the matrix supplies the label, stamp, accent, CTA, and facts. Keep it dependency-free and Deno-native (`Intl` is available).

Everything interpolated goes through one `escapeHtml()` applied to `&`, `<`, `>`, `"`, `'`. Product names are seller-authored and `delivery_order_declined` carries a seller's free-text `reason`; an unescaped angle bracket is an injection.

Formatting helpers:

- `formatPhp(value)` -> `PHP ${value.toFixed(2)}` with thousands separators.
- `formatDeadline(iso)` -> `Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })`. The product is Philippine; do not print UTC.

### 6.2 The RPC change (one migration)

`claim_pending_emails` must return `template` and `context`. Postgres cannot change a `returns table` signature with `create or replace`, so the migration must **drop and recreate**, then re-grant:

```sql
drop function if exists public.claim_pending_emails(integer, integer);

create function public.claim_pending_emails(
  p_limit integer default 25,
  p_lease_seconds integer default 300
)
returns table (
  id uuid, claim_token uuid, attempt_count integer,
  recipient_email text, recipient_name text,
  subject text, body text, template text, context jsonb
)
...
```

Inside, add `pe.template` and `pe.context` to the `claimed` CTE's `returning` list and to the final `select`. Keep the claim/lease `skip locked` logic **byte-for-byte identical** - this migration changes the projection, not the behaviour. Re-issue:

```sql
revoke all on function public.claim_pending_emails(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_pending_emails(integer, integer)
  to service_role;
```

New file: `supabase/migrations (to update profile database name)/202610190002_claim_pending_emails_template_context.sql`.

### 6.3 The worker change

In `supabase/functions/process-pending-emails/index.ts`:

1. Extend `QueueEmail` with `template: string` and `context: Record<string, unknown> | null`.
2. Resolve the human order number **once per email**, only when `context?.order_id` is a string:

```ts
const { data: order } = await ctx.supabaseAdmin
  .from("orders")
  .select("order_number")
  .eq("id", orderId)
  .maybeSingle()
```

Wrap it in `try/catch` and treat a failure as "no order number". A prettier email must never be able to fail a send. Do not parse `body` for the number.
3. Replace the request body's `body: email.body` with `body: renderEmail({ ... })` and add `is_plaintext: false` explicitly. Nothing else in the `fetch` call changes - keep `Idempotency-Key`, `to`, `subject`, and the whole retry/backoff block.

### 6.4 Supabase Auth templates

The six templates cannot import `emailLayout.ts`. Keep them in version control as `supabase/email-templates/{confirmation,recovery,magic_link,invite,email_change,reauthentication}.html` plus a short `README.md` stating:

- These are applied through the Supabase dashboard (Authentication -> Email Templates) or `PATCH /v1/projects/{ref}/config/auth` with the `mailer_templates_*_content` fields.
- They duplicate the shell in `emailLayout.ts` on purpose, because GoTrue has no imports.
- Any shell change must be applied to **both**, and both must carry the comment `<!-- email-shell: waybill-1 -->` so drift is visible.

Preserve every GoTrue variable exactly. Do not rename, reformat, or wrap `{{ .ConfirmationURL }}` in a redirect.

### 6.5 Assets and environment

- Reuse `https://kargo-eunice-13s-projects.vercel.app/kargo-logo-head.png` for the Nylas badge and the auth templates. Do not add a new raster, an SVG (Gmail strips it), or a base64 data URI (clipped).
- Add one optional secret: `supabase secrets set APP_BASE_URL="https://kargo-eunice-13s-projects.vercel.app"`. Renderer default is that same URL, so an unset secret still works. **No fabricated deep links** - the app has no per-tab URL routes, so the CTA goes to the app root and the label carries the intent.
- Document `APP_BASE_URL` in `NYLAS_SETUP.md` section 2.

### 6.6 Keep the two pipelines siblings

Same band height, same accent rule, same stamp anatomy, same 4px radius, same type stack, same footer rule. A buyer should not be able to tell which provider sent the email. The only intended difference is the right-hand cluster (`PAYMENT` + order number vs `ACCOUNT` + address).

---

## 7. Acceptance criteria

- [ ] Every Nylas email renders as HTML: banner band, 4px accent rule, stamp, waybill row, headline, `body` verbatim, CTA, footer.
- [ ] Every Supabase Auth email renders the same shell with the `ACCOUNT` cluster and the correct GoTrue variable.
- [ ] `body` text appears **exactly** as it is in `pending_emails` - no rewording, no truncation (except the `reason` fact, capped at 140 chars).
- [ ] No fact appears that is not in `body` or `context`. No invented tracking number, courier, deadline, or amount.
- [ ] Unknown `template` renders the neutral fallback instead of throwing.
- [ ] `is_plaintext: false` is explicit; `Idempotency-Key`, `to`, and `subject` are unchanged.
- [ ] `claim_pending_emails` returns `template` and `context`, still claims atomically with `skip locked`, and is executable by `service_role` only.
- [ ] HTML escaping covers `&`, `<`, `>`, `"`, `'`; a product name containing `<b>x</b>` arrives as literal text.
- [ ] At 600px and 390px the layout holds: one column, no horizontal overflow, no fixed-width child wider than the card.
- [ ] With images blocked, the wordmark, stamp, order number, lede, and CTA are all still legible.
- [ ] With dark mode forced (Gmail web / iOS Mail), the band stays indigo and body text stays readable.
- [ ] Outlook (desktop and web) still shows a solid `#171BB5` band when it drops the gradient, with no white gap and the CTA still reading as a button.
- [ ] Rendered HTML is under 40 KB; the only image is a 10.5 KB PNG.
- [ ] No change to any subject line, recipient, trigger, dedupe key, or `wants_email` condition.
- [ ] `npm run typecheck` and `npm run build` still pass (no app files touched).

---

## 8. Files expected to change

| File | Change |
|---|---|
| `supabase/functions/process-pending-emails/emailLayout.ts` | **New** - shell, token map, per-template matrix, escaping, formatters |
| `supabase/functions/process-pending-emails/index.ts` | `QueueEmail` type, `template`/`context` in the payload, order-number lookup, `renderEmail(...)`, `is_plaintext: false` |
| `supabase/migrations (to update profile database name)/202610190002_claim_pending_emails_template_context.sql` | **New** - drop/recreate the RPC with `template` + `context`, re-grant to `service_role` |
| `supabase/email-templates/*.html` (6) + `README.md` | **New** - the auth templates, versioned, `email-shell: waybill-1` |
| `NYLAS_SETUP.md` | Document `APP_BASE_URL` and the HTML body |
| `SUPABASE_SETUP.md` | Point at `supabase/email-templates/` and the "applied via dashboard/Management API" note |

No edits under `src/`. No new dependency. No change to `supabase/config.toml`.

---

## 9. Manual test script

1. **Render locally.** Call `renderEmail` with a real live row for each of the 16 templates, write the output to `.email-preview/<template>.html`, and open each at 600px and 390px. No overflow, no wrapping of the CTA.
2. **Images off.** Block images in the browser (or strip the `<img>` tag) and confirm the email still reads.
3. **Escaping.** Render `delivery_order_declined` with `reason = '<b>too far</b> & "late"'`; confirm the tags appear as text.
4. **Unknown template.** Render `template = 'not_a_real_template'`; confirm the neutral fallback.
5. **Queue a real send.** With `service_role`, insert one row per family into `pending_emails` (unique `dedupe_key`, your own address as recipient), wait for the next cron minute, and confirm in Gmail and iOS Mail. Check `status = 'sent'` and `provider_message_id` is set.
6. **Auth.** Trigger a real confirmation (new temp account) and a real reset ("Forgot password?") and open both in Gmail. Confirm the buttons land on the app and the link still works end to end.
7. **OTP.** Trigger a reauthentication email and confirm the code is centred, spaced, and selectable.
8. **Regression.** Confirm no subject line changed and no recipient received an email they did not receive before.

---

## 10. Out of scope

- Rewriting any email body, subject, or trigger copy.
- New emails, digests, reminders, or marketing.
- Enabling the disabled Supabase notification emails.
- App-side changes: inbox UI, notification centre, settings copy.
- Deep-linking to a tab (`?tab=`); if that is ever added, wire it through `APP_BASE_URL` then.
- A design-system refactor. This prompt spends its budget on one artifact: the email.
