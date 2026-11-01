-- Add time-series data to the current-status response.
-- Existing reached-stage RPCs remain untouched.

create or replace function public.fulfillment_analytics_current_cohort_rows(
  p_period text default 'last_30_days',
  p_start date default null,
  p_end date default null,
  p_as_of timestamptz default statement_timestamp()
) returns table(order_id uuid, payment_confirmed_at timestamptz)
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
  payment_candidates as (
    select distinct on (e.order_id)
      e.order_id,
      e.occurred_at as payment_confirmed_at
    from events e cross join range r
    where e.stage='payment_confirmed'
      and e.occurred_at>=r.start_at
      and e.occurred_at<r.end_at
    order by e.order_id,e.occurred_at,e.recorded_at
  ),
  history_start as (
    select e.order_id,min(e.occurred_at) as first_history_at
    from events e
    group by e.order_id
  )
  select pc.order_id,pc.payment_confirmed_at
  from payment_candidates pc
  join history_start hs on hs.order_id=pc.order_id
  cross join capture c
  where hs.first_history_at >= c.capture_started_at;
$$;
revoke all on function public.fulfillment_analytics_current_cohort_rows(text,date,date,timestamptz)
  from public,anon,authenticated;

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
      c.payment_confirmed_at,
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
      date_trunc(range_row.grouping,c.payment_confirmed_at at time zone 'Asia/Manila')
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

notify pgrst,'reload schema';
