-- Order tracking and buyer-shouldered shipping.

alter table public.orders
  add column if not exists reserved_payment_method text,
  add column if not exists shipping_applies boolean not null default false,
  add column if not exists buyer_accepted_shipping_fee boolean not null default false,
  add column if not exists buyer_accepted_shipping_fee_at timestamptz,
  add column if not exists shipping_state text,
  add column if not exists shipping_fee numeric(12,2),
  add column if not exists shipping_fee_set_at timestamptz,
  add column if not exists shipping_fee_set_by uuid references public.user_profiles(id),
  add column if not exists delivery_pin_lat double precision,
  add column if not exists delivery_pin_lng double precision,
  add column if not exists delivery_pin_url text,
  add column if not exists delivery_pin_updated_at timestamptz,
  add column if not exists deadline_paused_at timestamptz,
  add column if not exists courier_company text,
  add column if not exists rider_name text,
  add column if not exists rider_contact text,
  add column if not exists tracking_url text,
  add column if not exists tracking_set_at timestamptz,
  add column if not exists decline_reason text,
  add column if not exists declined_at timestamptz,
  add column if not exists declined_by uuid references public.user_profiles(id);

alter table public.orders
  drop constraint if exists orders_shipping_state_check,
  add constraint orders_shipping_state_check check (
    shipping_state is null or shipping_state in (
      'waiting_for_seller', 'fee_set', 'correction_requested', 'declined'
    )
  ),
  drop constraint if exists orders_shipping_fee_check,
  add constraint orders_shipping_fee_check check (shipping_fee is null or shipping_fee >= 0),
  drop constraint if exists orders_delivery_pin_lat_check,
  add constraint orders_delivery_pin_lat_check check (
    delivery_pin_lat is null or delivery_pin_lat between -90 and 90
  ),
  drop constraint if exists orders_delivery_pin_lng_check,
  add constraint orders_delivery_pin_lng_check check (
    delivery_pin_lng is null or delivery_pin_lng between -180 and 180
  );

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

