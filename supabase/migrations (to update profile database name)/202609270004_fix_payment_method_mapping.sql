-- Repair the malformed seeded receive method that exposed the seller's name as
-- a buyer-selectable payment method. Preserve an already-captured payer name;
-- only move the legacy value into payer_account_name when that field is empty.
update public.payments
set payer_account_name = coalesce(nullif(trim(payer_account_name), ''), method_type),
    method_type = 'GCash'
where method_type = 'Maria Santos';

update public.seller_payment_methods
set method_type = 'GCash', updated_at = now()
where method_type = 'Maria Santos'
  and account_name = 'Maria S. Santos';

alter table public.seller_payment_methods
  drop constraint if exists seller_payment_methods_method_type_check;
alter table public.seller_payment_methods
  add constraint seller_payment_methods_method_type_check
  check (method_type in ('GCash', 'Maya', 'Bank Transfer', 'Cash on Meetup', 'Cash on Delivery'));

alter table public.payments
  drop constraint if exists payments_method_type_check;
alter table public.payments
  add constraint payments_method_type_check
  check (method_type in ('GCash', 'Maya', 'Bank Transfer', 'Cash on Meetup', 'Cash on Delivery', 'Others', 'Receipt Upload'));

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
  if p_method_type not in ('GCash', 'Maya', 'Bank Transfer', 'Cash on Meetup', 'Cash on Delivery', 'Others', 'Receipt Upload') then
    raise exception 'Invalid payment method';
  end if;
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
    p_receipt_path, nullif(trim(p_payer_account_name), ''),
    nullif(trim(p_payer_phone), ''), nullif(trim(p_buyer_contact_url), '')
  ) returning * into result;
  update public.orders set status = 'payment_submitted' where id = target.id;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.seller_id, 'clipboard', 'New payment proof submitted for ' || target.order_number, 'Payments', jsonb_build_object('order_id', target.id));
  return jsonb_build_object('accepted', true, 'payment', to_jsonb(result));
end;
$$;

revoke all on function public.submit_order_payment(uuid, text, numeric, text, text, text, text, text) from public;
grant execute on function public.submit_order_payment(uuid, text, numeric, text, text, text, text, text) to authenticated;
