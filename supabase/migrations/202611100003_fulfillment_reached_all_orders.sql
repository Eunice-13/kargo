-- "Reached stage" view of Order Fulfillment now covers EVERY order created in
-- the selected window, including the awaiting-payment stages, and counts the
-- stages each order has EVER reached (one order can sit in many stages).
--
--   Awaiting payment : payment_pending, payment_submitted, insufficient_payment
--   Fulfillment      : payment_confirmed, preparing, shipped, delivered
--   Closed w/o delivery : expired, cancelled
--
-- Same cohort as the "Current status" view (orders created in the window), so
-- the two views start from the same orders. They differ only in how an order
-- is counted:
--   Current status : once, in its latest status          (counts add to 100%)
--   Reached stage  : in every stage it has reached        (counts can exceed 100%)
--
-- A stage counts as reached when the recorded history shows it (an event), or
-- when the order's CURRENT state proves it: an order that is delivered also
-- reached shipped, preparing, payment confirmed and payment submitted, and an
-- order that is expired/cancelled/insufficient reached that stage. Reached
-- therefore never shows fewer orders than Current status for the same stage.
--
-- The awaiting-payment stages had no history before, so this migration:
--   * allows them in order_fulfillment_events and records them from now on
--     (the existing orders trigger calls fulfillment_analytics_stage),
--   * backfills only what the data evidences: every order started as
--     payment_pending (its created_at); payment_submitted from the first
--     payments row; insufficient_payment only for orders currently in that
--     status (time of the last payment review).
--
-- Functions and event rows only; no existing order, payment or event is
-- changed. Safe to re-run. Supersedes the reached-stage functions in
-- 202611090004 and 202611100001.

-- ---------------------------------------------------------------------------
-- 1. Allow and record the awaiting-payment stages.
-- ---------------------------------------------------------------------------
alter table public.order_fulfillment_events
  drop constraint if exists order_fulfillment_events_stage_check;
alter table public.order_fulfillment_events
  add constraint order_fulfillment_events_stage_check
  check (stage in (
    'payment_pending','payment_submitted','insufficient_payment',
    'payment_confirmed','preparing','shipped','in_transit','delivered',
    'cancelled','incomplete','expired'
  ));

create or replace function public.fulfillment_analytics_stage(p_status text,p_stage text)
returns text language sql immutable set search_path='' as $$
  select case
    when p_status in ('payment_pending','payment_submitted','insufficient_payment') then p_status
    when p_status in ('cancelled','expired') then p_status
    when p_status='incomplete' then null
    when p_status='completed' or p_stage='delivered' then 'delivered'
    when p_stage in ('preparing','shipped','in_transit') then p_stage
    when p_status in ('payment_confirmed','preparing') then p_status
    else null end;
$$;
revoke all on function public.fulfillment_analytics_stage(text,text) from public,anon,authenticated;

-- Backfill from evidence only.
insert into public.order_fulfillment_events(order_id,stage,occurred_at,source)
select o.id,'payment_pending',o.created_at,'order_timestamp'
from public.orders o
where isfinite(o.created_at) and o.created_at <= statement_timestamp()
on conflict (order_id,stage) do nothing;

insert into public.order_fulfillment_events(order_id,stage,occurred_at,source)
select p.order_id,'payment_submitted',min(p.submitted_at),'order_timestamp'
from public.payments p
where isfinite(p.submitted_at) and p.submitted_at <= statement_timestamp()
group by p.order_id
on conflict (order_id,stage) do nothing;

insert into public.order_fulfillment_events(order_id,stage,occurred_at,source)
select o.id,'insufficient_payment',max(p.reviewed_at),'order_timestamp'
from public.orders o
join public.payments p on p.order_id=o.id
where o.status::text='insufficient_payment'
  and p.reviewed_at is not null and isfinite(p.reviewed_at)
  and p.reviewed_at <= statement_timestamp()
group by o.id
on conflict (order_id,stage) do nothing;

