begin;
lock table public.orders in share row exclusive mode;
-- Retain historical incomplete events, but display and capture expired instead.
alter table public.order_fulfillment_events drop constraint order_fulfillment_events_stage_check;
alter table public.order_fulfillment_events add constraint order_fulfillment_events_stage_check
  check (stage in ('payment_confirmed','preparing','shipped','in_transit','delivered','cancelled','incomplete','expired'));
-- Only backfill evidenced expiry times, never order creation or reservation deadlines.
insert into public.order_fulfillment_events(order_id,stage,occurred_at,source)
select o.id,'expired',min(n.created_at),'notification'
from public.orders o join public.notifications n on n.context->>'order_id'=o.id::text
where n.dedupe_key in ('claim_exp_'||o.id::text,'fulfillment_expired_'||o.id::text)
  and isfinite(n.created_at) and n.created_at<=statement_timestamp()
group by o.id
on conflict(order_id,stage) do nothing;

create or replace function public.fulfillment_analytics_stage(p_status text,p_stage text)
returns text language sql immutable set search_path='' as $$
  select case
    when p_status in ('cancelled','expired') then p_status
    when p_status='incomplete' then null
    when p_status='completed' or p_stage='delivered' then 'delivered'
    when p_stage in ('preparing','shipped','in_transit') then p_stage
    when p_status in ('payment_confirmed','preparing') then p_status
    else null end;
$$;
revoke all on function public.fulfillment_analytics_stage(text,text) from public,anon,authenticated;

create or replace function public.admin_fulfillment_analytics(
  p_period text default 'last_30_days',p_start date default null,p_end date default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r record; result jsonb; as_of timestamptz:=statement_timestamp();
begin
  perform public.admin_assert();
  select * into r from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);
  with stages(stage) as (values ('payment_confirmed'),('preparing'),('shipped'),('in_transit'),('delivered'),('cancelled'),('expired')),
  selected as (
    select * from public.order_fulfillment_events e
    where e.stage <> 'incomplete' and e.occurred_at>=r.start_at and e.occurred_at<r.end_at and e.occurred_at<=as_of and e.recorded_at<=as_of
  ), buckets as (
    select b at time zone 'Asia/Manila' as bucket_start,
      (b+('1 '||r.grouping)::interval) at time zone 'Asia/Manila' as bucket_end
    from generate_series(date_trunc(r.grouping,r.start_at at time zone 'Asia/Manila'),
      date_trunc(r.grouping,(r.end_at-interval '1 microsecond') at time zone 'Asia/Manila'),('1 '||r.grouping)::interval) b
  ), counts as (
    select (date_trunc(r.grouping,e.occurred_at at time zone 'Asia/Manila') at time zone 'Asia/Manila') as bucket_start,
      e.stage,count(*) as count from selected e group by 1,2
  ), chart as (
    select b.bucket_start,b.bucket_end,jsonb_object_agg(s.stage,coalesce(c.count,0)) as counts
    from buckets b cross join stages s left join counts c on c.bucket_start=b.bucket_start and c.stage=s.stage
    group by b.bucket_start,b.bucket_end
  )
  select jsonb_build_object('period',p_period,'timezone','Asia/Manila','startAt',r.start_at,'endAt',r.end_at,
    'grouping',r.grouping,'generatedAt',as_of,
    'countingRule','first_recorded_entry_per_order_per_stage',
    'snapshot', (select md5(coalesce(string_agg(order_id::text||stage||extract(epoch from occurred_at)::text,',' order by order_id,stage),'')) from selected),
    'captureStartedAt',(select capture_started_at from public.fulfillment_analytics_metadata),
    'historicalCoverage','partial_evidence_only',
    'totalEntries',(select count(*) from selected),'uniqueOrders',(select count(distinct order_id) from selected),
    'stageTotals',(select jsonb_object_agg(s.stage,(select count(*) from selected e where e.stage=s.stage)) from stages s),
    'chart',(select coalesce(jsonb_agg(jsonb_build_object('bucketStart',bucket_start,'bucketEnd',bucket_end,'counts',counts) order by bucket_start),'[]'::jsonb) from chart)) into result;
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
declare r record; result jsonb; as_of timestamptz:=coalesce(p_as_of,statement_timestamp());
  limit_rows integer:=least(greatest(coalesce(p_limit,25),1),100);
  offset_rows integer:=greatest(coalesce(p_offset,0),0);
begin
  perform public.admin_assert();
  if not isfinite(as_of) or as_of>statement_timestamp() then
    raise exception 'Invalid analytics snapshot time' using errcode='22023';
  end if;
  if p_stage is null or p_stage not in ('payment_confirmed','preparing','shipped','in_transit','delivered','cancelled','expired') then
    raise exception 'Select a fulfillment stage' using errcode='22023';
  end if;
  select * into r from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);
  if p_snapshot is not null and p_snapshot is distinct from (
    select md5(coalesce(string_agg(e.order_id::text||e.stage||extract(epoch from e.occurred_at)::text,',' order by e.order_id,e.stage),''))
    from public.order_fulfillment_events e where e.stage <> 'incomplete' and e.occurred_at>=r.start_at and e.occurred_at<r.end_at
      and e.occurred_at<=as_of and e.recorded_at<=as_of
  ) then
    raise exception 'Analytics changed; refresh the chart before viewing orders' using errcode='40001';
  end if;
  if p_bucket is not null and (not isfinite(p_bucket) or
    p_bucket is distinct from (date_trunc(r.grouping,p_bucket at time zone 'Asia/Manila') at time zone 'Asia/Manila') or
    p_bucket>=r.end_at or (p_bucket at time zone 'Asia/Manila'+('1 '||r.grouping)::interval) at time zone 'Asia/Manila'<=r.start_at) then
    raise exception 'Invalid chart bucket' using errcode='22023';
  end if;
  with selected as (
    select e.order_id,o.order_number,e.stage,e.occurred_at,e.source,o.status as current_status,o.fulfillment_stage as current_fulfillment_stage
    from public.order_fulfillment_events e join public.orders o on o.id=e.order_id
    where e.stage=p_stage and e.occurred_at>=r.start_at and e.occurred_at<r.end_at
      and e.occurred_at<=as_of and e.recorded_at<=as_of
      and (p_bucket is null or (date_trunc(r.grouping,e.occurred_at at time zone 'Asia/Manila') at time zone 'Asia/Manila')=p_bucket)
  ), page as (select * from selected order by occurred_at,order_id limit limit_rows offset offset_rows)
  select jsonb_build_object('generatedAt',as_of,'total',(select count(*) from selected),
    'rows',(select coalesce(jsonb_agg(to_jsonb(page) order by occurred_at,order_id),'[]'::jsonb) from page),
    'nextOffset',offset_rows+limit_rows) into result;
  return result;
end;
$$;
revoke all on function public.admin_fulfillment_orders(text,date,date,text,timestamptz,timestamptz,integer,integer,text) from public,anon;
grant execute on function public.admin_fulfillment_orders(text,date,date,text,timestamptz,timestamptz,integer,integer,text) to authenticated;

commit;
