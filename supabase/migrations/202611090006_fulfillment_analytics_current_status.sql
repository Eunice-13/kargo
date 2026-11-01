-- Current-status companion view for fulfillment analytics.
-- Existing reached-stage RPCs remain unchanged.

create or replace function public.fulfillment_analytics_current_cohort(
  p_period text default 'last_30_days',
  p_start date default null,
  p_end date default null,
  p_as_of timestamptz default statement_timestamp()
) returns table(order_id uuid)
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
    select distinct on (e.order_id) e.order_id
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
  select pc.order_id
  from payment_candidates pc
  join history_start hs on hs.order_id=pc.order_id
  cross join capture c
  where hs.first_history_at >= c.capture_started_at;
$$;
revoke all on function public.fulfillment_analytics_current_cohort(text,date,date,timestamptz)
  from public,anon,authenticated;

create or replace function public.admin_fulfillment_current_status(
  p_period text default 'last_30_days',
  p_start date default null,
  p_end date default null
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  as_of timestamptz := statement_timestamp();
  result jsonb;
begin
  perform public.admin_assert();

  with stages(stage) as (
    values
      ('payment_confirmed'),('preparing'),('shipped'),('delivered'),
      ('cancelled'),('expired'),('other')
  ),
  classified as (
    select
      c.order_id,
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
    from public.fulfillment_analytics_current_cohort(p_period,p_start,p_end,as_of) c
    join public.orders o on o.id=c.order_id
  ),
  totals as (
    select s.stage,coalesce(count(c.order_id),0)::integer as count
    from stages s
    left join classified c on c.stage=s.stage
    group by s.stage
  )
  select jsonb_build_object(
    'cohortSize',(select count(*) from classified),
    'generatedAt',as_of,
    'counts',(select jsonb_object_agg(stage,count) from totals)
  ) into result;

  return result;
end;
$$;
revoke all on function public.admin_fulfillment_current_status(text,date,date)
  from public,anon;
grant execute on function public.admin_fulfillment_current_status(text,date,date)
  to authenticated;

notify pgrst,'reload schema';
