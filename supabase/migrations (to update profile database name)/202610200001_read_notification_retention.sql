-- Retain unread notifications indefinitely. Read notifications become eligible
-- for deletion 30 days after read_at, regardless of when they were created.
create extension if not exists pg_cron;

create index if not exists notifications_read_at_retention_idx
  on public.notifications (read_at)
  where read_at is not null;

create or replace function public.cleanup_read_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.notifications
  where read_at is not null
    and read_at < now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_read_notifications() from public, anon, authenticated;
grant execute on function public.cleanup_read_notifications() to service_role;

-- Reapplying the migration replaces this job without creating duplicates.
do $$
declare
  existing_job bigint;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'kargo_cleanup_read_notifications'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$$;

-- Daily at 03:00 UTC. Eligible records are removed on the next daily run.
select cron.schedule(
  'kargo_cleanup_read_notifications',
  '0 3 * * *',
  $$select public.cleanup_read_notifications();$$
);
