begin;
lock table public.orders in share row exclusive mode;

-- Additive analytics only: no order/payment updates or workflow replacements.
-- Count each order's first evidenced entry into each stage, not its current status.
create table public.order_fulfillment_events (
  order_id uuid not null references public.orders(id) on delete restrict,
  stage text not null check (stage in ('payment_confirmed','preparing','shipped','in_transit','delivered','cancelled','incomplete')),
  occurred_at timestamptz not null check (isfinite(occurred_at)),
  recorded_at timestamptz not null default clock_timestamp(),
  source text not null check (source in ('transition','order_timestamp','notification','admin_audit')),
  primary key (order_id, stage)
);
create index order_fulfillment_events_time_stage on public.order_fulfillment_events(occurred_at, stage, order_id);
alter table public.order_fulfillment_events enable row level security;
revoke all on public.order_fulfillment_events from public, anon, authenticated;

create table public.fulfillment_analytics_metadata (
  singleton boolean primary key default true check (singleton),
  capture_started_at timestamptz not null default clock_timestamp()
);
insert into public.fulfillment_analytics_metadata(singleton) values (true);
alter table public.fulfillment_analytics_metadata enable row level security;
revoke all on public.fulfillment_analytics_metadata from public, anon, authenticated;

-- Never derive a date from created_at/updated_at or infer skipped stages.
-- Evidence is retained even if an order later becomes cancelled.
with evidence as (
  select id as order_id, 'payment_confirmed'::text as stage, payment_confirmed_at as occurred_at,
    'order_timestamp'::text as source from public.orders where payment_confirmed_at is not null
  union all
  select id, 'delivered', completed_at, 'order_timestamp' from public.orders where completed_at is not null
  union all
  select o.id, stages.stage, n.created_at, 'notification'
  from public.notifications n join public.orders o on n.context->>'order_id' = o.id::text
  cross join (values ('payment_confirmed','payment_confirmed'),('preparing','preparing'),
    ('shipped','shipped'),('in_transit','in_transit'),('completed','delivered'),
    ('cancelled','cancelled'),('incomplete','incomplete')) stages(status,stage)
  where n.dedupe_key='fulfillment_'||stages.status||'_'||o.id
  union all
  select o.id, 'cancelled', a.created_at, 'admin_audit'
  from public.admin_audit_log a join public.orders o on a.target_id=o.id::text
  where a.target_type='order' and a.action='cancel_order' and a.after_state->>'status'='cancelled'
), first_entry as (
  select distinct on(order_id,stage) order_id,stage,occurred_at,source
  from evidence where isfinite(occurred_at) and occurred_at <= statement_timestamp()
    and stage in ('payment_confirmed','preparing','shipped','in_transit','delivered','cancelled','incomplete')
  order by order_id,stage,occurred_at,source
)
insert into public.order_fulfillment_events(order_id,stage,occurred_at,source)
select order_id,stage,occurred_at,source from first_entry;

create function public.fulfillment_analytics_stage(p_status text,p_stage text)
returns text language sql immutable set search_path='' as $$
  select case
    when p_status in ('cancelled','incomplete') then p_status
    when p_status='expired' then null
    when p_status='completed' or p_stage='delivered' then 'delivered'
    when p_stage in ('preparing','shipped','in_transit') then p_stage
    when p_status in ('payment_confirmed','preparing') then p_status
    else null end;
$$;
revoke all on function public.fulfillment_analytics_stage(text,text) from public,anon,authenticated;

create function public.capture_order_fulfillment_entry()
returns trigger language plpgsql security definer set search_path='' as $$
declare current_stage text; previous_stage text;
begin
  current_stage := public.fulfillment_analytics_stage(new.status::text,new.fulfillment_stage);
  if tg_op='UPDATE' then
    previous_stage := public.fulfillment_analytics_stage(old.status::text,old.fulfillment_stage);
  end if;
  if current_stage is not null and current_stage is distinct from previous_stage then
    insert into public.order_fulfillment_events(order_id,stage,occurred_at,source)
    values(new.id,current_stage,clock_timestamp(),'transition')
    on conflict(order_id,stage) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_order_fulfillment_entry() from public,anon,authenticated;
create trigger orders_capture_fulfillment_entry
  after insert or update of status,fulfillment_stage on public.orders
  for each row execute function public.capture_order_fulfillment_entry();

-- One range resolver for summaries and detail; all calendar arithmetic is Manila-local.
create function public.fulfillment_analytics_range(p_period text,p_start date,p_end date,p_as_of timestamptz)
returns table(start_at timestamptz,end_at timestamptz,"grouping" text)
language plpgsql stable security definer set search_path='' as $$
declare local_today date := (p_as_of at time zone 'Asia/Manila')::date;
  start_day date; end_day date; days integer;
begin
  if p_period is null or p_period not in ('today','last_7_days','last_30_days','all_time','custom') then
    raise exception 'Invalid fulfillment analytics period' using errcode='22023';
  end if;
  if p_period='custom' then
    if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
      or p_start>p_end or p_end>local_today then
      raise exception 'Choose valid start/end dates, no later than today' using errcode='22023';
    end if;
    start_day:=p_start; end_day:=p_end;
  else
    if p_start is not null or p_end is not null then
      raise exception 'Dates are only accepted for a custom range' using errcode='22023';
    end if;
    end_day:=local_today;
    start_day:=case p_period when 'today' then local_today when 'last_7_days' then local_today-6 when 'last_30_days' then local_today-29 end;
    if p_period='all_time' then
      select coalesce(min((e.occurred_at at time zone 'Asia/Manila')::date),local_today)
        into start_day from public.order_fulfillment_events e where e.occurred_at<=p_as_of and e.recorded_at<=p_as_of;
    end if;
  end if;
  days:=end_day-start_day+1;
  "grouping":=case when p_period='all_time' then 'month' when days=1 then 'hour'
    when days<=31 then 'day' when days<=180 then 'week' else 'month' end;
  start_at:=start_day::timestamp at time zone 'Asia/Manila';
  end_at:=(end_day+1)::timestamp at time zone 'Asia/Manila';
  return next;
end;
$$;
revoke all on function public.fulfillment_analytics_range(text,date,date,timestamptz) from public,anon,authenticated;

create function public.admin_fulfillment_analytics(
  p_period text default 'last_30_days',p_start date default null,p_end date default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r record; result jsonb; as_of timestamptz:=statement_timestamp();
begin
  perform public.admin_assert();
  select * into r from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);
  with stages(stage) as (values ('payment_confirmed'),('preparing'),('shipped'),('in_transit'),('delivered'),('cancelled'),('incomplete')),
  selected as (
    select * from public.order_fulfillment_events e
    where e.occurred_at>=r.start_at and e.occurred_at<r.end_at and e.occurred_at<=as_of and e.recorded_at<=as_of
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

create function public.admin_fulfillment_orders(
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
  if p_stage is null or p_stage not in ('payment_confirmed','preparing','shipped','in_transit','delivered','cancelled','incomplete') then
    raise exception 'Select a fulfillment stage' using errcode='22023';
  end if;
  select * into r from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);
  if p_snapshot is not null and p_snapshot is distinct from (
    select md5(coalesce(string_agg(e.order_id::text||e.stage||extract(epoch from e.occurred_at)::text,',' order by e.order_id,e.stage),''))
    from public.order_fulfillment_events e where e.occurred_at>=r.start_at and e.occurred_at<r.end_at
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
