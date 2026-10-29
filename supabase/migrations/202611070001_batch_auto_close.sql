-- KARGO — Date-driven batch closure.
--
-- A batch stops taking orders at the end of its `ends_on` day (23:59:59
-- Asia/Manila), not only when the seller remembers to lock it. Three layers
-- enforce the same window:
--
--   1. close_expired_batches() flips live batches to `locked` on the existing
--      one-minute sweep, so the stored status matches reality.
--   2. claim_batch_product() and join_waitlist() refuse a batch past that
--      deadline, closing the sub-minute window before the sweep runs.
--   3. reopen_batch() lets the owning seller move `ends_on` forward and set the
--      batch back to `live`; a plain unlock would be re-locked within a minute.
--
-- No existing order, commitment, or inventory counter is touched.

begin;

-- Lock every live batch whose Philippine end date has passed. The sweep runs
-- this every minute, so a closed batch greys out everywhere within ~60s even
-- if no one has the app open.
create or replace function public.close_expired_batches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.batches b
  set status = 'locked', updated_at = now()
  where b.status = 'live'
    and public.group_formation_deadline(b.id) <= clock_timestamp();
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.close_expired_batches() from public;
grant execute on function public.close_expired_batches() to service_role;

-- Preserve the existing sweep (forming groups, combined payments, group order
-- payments, standalone delivery) and add batch closure to the same tick.
create or replace function public.sweep_expirations()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.close_expired_batches();
  perform public.expire_forming_group_orders();
  perform public.expire_combined_payments();
  perform public.expire_group_order_payments();
  perform public.sweep_standalone_delivery_expirations();
end
$function$;

