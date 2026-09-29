-- Keep the waitlist, but remove the old partial-offer approval state entirely.
-- Sellers may optionally cap the number of buyers waiting for each product.

alter table public.batch_products
  add column if not exists waitlist_limit integer;

alter table public.batch_products
  drop constraint if exists batch_products_waitlist_limit_check;

alter table public.batch_products
  add constraint batch_products_waitlist_limit_check
  check (waitlist_limit is null or waitlist_limit > 0);

-- The catalog depends on waitlist_status, so recreate it after simplifying the
-- enum. `offered` belonged only to the removed buyer-confirmation mechanism.
drop view if exists public.batch_catalog;
drop function if exists public.join_waitlist(uuid, integer);
drop function if exists public.offer_to_next_waitlist(uuid);

update public.waitlist_entries
set status = 'waiting'
where status = 'offered';

alter table public.waitlist_entries alter column status drop default;
alter table public.waitlist_entries
  alter column status type text using status::text;

drop type if exists public.waitlist_status;
create type public.waitlist_status as enum ('waiting', 'converted', 'cancelled');

alter table public.waitlist_entries
  alter column status type public.waitlist_status
  using status::public.waitlist_status;
alter table public.waitlist_entries
  alter column status set default 'waiting'::public.waitlist_status;

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
join public.profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft';

grant select on public.batch_catalog to authenticated;

-- Any available quantity is claimed immediately for the next buyer. A partial
-- amount no longer pauses for approval; it appears directly in My Claims.
create function public.offer_to_next_waitlist(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.batch_products;
  batch public.batches;
  entry public.waitlist_entries;
  available integer;
  claim_quantity integer;
  new_order public.orders;
begin
  select * into product
  from public.batch_products
  where id = p_product_id;
  if not found then return; end if;

  select * into batch
  from public.batches
  where id = product.batch_id;

  if batch.status <> 'live' or product.is_locked then return; end if;

  loop
    available := public.available_stock(p_product_id);
    if available <= 0 then return; end if;

    select * into entry
    from public.waitlist_entries w
    where w.batch_product_id = p_product_id
      and w.status = 'waiting'
    order by w.joined_at asc
    limit 1
    for update skip locked;
    if not found then return; end if;

    claim_quantity := least(available, entry.desired_quantity);

    begin
      new_order := public.place_order_for_buyer(
        p_product_id,
        entry.buyer_id,
        claim_quantity
      );
    exception when others then
      update public.waitlist_entries
      set status = 'cancelled'
      where id = entry.id;
      continue;
    end;

    update public.waitlist_entries
    set status = 'converted'
    where id = entry.id;

    insert into public.notifications (
      recipient_id, category, message, target_path, context, dedupe_key
    ) values (
      entry.buyer_id,
      'check',
      product.name || ' x' || claim_quantity ||
        ' was automatically added to My Claims from your waitlist.',
      'My Claims',
      jsonb_build_object('order_id', new_order.id, 'product_id', p_product_id),
      'wl_auto_' || entry.id::text
    )
    on conflict (recipient_id, dedupe_key)
      where dedupe_key is not null do nothing;

    if public.wants_email(entry.buyer_id, 'waitlist') then
      insert into public.pending_emails (
        recipient_id, template, subject, body, context, dedupe_key
      ) values (
        entry.buyer_id,
        'waitlist_auto_claimed',
        'A KARGO waitlist item was added to My Claims',
        claim_quantity || ' unit(s) of ' || product.name ||
          ' were automatically added to My Claims. Please submit payment before your reservation timer ends.',
        jsonb_build_object('order_id', new_order.id, 'product_id', p_product_id),
        'wl_auto_' || entry.id::text
      )
      on conflict (recipient_id, dedupe_key)
        where dedupe_key is not null do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public.offer_to_next_waitlist(uuid) from public, authenticated;

create function public.join_waitlist(p_product_id uuid, p_quantity integer)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.batch_products;
  batch public.batches;
  result public.waitlist_entries;
  waiting_count integer;
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
    and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment',
                     'payment_confirmed', 'preparing', 'completed');

  if product.limit_per_user is not null
     and buyer_claimed + p_quantity > product.limit_per_user then
    raise exception 'Requested quantity exceeds the per-buyer limit';
  end if;

  select * into result
  from public.waitlist_entries w
  where w.batch_product_id = p_product_id and w.buyer_id = auth.uid()
  for update;

  if found and result.status = 'waiting' then
    update public.waitlist_entries
    set desired_quantity = p_quantity
    where id = result.id
    returning * into result;
    return result;
  end if;

  select count(*)::integer into waiting_count
  from public.waitlist_entries w
  where w.batch_product_id = p_product_id and w.status = 'waiting';

  if product.waitlist_limit is not null
     and waiting_count >= product.waitlist_limit then
    raise exception 'The waitlist is full';
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

create or replace function public.set_product_waitlist_limit(
  p_product_id uuid,
  p_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting_count integer;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) or not public.can_sell(auth.uid()) then
    raise exception 'Active seller account required';
  end if;
  if p_limit is not null and p_limit <= 0 then
    raise exception 'Waitlist limit must be positive';
  end if;

  if not exists (
    select 1
    from public.batch_products bp
    join public.batches b on b.id = bp.batch_id
    where bp.id = p_product_id and b.seller_id = auth.uid()
  ) then
    raise exception 'Product not found or not owned by seller';
  end if;

  select count(*)::integer into waiting_count
  from public.waitlist_entries w
  where w.batch_product_id = p_product_id and w.status = 'waiting';

  if p_limit is not null and p_limit < waiting_count then
    raise exception 'Waitlist limit cannot be lower than the current queue';
  end if;

  update public.batch_products
  set waitlist_limit = p_limit
  where id = p_product_id;
end;
$$;

revoke all on function public.set_product_waitlist_limit(uuid, integer) from public;
grant execute on function public.set_product_waitlist_limit(uuid, integer) to authenticated;

-- Repair old rows that remained waiting even though their product had stock.
do $$
declare
  item record;
begin
  for item in
    select distinct w.batch_product_id
    from public.waitlist_entries w
    where w.status = 'waiting'
  loop
    perform public.offer_to_next_waitlist(item.batch_product_id);
  end loop;
end;
$$;
