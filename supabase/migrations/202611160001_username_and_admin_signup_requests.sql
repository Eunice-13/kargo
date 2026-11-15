-- ============================================================================
-- KARGO — Signup usernames + admin signup requests
-- ============================================================================
-- Two changes that both have to land inside `handle_new_auth_user()`, because
-- the profile row (and everything hanging off it) is written by that trigger
-- from `auth.signUp` metadata. The client cannot insert profile rows before
-- email confirmation.
--
--   1. `user_profiles.username` — a unique public handle. Nullable so every
--      existing/seeded account stays valid; the app renders a derived fallback
--      for those. Stored lowercase; the unique index is lower-case-safe because
--      the trigger and API normalise before writing.
--
--   2. Admin is an approval request, not a self-service role. A signup that
--      asks for admin gets an ordinary non-seller account plus one pending row
--      in `admin_signup_requests`. An existing admin approves it, which routes
--      through admin_grant_admin() and therefore still requires the invitee to
--      accept the invitation before is_admin() turns on.
--
-- Depends on 202611010001 (admin_members, is_admin, admin_audit),
-- 202611010002 (admin_assert, admin users dashboard), 202611010004
-- (admin_grant_admin) and 202611110001 (handle_new_auth_user).
-- ============================================================================

-- ─── 1. Username ────────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists username text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_username_format'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_username_format
      check (
        username is null
        or (
          username = lower(username)
          and username ~ '^[a-z][a-z0-9._]{2,19}$'
          and username !~ '\.\.'
          and username !~ '\.$'
        )
      );
  end if;
end
$$;

create unique index if not exists user_profiles_username_key
  on public.user_profiles (username);

comment on column public.user_profiles.username is
  'Public handle, stored lowercase, 3-20 chars starting with a letter. Null for accounts created before usernames existed.';

-- ─── 2. Admin signup requests ───────────────────────────────────────────────

create table if not exists public.admin_signup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reason text
);

comment on table public.admin_signup_requests is
  'A signup that selected the Admin role. Grants nothing on its own: approval calls admin_grant_admin(), which issues an invitation the account must still accept.';

create index if not exists admin_signup_requests_status_idx
  on public.admin_signup_requests (status, requested_at);

alter table public.admin_signup_requests enable row level security;

drop policy if exists admin_signup_requests_select_own on public.admin_signup_requests;

create policy admin_signup_requests_select_own on public.admin_signup_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.admin_signup_requests to authenticated;
-- No insert/update/delete grants: rows are written by the signup trigger and
-- the two admin RPCs below, all of which run as definer.

-- ─── 3. Signup trigger: persist username, record admin requests ─────────────

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  via_app boolean := (meta ->> 'signup_flow') = 'kargo_app';
  requested_admin boolean := (meta ->> 'requested_role') = 'admin';
  can_sell boolean;
  username_value text;
  buyer_address jsonb;
  address_text text;
  address_lat double precision;
  address_lng double precision;
  socials jsonb;
  seller_payment jsonb;
  payment_type text;
  payment_name text;
  payment_number text;
