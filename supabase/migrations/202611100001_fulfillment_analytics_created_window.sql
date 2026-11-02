-- Align "Where orders stand" and Order fulfillment analytics on one window.
--
-- Both cards now start from the same set of orders: orders CREATED in the
-- selected Manila-time window (for "last 30 days", today-29 .. today).
--   * Where orders stand: all of those orders, paid or not, grouped once by
--     their current status.
--   * Fulfillment analytics: only those orders that have a payment_confirmed
--     event, shown either by where they are now (current status) or by every
--     stage they have touched (reached stage).
--
-- Previously the analytics cohort was chosen by the payment_confirmed event
-- time and the dashboard used a rolling now() - 30 days, so the two cards
-- could not be compared. Trend buckets now use the order's created date.
--
-- Only function bodies change (CREATE OR REPLACE / one DROP of a helper whose
-- return type changes). No tables, columns or data are touched. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Shared cohort definition: created in window AND payment-confirmed.
-- ---------------------------------------------------------------------------
drop function if exists public.fulfillment_analytics_current_cohort_rows(text,date,date,timestamptz);

create function public.fulfillment_analytics_current_cohort_rows(
  p_period text default 'last_30_days',
  p_start date default null,
  p_end date default null,
  p_as_of timestamptz default statement_timestamp()
) returns table(order_id uuid, created_at timestamptz)
language sql stable security definer set search_path='' as $$
  with range as (
    select * from public.fulfillment_analytics_range(p_period,p_start,p_end,p_as_of)
  ),
  capture as (
    select capture_started_at from public.fulfillment_analytics_metadata where singleton
  ),
  events as (
    select e.*
    from public.order_fulfillment_events e
    where e.stage <> 'incomplete'
      and e.occurred_at <= p_as_of
      and e.recorded_at <= p_as_of
  ),
  paid as (
    select distinct e.order_id from events e where e.stage='payment_confirmed'
  ),
  history_start as (
    select e.order_id,min(e.occurred_at) as first_history_at
    from events e
    group by e.order_id
  )
  select o.id, o.created_at
  from public.orders o
  cross join range r
  join paid p on p.order_id=o.id
  join history_start hs on hs.order_id=o.id
  cross join capture c
  where o.created_at >= r.start_at
    and o.created_at <  r.end_at
    and hs.first_history_at >= c.capture_started_at;
$$;
revoke all on function public.fulfillment_analytics_current_cohort_rows(text,date,date,timestamptz)
  from public,anon,authenticated;

create or replace function public.fulfillment_analytics_current_cohort(
  p_period text default 'last_30_days',
  p_start date default null,
  p_end date default null,
  p_as_of timestamptz default statement_timestamp()
) returns table(order_id uuid)
language sql stable security definer set search_path='' as $$
  select c.order_id
  from public.fulfillment_analytics_current_cohort_rows(p_period,p_start,p_end,p_as_of) c;
$$;
revoke all on function public.fulfillment_analytics_current_cohort(text,date,date,timestamptz)
  from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 2. Current status view (counts + trend chart bucketed by created date).
