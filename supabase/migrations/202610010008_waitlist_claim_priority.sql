-- Keep capacity locks derived from stock and queue counts. Explicit seller
-- locks remain unchanged. Existing cancellation/expiry RPCs call this allocator.
-- Lock the product BEFORE reading availability or taking a queue entry, so
-- simultaneous releases cannot skip the first buyer or cancel a valid entry
-- based on stock read before another allocation completes.
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
  where id = p_product_id
  for update;
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
    order by w.joined_at asc, w.id asc
    limit 1
    for update;
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


create or replace function public.claim_batch_product(p_batch_product_id uuid, p_quantity integer)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.batch_products;
  batch public.batches;
  claimed integer;
  buyer_claimed integer;
  result public.orders;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Authentication and an active account are required';
  end if;
  if public.can_sell(auth.uid()) then
    raise exception 'Seller accounts cannot claim batch items';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  select * into product from public.batch_products where id = p_batch_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  select * into batch from public.batches where id = product.batch_id;
  if batch.status <> 'live' or product.is_locked then raise exception 'Product is not available'; end if;
  if batch.seller_id = auth.uid() then raise exception 'Sellers cannot claim their own product'; end if;

  -- The product row lock serializes this check with queue allocation and joins.
  -- Released stock belongs to waiting buyers until the queue is empty.
  if exists (
    select 1 from public.waitlist_entries w
    where w.batch_product_id = product.id and w.status = 'waiting'
  ) then
    raise exception 'Available stock is reserved for waitlisted buyers';
  end if;

  select coalesce(sum(o.quantity), 0)::integer into claimed
  from public.orders o
  where o.batch_product_id = product.id
    and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');

  if claimed + p_quantity > product.quantity_total then raise exception 'Insufficient inventory'; end if;

  -- Optional per-buyer limit: sum this buyer's own active claims for the product.
  if product.limit_per_user is not null then
    select coalesce(sum(o.quantity), 0)::integer into buyer_claimed
    from public.orders o
    where o.batch_product_id = product.id
      and o.buyer_id = auth.uid()
      and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
    if buyer_claimed + p_quantity > product.limit_per_user then
      raise exception 'Per-buyer limit of % reached for this item', product.limit_per_user;
    end if;
  end if;

  insert into public.orders (
    order_number, batch_product_id, buyer_id, seller_id, quantity,
    unit_base_price, unit_selling_price, reservation_expires_at
  ) values (
    'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
    product.id, auth.uid(), batch.seller_id, p_quantity,
    product.base_price, product.selling_price,
    now() + make_interval(hours => batch.reservation_hours)
  ) returning * into result;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (batch.seller_id, 'bag', 'A buyer claimed ' || product.name || ' x' || p_quantity, 'My Claims', jsonb_build_object('order_id', result.id));
  return result;
end;
$$;

revoke all on function public.claim_batch_product(uuid, integer) from public;
grant execute on function public.claim_batch_product(uuid, integer) to authenticated;
