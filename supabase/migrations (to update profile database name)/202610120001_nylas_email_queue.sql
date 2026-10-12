-- Reliable delivery metadata and atomic queue claiming for the Nylas worker.

alter table public.pending_emails
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists claim_token uuid,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text,
  add column if not exists provider_message_id text,
  add column if not exists provider_request_id text;

alter table public.pending_emails
  drop constraint if exists pending_emails_status_check,
  add constraint pending_emails_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  drop constraint if exists pending_emails_attempt_count_check,
  add constraint pending_emails_attempt_count_check check (attempt_count >= 0);

-- Preserve the state of rows that might have been delivered before this
-- migration introduced an explicit status column.
update public.pending_emails
set status = 'sent'
where sent_at is not null and status <> 'sent';

drop index if exists public.pending_emails_unsent_idx;
create index if not exists pending_emails_ready_idx
  on public.pending_emails (next_attempt_at, created_at)
  where sent_at is null and status in ('pending', 'processing');

-- Claiming is one transaction and uses SKIP LOCKED, so overlapping cron runs
-- cannot normally process the same row. claim_token also prevents an expired,
-- slow worker from overwriting the result of a newer worker.
create or replace function public.claim_pending_emails(
  p_limit integer default 25,
  p_lease_seconds integer default 300
)
returns table (
  id uuid,
  claim_token uuid,
  attempt_count integer,
  recipient_email text,
  recipient_name text,
  subject text,
  body text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select pe.id
    from public.pending_emails pe
    where pe.sent_at is null
      and pe.attempt_count < 5
      and pe.next_attempt_at <= now()
      and (
        pe.status = 'pending'
        or (
          pe.status = 'processing'
          and pe.locked_at < now() - make_interval(
            secs => greatest(coalesce(p_lease_seconds, 300), 60)
          )
        )
      )
    order by pe.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), claimed as (
    update public.pending_emails pe
    set status = 'processing',
        locked_at = now(),
        claim_token = gen_random_uuid(),
        last_attempt_at = now(),
        attempt_count = pe.attempt_count + 1,
        last_error = null
    from candidates c
    where pe.id = c.id
    returning pe.id, pe.claim_token, pe.attempt_count, pe.recipient_id,
              pe.subject, pe.body, pe.created_at
  )
  select c.id,
         c.claim_token,
         c.attempt_count,
         u.email::text,
         up.display_name,
         c.subject,
         c.body
  from claimed c
  left join auth.users u on u.id = c.recipient_id
  left join public.user_profiles up on up.id = c.recipient_id
  order by c.created_at;
end;
$$;

revoke all on function public.claim_pending_emails(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_pending_emails(integer, integer)
  to service_role;

-- pg_cron calls the Edge Function once per minute. The WHERE clauses make the
-- job a no-op until both Vault values described in NYLAS_SETUP.md are present.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('kargo_process_pending_emails');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'kargo_process_pending_emails',
  '* * * * *',
  $job$
    select net.http_post(
      url := rtrim((
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'kargo_supabase_url'
        order by created_at desc
        limit 1
      ), '/') || '/functions/v1/process-pending-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'kargo_email_worker_secret_key'
          order by created_at desc
          limit 1
        )
      ),
      body := '{"limit":25}'::jsonb,
      timeout_milliseconds := 50000
    )
    where exists (
      select 1 from vault.decrypted_secrets where name = 'kargo_supabase_url'
    )
      and exists (
        select 1 from vault.decrypted_secrets
        where name = 'kargo_email_worker_secret_key'
      );
  $job$
);
