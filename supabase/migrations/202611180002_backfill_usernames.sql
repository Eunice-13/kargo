-- Backfill a unique public username for every account from its display name.
--
-- Rules match src/lib/username.ts and the user_profiles_username_format check:
-- lowercase, 3-20 characters, starts with a letter, letters/numbers/dot only,
-- no consecutive dots and no trailing dot. Duplicate names get a numeric
-- suffix, so a full name may repeat but a username never can.

create or replace function public.username_base(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  base text;
  reserved text[] := array[
    'admin', 'administrator', 'kargo', 'support', 'seller',
    'buyer', 'root', 'help', 'system', 'official'
  ];
begin
  base := regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9]+', '.', 'g');
  base := trim(both '.' from base);
  base := substr(base, 1, 20);
  base := trim(both '.' from base);

  if base = '' then
    base := 'user';
  elsif base !~ '^[a-z]' or length(base) < 3 or base = any(reserved) then
    base := 'user.' || base;
  end if;

  return rtrim(substr(base, 1, 20), '.');
end;
$$;

create or replace function public.username_with_suffix(p_base text, p_n int)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_n <= 0 then p_base
    else rtrim(substr(p_base, 1, 20 - length(p_n::text)), '.') || p_n::text
  end;
$$;

comment on function public.username_base(text) is
  'Derives the first-choice public username from a display name.';
comment on function public.username_with_suffix(text, int) is
  'Appends a numeric suffix while keeping a username within the 20-character limit.';

-- Backfill accounts created before usernames existed. Ordering makes the
-- numeric suffixes deterministic (oldest account keeps the unsuffixed handle).
do $$
declare
  profile record;
  base text;
  candidate text;
  suffix int;
begin
  for profile in
    select id, display_name
    from public.user_profiles
    where username is null
    order by created_at, id
  loop
    base := public.username_base(profile.display_name);
    candidate := base;
    suffix := 0;

    while exists (
      select 1 from public.user_profiles where username = candidate
    ) loop
      suffix := suffix + 1;
      candidate := public.username_with_suffix(base, suffix);
    end loop;

    update public.user_profiles
    set username = candidate
    where id = profile.id;
  end loop;
end
$$;

-- New profile rows that arrive without a handle (imports, admin-created
-- accounts) get one automatically. The unique index remains the authority.
create or replace function public.ensure_profile_username()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  if new.username is not null then
    return new;
  end if;

  base := public.username_base(new.display_name);
  candidate := base;

  while exists (
    select 1 from public.user_profiles where username = candidate
  ) loop
    suffix := suffix + 1;
    candidate := public.username_with_suffix(base, suffix);
  end loop;

  new.username := candidate;
  return new;
end;
$$;

drop trigger if exists ensure_profile_username on public.user_profiles;

create trigger ensure_profile_username
  before insert
  on public.user_profiles
  for each row
  execute function public.ensure_profile_username();

-- Already created in 202611160001, repeated here so this migration is
-- self-contained on databases that skipped it.
create unique index if not exists user_profiles_username_key
  on public.user_profiles (username);

comment on column public.user_profiles.username is
  'Unique public handle, stored lowercase, 3-20 chars starting with a letter. Duplicate display names receive a numeric suffix.';
