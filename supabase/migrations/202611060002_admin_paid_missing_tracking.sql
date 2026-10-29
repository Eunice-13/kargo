-- Match the dashboard paid-orders-missing-tracking count before pagination.
create or replace function public.admin_list_orders(
  p_search text default null,
  p_status text default 'all',
  p_days integer default 30,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_since timestamptz := case when coalesce(p_days,0) > 0 then now() - make_interval(days => p_days) else null end;
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  select count(*) into v_total
  from public.orders o
  join public.batch_products bp on bp.id = o.batch_product_id
  join public.user_profiles buyer on buyer.id = o.buyer_id
  join public.user_profiles seller on seller.id = o.seller_id
  where
    (v_search is null or o.order_number ilike '%' || v_search || '%'
      or bp.name ilike '%' || v_search || '%'
      or buyer.display_name ilike '%' || v_search || '%'
      or seller.display_name ilike '%' || v_search || '%')
    and (p_status = 'all' or o.status::text = p_status
      or (p_status = 'paid_missing_tracking'
        and o.status in ('payment_confirmed', 'preparing')
        and o.payment_confirmed_at is not null
        and o.payment_confirmed_at < now() - interval '7 days'
        and (o.tracking_number is null or length(trim(o.tracking_number)) = 0)))
    and (v_since is null or o.created_at >= v_since);

  select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc), '[]'::jsonb)
    into v_rows
  from (
    select
      o.id, o.order_number as "orderNumber", bp.name as product,
      buyer.display_name as buyer, seller.display_name as seller,
      o.total_amount as amount, o.status,
      o.tracking_number as "trackingNumber", o.created_at as "createdAt"
    from public.orders o
    join public.batch_products bp on bp.id = o.batch_product_id
    join public.user_profiles buyer on buyer.id = o.buyer_id
    join public.user_profiles seller on seller.id = o.seller_id
    where
      (v_search is null or o.order_number ilike '%' || v_search || '%'
        or bp.name ilike '%' || v_search || '%'
        or buyer.display_name ilike '%' || v_search || '%'
        or seller.display_name ilike '%' || v_search || '%')
      and (p_status = 'all' or o.status::text = p_status
      or (p_status = 'paid_missing_tracking'
        and o.status in ('payment_confirmed', 'preparing')
        and o.payment_confirmed_at is not null
        and o.payment_confirmed_at < now() - interval '7 days'
        and (o.tracking_number is null or length(trim(o.tracking_number)) = 0)))
      and (v_since is null or o.created_at >= v_since)
    order by o.created_at desc
    offset v_offset limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', coalesce(v_total,0), 'nextOffset', v_offset + v_limit);
end;
$$;

revoke all on function public.admin_list_orders(text, text, integer, integer, integer) from public, anon;
grant execute on function public.admin_list_orders(text, text, integer, integer, integer) to authenticated;
