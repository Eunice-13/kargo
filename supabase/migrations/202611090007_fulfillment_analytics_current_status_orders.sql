-- Current-status drill-down companion for admin_fulfillment_current_status.
-- Reached-stage drill-down RPCs remain unchanged.

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
  result jsonb;
  limit_rows integer := least(greatest(coalesce(p_limit,25),1),100);
  offset_rows integer := greatest(coalesce(p_offset,0),0);
begin
  perform public.admin_assert();
  if p_stage is null or p_stage not in (
    'payment_confirmed','preparing','shipped','delivered','cancelled','expired','other'
  ) then
    raise exception 'Select a current fulfillment status' using errcode='22023';
  end if;

  with cohort as (
    select *
    from public.fulfillment_analytics_current_cohort(
      p_period,p_start,p_end,as_of
    )
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
    from cohort c
    join public.orders o on o.id=c.order_id
  ),
  selected as (
    select
      c.order_id,
      o.order_number,
      c.stage,
      as_of as occurred_at,
      'current_status'::text as source,
      o.status::text as current_status,
      o.fulfillment_stage as current_fulfillment_stage
    from classified c
    join public.orders o on o.id=c.order_id
    where c.stage=p_stage
  ),
  page as (
    select *
    from selected
    order by order_id
    limit limit_rows offset offset_rows
  )
  select jsonb_build_object(
    'generatedAt',as_of,
    'total',(select count(*) from selected),
    'rows',(select coalesce(jsonb_agg(to_jsonb(page) order by order_id),'[]'::jsonb) from page),
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
