-- Run after migrations against a local Supabase database using psql.
-- All fixtures, including the signup-trigger profile, are rolled back.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'profile-rename@kargo.test', '', now(), now(), now());

do $$
begin
  if not public.is_active('10000000-0000-0000-0000-000000000009') then
    raise exception 'Signup trigger or is_active failed after profile rename';
  end if;
  if public.can_sell('10000000-0000-0000-0000-000000000009') then
    raise exception 'New buyer unexpectedly has seller capability';
  end if;

  update public.user_profiles set can_sell = true
  where id = '10000000-0000-0000-0000-000000000009';
  if not public.can_sell('10000000-0000-0000-0000-000000000009') then
    raise exception 'can_sell did not read user_profiles';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.prosrc ~ '\mpublic\.profiles\M'
  ) then
    raise exception 'A function still references the old profile table';
  end if;
end;
$$;
rollback;