create or replace function public.set_order_shipping_fee(p_order_id uuid, p_fee numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.orders;
  remaining interval;
begin
  if p_fee is null or p_fee < 0 then raise exception 'Shipping fee must be zero or greater'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found or target.seller_id <> auth.uid() or not public.can_sell(auth.uid()) then
    raise exception 'Seller access required';
  end if;
  if target.status <> 'payment_pending' or not target.shipping_applies
    or target.shipping_state not in ('waiting_for_seller', 'correction_requested')
    or target.deadline_paused_at is null then
    raise exception 'Shipping fee can no longer be changed';
  end if;
  remaining := greatest(target.reservation_expires_at - target.deadline_paused_at, interval '0 seconds');
  update public.orders set
    shipping_fee = p_fee, shipping_fee_set_at = now(), shipping_fee_set_by = auth.uid(),
    shipping_state = 'fee_set', deadline_paused_at = null,
    reservation_expires_at = now() + remaining
  where id = target.id;

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (target.buyer_id, 'check', 'Shipping fee added. You can now pay for ' || target.order_number,
    'My Claims', jsonb_build_object('order_id', target.id, 'shipping_fee', p_fee),
    'shipping_fee_' || target.id::text)
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  if public.wants_email(target.buyer_id, 'payments') then
    insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
    values (target.buyer_id, 'shipping_fee_added', 'Shipping fee added',
      'The seller added a shipping fee of PHP ' || trim(to_char(p_fee, 'FM9999999990.00')) ||
      '. Your new total is PHP ' || trim(to_char(target.total_amount + p_fee, 'FM9999999990.00')) ||
      ', and your payment deadline has resumed.',
      jsonb_build_object('order_id', target.id, 'shipping_fee', p_fee), 'shipping_fee_' || target.id::text)
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
end; $$;

create or replace function public.request_location_correction(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.orders;
begin
  select * into target from public.orders where id = p_order_id for update;
  if not found or target.seller_id <> auth.uid() or not public.can_sell(auth.uid()) then raise exception 'Seller access required'; end if;
  if target.status <> 'payment_pending' or not target.shipping_applies or target.deadline_paused_at is null then
    raise exception 'Location correction is not available';
  end if;
  update public.orders set shipping_state = 'correction_requested' where id = target.id;
  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (target.buyer_id, 'pin', 'Seller requested a location correction for ' || target.order_number,
    'My Claims', jsonb_build_object('order_id', target.id),
    'location_correction_' || target.id::text || '_' || extract(epoch from now())::bigint::text);
  if public.wants_email(target.buyer_id, 'claims') then
    insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
    values (target.buyer_id, 'location_correction', 'Seller requested a location correction',
      'Update the delivery pin for ' || target.order_number || '. Your payment deadline remains paused.',
      jsonb_build_object('order_id', target.id),
      'location_correction_' || target.id::text || '_' || extract(epoch from now())::bigint::text);
  end if;
end; $$;

create or replace function public.decline_delivery_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.orders;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'A decline reason is required'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found or target.seller_id <> auth.uid() or not public.can_sell(auth.uid()) then raise exception 'Seller access required'; end if;
  if target.status <> 'payment_pending' or not target.shipping_applies or target.deadline_paused_at is null then
    raise exception 'This delivery order cannot be declined';
  end if;
  update public.orders set status = 'cancelled', shipping_state = 'declined',
    decline_reason = trim(p_reason), declined_at = now(), declined_by = auth.uid(), deadline_paused_at = null
  where id = target.id;
  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (target.buyer_id, 'package', 'Order declined by seller: ' || trim(p_reason),
    'My Claims', jsonb_build_object('order_id', target.id, 'reason', trim(p_reason)),
    'delivery_declined_' || target.id::text)
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  if public.wants_email(target.buyer_id, 'claims') then
    insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
    values (target.buyer_id, 'delivery_order_declined', 'Order declined by seller',
      'The seller declined ' || target.order_number || '. Reason: ' || trim(p_reason),
      jsonb_build_object('order_id', target.id, 'reason', trim(p_reason)),
      'delivery_declined_' || target.id::text)
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  perform public.offer_to_next_waitlist(target.batch_product_id);
end; $$;

create or replace function public.update_order_delivery_pin(
  p_order_id uuid, p_lat double precision, p_lng double precision, p_url text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if nullif(trim(p_url), '') is null and (p_lat is null or p_lng is null) then
    raise exception 'A delivery pin or Google Maps link is required';
  end if;
  update public.orders set delivery_pin_lat = p_lat, delivery_pin_lng = p_lng,
    delivery_pin_url = nullif(trim(p_url), ''), delivery_pin_updated_at = now(),
    shipping_state = 'waiting_for_seller'
  where id = p_order_id and buyer_id = auth.uid() and status = 'payment_pending'
    and shipping_applies and deadline_paused_at is not null
    and shipping_state in ('waiting_for_seller', 'correction_requested')
    and public.is_active(auth.uid());
  if not found then raise exception 'Delivery location cannot be updated'; end if;
end; $$;

create or replace function public.set_order_tracking(
  p_order_id uuid, p_courier text, p_rider_name text, p_rider_contact text,
  p_tracking_number text, p_eta timestamptz, p_tracking_url text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if nullif(trim(p_courier), '') is null or nullif(trim(p_rider_name), '') is null
    or nullif(trim(p_rider_contact), '') is null or nullif(trim(p_tracking_number), '') is null
    or p_eta is null then raise exception 'Courier, rider, tracking number, and ETA are required'; end if;
  update public.orders set courier_company = trim(p_courier), rider_name = trim(p_rider_name),
    rider_contact = trim(p_rider_contact), tracking_number = trim(p_tracking_number),
    eta = p_eta, tracking_url = nullif(trim(p_tracking_url), ''), tracking_set_at = now()
  where id = p_order_id and seller_id = auth.uid() and public.can_sell(auth.uid())
    and status in ('payment_confirmed', 'preparing', 'completed');
  if not found then raise exception 'Order is not ready for tracking'; end if;
end; $$;

revoke all on function public.set_order_shipping_fee(uuid, numeric) from public;
revoke all on function public.request_location_correction(uuid) from public;
revoke all on function public.decline_delivery_order(uuid, text) from public;
revoke all on function public.update_order_delivery_pin(uuid, double precision, double precision, text) from public;
revoke all on function public.set_order_tracking(uuid, text, text, text, text, timestamptz, text) from public;
grant execute on function public.set_order_shipping_fee(uuid, numeric) to authenticated;
grant execute on function public.request_location_correction(uuid) to authenticated;
grant execute on function public.decline_delivery_order(uuid, text) to authenticated;
grant execute on function public.update_order_delivery_pin(uuid, double precision, double precision, text) to authenticated;
grant execute on function public.set_order_tracking(uuid, text, text, text, text, timestamptz, text) to authenticated;

-- Column grants keep direct buyer writes limited to the locator/acceptance fields;
-- all seller business mutations go through the ownership-checking RPCs above.
revoke update on public.orders from authenticated;
grant update (
  delivery_pin_lat, delivery_pin_lng, delivery_pin_url, delivery_pin_updated_at,
  buyer_accepted_shipping_fee, buyer_accepted_shipping_fee_at, shipping_state
) on public.orders to authenticated;
drop policy if exists orders_update_buyer on public.orders;
create policy orders_update_buyer_shipping on public.orders for update to authenticated
  using (
    buyer_id = auth.uid() and public.is_active(auth.uid()) and shipping_applies
    and status = 'payment_pending' and deadline_paused_at is not null
    and shipping_state in ('waiting_for_seller', 'correction_requested')
  )
  with check (
    buyer_id = auth.uid() and shipping_applies and status = 'payment_pending'
    and deadline_paused_at is not null
    and shipping_state in ('waiting_for_seller', 'correction_requested')
  );

create or replace function public.submit_order_payment(
  p_order_id uuid,
  p_method_type text,
  p_amount numeric,
  p_reference_number text default null,
  p_receipt_path text default null,
  p_payer_account_name text default null,
  p_payer_phone text default null,
  p_buyer_contact_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  result public.payments;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active account required'; end if;
  if nullif(trim(p_method_type), '') is null then raise exception 'Payment method is required'; end if;
  select * into target from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if target.deadline_paused_at is not null or target.shipping_state in ('waiting_for_seller', 'correction_requested') then
    return jsonb_build_object('accepted', false, 'error', 'Waiting for seller to set the shipping fee');
  end if;
  if target.reserved_payment_method is not null
    and lower(trim(p_method_type)) <> lower(target.reserved_payment_method) then
    return jsonb_build_object('accepted', false, 'error', 'Use the payment method selected at reservation');
  end if;
  if target.reservation_expires_at <= now() then
    if target.status in ('payment_pending', 'insufficient_payment') then
      update public.orders set status = 'expired' where id = target.id;
      insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
      values (target.buyer_id, 'clock', 'Your claim expired before payment was completed.', 'My Claims',
        jsonb_build_object('order_id', target.id), 'claim_exp_' || target.id::text)
      on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
      perform public.offer_to_next_waitlist(target.batch_product_id);
    end if;
    return jsonb_build_object('accepted', false, 'error', 'Payment deadline has expired');
  end if;
  if target.status not in ('payment_pending', 'insufficient_payment') then
    return jsonb_build_object('accepted', false, 'error', 'Order is not payable');
  end if;
  if p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  insert into public.payments (
    order_id, submitted_by, method_type, amount, reference_number, receipt_path,
    payer_account_name, payer_phone, buyer_contact_url
  ) values (
    target.id, auth.uid(), coalesce(target.reserved_payment_method, trim(p_method_type)), p_amount,
    nullif(trim(p_reference_number), ''), p_receipt_path,
    nullif(trim(p_payer_account_name), ''), nullif(trim(p_payer_phone), ''),
    nullif(trim(p_buyer_contact_url), '')
  ) returning * into result;
  update public.orders set status = 'payment_submitted' where id = target.id;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.seller_id, 'clipboard', 'New payment proof submitted for ' || target.order_number,
    'Payments', jsonb_build_object('order_id', target.id));
  return jsonb_build_object('accepted', true, 'payment', to_jsonb(result));
end;
$$;

drop function if exists public.review_order_payment(uuid, public.payment_status, text, numeric);
create function public.review_order_payment(
  p_payment_id uuid,
  p_decision public.payment_status,
  p_reason text,
  p_deadline_hours numeric
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
  target public.orders;
  total_paid numeric;
  amount_due numeric;
  deadline_at timestamptz;
begin
  if p_decision not in ('verified', 'rejected') then raise exception 'Invalid payment decision'; end if;
  if p_decision = 'rejected' then
    if p_deadline_hours is null or p_deadline_hours <= 0 then
      raise exception 'A positive resubmission deadline in hours is required';
    end if;
    deadline_at := now() + (p_deadline_hours * interval '1 hour');
  end if;
  select p.* into payment from public.payments p where p.id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  select * into target from public.orders where id = payment.order_id and seller_id = auth.uid() for update;
  if not found or not public.can_sell(auth.uid()) then raise exception 'Seller access required'; end if;
  update public.payments set status = p_decision,
    rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_reason), '') end,
    rejection_deadline = case when p_decision = 'rejected' then deadline_at end,
    reviewed_at = now(), reviewed_by = auth.uid()
  where id = payment.id;
  amount_due := target.total_amount + coalesce(target.shipping_fee, 0);
  if p_decision = 'verified' then
    select coalesce(sum(amount), 0) into total_paid
    from public.payments where order_id = target.id and status = 'verified';
    update public.orders set
      status = case when total_paid >= amount_due then 'payment_confirmed'::public.order_status else 'insufficient_payment'::public.order_status end,
      payment_confirmed_at = case when total_paid >= amount_due then coalesce(payment_confirmed_at, now()) end
    where id = target.id returning * into target;
  else
    update public.orders set status = 'payment_pending'::public.order_status,
      reservation_expires_at = deadline_at, payment_confirmed_at = null
    where id = target.id returning * into target;
  end if;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.buyer_id, case when p_decision = 'verified' then 'check' else 'clock' end,
    case when p_decision = 'verified' then 'Your payment was reviewed for '
      else 'Your payment was rejected for ' end || target.order_number,
    'Payments', jsonb_build_object('order_id', target.id, 'payment_id', payment.id));
  return target;
end;
$$;

revoke all on function public.submit_order_payment(uuid, text, numeric, text, text, text, text, text) from public;
grant execute on function public.submit_order_payment(uuid, text, numeric, text, text, text, text, text) to authenticated;
revoke all on function public.review_order_payment(uuid, public.payment_status, text, numeric) from public;
grant execute on function public.review_order_payment(uuid, public.payment_status, text, numeric) to authenticated;

create or replace function public.sweep_expirations()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select o.id, o.batch_product_id, o.buyer_id, o.quantity, o.order_number, bp.name as product_name
    from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
    where o.status in ('payment_pending', 'insufficient_payment')
      and o.deadline_paused_at is null and o.reservation_expires_at <= now()
    for update of o skip locked
  loop
    update public.orders set status = 'expired' where id = r.id;
    insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
    values (r.buyer_id, 'clock', 'Your claim for ' || r.product_name || ' x' || r.quantity ||
      ' expired — payment is now blocked.', 'My Claims', jsonb_build_object('order_id', r.id),
      'claim_exp_' || r.id::text)
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
    perform public.offer_to_next_waitlist(r.batch_product_id);
  end loop;
end; $$;

create or replace function public.queue_payment_deadline_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare queued_count integer;
begin
  insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
  select o.buyer_id, 'payment_deadline_reminder', 'One hour left to pay for your KARGO claim',
    'Your payment deadline for order ' || o.order_number || ' (' || bp.name ||
      ') is less than one hour away. Submit payment in KARGO to keep your reservation.',
    jsonb_build_object('order_id', o.id, 'deadline', o.reservation_expires_at),
    'payment_reminder_' || o.id::text || '_' || extract(epoch from o.reservation_expires_at)::bigint::text
  from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
  where o.status in ('payment_pending', 'insufficient_payment')
    and o.deadline_paused_at is null
    and o.reservation_expires_at > now()
    and o.reservation_expires_at <= now() + interval '1 hour'
    and public.wants_email(o.buyer_id, 'payments')
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics queued_count = row_count;
  return queued_count;
end; $$;

notify pgrst, 'reload schema';