-- ---------------------------------------------------------------------------
create or replace function public.admin_fulfillment_current_status(
  p_period text default 'last_30_days',
  p_start date default null,
  p_end date default null
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  as_of timestamptz := statement_timestamp();
  range_row record;
  result jsonb;
begin
  perform public.admin_assert();
  select * into range_row
  from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);

  with stages(stage) as (
    values ('payment_confirmed'),('preparing'),('shipped'),('delivered'),
      ('cancelled'),('expired'),('other')
  ),
  classified as (
    select
      c.order_id,
      c.created_at,
      case public.fulfillment_analytics_stage(o.status::text,o.fulfillment_stage)
        when 'in_transit' then 'shipped'
        when 'payment_confirmed' then 'payment_confirmed'
        when 'preparing' then 'preparing'
        when 'shipped' then 'shipped'
        when 'delivered' then 'delivered'
        when 'cancelled' then 'cancelled'
        when 'expired' then 'expired'
        else 'other'
      end as stage
    from public.fulfillment_analytics_current_cohort_rows(
      p_period,p_start,p_end,as_of
    ) c
    join public.orders o on o.id=c.order_id
  ),
  totals as (
    select s.stage,coalesce(count(c.order_id),0)::integer as count
    from stages s left join classified c on c.stage=s.stage
    group by s.stage
  ),
  buckets as (
    select b at time zone 'Asia/Manila' as bucket_start,
      (b+('1 '||range_row.grouping)::interval) at time zone 'Asia/Manila' as bucket_end
    from generate_series(
      date_trunc(range_row.grouping,range_row.start_at at time zone 'Asia/Manila'),
      date_trunc(range_row.grouping,(range_row.end_at-interval '1 microsecond') at time zone 'Asia/Manila'),
      ('1 '||range_row.grouping)::interval
    ) b
  ),
  counts as (
    select
      date_trunc(range_row.grouping,c.created_at at time zone 'Asia/Manila')
        at time zone 'Asia/Manila' as bucket_start,
      c.stage,
      count(*)::integer as count
    from classified c
    group by 1,c.stage
  ),
  chart as (
    select b.bucket_start,b.bucket_end,
      jsonb_object_agg(s.stage,coalesce(c.count,0)) as counts
    from buckets b cross join stages s
    left join counts c on c.bucket_start=b.bucket_start and c.stage=s.stage
    group by b.bucket_start,b.bucket_end
  )
  select jsonb_build_object(
    'period',p_period,
    'timezone','Asia/Manila',
    'startAt',range_row.start_at,
    'endAt',range_row.end_at,
    'grouping',range_row.grouping,
    'cohortSize',(select count(*) from classified),
    'generatedAt',as_of,
    'counts',(select jsonb_object_agg(stage,count) from totals),
    'chart',(select coalesce(jsonb_agg(jsonb_build_object(
      'bucketStart',bucket_start,'bucketEnd',bucket_end,'counts',counts
    ) order by bucket_start),'[]'::jsonb) from chart)
  ) into result;

  return result;
end;
$$;
revoke all on function public.admin_fulfillment_current_status(text,date,date)
  from public,anon;
