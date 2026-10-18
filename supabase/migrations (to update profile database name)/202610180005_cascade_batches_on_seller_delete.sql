-- Allow seller profile deletion to clean up batches owned by that seller.
-- Batch-owned catalog data already cascades from batches where appropriate.
alter table public.batches
  drop constraint if exists batches_seller_id_fkey;

alter table public.batches
  add constraint batches_seller_id_fkey
  foreign key (seller_id)
  references public.user_profiles(id)
  on delete cascade;

comment on constraint batches_seller_id_fkey on public.batches is
  'Delete seller-owned batches when the seller profile is deleted.';
