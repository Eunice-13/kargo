# Nylas transactional email setup

`process-pending-emails` drains `public.pending_emails` once per minute. It renders
each row into KARGO's branded HTML template plus a plain-text alternative, sends
through one provider, and keeps retries and provider IDs on the queue row for
auditing. Nylas is the default provider; Brevo can be selected with one secret.
See `EMAILS.md` for the design system, template list, and preview tools.

## 1. Connect the sender mailbox

In Nylas, connect the mailbox KARGO should send from and copy its grant ID. The
grant determines the actual From address.

## 2. Configure Edge Function secrets

Run these from an authenticated Supabase CLI session (do not put these values in
`VITE_*` variables or commit them):

```powershell
supabase secrets set NYLAS_API_KEY="<nylas-api-key>" NYLAS_GRANT_ID="<nylas-grant-id>"
```

For an EU Nylas application, also set:

```powershell
supabase secrets set NYLAS_API_URI="https://api.eu.nylas.com"
```

US applications default to `https://api.us.nylas.com`.

Then set the app origin the email buttons should open:

```powershell
supabase secrets set KARGO_APP_URL="https://your-app-origin"
```

`APP_URL` and `SITE_URL` are accepted as fallbacks. Leave all three unset and
CTAs render as instructions ("Open KARGO and go to My Claims") instead of links
that go nowhere.

The banner logo needs no secret: it resolves from the public `brand-assets`
bucket (step 4). To point at a different image, set either of these:

```powershell
supabase secrets set KARGO_EMAIL_LOGO_URL="https://cdn.example.com/kargo-logo-head.png"
supabase secrets set KARGO_EMAIL_ASSET_BASE_URL="https://your-app-origin"
```

## 3. Send through Brevo instead (optional)

Nylas stays the default. To switch providers without touching code:

```powershell
supabase secrets set EMAIL_PROVIDER="brevo" `
  BREVO_API_KEY="<brevo-api-key>" `
  BREVO_SENDER_EMAIL="orders@your-domain.com" `
  BREVO_SENDER_NAME="KARGO"
```

Switch back with `supabase secrets set EMAIL_PROVIDER="nylas"` or by unsetting
it. A missing or invalid provider configuration fails the worker at startup and
leaves the queue untouched, so no mail is lost.

## 4. Apply and deploy

This repository currently keeps its SQL in
`supabase/migrations (to update profile database name)`, which is not the
Supabase CLI's standard migration directory. Apply
`202610120001_nylas_email_queue.sql` and
`202610190002_branded_email_design.sql` through the Supabase SQL editor (or move
them into your active migration workflow), then deploy the function:

```powershell
supabase functions deploy process-pending-emails
```

The second migration extends `claim_pending_emails` with `template`, `context`,
and the resolved details the designed templates need, and creates the public
`brand-assets` storage bucket.

Upload the banner mark once so the fallback logo URL is real:

```powershell
node scripts/upload-brand-assets.mjs
```

The script reads `.env.local`, creates the bucket if it is missing, uploads
`public/kargo-logo-head.png` (and `public/kargo-logo.png`), and prints the public
URLs. A missing logo is not fatal: the banner wordmark is live text.

## 5. Give the database cron job its internal credentials

Create a dedicated Supabase secret API key named `email_worker` for this worker.
Then run the following in the Supabase SQL editor, substituting the project URL
and that key:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'kargo_supabase_url'
);

select vault.create_secret(
  'sb_secret_YOUR_DEDICATED_WORKER_KEY',
  'kargo_email_worker_secret_key'
);
```

The migration-created cron job remains a no-op until both Vault secrets exist.
It then invokes the worker every minute.

## Verification

Render every template locally before sending real mail:

```powershell
npm run test:emails
npm run preview:emails      # scripts/out/emails/index.html
npm run screenshot:emails   # optional visual pass, light + dark
```

Then insert a normal application event that queues an email, or inspect the queue:

```sql
select id, template, subject, status, attempt_count, sent_at, last_error,
       provider_message_id, provider_request_id
from public.pending_emails
order by created_at desc
limit 20;
```

Successful rows move to `sent` and the worker response reports the provider it
used. Temporary failures return to `pending` with exponential backoff. Permanent
failures and rows that exhaust five attempts move to `failed` and retain
`last_error` for diagnosis. A row still renders from its queued `subject`/`body`
if its template is unknown or was queued before the branded migration.
