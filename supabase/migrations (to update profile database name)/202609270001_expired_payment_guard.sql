-- Expiry is an atomic state transition: mark the claim expired, release its
-- inventory (expired orders are excluded from batch_catalog claimed totals),
-- advance the waitlist, and reject any payment result.

create or replace function public.expire_claim_if_due(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
begin
  select * into target
  from public.orders
  where id = p_order_id and buyer_id = auth.uid()
  for update;
  if not found then raise exception 'Order not found'; end if;

  if target.status in ('payment_pending', 'insufficient_payment')
     and target.reservation_expires_at <= now() then
    update public.orders set status = 'expired' where id = target.id;
    insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
    values (target.buyer_id, 'clock', 'Your claim expired before payment was completed.', 'My Claims',
            jsonb_build_object('order_id', target.id), 'claim_exp_' || target.id::text)
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
    perform public.offer_to_next_waitlist(target.batch_product_id);
    return true;
  end if;
  return target.status = 'expired';
end;
$$;

revoke all on function public.expire_claim_if_due(uuid) from public;
grant execute on function public.expire_claim_if_due(uuid) to authenticated;

drop function if exists public.submit_order_payment(uuid, text, numeric, text, text, text, text, text);

create function public.submit_order_payment(
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
  select * into target from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;

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
    target.id, auth.uid(), p_method_type, p_amount, nullif(trim(p_reference_number), ''),
    p_receipt_path, p_payer_account_name, p_payer_phone, p_buyer_contact_url
  ) returning * into result;
  update public.orders set status = 'payment_submitted' where id = target.id;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.seller_id, 'clipboard', 'New payment proof submitted for ' || target.order_number, 'Payments', jsonb_build_object('order_id', target.id));
  return jsonb_build_object('accepted', true, 'payment', to_jsonb(result));
end;
$$;

revoke all on function public.submit_order_payment(uuid, text, numeric, text, text, text, text, text) from public;
grant execute on function public.submit_order_payment(uuid, text, numeric, text, text, text, text, text) to authenticated;

create or replace function public.reject_expired_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
begin
  select * into target from public.orders where id = new.order_id;
  if not found then raise exception 'Order not found'; end if;
  if target.reservation_expires_at <= now() then raise exception 'Payment deadline has expired'; end if;
  if target.status not in ('payment_pending', 'insufficient_payment') then raise exception 'Order is not payable'; end if;
  return new;
end;
$$;

drop trigger if exists payments_reject_expired on public.payments;
create trigger payments_reject_expired
before insert on public.payments
for each row execute function public.reject_expired_payment_insert();

-- Include insufficient payments in the periodic fallback sweep. A proof already
-- awaiting seller review remains held because it was submitted before expiry.
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
    select o.id, o.batch_product_id, o.buyer_id, o.quantity, o.order_number, bp.name as product_name
    from public.orders o
    join public.batch_products bp on bp.id = o.batch_product_id
    where o.status in ('payment_pending', 'insufficient_payment')
      and o.reservation_expires_at <= now()
    for update of o skip locked
  loop
    update public.orders set status = 'expired' where id = r.id;
    insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
    values (r.buyer_id, 'clock', 'Your claim for ' || r.product_name || ' x' || r.quantity || ' expired — payment is now blocked.',
            'My Claims', jsonb_build_object('order_id', r.id), 'claim_exp_' || r.id::text)
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
    perform public.offer_to_next_waitlist(r.batch_product_id);
  end loop;

  for r in
    select id, batch_product_id, buyer_id from public.waitlist_entries
    where status = 'offered' and offer_expires_at <= now()
    for update skip locked
  loop
    update public.waitlist_entries set status = 'cancelled', offer_expires_at = null where id = r.id;
    insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
    values (r.buyer_id, 'clock', 'Your waitlist offer expired without a response and was passed to the next buyer.',
            'My Claims', jsonb_build_object('waitlist_id', r.id), 'wl_timeout_' || r.id::text)
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
    perform public.offer_to_next_waitlist(r.batch_product_id);
  end loop;
end;
$$;
