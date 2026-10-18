-- Seller-managed batch and product photos. Paths are stored in relational
-- tables while the public bucket serves the image files.

alter table public.batches
  add column if not exists cover_path text;

alter table public.batch_products
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'batch-media',
  'batch-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  create policy batch_media_public_read
    on storage.objects for select
    using (bucket_id = 'batch-media');
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy batch_media_seller_insert
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'batch-media'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy batch_media_seller_update
    on storage.objects for update to authenticated
    using (bucket_id = 'batch-media' and owner_id = auth.uid()::text)
    with check (
      bucket_id = 'batch-media'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy batch_media_seller_delete
    on storage.objects for delete to authenticated
    using (bucket_id = 'batch-media' and owner_id = auth.uid()::text);
exception when duplicate_object then null;
end $$;

drop view if exists public.batch_catalog;

create view public.batch_catalog with (security_barrier = true) as
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
  b.seller_id,
  seller.display_name as seller_name,
  bp.id as product_id,
  bp.name as product_name,
  bp.image_path as product_image_path,
  bp.base_price,
  bp.markup,
  bp.selling_price,
  bp.quantity_total,
  bp.is_locked as product_locked,
  (select coalesce(sum(x.quantity_total), 0)
     from public.batch_products x where x.batch_id = b.id) as batch_total_items,
  (select coalesce(sum(o.quantity), 0)
     from public.orders o
     join public.batch_products x on x.id = o.batch_product_id
    where x.batch_id = b.id
      and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment',
                       'payment_confirmed', 'preparing', 'completed')) as batch_claimed,
  (select coalesce(sum(o.quantity), 0)
     from public.orders o
    where o.batch_product_id = bp.id
      and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment',
                       'payment_confirmed', 'preparing', 'completed')) as quantity_claimed,
  (select count(*)
     from public.waitlist_entries w
    where w.batch_product_id = bp.id and w.status = 'waiting') as waitlist_count,
  bp.limit_per_user,
  bp.waitlist_limit
from public.batches b
join public.user_profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft';

grant select on public.batch_catalog to authenticated;
