-- Downgrade only when nothing active relies on the snapshot-safe references.
begin;
lock table public.orders, public.combined_delivery_groups,
  public.combined_delivery_members, public.batches, public.batch_products,
  public.combined_delivery_batch_pins in access exclusive mode nowait;
do $$ begin
  if exists(select 1 from public.combined_delivery_members where released_at is null)
    or exists(select 1 from public.combined_delivery_batch_pins)
    or exists(select 1 from public.combined_delivery_groups where status in ('pending_approval','awaiting_shipping_fee','shipping_fee_set')) then
    raise exception 'Cannot remove snapshot-safe batch protection while delivery requests are active' using errcode='22023';
  end if;
end; $$;
drop trigger combined_delivery_members_batch_pin on public.combined_delivery_members;
drop function public.sync_combined_delivery_batch_pin();
drop table public.combined_delivery_batch_pins;
drop trigger orders_combined_delivery_revision on public.orders;
drop function public.stamp_combined_delivery_order_revision();
alter table public.orders drop constraint orders_delivery_revision_key;
alter table public.orders drop column combined_delivery_revision;
alter table public.batch_products drop constraint batch_products_delivery_identity_key;
alter table public.batches drop constraint batches_delivery_identity_key;
notify pgrst,'reload schema';
commit;
