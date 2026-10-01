create or replace function public.notify_payment_resubmission(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
  target public.orders;
begin
  select p.* into payment
  from public.payments p
  where p.id = p_payment_id;

  if not found then
    raise exception 'Payment not found';
  end if;

  select o.* into target
  from public.orders o
  where o.id = payment.order_id
    and o.seller_id = auth.uid();

  if not found or not public.can_sell(auth.uid()) then
    raise exception 'Seller access required';
  end if;

  if payment.status <> 'rejected' or payment.rejection_deadline is null then
    raise exception 'Only rejected payments with a resubmission deadline can be notified';
  end if;

  if payment.rejection_deadline <= now() then
    raise exception 'The resubmission deadline has passed';
  end if;

  insert into public.notifications (
    recipient_id,
    category,
    message,
    target_path,
    context,
    dedupe_key
  )
  values (
    target.buyer_id,
    'clock',
    'Reminder: resubmit payment proof for ' || target.order_number || ' before the deadline.',
    'My Claims',
    jsonb_build_object(
      'order_id', target.id,
      'payment_id', payment.id,
      'rejection_deadline', payment.rejection_deadline,
      'action', 'resubmit_payment'
    ),
    'payment_resubmit_' || payment.id::text || '_' || extract(epoch from payment.rejection_deadline)::bigint::text
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke all on function public.notify_payment_resubmission(uuid) from public;
grant execute on function public.notify_payment_resubmission(uuid) to authenticated;
