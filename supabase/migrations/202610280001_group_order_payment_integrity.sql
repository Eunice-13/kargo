-- Requires 202610270001 and the existing Group Orders/manual payment schema.
-- Definition-only migration: no backfill, cleanup invocation, or historical record rewrites.
begin;

-- Callers lock the parent group first. Every grouped mutation uses group -> orders -> payment.
create or replace function public.lock_payable_group_orders(p_group_id uuid, p_statuses text[])
returns void language plpgsql security definer set search_path='' as $$
declare g public.group_orders; child_count integer;
begin
  select * into g from public.group_orders where id=p_group_id;
  perform 1 from public.orders where group_order_id=p_group_id order by id for update;
  select count(*) into child_count from public.orders where group_order_id=p_group_id;
  if g.checked_out_at is null or child_count=0 or not exists(
    select 1 from public.orders where id=g.payment_order_id and group_order_id=g.id
  ) or exists(select 1 from public.orders where group_order_id=g.id and not(status::text=any(p_statuses)))
    or exists(select 1 from public.group_order_commitments c where c.group_order_id=g.id and not exists(
      select 1 from public.orders o where o.group_order_id=g.id and o.batch_product_id=c.batch_product_id)) then
    raise exception 'Group product orders are inconsistent; reconciliation is required';
  end if;
end $$;
revoke all on function public.lock_payable_group_orders(uuid,text[]) from public,anon,authenticated,service_role;

