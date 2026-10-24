-- Admin dashboard performance data: adds confirmed-order counts to the daily
-- series and an order-pipeline breakdown (last 30 days) for the second chart.
-- Money is recognised at payment confirmation, so approvals on older orders
-- land in the window on the day the seller/admin confirms them.
-- Replaces the function from 202611010002_admin_users_dashboard.sql.

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
  -- day the payment was confirmed, not the order date.
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
