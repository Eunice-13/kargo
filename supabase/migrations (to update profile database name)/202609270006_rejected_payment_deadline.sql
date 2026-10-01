alter table public.payments
  add column if not exists rejection_deadline timestamptz;

drop function if exists public.review_order_payment(uuid, public.payment_status, text);
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

  update public.payments
  set status = p_decision,
      rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_reason), '') else null end,
      rejection_deadline = case when p_decision = 'rejected' then deadline_at else null end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = payment.id;

  if p_decision = 'verified' then
    select coalesce(sum(amount), 0) into total_paid
    from public.payments where order_id = target.id and status = 'verified';
    update public.orders set
      status = case when total_paid >= target.total_amount then 'payment_confirmed'::public.order_status else 'insufficient_payment'::public.order_status end,
      payment_confirmed_at = case when total_paid >= target.total_amount then coalesce(payment_confirmed_at, now()) else null end
    where id = target.id returning * into target;
  else
    update public.orders
    set status = 'payment_pending'::public.order_status,
        reservation_expires_at = deadline_at,
        payment_confirmed_at = null
    where id = target.id
    returning * into target;
  end if;

  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (
    target.buyer_id,
    case when p_decision = 'verified' then 'check' else 'clock' end,
    case
      when p_decision = 'verified' then 'Your payment was reviewed for ' || target.order_number
      else 'Your payment was rejected for ' || target.order_number || '. Submit a new proof before the resubmission deadline.'
    end,
    'Payments',
    jsonb_build_object('order_id', target.id, 'payment_id', payment.id, 'rejection_deadline', deadline_at)
  );
  return target;
end;
$$;

revoke all on function public.review_order_payment(uuid, public.payment_status, text, numeric) from public;
grant execute on function public.review_order_payment(uuid, public.payment_status, text, numeric) to authenticated;
