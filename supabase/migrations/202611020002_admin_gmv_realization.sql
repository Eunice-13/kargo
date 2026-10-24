-- Realized GMV: recognise money when the payment is confirmed, not when the
-- order was created. Seller approval (and admin override) sets
-- orders.payment_confirmed_at, so that timestamp is the canonical event for
-- GMV, buyer spend, seller GMV, the performance chart, and top sellers.
--
-- This replaces the dashboard created in 202611020001 and the money metrics in
-- 202611010002. A 45-day-old order approved today now counts today. Legacy
-- confirmed rows without a confirmation timestamp fall back to created_at.
--
-- Re-run is safe: every function is CREATE OR REPLACE.

-- ─── admin_dashboard() ───────────────────────────────────────────────────────

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed public.order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_gmv_30 numeric;
  v_orders_30 integer;
  v_active_sellers integer;
  v_payments_pending integer;
  v_suspended integer;
  v_flagged_hidden integer;
  v_stuck integer;
  v_chart jsonb;
  v_pipeline jsonb;
  v_recent jsonb;
  v_top jsonb;
begin
  perform public.admin_assert();

  select coalesce(sum(o.total_amount), 0), count(*)
    into v_gmv_30, v_orders_30
  from public.orders o
  where o.status = any(v_confirmed)
    and coalesce(o.payment_confirmed_at, o.created_at) >= now() - interval '30 days';

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

  -- 14-day performance series (oldest -> newest), zero-filled from one
  -- aggregate so GMV and order counts can never disagree. Both land on the
  -- day the payment was confirmed, so an approval today appears today even
  -- when the order was placed earlier.
  select jsonb_agg(row_to_json(d) order by d.day)
    into v_chart
  from (
    select
      (current_date - g.n) as day,
      coalesce(a.gmv, 0) as gmv,
      coalesce(a.orders, 0) as orders
    from generate_series(13, 0, -1) as g(n)
    left join (
      select
        coalesce(o.payment_confirmed_at, o.created_at)::date as day,
        sum(o.total_amount) as gmv,
        count(*)::integer as orders
      from public.orders o
      where o.status = any(v_confirmed)
        and coalesce(o.payment_confirmed_at, o.created_at)::date
          between current_date - 13 and current_date
      group by 1
    ) a on a.day = (current_date - g.n)
  ) d;

  -- Order pipeline: every order created in the last 30 days, grouped by status
  -- and returned in the enum's natural order. Zero-count statuses are omitted.
  select coalesce(
    jsonb_agg(
      jsonb_build_object('status', s.status, 'count', s.count)
      order by s.sort_order
    ),
    '[]'::jsonb
  )
    into v_pipeline
  from (
    select
      o.status::text as status,
      count(*)::integer as count,
      array_position(enum_range(null::public.order_status), o.status) as sort_order
    from public.orders o
    where o.created_at >= now() - interval '30 days'
    group by o.status
  ) s;

  -- Recent admin activity (last 8 audit rows).
  select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb)
    into v_recent
  from (
    select id, actor_name, action, target_type, target_label, created_at
    from public.admin_audit_log
    order by created_at desc
    limit 8
  ) a;

  -- Top sellers (30d) by realized GMV.
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
      and coalesce(o.payment_confirmed_at, o.created_at) >= now() - interval '30 days'
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
    'pipeline', v_pipeline,
    'recentActivity', v_recent,
    'topSellers', v_top
  );
end;
$$;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- ─── admin_list_users() ──────────────────────────────────────────────────────

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
  v_confirmed public.order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

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

  select coalesce(jsonb_agg(row_to_json(f) order by f."createdAt" desc), '[]'::jsonb)
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
      u.last_sign_in_at as "lastSignInAt",
      coalesce((select count(*) from public.orders o where o.buyer_id = p.id), 0) as orders,
      -- Role-aware money metric (30d): sellers see what they sold; buyers see
      -- what they spent. Recognised at payment confirmation.
      case when p.can_sell then 'seller' else 'buyer' end as "gmvRole",
      coalesce((
        select sum(o.total_amount) from public.orders o
        where (case when p.can_sell then o.seller_id else o.buyer_id end) = p.id
          and o.status = any(v_confirmed)
          and coalesce(o.payment_confirmed_at, o.created_at) >= now() - interval '30 days'
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

-- ─── admin_get_user() ────────────────────────────────────────────────────────

create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed public.order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
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
    'lastSignInAt', u.last_sign_in_at,
    'buyerOrders', coalesce((select count(*) from public.orders o where o.buyer_id = p.id), 0),
    'sellerOrders', coalesce((select count(*) from public.orders o where o.seller_id = p.id), 0),
    'sellerGmv30', coalesce((
      select sum(o.total_amount) from public.orders o
      where o.seller_id = p.id and o.status = any(v_confirmed)
        and coalesce(o.payment_confirmed_at, o.created_at) >= now() - interval '30 days'
    ), 0),
    'buyerSpend30', coalesce((
      select sum(o.total_amount) from public.orders o
      where o.buyer_id = p.id and o.status = any(v_confirmed)
        and coalesce(o.payment_confirmed_at, o.created_at) >= now() - interval '30 days'
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
