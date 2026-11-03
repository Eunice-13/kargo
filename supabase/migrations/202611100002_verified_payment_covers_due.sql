-- A claim is Paid and Reserved only after the seller verifies a payment that
-- covers the full amount due. Money already received must still count, even
-- when it arrived as an insufficient (rejected + shortfall) payment, so a
-- top-up of the remaining balance can settle the order.
--
-- Rules:
--   1. received_payment_total() = verified payments + rejected payments that
--      carry a shortfall (the amount actually received on a short payment).
--   2. A payment can never be set to `verified` unless
--      received_payment_total (including it) covers the order due. This makes
--      "insufficient and verified at the same time" impossible.
--   3. Review functions use the same received-total formula so a top-up that
--      completes the balance confirms the order.

begin;

create or replace function public.received_payment_total(p_order_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(p.amount), 0)
  from public.payments p
  where p.order_id = p_order_id
    and (
      p.status = 'verified'
      or (p.status = 'rejected' and coalesce(p.shortfall_amount, 0) > 0)
    );
$$;

-- Guard: never verify a payment that leaves the order short.
create or replace function public.guard_verified_payment_covers_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_group public.group_orders;
  v_due numeric;
  v_received numeric;
begin
  if new.status <> 'verified' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'verified' then return new; end if;

  -- Combined delivery uses a separate whole-group workflow.
  if new.combined_delivery_group_id is not null then return new; end if;

  select * into v_order from public.orders where id = new.order_id;
  if not found then return new; end if;

  if v_order.group_order_id is not null then
    select * into v_group from public.group_orders where id = v_order.group_order_id;
    if not found then return new; end if;
    v_due := coalesce(v_group.final_subtotal, 0) + coalesce(v_group.shipping_fee, 0);
  else
    v_due := coalesce(v_order.total_amount, 0) + coalesce(v_order.shipping_fee, 0);
  end if;

  select coalesce(sum(p.amount), 0) into v_received
  from public.payments p
  where p.order_id = new.order_id
    and p.id <> new.id
    and (
      p.status = 'verified'
      or (p.status = 'rejected' and coalesce(p.shortfall_amount, 0) > 0)
    );

  if v_received + new.amount < v_due - 0.005 then
    raise exception 'A short payment cannot be verified; record the shortfall instead'
      using errcode = '22023';
  end if;

  return new;
end $$;

drop trigger if exists payments_verified_covers_due on public.payments;
create trigger payments_verified_covers_due
  before insert or update of status, amount on public.payments
  for each row execute function public.guard_verified_payment_covers_due();

-- Individual order review with the received-total formula.
create or replace function public.phase3_review_order_payment(
  p_payment_id uuid,
  p_decision public.payment_status,
  p_reason text,
  p_deadline_hours numeric,
  p_shortfall_amount numeric default null
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
  is_insufficient boolean;
  computed_shortfall numeric;
begin
  if p_decision is null or p_decision not in ('verified', 'rejected') then
    raise exception 'Invalid payment decision' using errcode = '22023';
  end if;

  if p_decision = 'rejected' then
    if p_deadline_hours is null or p_deadline_hours <= 0 then
      raise exception 'A positive resubmission deadline in hours is required'
        using errcode = '22023';
    end if;
    deadline_at := now() + (p_deadline_hours * interval '1 hour');
  end if;

  select p.* into payment from public.payments p where p.id = p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;

  select * into target
  from public.orders
  where id = payment.order_id and seller_id = auth.uid()
  for update;
  if not found or not public.can_sell(auth.uid()) then
    raise exception 'Seller access required' using errcode = '42501';
  end if;

  if payment.status = p_decision and payment.reviewed_by is not null then
    return target;
  end if;

  if payment.status <> 'pending_review' then
    raise exception 'Payment review is stale or conflicts with an existing decision'
      using errcode = '22023';
  end if;

  if target.status <> 'payment_submitted' then
    raise exception 'Order is not awaiting verification' using errcode = '22023';
  end if;

  amount_due := target.total_amount + coalesce(target.shipping_fee, 0);
  total_paid := public.received_payment_total(target.id)
    - case when payment.status = 'verified' then payment.amount else 0 end;

  is_insufficient :=
    p_decision = 'rejected' and coalesce(p_shortfall_amount, 0) > 0;

  if is_insufficient then
    computed_shortfall := round(amount_due - total_paid - payment.amount, 2);
    if computed_shortfall <= 0 then
      raise exception 'No shortfall remains for this payment'
        using errcode = '22023';
    end if;
  end if;

  update public.payments
  set status = p_decision,
      shortfall_amount = case when is_insufficient then computed_shortfall end,
      rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_reason), '') end,
      rejection_deadline = case when p_decision = 'rejected' then deadline_at end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = payment.id;

  if p_decision = 'verified' then
    total_paid := total_paid + payment.amount;
    update public.orders
    set status = case
          when total_paid >= amount_due - 0.005 then 'payment_confirmed'::public.order_status
          else 'insufficient_payment'::public.order_status
        end,
        payment_confirmed_at = case
          when total_paid >= amount_due - 0.005 then coalesce(payment_confirmed_at, now())
          else null
        end
    where id = target.id
    returning * into target;
  elsif is_insufficient then
    update public.orders
    set status = 'insufficient_payment'::public.order_status,
        reservation_expires_at = coalesce(deadline_at, reservation_expires_at),
        payment_confirmed_at = null
    where id = target.id
    returning * into target;
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
      when is_insufficient then 'Your payment for ' || target.order_number ||
        ' is short by ₱' || to_char(computed_shortfall, 'FM999,999,990.00') ||
        '. Please send the remaining balance.'
      when p_decision = 'verified' then 'Your payment was reviewed for '
      else 'Your payment was rejected for '
    end || target.order_number,
    'Payments',
    jsonb_build_object('order_id', target.id, 'payment_id', payment.id)
  );

  return target;
