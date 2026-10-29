create or replace function public.admin_list_batches(
  p_search text default null,
  p_status text default 'all',
  p_moderation text default 'all',
  p_category text default 'all',
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
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  select count(*) into v_total
  from public.batches b
  join public.user_profiles s on s.id = b.seller_id
  where
    (v_search is null
      or b.title ilike '%' || v_search || '%'
      or s.display_name ilike '%' || v_search || '%'
      or b.id::text = v_search)
    and (p_status = 'all' or b.status::text = p_status)
    and (p_moderation = 'all' or b.moderation_status::text = p_moderation
      or (p_moderation = 'flagged_hidden' and b.moderation_status in ('flagged', 'hidden')))
    and (p_category = 'all' or b.category = p_category);

  select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc), '[]'::jsonb)
    into v_rows
  from (
    select
      b.id,
      b.title,
      b.status,
      b.category,
      b.moderation_status as "moderationStatus",
      b.moderation_reason as "moderationReason",
      b.cover_path as "coverPath",
      b.starts_on as "startsOn",
      b.ends_on as "endsOn",
      b.created_at as "createdAt",
      b.seller_id as "sellerId",
      s.display_name as "sellerName",
      (select count(*) from public.batch_products x where x.batch_id = b.id) as products,
      coalesce((select sum(x.quantity_total) from public.batch_products x where x.batch_id = b.id), 0) as "totalQty",
      coalesce((
        select sum(o.quantity) from public.orders o
        join public.batch_products x on x.id = o.batch_product_id
        where x.batch_id = b.id
          and o.status = any (array['payment_pending'::public.order_status,'payment_submitted'::public.order_status,'insufficient_payment'::public.order_status,'payment_confirmed'::public.order_status,'preparing'::public.order_status,'completed'::public.order_status])
      ), 0) as "claimedQty"
    from public.batches b
    join public.user_profiles s on s.id = b.seller_id
    where
      (v_search is null
        or b.title ilike '%' || v_search || '%'
        or s.display_name ilike '%' || v_search || '%'
        or b.id::text = v_search)
      and (p_status = 'all' or b.status::text = p_status)
      and (p_moderation = 'all' or b.moderation_status::text = p_moderation
      or (p_moderation = 'flagged_hidden' and b.moderation_status in ('flagged', 'hidden')))
      and (p_category = 'all' or b.category = p_category)
    order by b.created_at desc
    offset v_offset limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', coalesce(v_total, 0), 'nextOffset', v_offset + v_limit);
end;
$$;

revoke all on function public.admin_list_batches(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_batches(text, text, text, text, integer, integer) to authenticated;

