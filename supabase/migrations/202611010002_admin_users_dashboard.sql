-- ============================================================================
-- KARGO Admin — Phase 2: Dashboard + Users read/write RPCs
-- ============================================================================
-- Depends on 202611010001_admin_foundation.sql (admin_members, is_admin(),
-- admin_audit(), account_status columns).
--
-- Every function is security definer, search_path='' , fully qualified, and
-- gated with is_admin(). Reads return jsonb the frontend consumes directly.
-- Writes require a reason, protect the actor from self-harm, and write one
-- audit row in the same transaction.
--
-- GMV = sum(orders.total_amount) where status in
--   ('payment_confirmed','preparing','completed').
-- "Active sellers" = can_sell and account_status='active'.
-- Email is read from auth.users inside these definer functions (clients cannot).
-- Apply via the Supabase SQL editor (CLI db push is blocked by the pre-existing
-- migration-history mismatch; this file is standalone and idempotent).
-- ============================================================================

-- ─── helper: assert caller is an admin ──────────────────────────────────────

create or replace function public.admin_assert()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.admin_assert() from public, anon, authenticated;

-- ─── admin_dashboard() ──────────────────────────────────────────────────────

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_gmv_30 numeric;
  v_orders_30 integer;
  v_active_sellers integer;
  v_payments_pending integer;
  v_suspended integer;
  v_flagged_hidden integer;
  v_stuck integer;
  v_chart jsonb;
  v_recent jsonb;
  v_top jsonb;
begin
  perform public.admin_assert();

  select coalesce(sum(o.total_amount), 0), count(*)
    into v_gmv_30, v_orders_30
  from public.orders o
  where o.status = any(v_confirmed)
    and o.created_at >= now() - interval '30 days';

  select count(*) into v_active_sellers
  from public.user_profiles p
  where p.can_sell = true and p.account_status = 'active';

  select count(*) into v_payments_pending
  from public.payments pay
  where pay.status = 'pending_review';

  select count(*) into v_suspended
  from public.user_profiles p
  where p.account_status = 'suspended';

  -- Flagged/hidden batches only if the moderation column exists (Phase 3).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'batches'
      and column_name = 'moderation_status'
  ) then
    execute $q$
      select count(*) from public.batches
      where moderation_status in ('flagged','hidden')
    $q$ into v_flagged_hidden;
  else
    v_flagged_hidden := 0;
  end if;

  -- Paid-but-not-shipped for 7+ days: confirmed/preparing with no tracking.
  select count(*) into v_stuck
  from public.orders o
  where o.status in ('payment_confirmed','preparing')
    and o.payment_confirmed_at is not null
    and o.payment_confirmed_at < now() - interval '7 days'
    and (o.tracking_number is null or length(trim(o.tracking_number)) = 0);

  -- 14-day GMV series (oldest -> newest), zero-filled.
  select jsonb_agg(row_to_json(d) order by d.day)
    into v_chart
  from (
    select
      (current_date - g.offset) as day,
      coalesce((
        select sum(o.total_amount)
        from public.orders o
        where o.status = any(v_confirmed)
          and o.created_at::date = (current_date - g.offset)
      ), 0) as gmv
    from generate_series(13, 0, -1) as g(offset)
  ) d;

  -- Recent admin activity (last 8 audit rows).
  select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb)
    into v_recent
  from (
    select id, actor_name, action, target_type, target_label, created_at
    from public.admin_audit_log
    order by created_at desc
    limit 8
  ) a;

  -- Top sellers (30d) by confirmed GMV.
  select coalesce(jsonb_agg(row_to_json(s) order by s.gmv desc), '[]'::jsonb)
    into v_top
  from (
    select
      p.id,
      coalesce(nullif(p.shop_name, ''), p.display_name) as shop,
      p.avatar_path,
      count(o.id) as orders,
      coalesce(sum(o.total_amount), 0) as gmv
    from public.user_profiles p
    join public.orders o on o.seller_id = p.id
      and o.status = any(v_confirmed)
      and o.created_at >= now() - interval '30 days'
    where p.can_sell = true
    group by p.id, shop, p.avatar_path
    order by gmv desc
    limit 5
  ) s;

  return jsonb_build_object(
    'gmv30', v_gmv_30,
    'orders30', v_orders_30,
    'activeSellers', v_active_sellers,
    'paymentsPending', v_payments_pending,
    'suspended', v_suspended,
    'flaggedHidden', v_flagged_hidden,
    'stuckOrders', v_stuck,
    'chart', coalesce(v_chart, '[]'::jsonb),
    'recentActivity', v_recent,
    'topSellers', v_top
  );
