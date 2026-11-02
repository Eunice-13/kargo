-- Phase 1 fulfillment analytics: payment-confirmed cohort with full recorded history.
-- The history boundary is the earliest available event, not a fixed calendar date.
update public.fulfillment_analytics_metadata
set capture_started_at = coalesce(
  (select min(occurred_at) from public.order_fulfillment_events),
  '1970-01-01 00:00:00+00'::timestamptz
)
where singleton;

create or replace function public.fulfillment_analytics_range(
  p_period text,
  p_start date,
  p_end date,
  p_as_of timestamptz
) returns table(start_at timestamptz, end_at timestamptz, "grouping" text)
language plpgsql stable security definer set search_path='' as $$
declare
  local_today date := (p_as_of at time zone 'Asia/Manila')::date;
  start_day date;
  end_day date;
  days integer;
begin
  if p_period is null or p_period not in ('today','last_7_days','last_30_days','all_time','custom') then
    raise exception 'Invalid fulfillment analytics period' using errcode='22023';
  end if;

  if p_period='custom' then
    if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
      or p_start>p_end or p_end>local_today then
      raise exception 'Choose valid start/end dates, no later than today' using errcode='22023';
    end if;
    start_day:=p_start;
    end_day:=p_end;
  else
    if p_start is not null or p_end is not null then
      raise exception 'Dates are only accepted for a custom range' using errcode='22023';
    end if;
    end_day:=local_today;
    start_day:=case p_period
      when 'today' then local_today
      when 'last_7_days' then local_today-6
      when 'last_30_days' then local_today-29
    end;
    if p_period='all_time' then
      select greatest(
        coalesce(min((e.occurred_at at time zone 'Asia/Manila')::date), local_today),
        ((select capture_started_at from public.fulfillment_analytics_metadata)
          at time zone 'Asia/Manila')::date
      )
      into start_day
      from public.order_fulfillment_events e
      where e.occurred_at<=p_as_of and e.recorded_at<=p_as_of;
    end if;
  end if;

  days:=end_day-start_day+1;
  "grouping":=case
    when p_period='all_time' then 'month'
    when days=1 then 'hour'
    when days<=31 then 'day'
    when days<=180 then 'week'
    else 'month'
  end;
  start_at:=start_day::timestamp at time zone 'Asia/Manila';
  end_at:=(end_day+1)::timestamp at time zone 'Asia/Manila';
  return next;
end;
$$;
revoke all on function public.fulfillment_analytics_range(text,date,date,timestamptz) from public,anon,authenticated;

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
      e.occurred_at as payment_confirmed_at,
      e.source as payment_source
    from events e
    where e.stage='payment_confirmed'
      and e.occurred_at>=r.start_at
      and e.occurred_at<r.end_at
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
    select date_trunc(r.grouping,c.payment_confirmed_at at time zone 'Asia/Manila') at time zone 'Asia/Manila' as bucket_start,
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
    select distinct on (e.order_id) e.order_id,e.occurred_at as payment_confirmed_at,e.source as payment_source
    from events e
    where e.stage='payment_confirmed' and e.occurred_at>=r.start_at and e.occurred_at<r.end_at
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
    select c.order_id,'payment_confirmed'::text as stage,c.payment_confirmed_at as reached_at,c.payment_source as source,c.payment_confirmed_at as cohort_at
    from cohort c
    union
    select c.order_id,'preparing',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.payment_confirmed_at
    from cohort c join events e on e.order_id=c.order_id and e.stage in ('preparing','shipped','in_transit','delivered') group by c.order_id,c.payment_confirmed_at
    union
    select c.order_id,'shipped',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.payment_confirmed_at
    from cohort c join events e on e.order_id=c.order_id and e.stage in ('shipped','in_transit','delivered') group by c.order_id,c.payment_confirmed_at
    union
    select c.order_id,'delivered',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.payment_confirmed_at
    from cohort c join events e on e.order_id=c.order_id and e.stage='delivered' group by c.order_id,c.payment_confirmed_at
    union
    select c.order_id,'cancelled',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.payment_confirmed_at
    from cohort c join events e on e.order_id=c.order_id and e.stage='cancelled' group by c.order_id,c.payment_confirmed_at
    union
    select c.order_id,'expired',min(e.occurred_at),(array_agg(e.source order by e.occurred_at))[1],c.payment_confirmed_at
    from cohort c join events e on e.order_id=c.order_id and e.stage='expired' group by c.order_id,c.payment_confirmed_at
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

notify pgrst,'reload schema';