-- ---------------------------------------------------------------------------
-- 2. One definition of "which stages has each order reached".
--    Returns one row per (order, stage reached) for orders created in range.
--    reached_at is null when only the current state proves the stage.
-- ---------------------------------------------------------------------------
create or replace function public.fulfillment_analytics_reached(
  p_period text,
  p_start date,
  p_end date,
  p_as_of timestamptz
) returns table(
  order_id uuid,
  created_at timestamptz,
  stage text,
  reached_at timestamptz,
  source text
)
language sql stable security definer set search_path='' as $$
  with range as (
    select * from public.fulfillment_analytics_range(p_period,p_start,p_end,p_as_of)
  ),
  events as (
    select e.*
    from public.order_fulfillment_events e
    where e.stage <> 'incomplete'
      and e.occurred_at <= p_as_of
      and e.recorded_at <= p_as_of
  ),
  cohort as (
    select
      o.id as order_id,
      o.created_at,
      public.fulfillment_analytics_current_stage(o.status::text,o.fulfillment_stage) as current_stage
    from public.orders o
    cross join range r
    where o.created_at >= r.start_at
      and o.created_at <  r.end_at
  ),
  -- stage, recorded events that prove it, current states that prove it.
  defs(stage,event_stages,current_stages) as (
    values
      ('payment_submitted',
        array['payment_submitted','insufficient_payment','payment_confirmed','preparing','shipped','in_transit','delivered'],
        array['payment_submitted','insufficient_payment','payment_confirmed','preparing','shipped','delivered']),
      ('insufficient_payment',
        array['insufficient_payment'],
        array['insufficient_payment']),
      ('payment_confirmed',
        array['payment_confirmed','preparing','shipped','in_transit','delivered'],
        array['payment_confirmed','preparing','shipped','delivered']),
      ('preparing',
        array['preparing','shipped','in_transit','delivered'],
        array['preparing','shipped','delivered']),
      ('shipped',
        array['shipped','in_transit','delivered'],
        array['shipped','delivered']),
      ('delivered',
        array['delivered'],
        array['delivered']),
      ('cancelled',
        array['cancelled'],
        array['cancelled']),
      ('expired',
        array['expired'],
        array['expired'])
  ),
  from_events as (
    select c.order_id,d.stage,min(e.occurred_at) as reached_at,
      (array_agg(e.source order by e.occurred_at))[1] as source
    from cohort c
    join events e on e.order_id=c.order_id
    join defs d on e.stage = any(d.event_stages)
    group by c.order_id,d.stage
  ),
  from_current as (
    select c.order_id,d.stage
    from cohort c
    join defs d on c.current_stage = any(d.current_stages)
  ),
  later as (
    select
      coalesce(fe.order_id,fc.order_id) as order_id,
      coalesce(fe.stage,fc.stage) as stage,
      fe.reached_at,
      coalesce(fe.source,'current_status') as source
    from from_events fe
    full outer join from_current fc
      on fc.order_id=fe.order_id and fc.stage=fe.stage
  )
  -- Every order started as payment_pending.
  select c.order_id,c.created_at,'payment_pending'::text,
    coalesce(
      (select e.occurred_at from events e where e.order_id=c.order_id and e.stage='payment_pending'),
      c.created_at
    ),
    'order_timestamp'::text
  from cohort c
  union all
  select l.order_id,c.created_at,l.stage,l.reached_at,l.source
  from later l
  join cohort c on c.order_id=l.order_id;
