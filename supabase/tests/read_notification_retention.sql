-- Run against local Supabase after applying migrations. All changes roll back:
-- psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/read_notification_retention.sql
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('15000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'notification-retention@kargo.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.user_profiles (id, display_name)
values ('15000000-0000-0000-0000-000000000001', 'Notification Retention Test')
on conflict (id) do nothing;

insert into public.notifications (id, recipient_id, category, message, created_at, read_at)
values
  -- Old and read for longer than 30 days: remove.
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'check', 'Old read', now() - interval '90 days', now() - interval '31 days'),
  -- Old but only recently read: retain for a full 30 days from reading.
  ('25000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'check', 'Recently read', now() - interval '90 days', now() - interval '1 day'),
  -- Old and unread: always retain.
  ('25000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000001', 'check', 'Old unread', now() - interval '90 days', null),
  -- Boundary: delete only after 30 days, not before or at the boundary.
  ('25000000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000001', 'check', 'Exactly 30 days', now() - interval '90 days', now() - interval '30 days');

select public.cleanup_read_notifications();

do $$
begin
  if exists (select 1 from public.notifications where id = '25000000-0000-0000-0000-000000000001') then
    raise exception 'Read notification older than 30 days was not removed';
  end if;
  if (select count(*) from public.notifications where id in (
    '25000000-0000-0000-0000-000000000002',
    '25000000-0000-0000-0000-000000000003',
    '25000000-0000-0000-0000-000000000004'
  )) <> 3 then
    raise exception 'Cleanup removed an unread, recently read, or boundary notification';
  end if;
  if public.cleanup_read_notifications() <> 0 then
    raise exception 'Cleanup must be idempotent';
  end if;
  if has_function_privilege('authenticated', 'public.cleanup_read_notifications()', 'execute')
     or has_function_privilege('anon', 'public.cleanup_read_notifications()', 'execute') then
    raise exception 'Client roles must not execute global cleanup';
  end if;
  if (select count(*) from cron.job where jobname = 'kargo_cleanup_read_notifications' and active) <> 1 then
    raise exception 'Expected one active daily cleanup job';
  end if;
end;
$$;

rollback;