create or replace function public.expire_group_order_payment(p_group_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare g public.group_orders; product_id uuid;
begin
  select * into g from public.group_orders where id=p_group_id for update;
  if not found or g.status<>'payment_pending' or g.checked_out_at is null
    or g.payment_deadline is null or g.payment_deadline>clock_timestamp() then return false; end if;
  perform public.lock_payable_group_orders(g.id,array['payment_pending','insufficient_payment']);
  -- Respect existing pause reasons; waiting/shipping review has no payment deadline.
  if exists(select 1 from public.orders where group_order_id=g.id and deadline_paused_at is not null) then return false; end if;
  if exists(select 1 from public.payments where order_id in(select id from public.orders where group_order_id=g.id) and status='pending_review') then
    raise exception 'Group has pending payment proof; reconciliation is required';
  end if;
  update public.group_orders set status='expired',updated_at=clock_timestamp() where id=g.id;
  update public.orders set status='expired' where group_order_id=g.id;
  insert into public.notifications(recipient_id,category,message,target_path,context,dedupe_key)
  values(g.leader_id,'clock','Your group order expired — payment is now blocked.','My Claims',
    jsonb_build_object('group_order_id',g.id),'group_payment_exp_'||g.id::text)
  on conflict(recipient_id,dedupe_key) where dedupe_key is not null do nothing;
  for product_id in select distinct batch_product_id from public.orders where group_order_id=g.id order by batch_product_id loop
    perform public.offer_to_next_waitlist(product_id);
  end loop;
  return true;
end $$;
revoke all on function public.expire_group_order_payment(uuid) from public,anon,authenticated;
grant execute on function public.expire_group_order_payment(uuid) to service_role;

create or replace function public.expire_group_order_payments()
returns void language plpgsql security definer set search_path='' as $$
declare g record;
begin
  for g in select id from public.group_orders where status='payment_pending' and checked_out_at is not null
    and payment_deadline<=clock_timestamp() order by id for update skip locked loop
    perform public.expire_group_order_payment(g.id);
  end loop;
end $$;
revoke all on function public.expire_group_order_payments() from public,anon,authenticated;
grant execute on function public.expire_group_order_payments() to service_role;


CREATE OR REPLACE FUNCTION public.sweep_standalone_delivery_expirations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  for r in
    select o.id, o.batch_product_id, o.buyer_id, o.quantity, o.order_number, bp.name as product_name
    from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
    where o.group_order_id is null and o.status in ('payment_pending', 'insufficient_payment')
      and o.deadline_paused_at is null and o.reservation_expires_at <= now() and not exists(select 1 from public.combined_delivery_members m where m.order_id=o.id and m.released_at is null)
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
end; $function$
;

CREATE OR REPLACE FUNCTION public.sweep_expirations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin perform public.expire_forming_group_orders(); perform public.expire_combined_payments(); perform public.expire_group_order_payments(); perform public.sweep_standalone_delivery_expirations(); end $function$
;

CREATE OR REPLACE FUNCTION public.checkout_group_order(p_group_order_id uuid, p_payment_method text, p_pin_lat double precision, p_pin_lng double precision, p_pin_url text, p_pin_address text, p_accept_shipping boolean, p_acknowledged boolean)
 RETURNS group_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target public.group_orders;
  target_batch public.batches;
  member_count integer;
  leader_items integer;
  subtotal numeric(12,2);
  discount numeric(12,2) := 0;
  shipping_required boolean;
  line record;
  created_order public.orders;
  first_order_id uuid;
  factor numeric;
begin
  select * into target from public.group_orders where id = p_group_order_id for update;
  if not found or target.leader_id <> auth.uid() or target.status <> 'forming' then raise exception 'Leader access required'; end if;
  if public.group_formation_deadline(target.batch_id) <= clock_timestamp() then raise exception 'The batch deadline has passed'; end if;
  if not p_acknowledged then raise exception 'Leader payment and delivery acknowledgment is required'; end if;
  select * into target_batch from public.batches where id = target.batch_id for update;
  select count(*)::integer into member_count from public.group_order_members
    where group_order_id = target.id and status = 'active';
  if member_count < 2 then raise exception 'At least two separate accounts are required'; end if;
  select coalesce(sum(quantity), 0)::integer into leader_items from public.group_order_commitments
    where group_order_id = target.id and user_id = target.leader_id;
  if leader_items < 1 then raise exception 'The leader must commit at least one item'; end if;
  select coalesce(sum(quantity * unit_selling_price), 0) into subtotal
    from public.group_order_commitments where group_order_id = target.id;
  if subtotal <= 0 then raise exception 'The group has no committed items'; end if;

  if target_batch.group_discount_type is not null
    and (target_batch.group_discount_min_subtotal is null or subtotal >= target_batch.group_discount_min_subtotal) then
    discount := case target_batch.group_discount_type
      when 'percentage' then round(subtotal * least(target_batch.group_discount_value, 100) / 100, 2)
      else least(target_batch.group_discount_value, subtotal)
    end;
  end if;
  factor := (subtotal - discount) / subtotal;
  shipping_required := lower(trim(p_payment_method)) <> lower('Cash on Meetup');
  if nullif(trim(p_payment_method), '') is null then raise exception 'Payment method is required'; end if;
  if not exists (
    select 1 from public.seller_payment_methods m where m.seller_id = target_batch.seller_id
      and m.is_active and lower(m.method_type) = lower(trim(p_payment_method))
  ) then raise exception 'Payment method is not accepted by this seller'; end if;
  if shipping_required and (
    not coalesce(p_accept_shipping, false)
    or (p_pin_lat is null and p_pin_lng is null and nullif(trim(p_pin_url), '') is null)
  ) then raise exception 'A delivery location and shipping acceptance are required'; end if;

  for line in
    select c.batch_product_id, sum(c.quantity)::integer as quantity,
      min(c.unit_selling_price) as unit_price, min(bp.base_price) as base_price
    from public.group_order_commitments c
    join public.batch_products bp on bp.id = c.batch_product_id
    where c.group_order_id = target.id
    group by c.batch_product_id
  loop
    insert into public.orders (
      order_number, batch_product_id, buyer_id, seller_id, quantity,
      unit_base_price, unit_selling_price, reservation_expires_at,
      reserved_payment_method, shipping_applies, group_order_id
    ) values (
      'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
      line.batch_product_id, target.leader_id, target_batch.seller_id, line.quantity,
      line.base_price, round(line.unit_price * factor, 2),
      now() + make_interval(hours => target_batch.reservation_hours),
      trim(p_payment_method), shipping_required, target.id
    ) returning * into created_order;
    first_order_id := coalesce(first_order_id, created_order.id);
  end loop;

  update public.orders set
    buyer_accepted_shipping_fee = shipping_required and p_accept_shipping,
    buyer_accepted_shipping_fee_at = case when shipping_required then now() end,
    shipping_state = case when shipping_required then 'waiting_for_seller' end,
    delivery_pin_lat = case when shipping_required then p_pin_lat end,
    delivery_pin_lng = case when shipping_required then p_pin_lng end,
    delivery_pin_url = case when shipping_required then nullif(trim(p_pin_url), '') end,
    delivery_pin_address = case when shipping_required then nullif(trim(p_pin_address), '') end,
    delivery_pin_updated_at = case when shipping_required then now() end,
    deadline_paused_at = case when shipping_required then now() end
  where id = first_order_id;

  -- Recheck after product/batch lock waits; an expired checkout rolls back all orders.
  if public.group_formation_deadline(target.batch_id) <= clock_timestamp() then raise exception 'The batch deadline has passed'; end if;
  -- Pause every reserved product while shipping is reviewed, not only the representative.
  update public.orders set deadline_paused_at=case when shipping_required then now() end,
    shipping_state=case when shipping_required then 'waiting_for_seller' end
    where group_order_id=target.id;
  update public.group_orders set
    status = case when shipping_required then 'waiting_for_seller' else 'payment_pending' end,
    regular_subtotal = subtotal,
    discount_amount = discount,
    final_subtotal = subtotal - discount,
    reserved_payment_method = trim(p_payment_method),
    shipping_applies = shipping_required,
    shipping_state = case when shipping_required then 'waiting_for_seller' end,
    delivery_pin_lat = case when shipping_required then p_pin_lat end,
    delivery_pin_lng = case when shipping_required then p_pin_lng end,
    delivery_pin_url = case when shipping_required then nullif(trim(p_pin_url), '') end,
    delivery_pin_address = case when shipping_required then nullif(trim(p_pin_address), '') end,
    acknowledged_by_leader = true,
    payment_order_id = first_order_id,
    payment_deadline = case when shipping_required then null else now() + make_interval(hours => target_batch.reservation_hours) end,
    checked_out_at = now(), updated_at = now()
  where id = target.id returning * into target;

  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target_batch.seller_id, 'package', 'A group order is ready for review', 'My Claims', jsonb_build_object('group_order_id', target.id));
  insert into public.notifications (recipient_id, category, message, target_path, context)
  select user_id, 'check', 'Your group order reached checkout.', 'My Claims', jsonb_build_object('group_order_id', target.id)
  from public.group_order_members where group_order_id = target.id and status = 'active' and user_id <> target.leader_id;
  return target;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_group_order_shipping_fee(p_group_order_id uuid, p_fee numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.group_orders; target_batch public.batches;
begin
  if p_fee < 0 then raise exception 'Shipping fee cannot be negative'; end if;
  select * into target from public.group_orders where id = p_group_order_id for update;
  select * into target_batch from public.batches where id = target.batch_id;
  if not found or target_batch.seller_id <> auth.uid() or not public.can_sell(auth.uid()) then raise exception 'Seller access required'; end if;
  if target.status <> 'waiting_for_seller' then raise exception 'This group order is not waiting for a shipping fee'; end if;
  if p_fee is null then raise exception 'Shipping fee is required'; end if;
  perform public.lock_payable_group_orders(target.id,array['payment_pending']);
  update public.group_orders set status = 'payment_pending', shipping_state = 'fee_set', shipping_fee = p_fee,
    payment_deadline = now() + make_interval(hours => target_batch.reservation_hours), updated_at = now()
    where id = target.id;
  update public.orders set shipping_state = 'fee_set', shipping_fee = case when id=target.payment_order_id then p_fee else null end, deadline_paused_at = null,
    reservation_expires_at = now() + make_interval(hours => target_batch.reservation_hours)
    where group_order_id = target.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_group_order_payment(p_group_order_id uuid, p_method_type text, p_amount numeric, p_reference_number text, p_receipt_path text, p_payer_account_name text, p_payer_phone text, p_buyer_contact_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.group_orders; result public.payments;
begin
  select * into target from public.group_orders where id = p_group_order_id and leader_id = auth.uid() for update;
  if not found then raise exception 'Group order not found'; end if;
  if target.status not in ('payment_pending') then return jsonb_build_object('accepted', false, 'error', 'Group order is not payable'); end if;
  perform public.lock_payable_group_orders(target.id,array['payment_pending','insufficient_payment']);
  if exists(select 1 from public.orders where group_order_id=target.id and deadline_paused_at is not null) then raise exception 'The group payment deadline is paused'; end if;
  if target.payment_deadline is null or target.payment_deadline <= clock_timestamp() then
    perform public.expire_group_order_payment(target.id);
    return jsonb_build_object('accepted', false, 'error', 'Payment deadline has expired');
  end if;
  if lower(trim(p_method_type)) <> lower(target.reserved_payment_method) then
    return jsonb_build_object('accepted', false, 'error', 'Use the payment method selected at checkout');
  end if;
  insert into public.payments (
    order_id, submitted_by, method_type, amount, reference_number, receipt_path,
    payer_account_name, payer_phone, buyer_contact_url
  ) values (
    target.payment_order_id, auth.uid(), target.reserved_payment_method, p_amount,
    nullif(trim(p_reference_number), ''), p_receipt_path,
    nullif(trim(p_payer_account_name), ''), nullif(trim(p_payer_phone), ''), nullif(trim(p_buyer_contact_url), '')
  ) returning * into result;
  if target.payment_deadline <= clock_timestamp() then raise exception 'Payment deadline has expired'; end if;
  update public.group_orders set status = 'payment_submitted', updated_at = now() where id = target.id;
  update public.orders set status = 'payment_submitted' where group_order_id = target.id;
  return jsonb_build_object('accepted', true, 'payment', to_jsonb(result));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.review_group_order_payment(p_payment_id uuid, p_decision payment_status, p_reason text, p_deadline_hours numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare payment public.payments; target public.group_orders; target_batch public.batches; total_paid numeric; amount_due numeric; deadline_at timestamptz; review_time timestamptz; payment_order uuid;
begin
  if p_decision is null or p_decision not in ('verified','rejected') then raise exception 'Choose verified or rejected'; end if;
  -- Discover identity without locking a payment before its parent (avoids submit/review deadlocks).
  select order_id into payment_order from public.payments where id=p_payment_id;
  if not found then raise exception 'Payment not found'; end if;
  select g.* into target from public.group_orders g where g.payment_order_id=payment_order for update;
  if not found then raise exception 'Group order not found'; end if;
  select * into target_batch from public.batches where id=target.batch_id;
  if target_batch.seller_id<>auth.uid() or auth.uid() is null or not public.can_sell(auth.uid()) then raise exception 'Seller access required'; end if;
  if target.status in ('expired','cancelled') then raise exception 'Expired or cancelled group orders cannot be reviewed'; end if;
  if target.status not in ('payment_pending','payment_submitted','payment_confirmed') then raise exception 'Group order is not reviewable'; end if;
  perform 1 from public.orders where group_order_id=target.id order by id for update;
  select * into payment from public.payments where id=p_payment_id and order_id=target.payment_order_id for update;
  if not found then raise exception 'Payment no longer belongs to this group'; end if;
  if payment.status<>'pending_review' then
    if payment.status=p_decision and payment.reviewed_by=auth.uid() and
      (p_decision='verified' or (payment.rejection_reason is not distinct from nullif(trim(p_reason),'') and
       p_deadline_hours>0 and payment.rejection_deadline=payment.reviewed_at+p_deadline_hours*interval '1 hour')) then return; end if;
    raise exception 'Payment review is stale or conflicts with an existing decision';
  end if;
  if target.status<>'payment_submitted' then raise exception 'Group order is not awaiting verification'; end if;
  perform public.lock_payable_group_orders(target.id,array['payment_submitted']);
  if target.payment_deadline is null or payment.submitted_at>target.payment_deadline then raise exception 'Payment proof was not submitted before its deadline'; end if;
  if (select count(*) from public.payments where order_id=target.payment_order_id and status='pending_review')<>1 then raise exception 'Payment review is ambiguous'; end if;
  -- Submitted proof retains the existing seller-review protection after the payment deadline.
  review_time:=clock_timestamp();
  if p_decision = 'rejected' then
    if p_deadline_hours is null or p_deadline_hours <= 0 then raise exception 'A resubmission deadline is required'; end if;
    deadline_at := review_time + p_deadline_hours * interval '1 hour';
  end if;
  update public.payments set status = p_decision,
    rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_reason), '') end,
    rejection_deadline = case when p_decision = 'rejected' then deadline_at end,
    reviewed_at = review_time, reviewed_by = auth.uid() where id = payment.id;
  if p_decision = 'verified' then
    select coalesce(sum(amount), 0) into total_paid from public.payments
      where order_id = target.payment_order_id and status = 'verified';
    amount_due := target.final_subtotal + coalesce(target.shipping_fee, 0);
    update public.group_orders set status = case when total_paid >= amount_due then 'payment_confirmed' else 'payment_pending' end,
      updated_at = now() where id = target.id;
    update public.orders set status = case when total_paid >= amount_due then 'payment_confirmed'::public.order_status else 'insufficient_payment'::public.order_status end,
      payment_confirmed_at = case when total_paid >= amount_due then now() end where group_order_id = target.id;
    if total_paid >= amount_due then
      insert into public.notifications (recipient_id, category, message, target_path, context)
      select user_id, 'check', 'Payment was confirmed for your group order.', 'Orders', jsonb_build_object('group_order_id', target.id)
      from public.group_order_members where group_order_id = target.id and status = 'active';
    end if;
  else
    update public.group_orders set status = 'payment_pending', payment_deadline = deadline_at, updated_at = now() where id = target.id;
    update public.orders set status = 'payment_pending', reservation_expires_at = deadline_at, deadline_paused_at = null where group_order_id = target.id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  prod_id uuid; target public.orders;
begin
  select * into target from public.orders where id=p_order_id and buyer_id=auth.uid();
  if found and target.group_order_id is not null then
    raise exception 'This item belongs to a Group Order and cannot be cancelled individually';
  end if;
  update public.orders
  set status = 'cancelled'::public.order_status
  where id = p_order_id
    and buyer_id = auth.uid()
    and status = 'payment_pending'::public.order_status
    and public.is_active(auth.uid())
  returning batch_product_id into prod_id;

  if prod_id is null then
    raise exception 'Only a pending claim can be cancelled';
  end if;

  perform public.offer_to_next_waitlist(prod_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.review_order_payment(p_payment_id uuid, p_decision payment_status, p_reason text, p_deadline_hours numeric)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists(select 1 from public.payments p join public.orders o on o.id=p.order_id
    where p.id=p_payment_id and o.group_order_id is not null) then
    raise exception 'Use Group Order payment verification';
  end if;
 if exists(select 1 from public.payments where id=p_payment_id and combined_delivery_group_id is not null) then
  raise exception 'Use combined payment verification for this payment' using errcode='42501'; end if;
 return public.phase3_review_order_payment(p_payment_id,p_decision,p_reason,p_deadline_hours);
end $function$
;

CREATE OR REPLACE FUNCTION public.decide_order_extension(p_order_id uuid, p_approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target public.orders;
  parent_id uuid;
  parent public.group_orders;
  new_deadline timestamptz;
  decision text;
  decision_key text;
begin
  -- Preserve existing extension rules; synchronize all product deadlines under the parent lock.
  select group_order_id into parent_id from public.orders where id=p_order_id;
  if parent_id is not null then
    select * into parent from public.group_orders where id=parent_id for update;
    if parent.status not in ('waiting_for_seller','payment_pending') or parent.payment_order_id<>p_order_id then
      raise exception 'Use the payable Group Order representative for extensions';
    end if;
    perform public.lock_payable_group_orders(parent.id,array['payment_pending','insufficient_payment']);
  end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found or target.seller_id <> auth.uid() or not public.can_sell(auth.uid()) then
    raise exception 'Extension request not found';
  end if;
  if target.extension_status <> 'pending' then
    raise exception 'Extension request has already been decided';
  end if;
  if target.status not in ('payment_pending', 'insufficient_payment') then
    raise exception 'Order is no longer payable';
  end if;
  if not p_approve and target.reservation_expires_at <= now() and target.deadline_paused_at is null then
    raise exception 'The payment deadline has expired';
  end if;

  new_deadline := case
    when p_approve then greatest(target.reservation_expires_at, now()) + make_interval(hours => target.extension_requested_hours)
    else target.reservation_expires_at
  end;
  decision := case when p_approve then 'approved' else 'denied' end;

  update public.orders
  set extension_status = decision::public.extension_status,
      reservation_expires_at = new_deadline,
      extension_decided_at = now()
  where id = target.id
  returning * into target;

  if parent_id is not null then
    update public.orders set reservation_expires_at=target.reservation_expires_at where group_order_id=parent_id;
    update public.group_orders set payment_deadline=case when parent.status='waiting_for_seller' then null else target.reservation_expires_at end,
      updated_at=now() where id=parent_id;
  end if;

  decision_key := 'extension_' || decision || '_' || target.id::text || '_' ||
    extract(epoch from target.extension_decided_at)::bigint::text;

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    target.buyer_id,
    'clock',
    'Your extension request was ' || decision || ' for ' || target.order_number,
    'My Claims',
    jsonb_build_object('order_id', target.id, 'new_deadline', target.reservation_expires_at),
    decision_key
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  if public.wants_email(target.buyer_id, 'payments') then
    insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
    values (
      target.buyer_id,
      'extension_' || decision,
      'Payment extension ' || decision || ' for ' || target.order_number,
      'Your payment extension request for order ' || target.order_number || ' was ' || decision || '.',
      jsonb_build_object(
        'order_id', target.id,
        'requested_hours', target.extension_requested_hours,
        'reason', target.extension_reason,
        'current_deadline', case when p_approve then target.reservation_expires_at - make_interval(hours => target.extension_requested_hours) else target.reservation_expires_at end,
        'new_deadline', case when p_approve then target.reservation_expires_at else null end,
        'target_path', 'My Claims',
        'decision', decision
      ),
      decision_key
    )
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
end;
$function$
;

commit;
