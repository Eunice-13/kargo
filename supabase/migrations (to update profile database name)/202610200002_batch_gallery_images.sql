alter table public.batches
  add column if not exists gallery_paths text[] not null default '{}';

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
  (select coalesce(sum(x.quantity_total), 0) from public.batch_products x where x.batch_id = b.id) as batch_total_items,
  ((select coalesce(sum(o.quantity), 0) from public.orders o join public.batch_products x on x.id = o.batch_product_id
    where x.batch_id = b.id and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed'))
   + (select coalesce(sum(c.quantity), 0) from public.group_order_commitments c
      join public.group_orders g on g.id = c.group_order_id
      join public.batch_products x on x.id = c.batch_product_id
      where x.batch_id = b.id and g.status = 'forming')) as batch_claimed,
  ((select coalesce(sum(o.quantity), 0) from public.orders o where o.batch_product_id = bp.id
    and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed'))
   + (select coalesce(sum(c.quantity), 0) from public.group_order_commitments c
      join public.group_orders g on g.id = c.group_order_id
      where c.batch_product_id = bp.id and g.status = 'forming')) as quantity_claimed,
  (select count(*) from public.waitlist_entries w where w.batch_product_id = bp.id and w.status = 'waiting') as waitlist_count,
  bp.limit_per_user,
  bp.waitlist_limit,
  b.gallery_paths as batch_gallery_paths
from public.batches b
join public.user_profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft';

grant select on public.batch_catalog to authenticated;
