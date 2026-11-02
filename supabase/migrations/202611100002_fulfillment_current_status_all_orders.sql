-- "Current status" view of Order Fulfillment now covers EVERY order created in
-- the selected window, not only payment-confirmed ones.
--
--   Awaiting payment : payment_pending, payment_submitted, insufficient_payment
--   Fulfillment      : payment_confirmed, preparing, shipped, delivered (completed)
--   Closed w/o delivery : expired, cancelled          (any order, paid or not)
--   Other            : anything else (e.g. incomplete)
--
-- Each order is counted once, in its latest status, so the counts add up to
-- the number of orders created in the window. The "Reached stage" view is
-- unchanged: it still only looks at payment-confirmed orders and keeps the
-- full recorded history.
--
-- Only functions change (CREATE OR REPLACE). No tables, columns or data are
-- touched. Safe to re-run. Supersedes the current-status functions in
-- 202611090006/7/8 and 202611100001.

-- Single place that maps an order's status + fulfillment stage to a bucket.
create or replace function public.fulfillment_analytics_current_stage(
  p_status text,
  p_stage text
) returns text
language sql immutable set search_path='' as $$
  select case
    when p_status in ('payment_pending','payment_submitted','insufficient_payment') then p_status
    else coalesce(
      case public.fulfillment_analytics_stage(p_status,p_stage)
        when 'in_transit' then 'shipped'
        else public.fulfillment_analytics_stage(p_status,p_stage)
      end,
      'other'
    )
  end;
$$;
revoke all on function public.fulfillment_analytics_current_stage(text,text)
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
    values
      ('payment_pending'),('payment_submitted'),('insufficient_payment'),
      ('payment_confirmed'),('preparing'),('shipped'),('delivered'),
      ('expired'),('cancelled'),('other')
  ),
  classified as (
    select
      o.id as order_id,
      o.created_at,
      public.fulfillment_analytics_current_stage(o.status::text,o.fulfillment_stage) as stage
    from public.orders o
    where o.created_at >= range_row.start_at
      and o.created_at <  range_row.end_at
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

create or replace function public.admin_fulfillment_current_status_orders(
  p_period text default 'last_30_days',
  p_start date default null,
  p_end date default null,
  p_stage text default null,
  p_limit integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  as_of timestamptz := statement_timestamp();
  range_row record;
  result jsonb;
  limit_rows integer := least(greatest(coalesce(p_limit,25),1),100);
  offset_rows integer := greatest(coalesce(p_offset,0),0);
begin
  perform public.admin_assert();
  if p_stage is null or p_stage not in (
    'payment_pending','payment_submitted','insufficient_payment',
    'payment_confirmed','preparing','shipped','delivered',
    'expired','cancelled','other'
  ) then
    raise exception 'Select a current order status' using errcode='22023';
  end if;
  select * into range_row
  from public.fulfillment_analytics_range(p_period,p_start,p_end,as_of);

  with selected as (
    select
      o.id as order_id,
      o.order_number,
      public.fulfillment_analytics_current_stage(o.status::text,o.fulfillment_stage) as stage,
      -- For this view "occurred_at" is when the order was created.
      o.created_at as occurred_at,
      'current_status'::text as source,
      o.status::text as current_status,
      o.fulfillment_stage as current_fulfillment_stage
    from public.orders o
    where o.created_at >= range_row.start_at
      and o.created_at <  range_row.end_at
      and public.fulfillment_analytics_current_stage(o.status::text,o.fulfillment_stage) = p_stage
  ),
  page as (
    select *
    from selected
    order by occurred_at desc, order_id
    limit limit_rows offset offset_rows
  )
  select jsonb_build_object(
    'generatedAt',as_of,
    'total',(select count(*) from selected),
    'rows',(select coalesce(jsonb_agg(to_jsonb(page) order by occurred_at desc, order_id),'[]'::jsonb) from page),
    'nextOffset',offset_rows+limit_rows
  ) into result;

  return result;
end;
$$;
revoke all on function public.admin_fulfillment_current_status_orders(text,date,date,text,integer,integer)
  from public,anon;
grant execute on function public.admin_fulfillment_current_status_orders(text,date,date,text,integer,integer)
  to authenticated;

notify pgrst,'reload schema';
