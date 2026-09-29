-- Remove the optional queue cap. Waitlists remain unlimited.

create or replace function public.join_waitlist(
  p_product_id uuid,
  p_quantity integer
)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.batch_products;
  batch public.batches;
  result public.waitlist_entries;
  buyer_claimed integer;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Active account required';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  select * into product
  from public.batch_products
  where id = p_product_id
  for update;
  if not found then raise exception 'Product not found'; end if;

  select * into batch from public.batches where id = product.batch_id;
  if batch.status <> 'live' then raise exception 'Batch is not live'; end if;
  if product.is_locked then raise exception 'Product is locked'; end if;
  if public.available_stock(p_product_id) > 0 then
    raise exception 'This item is available; claim it instead';
  end if;

  select coalesce(sum(o.quantity), 0)::integer into buyer_claimed
  from public.orders o
  where o.batch_product_id = p_product_id
    and o.buyer_id = auth.uid()
    and o.status in (
      'payment_pending', 'payment_submitted', 'insufficient_payment',
      'payment_confirmed', 'preparing', 'completed'
    );

  if product.limit_per_user is not null
     and buyer_claimed + p_quantity > product.limit_per_user then
    raise exception 'Requested quantity exceeds the per-buyer limit';
  end if;

  select * into result
  from public.waitlist_entries w
  where w.batch_product_id = p_product_id
    and w.buyer_id = auth.uid()
  for update;

  if found and result.status = 'waiting' then
    update public.waitlist_entries
    set desired_quantity = p_quantity
    where id = result.id
    returning * into result;
    return result;
  end if;

  if result.id is not null then
    update public.waitlist_entries
    set desired_quantity = p_quantity,
        status = 'waiting',
        joined_at = now()
    where id = result.id
    returning * into result;
  else
    insert into public.waitlist_entries (
      batch_product_id, buyer_id, status, desired_quantity, joined_at
    ) values (
      p_product_id, auth.uid(), 'waiting', p_quantity, now()
    )
    returning * into result;
  end if;

  return result;
end;
$$;

revoke all on function public.join_waitlist(uuid, integer) from public;
grant execute on function public.join_waitlist(uuid, integer) to authenticated;

drop function if exists public.set_product_waitlist_limit(uuid, integer);

drop view if exists public.batch_catalog;

alter table public.batch_products
  drop constraint if exists batch_products_waitlist_limit_check,
  drop column if exists waitlist_limit;

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
  b.seller_id,
  seller.display_name as seller_name,
  bp.id as product_id,
  bp.name as product_name,
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
      and o.status in (
        'payment_pending', 'payment_submitted', 'insufficient_payment',
        'payment_confirmed', 'preparing', 'completed'
      )) as batch_claimed,
  (select coalesce(sum(o.quantity), 0)
     from public.orders o
    where o.batch_product_id = bp.id
      and o.status in (
        'payment_pending', 'payment_submitted', 'insufficient_payment',
        'payment_confirmed', 'preparing', 'completed'
      )) as quantity_claimed,
  (select count(*)
     from public.waitlist_entries w
    where w.batch_product_id = bp.id and w.status = 'waiting') as waitlist_count,
  bp.limit_per_user
from public.batches b
join public.profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft';

grant select on public.batch_catalog to authenticated;