-- Re-open a closed batch by choosing a new end date. Only the seller who owns
-- the batch (or an admin) may do this, and the date must not be in the past.
create or replace function public.reopen_batch(p_batch_id uuid, p_ends_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.batches;
  today_manila date := (now() at time zone 'Asia/Manila')::date;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Authentication and an active account are required';
  end if;

  select * into target from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;

  if target.seller_id <> auth.uid() and not public.is_admin(auth.uid()) then
    raise exception 'Only the seller can re-open this batch';
  end if;

  if p_ends_on is null then
    raise exception 'A new end date is required to re-open a batch';
  end if;
  if p_ends_on < today_manila then
    raise exception 'The new end date cannot be in the past';
  end if;
  if p_ends_on < target.starts_on then
    raise exception 'The end date cannot be before the start date';
  end if;

  update public.batches
  set status = 'live', ends_on = p_ends_on, updated_at = now()
  where id = p_batch_id;
end;
$$;
revoke all on function public.reopen_batch(uuid, date) from public;
grant execute on function public.reopen_batch(uuid, date) to authenticated;

-- ── Claims: refuse a batch past its end date ────────────────────────────────
-- Same body as 202610180001_tracking_and_buyer_shipping.sql, plus the date
-- guard next to the existing status check.
create or replace function public.claim_batch_product(
  p_batch_product_id uuid,
  p_quantity integer,
  p_payment_method text,
  p_pin_lat double precision,
  p_pin_lng double precision,
  p_pin_url text,
  p_accept_shipping boolean
)
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
  shipping_required boolean;
  result public.orders;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Authentication and an active account are required';
  end if;
  if public.can_sell(auth.uid()) then raise exception 'Seller accounts cannot claim batch items'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  if nullif(trim(p_payment_method), '') is null then raise exception 'Payment method is required'; end if;

  select * into product from public.batch_products where id = p_batch_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  select * into batch from public.batches where id = product.batch_id;
  if batch.status <> 'live' or product.is_locked then raise exception 'Product is not available'; end if;
  if public.group_formation_deadline(batch.id) <= clock_timestamp() then
    raise exception 'This batch has already closed';
  end if;
  if batch.seller_id = auth.uid() then raise exception 'Sellers cannot claim their own product'; end if;
  if not exists (
    select 1 from public.seller_payment_methods m
    where m.seller_id = batch.seller_id and m.is_active
      and lower(m.method_type) = lower(trim(p_payment_method))
  ) then
    raise exception 'Payment method is not accepted by this seller';
  end if;

  shipping_required := lower(trim(p_payment_method)) <> lower('Cash on Meetup');
  if shipping_required then
    if not coalesce(p_accept_shipping, false) then
      raise exception 'Shipping fee acceptance is required';
    end if;
    if nullif(trim(p_pin_url), '') is null and (p_pin_lat is null or p_pin_lng is null) then
      raise exception 'A delivery pin or Google Maps link is required';
    end if;
  end if;

  if exists (
    select 1 from public.waitlist_entries w
    where w.batch_product_id = product.id and w.status = 'waiting'
  ) then raise exception 'Available stock is reserved for waitlisted buyers'; end if;

  select coalesce(sum(o.quantity), 0)::integer into claimed
  from public.orders o
  where o.batch_product_id = product.id
    and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
  if claimed + p_quantity > product.quantity_total then raise exception 'Insufficient inventory'; end if;

  if product.limit_per_user is not null then
    select coalesce(sum(o.quantity), 0)::integer into buyer_claimed
    from public.orders o
    where o.batch_product_id = product.id and o.buyer_id = auth.uid()
      and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
    if buyer_claimed + p_quantity > product.limit_per_user then
      raise exception 'Per-buyer limit of % reached for this item', product.limit_per_user;
    end if;
  end if;

  insert into public.orders (
    order_number, batch_product_id, buyer_id, seller_id, quantity,
    unit_base_price, unit_selling_price, reservation_expires_at,
    reserved_payment_method, shipping_applies, buyer_accepted_shipping_fee,
    buyer_accepted_shipping_fee_at, shipping_state, delivery_pin_lat,
    delivery_pin_lng, delivery_pin_url, delivery_pin_updated_at, deadline_paused_at
  ) values (
    'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
    product.id, auth.uid(), batch.seller_id, p_quantity,
    product.base_price, product.selling_price,
    now() + make_interval(hours => batch.reservation_hours),
    trim(p_payment_method), shipping_required, shipping_required and p_accept_shipping,
    case when shipping_required then now() end,
    case when shipping_required then 'waiting_for_seller' end,
    case when shipping_required then p_pin_lat end,
    case when shipping_required then p_pin_lng end,
    case when shipping_required then nullif(trim(p_pin_url), '') end,
    case when shipping_required then now() end,
    case when shipping_required then now() end
  ) returning * into result;

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    batch.seller_id, 'package',
    case when shipping_required
      then 'A delivery order needs a shipping fee for ' || product.name
      else 'A buyer claimed ' || product.name || ' x' || p_quantity end,
    'My Claims', jsonb_build_object('order_id', result.id),
    case when shipping_required then 'shipping_needed_' || result.id::text end
  ) on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  if shipping_required and public.wants_email(batch.seller_id, 'claims') then
    insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
    values (
      batch.seller_id, 'shipping_fee_needed', 'A delivery order needs a shipping fee',
      'A buyer reserved ' || product.name || '. The payment deadline is paused until you review the location and set the shipping fee.',
      jsonb_build_object('order_id', result.id), 'shipping_needed_' || result.id::text
    ) on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return result;
end;
$$;
revoke all on function public.claim_batch_product(uuid, integer, text, double precision, double precision, text, boolean) from public;
grant execute on function public.claim_batch_product(uuid, integer, text, double precision, double precision, text, boolean) to authenticated;

-- ── Waitlist: same date guard ───────────────────────────────────────────────
-- Same body as 202610010004_waitlist_limits_and_cleanup.sql, plus the deadline
-- check beside the existing live/status check.
create or replace function public.join_waitlist(p_product_id uuid, p_quantity integer)
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
  if public.group_formation_deadline(batch.id) <= clock_timestamp() then
    raise exception 'This batch has already closed';
  end if;
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

commit;
