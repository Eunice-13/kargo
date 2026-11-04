-- Preserve the existing admin detail response and authorization, adding the
-- stored product image path so the console can render photos without catalog data.
create or replace function public.admin_get_batch(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed public.order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_batch jsonb;
  v_products jsonb;
  v_history jsonb;
begin
  perform public.admin_assert();

  select jsonb_build_object(
    'id', b.id,
    'title', b.title,
    'status', b.status,
    'category', b.category,
    'moderationStatus', b.moderation_status,
    'moderationReason', b.moderation_reason,
    'coverPath', b.cover_path,
    'startsOn', b.starts_on,
    'endsOn', b.ends_on,
    'reservationHours', b.reservation_hours,
    'notes', b.notes,
    'sellerId', b.seller_id,
    'sellerName', s.display_name,
    'createdAt', b.created_at,
    'orderCount', coalesce((
      select count(*) from public.orders o
      join public.batch_products x on x.id = o.batch_product_id
      where x.batch_id = b.id), 0),
    'confirmedGmv', coalesce((
      select sum(o.total_amount) from public.orders o
      join public.batch_products x on x.id = o.batch_product_id
      where x.batch_id = b.id and o.status = any(v_confirmed)), 0)
  )
  into v_batch
  from public.batches b
  join public.user_profiles s on s.id = b.seller_id
  where b.id = p_batch_id;

  if v_batch is null then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(row_to_json(p) order by p.name), '[]'::jsonb)
    into v_products
  from (
    select
      bp.name,
      bp.image_path as "imagePath",
      bp.selling_price as "sellingPrice",
      bp.quantity_total as "quantityTotal",
      bp.is_locked as "isLocked",
      coalesce((select sum(o.quantity) from public.orders o
        where o.batch_product_id = bp.id
          and o.status = any (array['payment_pending'::public.order_status,'payment_submitted'::public.order_status,'insufficient_payment'::public.order_status,'payment_confirmed'::public.order_status,'preparing'::public.order_status,'completed'::public.order_status])), 0) as claimed,
      coalesce((select count(*) from public.waitlist_entries w
        where w.batch_product_id = bp.id and w.status = 'waiting'::public.waitlist_status), 0) as waitlist
    from public.batch_products bp
    where bp.batch_id = p_batch_id
  ) p;

  select coalesce(jsonb_agg(row_to_json(h) order by h.created_at desc), '[]'::jsonb)
    into v_history
  from (
    select id, actor_name, action, reason, created_at
    from public.admin_audit_log
    where target_type = 'batch' and target_id = p_batch_id::text
    order by created_at desc limit 10
  ) h;

  return v_batch || jsonb_build_object('products', v_products, 'moderationHistory', v_history);
end;
$$;

revoke all on function public.admin_get_batch(uuid) from public, anon;
grant execute on function public.admin_get_batch(uuid) to authenticated;