begin
  can_sell := case
    when jsonb_typeof(meta -> 'can_sell') = 'boolean'
      then (meta ->> 'can_sell')::boolean
    else false
  end;

  -- An admin request never sells and never carries buyer/seller signup data.
  if requested_admin then
    can_sell := false;
  end if;

  username_value := nullif(trim(lower(coalesce(meta ->> 'username', ''))), '');

  buyer_address := case
    when jsonb_typeof(meta -> 'buyer_address') = 'object'
      then meta -> 'buyer_address'
    else null
  end;
  if buyer_address is not null then
    address_text := nullif(trim(buyer_address ->> 'addressText'), '');
    address_lat := case
      when jsonb_typeof(buyer_address -> 'lat') = 'number'
        then (buyer_address ->> 'lat')::double precision
      else null
    end;
    address_lng := case
      when jsonb_typeof(buyer_address -> 'lng') = 'number'
        then (buyer_address ->> 'lng')::double precision
      else null
    end;
  end if;
  socials := case
    when jsonb_typeof(meta -> 'social_links') = 'object'
      then meta -> 'social_links'
    else '{}'::jsonb
  end;

  -- Admin requests do not collect social accounts, so the "at least one social"
  -- signup contract is scoped to buyer/seller signups only.
  if via_app and not requested_admin and socials = '{}'::jsonb then
    raise exception 'Signup requires at least one social account'
      using errcode = '23514';
  end if;

  if username_value is not null and username_value !~ '^[a-z][a-z0-9._]{2,19}$' then
    raise exception 'Username format is invalid' using errcode = '23514';
  end if;

  insert into public.user_profiles (
    id,
    display_name,
    username,
    shop_name,
    social_links,
    social_visibility,
    can_sell
  )
  values (
    new.id,
    coalesce(meta ->> 'display_name', ''),
    username_value,
    nullif(meta ->> 'shop_name', ''),
    socials,
    case
      when jsonb_typeof(meta -> 'social_visibility') = 'object'
        then meta -> 'social_visibility'
      else '{}'::jsonb
    end,
    can_sell
  );

  if requested_admin then
    insert into public.admin_signup_requests (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
    return new;
  end if;

  -- Enforce the rest of the signup contract in the database as well as the
  -- form: buyers need a delivery address with a map pin, sellers need one
  -- usable payment method.
  if can_sell then
    seller_payment := meta -> 'seller_payment_method';
    if jsonb_typeof(seller_payment) = 'object' then
      payment_type := nullif(trim(seller_payment ->> 'method_type'), '');
      payment_name := nullif(trim(seller_payment ->> 'account_name'), '');
      payment_number := nullif(trim(seller_payment ->> 'account_number'), '');
    end if;

    if payment_type is null or payment_number is null then
      if via_app then
        raise exception 'Seller signup requires at least one payment method'
          using errcode = '23514';
      end if;
    else
      insert into public.seller_payment_methods (
        seller_id,
        method_type,
        account_name,
        account_number
      )
      select new.id, payment_type, payment_name, payment_number
      where not exists (
        select 1
        from public.seller_payment_methods method
        where method.seller_id = new.id
          and method.is_active
          and lower(method.method_type) = lower(payment_type)
          and coalesce(method.account_number, '') = coalesce(payment_number, '')
      );
    end if;
  else
    if via_app and (
      address_text is null or address_lat is null or address_lng is null
    ) then
      raise exception 'Buyer signup requires a delivery address and map pin'
        using errcode = '23514';
    end if;

    if address_text is not null and address_lat is not null and address_lng is not null then
      insert into public.buyer_addresses (
        buyer_id,
        slot,
        label,
        address_text,
        pin_lat,
        pin_lng,
        is_default
      )
      values (new.id, 1, 'Home', address_text, address_lat, address_lng, true)
      on conflict (buyer_id, slot) do nothing;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Creates the profile (including username) plus required signup data from auth.signUp metadata. Admin-role signups create a pending approval request instead of buyer/seller data.';

-- ─── 4. Admin RPCs ──────────────────────────────────────────────────────────

create or replace function public.admin_list_signup_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform public.admin_assert();

  select coalesce(jsonb_agg(row order by row ->> 'requestedAt' desc), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'id', r.id,
      'userId', r.user_id,
      'displayName', p.display_name,
      'username', p.username,
      'email', u.email,
      'requestedAt', r.requested_at
    ) as row
    from public.admin_signup_requests r
    join public.user_profiles p on p.id = r.user_id
    left join auth.users u on u.id = r.user_id
    where r.status = 'pending'
  ) rows;

  return v_rows;
end;
$$;

revoke all on function public.admin_list_signup_requests() from public, anon;
grant execute on function public.admin_list_signup_requests() to authenticated;

create or replace function public.admin_approve_signup_request(
  p_request_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.admin_signup_requests;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.admin_assert();

  if v_reason is null or length(v_reason) < 8 then
    v_reason := 'Approved admin signup request';
  end if;

  select * into v_request
  from public.admin_signup_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object('changed', false);
  end if;

  -- Reuses the existing grant path so the new admin still has to accept the
  -- invitation (accepted_at starts null) before is_admin() turns on.
  perform public.admin_grant_admin(
    p_user_id => v_request.user_id,
    p_reason => v_reason
  );

  update public.admin_signup_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reason = v_reason
  where id = p_request_id;

  return jsonb_build_object('changed', true);
end;
$$;

revoke all on function public.admin_approve_signup_request(uuid, text) from public, anon;
grant execute on function public.admin_approve_signup_request(uuid, text) to authenticated;

create or replace function public.admin_reject_signup_request(
  p_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.admin_signup_requests;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.admin_assert();

  if v_reason is null or length(v_reason) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;

  select * into v_request
  from public.admin_signup_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object('changed', false);
  end if;

  update public.admin_signup_requests
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reason = v_reason
  where id = p_request_id;

  return jsonb_build_object('changed', true);
end;
$$;

revoke all on function public.admin_reject_signup_request(uuid, text) from public, anon;
grant execute on function public.admin_reject_signup_request(uuid, text) to authenticated;

notify pgrst, 'reload schema';