end $$;

-- Group order review with the received-total formula.
create or replace function public.review_group_order_payment(
  p_payment_id uuid,
  p_decision public.payment_status,
  p_reason text,
  p_deadline_hours numeric,
  p_shortfall_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
  target public.group_orders;
  target_batch public.batches;
  total_paid numeric;
  amount_due numeric;
  deadline_at timestamptz;
  review_time timestamptz;
  payment_order uuid;
  is_insufficient boolean;
  computed_shortfall numeric;
begin
  if p_decision is null or p_decision not in ('verified','rejected') then
    raise exception 'Choose verified or rejected';
  end if;

  select order_id into payment_order from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found'; end if;

  select g.* into target from public.group_orders g
  where g.payment_order_id = payment_order for update;
  if not found then raise exception 'Group order not found'; end if;

  select * into target_batch from public.batches where id = target.batch_id;
  if target_batch.seller_id <> auth.uid() or auth.uid() is null or not public.can_sell(auth.uid()) then
    raise exception 'Seller access required';
  end if;

  if target.status in ('expired','cancelled') then
    raise exception 'Expired or cancelled group orders cannot be reviewed';
  end if;
  if target.status not in ('payment_pending','payment_submitted','payment_confirmed') then
    raise exception 'Group order is not reviewable';
  end if;

  perform 1 from public.orders where group_order_id = target.id order by id for update;

  select * into payment from public.payments
  where id = p_payment_id and order_id = target.payment_order_id for update;
  if not found then raise exception 'Payment no longer belongs to this group'; end if;

  if payment.status <> 'pending_review' then
    if payment.status = p_decision and payment.reviewed_by = auth.uid() and
      (
        p_decision = 'verified'
        or (
          payment.rejection_reason is not distinct from nullif(trim(p_reason),'')
          and p_deadline_hours > 0
          and payment.rejection_deadline = payment.reviewed_at + p_deadline_hours * interval '1 hour'
        )
      )
    then
      return;
    end if;
    raise exception 'Payment review is stale or conflicts with an existing decision';
  end if;

  if target.status <> 'payment_submitted' then
    raise exception 'Group order is not awaiting verification';
  end if;

  perform public.lock_payable_group_orders(target.id, array['payment_submitted']);

  if target.payment_deadline is null or payment.submitted_at > target.payment_deadline then
    raise exception 'Payment proof was not submitted before its deadline';
  end if;
  if (
    select count(*) from public.payments
    where order_id = target.payment_order_id and status = 'pending_review'
  ) <> 1 then
    raise exception 'Payment review is ambiguous';
  end if;

  review_time := clock_timestamp();

  if p_decision = 'rejected' then
    if p_deadline_hours is null or p_deadline_hours <= 0 then
      raise exception 'A resubmission deadline is required';
    end if;
    deadline_at := review_time + p_deadline_hours * interval '1 hour';
  end if;

  amount_due := target.final_subtotal + coalesce(target.shipping_fee, 0);
  total_paid := public.received_payment_total(target.payment_order_id);

  is_insufficient :=
    p_decision = 'rejected' and coalesce(p_shortfall_amount, 0) > 0;

  if is_insufficient then
    computed_shortfall := round(amount_due - total_paid - payment.amount, 2);
    if computed_shortfall <= 0 then
      raise exception 'No shortfall remains for this payment'
        using errcode = '22023';
    end if;
  end if;

  update public.payments
  set status = p_decision,
      shortfall_amount = case when is_insufficient then computed_shortfall end,
      rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_reason), '') end,
      rejection_deadline = case when p_decision = 'rejected' then deadline_at end,
      reviewed_at = review_time,
      reviewed_by = auth.uid()
  where id = payment.id;

  if p_decision = 'verified' then
    total_paid := total_paid + payment.amount;
    update public.group_orders
    set status = case when total_paid >= amount_due - 0.005 then 'payment_confirmed' else 'payment_pending' end,
        updated_at = now()
    where id = target.id;

    update public.orders
    set status = case
          when total_paid >= amount_due - 0.005 then 'payment_confirmed'::public.order_status
          else 'insufficient_payment'::public.order_status
        end,
        payment_confirmed_at = case when total_paid >= amount_due - 0.005 then now() else null end
    where group_order_id = target.id;

    if total_paid >= amount_due - 0.005 then
      insert into public.notifications (recipient_id, category, message, target_path, context)
      select user_id, 'check', 'Payment was confirmed for your group order.',
        'Orders', jsonb_build_object('group_order_id', target.id)
      from public.group_order_members
      where group_order_id = target.id and status = 'active';
    end if;
  elsif is_insufficient then
    update public.group_orders
    set status = 'payment_pending', payment_deadline = deadline_at, updated_at = now()
    where id = target.id;

    update public.orders
    set status = 'insufficient_payment'::public.order_status,
        reservation_expires_at = deadline_at,
        deadline_paused_at = null
    where group_order_id = target.id;
  else
    update public.group_orders
    set status = 'payment_pending', payment_deadline = deadline_at, updated_at = now()
    where id = target.id;

    update public.orders
    set status = 'payment_pending'::public.order_status,
        reservation_expires_at = deadline_at,
        deadline_paused_at = null
    where group_order_id = target.id;
  end if;
end $$;

revoke all on function public.received_payment_total(uuid) from public;

commit;
