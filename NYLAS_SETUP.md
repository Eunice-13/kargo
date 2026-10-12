# Nylas transactional email setup

`process-pending-emails` drains `public.pending_emails` once per minute. It sends
from one Nylas-connected mailbox and keeps retries and provider IDs on the queue
row for auditing.

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

## 3. Apply and deploy

This repository currently keeps its SQL in
`supabase/migrations (to update profile database name)`, which is not the
Supabase CLI's standard migration directory. Apply
`202610120001_nylas_email_queue.sql` through the Supabase SQL editor (or move it
into your active migration workflow), then deploy the function:

```powershell
supabase functions deploy process-pending-emails
```

## 4. Give the database cron job its internal credentials

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

Insert a normal application event that queues an email, or inspect the queue:

```sql
select id, subject, status, attempt_count, sent_at, last_error,
       provider_message_id, provider_request_id
from public.pending_emails
order by created_at desc
limit 20;
```

Successful rows move to `sent`. Temporary failures return to `pending` with
exponential backoff. Permanent failures and rows that exhaust five attempts move
to `failed` and retain `last_error` for diagnosis.
