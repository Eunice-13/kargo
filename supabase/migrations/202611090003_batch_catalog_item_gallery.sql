-- The catalog gallery is exactly the batch's own media: the cover photo first,
-- then one photo per item that has one. Sellers can still upload as many extra
-- batch photos as they like (batches.gallery_paths keeps them); those extras are
-- intentionally not part of the catalog gallery.

create or replace view public.batch_catalog with (security_barrier = true) as
select
  b.id as batch_id,
  b.title as batch_title,
  b.status as batch_status,
  b.starts_on,
  b.ends_on,
  b.category,
  b.reservation_hours,
  b.notes,
  b.cover_path as batch_cover_path,
  b.group_orders_enabled,
  b.group_discount_type,
  b.group_discount_value,
  b.group_discount_min_subtotal,
  b.seller_id,
  seller.display_name as seller_name,
  bp.id as product_id,
  bp.name as product_name,
  bp.image_path as product_image_path,
  bp.selling_unit,
  bp.pieces_per_box,
  bp.base_price,
  bp.markup,
  bp.selling_price,
  bp.quantity_total,
  bp.is_locked as product_locked,
  (select coalesce(sum(x.quantity_total), 0::bigint)
     from public.batch_products x where x.batch_id = b.id) as batch_total_items,
  ((select coalesce(sum(o.quantity), 0::bigint)
      from public.orders o
      join public.batch_products x on x.id = o.batch_product_id
     where x.batch_id = b.id
       and o.status = any (array['payment_pending'::public.order_status,'payment_submitted'::public.order_status,'insufficient_payment'::public.order_status,'payment_confirmed'::public.order_status,'preparing'::public.order_status,'completed'::public.order_status]))
   + (select coalesce(sum(c.quantity), 0::bigint)
        from public.group_order_commitments c
        join public.group_orders g on g.id = c.group_order_id
        join public.batch_products x on x.id = c.batch_product_id
       where x.batch_id = b.id and g.status = 'forming'::text
         and public.group_formation_deadline(g.batch_id) > clock_timestamp())) as batch_claimed,
  ((select coalesce(sum(o.quantity), 0::bigint)
      from public.orders o
     where o.batch_product_id = bp.id
       and o.status = any (array['payment_pending'::public.order_status,'payment_submitted'::public.order_status,'insufficient_payment'::public.order_status,'payment_confirmed'::public.order_status,'preparing'::public.order_status,'completed'::public.order_status]))
   + (select coalesce(sum(c.quantity), 0::bigint)
        from public.group_order_commitments c
        join public.group_orders g on g.id = c.group_order_id
       where c.batch_product_id = bp.id and g.status = 'forming'::text
         and public.group_formation_deadline(g.batch_id) > clock_timestamp())) as quantity_claimed,
  (select count(*) from public.waitlist_entries w
     where w.batch_product_id = bp.id and w.status = 'waiting'::public.waitlist_status) as waitlist_count,
  bp.limit_per_user,
  bp.waitlist_limit,
  array_remove(
    array_prepend(
      b.cover_path,
      coalesce(
        (select array_agg(item.image_path order by item.created_at, item.id)
           from public.batch_products item
          where item.batch_id = b.id
            and item.image_path is not null),
        '{}'::text[]
      )
    ),
    null
  ) as batch_gallery_paths,
  b.moderation_status,
  b.moderation_reason
from public.batches b
join public.user_profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft'::public.batch_status
  and (b.moderation_status <> 'hidden'::public.batch_moderation or b.seller_id = auth.uid());

grant select on public.batch_catalog to authenticated;

notify pgrst, 'reload schema';