grant execute on function public.admin_fulfillment_current_status(text,date,date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reached-stage view: cohort chosen by created date, stages unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.admin_fulfillment_analytics(
  p_period text default 'last_30_days',
  p_start date default null,
  p_end date default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  r record;
  result jsonb;
  as_of timestamptz:=statement_timestamp();
  capture_start timestamptz;
begin
  perform public.admin_assert();
  select * into r from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);
  select m.capture_started_at into capture_start from public.fulfillment_analytics_metadata m where m.singleton;

  with stages(stage) as (
    values ('payment_confirmed'),('preparing'),('shipped'),('delivered'),('cancelled'),('expired')
  ),
  events as (
    select e.*
    from public.order_fulfillment_events e
    where e.stage <> 'incomplete'
      and e.occurred_at<=as_of
      and e.recorded_at<=as_of
  ),
  payment_candidates as (
    select distinct on (e.order_id)
      e.order_id,
      o.created_at as created_at,
      e.occurred_at as payment_confirmed_at,
      e.source as payment_source
    from events e
    join public.orders o on o.id=e.order_id
    where e.stage='payment_confirmed'
      and o.created_at>=r.start_at
      and o.created_at<r.end_at
    order by e.order_id,e.occurred_at,e.recorded_at
  ),
  history_start as (
    select e.order_id,min(e.occurred_at) as first_history_at
    from events e
    group by e.order_id
  ),
  excluded as (
    select pc.order_id
    from payment_candidates pc
    join history_start hs on hs.order_id=pc.order_id
    where hs.first_history_at < capture_start
  ),
  cohort as (
    select pc.*
    from payment_candidates pc
    left join excluded x on x.order_id=pc.order_id
    where x.order_id is null
  ),
  reached as (
    select c.order_id,'payment_confirmed'::text as stage,c.payment_confirmed_at as reached_at,c.payment_source as source
    from cohort c
    union
    select c.order_id,'preparing',min(e.occurred_at), (array_agg(e.source order by e.occurred_at))[1]
    from cohort c join events e on e.order_id=c.order_id and e.stage in ('preparing','shipped','in_transit','delivered')
    group by c.order_id
    union
    select c.order_id,'shipped',min(e.occurred_at), (array_agg(e.source order by e.occurred_at))[1]
    from cohort c join events e on e.order_id=c.order_id and e.stage in ('shipped','in_transit','delivered')
    group by c.order_id
    union
    select c.order_id,'delivered',min(e.occurred_at), (array_agg(e.source order by e.occurred_at))[1]
    from cohort c join events e on e.order_id=c.order_id and e.stage='delivered'
    group by c.order_id
    union
    select c.order_id,'cancelled',min(e.occurred_at), (array_agg(e.source order by e.occurred_at))[1]
    from cohort c join events e on e.order_id=c.order_id and e.stage='cancelled'
    group by c.order_id
    union
    select c.order_id,'expired',min(e.occurred_at), (array_agg(e.source order by e.occurred_at))[1]
    from cohort c join events e on e.order_id=c.order_id and e.stage='expired'
    group by c.order_id
  ),
  totals as (
    select s.stage,coalesce(count(rr.order_id),0)::integer as count
    from stages s left join reached rr on rr.stage=s.stage
    group by s.stage
  ),
  buckets as (
    select b at time zone 'Asia/Manila' as bucket_start,
      (b+('1 '||r.grouping)::interval) at time zone 'Asia/Manila' as bucket_end
    from generate_series(
      date_trunc(r.grouping,r.start_at at time zone 'Asia/Manila'),
      date_trunc(r.grouping,(r.end_at-interval '1 microsecond') at time zone 'Asia/Manila'),
      ('1 '||r.grouping)::interval
    ) b
  ),
  counts as (
    select date_trunc(r.grouping,c.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila' as bucket_start,
      reached.stage,count(*)::integer as count
    from reached
    join cohort c on c.order_id=reached.order_id
    group by 1,reached.stage
  ),
  chart as (
    select b.bucket_start,b.bucket_end,
      jsonb_object_agg(s.stage,coalesce(c.count,0)) as counts
    from buckets b cross join stages s
    left join counts c on c.bucket_start=b.bucket_start and c.stage=s.stage
    group by b.bucket_start,b.bucket_end
  )
  select jsonb_build_object(
    'period',p_period,
    'timezone','Asia/Manila',
    'startAt',r.start_at,
    'endAt',r.end_at,
    'grouping',r.grouping,
    'generatedAt',as_of,
    'countingRule','payment_confirmed_cohort_reached_stages',
    'snapshot',(select md5(coalesce(string_agg(order_id::text||stage||extract(epoch from reached_at)::text,',' order by order_id,stage),'')) from reached),
    'captureStartedAt',capture_start,
    'historicalCoverage','full_recorded_history',
    'totalEntries',(select count(*) from reached),
    'cohortSize',(select count(*) from cohort),
    'excludedOrders',(select count(*) from excluded),
    'uniqueOrders',(select count(*) from cohort),
    'stageTotals',(select jsonb_object_agg(stage,count) from totals),
    'chart',(select coalesce(jsonb_agg(jsonb_build_object('bucketStart',bucket_start,'bucketEnd',bucket_end,'counts',counts) order by bucket_start),'[]'::jsonb) from chart)
  ) into result;

  if ((result->'stageTotals'->>'delivered')::integer > (result->'stageTotals'->>'shipped')::integer
      or (result->'stageTotals'->>'shipped')::integer > (result->'stageTotals'->>'preparing')::integer
      or (result->'stageTotals'->>'preparing')::integer > (result->'stageTotals'->>'payment_confirmed')::integer) then
    raise exception 'Fulfillment funnel is not monotonic' using errcode='22023';
  end if;
  return result;
end;
$$;
revoke all on function public.admin_fulfillment_analytics(text,date,date) from public,anon;
grant execute on function public.admin_fulfillment_analytics(text,date,date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reached-stage drill-down: same cohort; bucket filter uses created date.
-- ---------------------------------------------------------------------------
create or replace function public.admin_fulfillment_orders(
  p_period text default 'last_30_days',p_start date default null,p_end date default null,
  p_stage text default null,p_bucket timestamptz default null,p_as_of timestamptz default null,
  p_limit integer default 25,p_offset integer default 0,p_snapshot text default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  r record;
  result jsonb;
  as_of timestamptz:=coalesce(p_as_of,statement_timestamp());
  capture_start timestamptz;
  limit_rows integer:=least(greatest(coalesce(p_limit,25),1),100);
  offset_rows integer:=greatest(coalesce(p_offset,0),0);
begin
  perform public.admin_assert();
  if not isfinite(as_of) or as_of>statement_timestamp() then
    raise exception 'Invalid analytics snapshot time' using errcode='22023';
  end if;
  if p_stage is null or p_stage not in ('payment_confirmed','preparing','shipped','delivered','cancelled','expired') then
    raise exception 'Select a fulfillment stage' using errcode='22023';
  end if;
  select * into r from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);
  select m.capture_started_at into capture_start from public.fulfillment_analytics_metadata m where m.singleton;

  with events as (
    select e.* from public.order_fulfillment_events e
    where e.stage <> 'incomplete' and e.occurred_at<=as_of and e.recorded_at<=as_of
  ),
  payment_candidates as (
    select distinct on (e.order_id) e.order_id,o.created_at as created_at,e.occurred_at as payment_confirmed_at,e.source as payment_source
    from events e
    join public.orders o on o.id=e.order_id
    where e.stage='payment_confirmed' and o.created_at>=r.start_at and o.created_at<r.end_at
    order by e.order_id,e.occurred_at,e.recorded_at
  ),
  history_start as (
    select e.order_id,min(e.occurred_at) as first_history_at from events e group by e.order_id
  ),
  cohort as (
    select pc.* from payment_candidates pc
    join history_start hs on hs.order_id=pc.order_id and hs.first_history_at>=capture_start
  ),
  reached as (
    select c.order_id,'payment_confirmed'::text as stage,c.payment_confirmed_at as reached_at,c.payment_source as source,c.created_at as cohort_at
    from cohort c
    union
    select c.order_id,'preparing',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.created_at
    from cohort c join events e on e.order_id=c.order_id and e.stage in ('preparing','shipped','in_transit','delivered') group by c.order_id,c.created_at
    union
    select c.order_id,'shipped',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.created_at
    from cohort c join events e on e.order_id=c.order_id and e.stage in ('shipped','in_transit','delivered') group by c.order_id,c.created_at
    union
    select c.order_id,'delivered',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.created_at
    from cohort c join events e on e.order_id=c.order_id and e.stage='delivered' group by c.order_id,c.created_at
    union
    select c.order_id,'cancelled',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.created_at
    from cohort c join events e on e.order_id=c.order_id and e.stage='cancelled' group by c.order_id,c.created_at
    union
    select c.order_id,'expired',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.created_at
    from cohort c join events e on e.order_id=c.order_id and e.stage='expired' group by c.order_id,c.created_at
  ),
  selected as (
    select reached.order_id,o.order_number,reached.stage,reached.reached_at as occurred_at,reached.source,
      o.status as current_status,o.fulfillment_stage as current_fulfillment_stage
    from reached join public.orders o on o.id=reached.order_id
    where reached.stage=p_stage
      and (p_bucket is null or date_trunc(r.grouping,reached.cohort_at at time zone 'Asia/Manila') at time zone 'Asia/Manila'=p_bucket)
  ),
  page as (select * from selected order by occurred_at,order_id limit limit_rows offset offset_rows)
  select jsonb_build_object(
    'generatedAt',as_of,
    'total',(select count(*) from selected),
    'rows',(select coalesce(jsonb_agg(to_jsonb(page) order by occurred_at,order_id),'[]'::jsonb) from page),
    'nextOffset',offset_rows+limit_rows
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_fulfillment_orders(text,date,date,text,timestamptz,timestamptz,integer,integer,text) from public,anon;
grant execute on function public.admin_fulfillment_orders(text,date,date,text,timestamptz,timestamptz,integer,integer,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Dashboard "Where orders stand": same created window as the analytics.
--    Only the v_pipeline filter changes; the rest is copied unchanged from
--    202611070001_top_sellers_by_orders.sql.
-- ---------------------------------------------------------------------------
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
  -- aggregate so GMV and order counts can never disagree.
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

  -- Order pipeline: every order CREATED in the last 30 days (Manila calendar
  -- window, identical to fulfillment analytics "Last 30 days"), paid or not,
  -- grouped once by its current status.
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
    cross join (
      select w.start_at, w.end_at
      from public.fulfillment_analytics_range('last_30_days', null::date, null::date, now()) w
    ) win
    where o.created_at >= win.start_at
      and o.created_at <  win.end_at
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

  -- Top sellers (30d) by CONFIRMED ORDER COUNT (GMV breaks ties). The limit is
  -- applied on the order-count ranking so the five shown are the true top five.
  select coalesce(jsonb_agg(row_to_json(s) order by s.orders desc, s.gmv desc, s.shop), '[]'::jsonb)
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
    order by orders desc, gmv desc, shop
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

notify pgrst, 'reload schema';
