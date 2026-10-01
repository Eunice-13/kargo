-- Waitlist stock no longer requires buyer confirmation. Any available quantity
-- is immediately added to the first waitlisted buyer's My Claims list.

create or replace function public.offer_to_next_waitlist(p_product_id uuid)
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
      -- If the buyer can no longer claim this product (for example because of
      -- a per-user limit), remove the stale entry and continue down the queue.
      update public.waitlist_entries
      set status = 'cancelled'
      where id = entry.id;
      continue;
    end;

    update public.waitlist_entries
    set status = 'converted'
    where id = entry.id;

    insert into public.notifications (
      recipient_id,
      category,
      message,
      target_path,
      context,
      dedupe_key
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
        recipient_id,
        template,
        subject,
        body,
        context,
        dedupe_key
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

create or replace function public.join_waitlist(p_product_id uuid, p_quantity integer)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.batch_products;
  result public.waitlist_entries;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Active account required';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  select * into product
  from public.batch_products
  where id = p_product_id;
  if not found then raise exception 'Product not found'; end if;

  insert into public.waitlist_entries (
    batch_product_id,
    buyer_id,
    status,
    desired_quantity,
    joined_at
  ) values (
    p_product_id,
    auth.uid(),
    'waiting',
    p_quantity,
    now()
  )
  on conflict (batch_product_id, buyer_id) do update
  set desired_quantity = excluded.desired_quantity,
      status = case
        when public.waitlist_entries.status in ('converted', 'cancelled')
          then 'waiting'::public.waitlist_status
        else public.waitlist_entries.status
      end,
      joined_at = case
        when public.waitlist_entries.status in ('converted', 'cancelled')
          then excluded.joined_at
        else public.waitlist_entries.joined_at
      end
  returning * into result;

  return result;
end;
$$;

revoke all on function public.join_waitlist(uuid, integer) from public;
grant execute on function public.join_waitlist(uuid, integer) to authenticated;

-- Keep claim expiry handling, but remove the obsolete partial-offer timeout.
create or replace function public.sweep_expirations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select o.id, o.batch_product_id, o.buyer_id, o.quantity,
           o.order_number, bp.name as product_name
    from public.orders o
    join public.batch_products bp on bp.id = o.batch_product_id
    where o.status in ('payment_pending', 'insufficient_payment')
      and o.reservation_expires_at <= now()
    for update of o skip locked
  loop
    update public.orders
    set status = 'expired'
    where id = r.id;

    insert into public.notifications (
      recipient_id,
      category,
      message,
      target_path,
      context,
      dedupe_key
    ) values (
      r.buyer_id,
      'clock',
      'Your claim for ' || r.product_name || ' x' || r.quantity ||
        ' expired — payment is now blocked.',
      'My Claims',
      jsonb_build_object('order_id', r.id),
      'claim_exp_' || r.id::text
    )
    on conflict (recipient_id, dedupe_key)
      where dedupe_key is not null do nothing;

    perform public.offer_to_next_waitlist(r.batch_product_id);
  end loop;
end;
$$;

-- Automatically convert any offer that was awaiting a response when this
-- migration is applied.
create temporary table waitlist_products_to_reprocess on commit drop as
select distinct batch_product_id
from public.waitlist_entries
where status = 'offered';

update public.waitlist_entries
set status = 'waiting'
where status = 'offered';

do $$
declare
  item record;
begin
  for item in select batch_product_id from waitlist_products_to_reprocess loop
    perform public.offer_to_next_waitlist(item.batch_product_id);
  end loop;
end;
$$;

drop function if exists public.respond_waitlist_offer(uuid, boolean);

alter table public.waitlist_entries
  drop column if exists offer_quantity,
  drop column if exists offered_at,
  drop column if exists offer_expires_at;

alter table public.profiles
  drop column if exists waitlist_response_hours;

-- PostgreSQL enum labels cannot be removed in place. The legacy `offered`
-- label remains in the database type for migration compatibility, but no
-- function or application path can create that state anymore.