$$;
revoke all on function public.fulfillment_analytics_reached(text,date,date,timestamptz)
  from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reached-stage summary: totals, trend chart (by created date), snapshot.
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
    values ('payment_pending'),('payment_submitted'),('insufficient_payment'),
      ('payment_confirmed'),('preparing'),('shipped'),('delivered'),
      ('cancelled'),('expired')
  ),
  reached as (
    select * from public.fulfillment_analytics_reached(p_period,p_start,p_end,as_of)
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
    select date_trunc(r.grouping,rr.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila' as bucket_start,
      rr.stage,count(*)::integer as count
    from reached rr
    group by 1,rr.stage
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
    'countingRule','all_orders_reached_stages',
    'snapshot',(select md5(coalesce(string_agg(order_id::text||stage||coalesce(extract(epoch from reached_at)::text,'-'),',' order by order_id,stage),'')) from reached),
    'captureStartedAt',capture_start,
    'historicalCoverage','full_recorded_history',
    'totalEntries',(select count(*) from reached),
    'cohortSize',(select count(*) from reached where stage='payment_pending'),
    'excludedOrders',0,
    'uniqueOrders',(select count(*) from reached where stage='payment_pending'),
    'stageTotals',(select jsonb_object_agg(stage,count) from totals),
    'chart',(select coalesce(jsonb_agg(jsonb_build_object('bucketStart',bucket_start,'bucketEnd',bucket_end,'counts',counts) order by bucket_start),'[]'::jsonb) from chart)
  ) into result;

  -- By construction every later stage is contained in the one before it.
  if ((result->'stageTotals'->>'delivered')::integer > (result->'stageTotals'->>'shipped')::integer
      or (result->'stageTotals'->>'shipped')::integer > (result->'stageTotals'->>'preparing')::integer
      or (result->'stageTotals'->>'preparing')::integer > (result->'stageTotals'->>'payment_confirmed')::integer
      or (result->'stageTotals'->>'payment_confirmed')::integer > (result->'stageTotals'->>'payment_submitted')::integer
      or (result->'stageTotals'->>'payment_submitted')::integer > (result->'stageTotals'->>'payment_pending')::integer) then
    raise exception 'Fulfillment funnel is not monotonic' using errcode='22023';
  end if;
  return result;
end;
$$;
revoke all on function public.admin_fulfillment_analytics(text,date,date) from public,anon;
grant execute on function public.admin_fulfillment_analytics(text,date,date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reached-stage drill-down.
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
  limit_rows integer:=least(greatest(coalesce(p_limit,25),1),100);
  offset_rows integer:=greatest(coalesce(p_offset,0),0);
begin
  perform public.admin_assert();
  if not isfinite(as_of) or as_of>statement_timestamp() then
    raise exception 'Invalid analytics snapshot time' using errcode='22023';
  end if;
  if p_stage is null or p_stage not in (
    'payment_pending','payment_submitted','insufficient_payment',
    'payment_confirmed','preparing','shipped','delivered','cancelled','expired'
  ) then
    raise exception 'Select a fulfillment stage' using errcode='22023';
  end if;
  select * into r from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);

  with selected as (
    select rr.order_id,o.order_number,rr.stage,rr.reached_at as occurred_at,rr.source,
      o.status as current_status,o.fulfillment_stage as current_fulfillment_stage
    from public.fulfillment_analytics_reached(p_period,p_start,p_end,as_of) rr
    join public.orders o on o.id=rr.order_id
    where rr.stage=p_stage
      and (p_bucket is null
        or date_trunc(r.grouping,rr.created_at at time zone 'Asia/Manila') at time zone 'Asia/Manila'=p_bucket)
  ),
  page as (
    select * from selected
    order by occurred_at nulls last,order_id
    limit limit_rows offset offset_rows
  )
  select jsonb_build_object(
    'generatedAt',as_of,
    'total',(select count(*) from selected),
    'rows',(select coalesce(jsonb_agg(to_jsonb(page) order by occurred_at nulls last,order_id),'[]'::jsonb) from page),
    'nextOffset',offset_rows+limit_rows
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_fulfillment_orders(text,date,date,text,timestamptz,timestamptz,integer,integer,text) from public,anon;
grant execute on function public.admin_fulfillment_orders(text,date,date,text,timestamptz,timestamptz,integer,integer,text) to authenticated;

notify pgrst,'reload schema';