end;
$$;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- ─── admin_list_users() ─────────────────────────────────────────────────────
-- p_role: 'all'|'buyer'|'seller'|'admin'; p_status: 'all'|'active'|'suspended'

create or replace function public.admin_list_users(
  p_search text default null,
  p_role text default 'all',
  p_status text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  -- Shared filter predicate, evaluated once for the total and once for the page.
  -- (Kept as two queries for clarity; the set is small for a hackathon dataset.)
  select count(*) into v_total
  from public.user_profiles p
  left join auth.users u on u.id = p.id
  where
    (v_search is null
      or p.display_name ilike '%' || v_search || '%'
      or u.email ilike '%' || v_search || '%'
      or coalesce(p.shop_name, '') ilike '%' || v_search || '%'
      or p.id::text = v_search)
    and (p_role = 'all'
      or (p_role = 'admin' and public.is_admin(p.id))
      or (p_role = 'seller' and p.can_sell and not public.is_admin(p.id))
      or (p_role = 'buyer' and not p.can_sell and not public.is_admin(p.id)))
    and (p_status = 'all' or p.account_status::text = p_status);

  select coalesce(jsonb_agg(row_to_json(f) order by f.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select
      p.id,
      p.display_name as name,
      u.email,
      nullif(p.shop_name, '') as "shopName",
      p.avatar_path as "avatarPath",
      p.can_sell as "canSell",
      public.is_admin(p.id) as "isAdmin",
      p.account_status as "accountStatus",
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      coalesce((select count(*) from public.orders o where o.buyer_id = p.id), 0) as orders,
      coalesce((
        select sum(o.total_amount) from public.orders o
        where o.seller_id = p.id and o.status = any(v_confirmed)
          and o.created_at >= now() - interval '30 days'
      ), 0) as "gmv30"
    from public.user_profiles p
    left join auth.users u on u.id = p.id
    where
      (v_search is null
        or p.display_name ilike '%' || v_search || '%'
        or u.email ilike '%' || v_search || '%'
        or coalesce(p.shop_name, '') ilike '%' || v_search || '%'
        or p.id::text = v_search)
      and (p_role = 'all'
        or (p_role = 'admin' and public.is_admin(p.id))
        or (p_role = 'seller' and p.can_sell and not public.is_admin(p.id))
        or (p_role = 'buyer' and not p.can_sell and not public.is_admin(p.id)))
      and (p_status = 'all' or p.account_status::text = p_status)
    order by p.created_at desc
    offset v_offset limit v_limit
  ) f;

  return jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'nextOffset', v_offset + v_limit
  );
end;
$$;

revoke all on function public.admin_list_users(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, text, integer, integer) to authenticated;

-- ─── admin_get_user() ───────────────────────────────────────────────────────

create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_profile jsonb;
  v_recent jsonb;
  v_history jsonb;
begin
  perform public.admin_assert();

  select jsonb_build_object(
    'id', p.id,
    'name', p.display_name,
    'email', u.email,
    'bio', p.bio,
    'shopName', nullif(p.shop_name, ''),
    'avatarPath', p.avatar_path,
    'canSell', p.can_sell,
    'isAdmin', public.is_admin(p.id),
    'accountStatus', p.account_status,
    'accountStatusReason', p.account_status_reason,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'buyerOrders', coalesce((select count(*) from public.orders o where o.buyer_id = p.id), 0),
    'sellerOrders', coalesce((select count(*) from public.orders o where o.seller_id = p.id), 0),
    'sellerGmv30', coalesce((
      select sum(o.total_amount) from public.orders o
      where o.seller_id = p.id and o.status = any(v_confirmed)
        and o.created_at >= now() - interval '30 days'
    ), 0),
    'liveBatches', coalesce((
      select count(*) from public.batches b
      where b.seller_id = p.id and b.status = 'live'
    ), 0)
  )
  into v_profile
  from public.user_profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if v_profile is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
    into v_recent
  from (
    select o.id, o.order_number, o.status, o.total_amount, o.created_at
    from public.orders o
    where o.buyer_id = p_user_id or o.seller_id = p_user_id
    order by o.created_at desc
    limit 5
  ) r;

  select coalesce(jsonb_agg(row_to_json(h) order by h.created_at desc), '[]'::jsonb)
    into v_history
  from (
    select id, actor_name, action, target_label, reason, created_at
    from public.admin_audit_log
    where target_type = 'user' and target_id = p_user_id::text
    order by created_at desc
    limit 10
  ) h;

  return v_profile
    || jsonb_build_object('recentOrders', v_recent, 'moderationHistory', v_history);
end;
$$;

revoke all on function public.admin_get_user(uuid) from public, anon;
grant execute on function public.admin_get_user(uuid) to authenticated;

-- ─── admin_search_users() — lightweight picker ──────────────────────────────

create or replace function public.admin_search_users(
  p_query text,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 25);
  v_rows jsonb;
begin
  perform public.admin_assert();
  if v_query is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    into v_rows
  from (
    select p.id, p.display_name as name, u.email, p.avatar_path
    from public.user_profiles p
    left join auth.users u on u.id = p.id
    where p.display_name ilike '%' || v_query || '%'
       or u.email ilike '%' || v_query || '%'
    order by p.display_name
    limit v_limit
  ) r;

  return v_rows;
end;
$$;

revoke all on function public.admin_search_users(text, integer) from public, anon;
grant execute on function public.admin_search_users(text, integer) to authenticated;

-- ─── admin_set_account_status() — suspend / restore ─────────────────────────

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.user_profiles;
  v_label text;
begin
  perform public.admin_assert();

  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status' using errcode = '42501';
  end if;

  select * into v_target from public.user_profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if v_target.account_status = p_status then
    return jsonb_build_object('changed', false, 'status', p_status);
  end if;

  v_label := coalesce(nullif(v_target.shop_name, ''), v_target.display_name);

  update public.user_profiles
  set account_status = p_status,
      account_status_reason = trim(p_reason),
      account_status_changed_at = now(),
      account_status_changed_by = auth.uid()
  where id = p_user_id;

  perform public.admin_audit(
    case when p_status = 'suspended' then 'suspend_account' else 'restore_account' end,
    'user', p_user_id::text, v_label, trim(p_reason),
    jsonb_build_object('account_status', v_target.account_status),
    jsonb_build_object('account_status', p_status)
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    p_user_id,
    case when p_status = 'suspended' then 'package' else 'check' end,
    case when p_status = 'suspended'
      then 'Your account has been suspended. Reason: ' || trim(p_reason)
      else 'Your account has been restored.' end,
    'Settings',
    jsonb_build_object('account_status', p_status),
    'account_status_' || p_user_id::text || '_' || extract(epoch from now())::bigint::text
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true, 'status', p_status);
end;
$$;

revoke all on function public.admin_set_account_status(uuid, public.account_status, text) from public, anon;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;

-- ─── admin_set_seller_access() — grant / revoke can_sell ────────────────────

create or replace function public.admin_set_seller_access(
  p_user_id uuid,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.user_profiles;
  v_label text;
begin
  perform public.admin_assert();

  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;

  select * into v_target from public.user_profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if v_target.can_sell = p_enabled then
    return jsonb_build_object('changed', false, 'canSell', p_enabled);
  end if;

  v_label := coalesce(nullif(v_target.shop_name, ''), v_target.display_name);

  update public.user_profiles set can_sell = p_enabled where id = p_user_id;

  perform public.admin_audit(
    case when p_enabled then 'grant_seller' else 'revoke_seller' end,
    'user', p_user_id::text, v_label, trim(p_reason),
    jsonb_build_object('can_sell', v_target.can_sell),
    jsonb_build_object('can_sell', p_enabled)
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    p_user_id,
    'check',
    case when p_enabled
      then 'Seller access has been enabled for your account.'
      else 'Seller access has been removed. Reason: ' || trim(p_reason) end,
    'Settings',
    jsonb_build_object('can_sell', p_enabled),
    'seller_access_' || p_user_id::text || '_' || extract(epoch from now())::bigint::text
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true, 'canSell', p_enabled);
end;
$$;

revoke all on function public.admin_set_seller_access(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_seller_access(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
