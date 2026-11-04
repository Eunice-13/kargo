-- Payment review integrity.
--
-- Rules enforced here:
--   1. A newly submitted payment stays in `pending_review`; the order stays
--      `payment_submitted` until the seller explicitly reviews it.
--   2. Only an explicitly reviewed (`reviewed_by` set) verified payment may put
--      an order into `payment_confirmed`, including direct/manual updates.
--   3. An insufficient payment is REJECTED, never verified. Its shortfall is
--      stored on the payment row and the order becomes `insufficient_payment`
--      (displayed as Pending + Insufficient everywhere).
--
-- This migration is definition/schema only. Historical data correction lives in
-- scripts/payment-state-correction*.sql so it can be dry-run and rolled back.

begin;

alter table public.payments
  add column if not exists shortfall_amount numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_shortfall_amount_valid'
  ) then
    alter table public.payments
      add constraint payments_shortfall_amount_valid
      check (
        shortfall_amount is null
        or (shortfall_amount > 0 and shortfall_amount = round(shortfall_amount, 2))
      );
  end if;
end $$;

-- Guard: never let an order jump to payment_confirmed without an explicitly
-- reviewed verified payment. Works for individual, group and combined orders.
create or replace function public.guard_order_payment_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'payment_confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'payment_confirmed')
  then
    if not exists (
      select 1
      from public.payments p
      where p.status = 'verified'
        and p.reviewed_by is not null
        and (
          p.order_id = new.id
          or (
            p.combined_delivery_group_id is not null
            and exists (
              select 1
              from public.combined_delivery_payment_reservations r
              where r.payment_id = p.id and r.order_id = new.id
            )
          )
          or (
            new.group_order_id is not null
            and exists (
              select 1
              from public.group_orders g
              where g.id = new.group_order_id
                and g.payment_order_id = p.order_id
            )
          )
        )
    ) then
      raise exception 'Order cannot be confirmed without an explicitly reviewed payment'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists orders_require_reviewed_payment on public.orders;
create trigger orders_require_reviewed_payment
  before insert or update of status on public.orders
  for each row execute function public.guard_order_payment_confirmation();

-- Individual order review. Adds a shortfall decision and requires the order to
-- still be awaiting verification.
drop function if exists public.phase3_review_order_payment(
  uuid, public.payment_status, text, numeric
);

create function public.phase3_review_order_payment(
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

  -- Idempotent retry of the same explicit decision.
  if payment.status = p_decision and payment.reviewed_by is not null then
    return target;
  end if;

  if payment.status <> 'pending_review' then
    raise exception 'Payment review is stale or conflicts with an existing decision'
      using errcode = '22023';
  end if;

  -- A seller may only review proof that is actually awaiting verification. This
  -- blocks a stale UI or a direct call from confirming an order in any other
  -- state (including a second runtime path into Paid and Reserved).
  if target.status <> 'payment_submitted' then
    raise exception 'Order is not awaiting verification' using errcode = '22023';
  end if;

  amount_due := target.total_amount + coalesce(target.shipping_fee, 0);

  select coalesce(sum(amount), 0) into total_paid
  from public.payments
  where order_id = target.id and status = 'verified';

  is_insufficient :=
    p_decision = 'rejected' and coalesce(p_shortfall_amount, 0) > 0;

  if is_insufficient then
    -- The amount paid is the payment record itself. The shortfall is therefore
    -- expected total minus every payment already verified minus this one.
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
          when total_paid >= amount_due then 'payment_confirmed'::public.order_status
          else 'insufficient_payment'::public.order_status
        end,
        payment_confirmed_at = case
          when total_paid >= amount_due then coalesce(payment_confirmed_at, now())
          else null
        end
    where id = target.id
    returning * into target;
  elsif is_insufficient then
    -- Pending with an outstanding balance: the buyer can top up, and the
    -- shortfall stays on the rejected payment record.
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

drop function if exists public.review_order_payment(
  uuid, public.payment_status, text, numeric
);

create function public.review_order_payment(
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
begin
  if exists (
    select 1 from public.payments p join public.orders o on o.id = p.order_id
    where p.id = p_payment_id and o.group_order_id is not null
  ) then
    raise exception 'Use Group Order payment verification';
  end if;

  if exists (
    select 1 from public.payments
    where id = p_payment_id and combined_delivery_group_id is not null
  ) then
    raise exception 'Use combined payment verification for this payment'
      using errcode = '42501';
  end if;

  return public.phase3_review_order_payment(
    p_payment_id, p_decision, p_reason, p_deadline_hours, p_shortfall_amount
  );
end $$;

-- Group order review. Same shortfall contract as an individual order.
drop function if exists public.review_group_order_payment(
  uuid, public.payment_status, text, numeric
);

create function public.review_group_order_payment(
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

  select coalesce(sum(amount), 0) into total_paid
  from public.payments
  where order_id = target.payment_order_id and status = 'verified';

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
    set status = case when total_paid >= amount_due then 'payment_confirmed' else 'payment_pending' end,
        updated_at = now()
    where id = target.id;

    update public.orders
    set status = case
          when total_paid >= amount_due then 'payment_confirmed'::public.order_status
          else 'insufficient_payment'::public.order_status
        end,
        payment_confirmed_at = case when total_paid >= amount_due then now() else null end
    where group_order_id = target.id;

    if total_paid >= amount_due then
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

-- Buyer-facing effective state must keep an insufficient rejection distinct
-- from an ordinary rejection.
create or replace function public.buyer_order_payment_states()
returns table(
  order_id uuid,
  effective_status text,
  latest_payment_status text,
  rejection_deadline timestamp with time zone
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id as order_id,
    case
      when o.status in (
        'payment_confirmed'::public.order_status,
        'preparing'::public.order_status,
        'completed'::public.order_status,
        'expired'::public.order_status,
        'cancelled'::public.order_status,
        'incomplete'::public.order_status
      ) then o.status::text
      when latest.status = 'rejected'::public.payment_status
        and coalesce(latest.shortfall_amount, 0) > 0 then 'insufficient_payment'
      when latest.status = 'rejected'::public.payment_status then 'payment_pending'
      when latest.status = 'pending_review'::public.payment_status then 'payment_submitted'
      else o.status::text
    end as effective_status,
    latest.status::text as latest_payment_status,
    latest.rejection_deadline
  from public.orders o
  left join lateral (
    select p.status, p.rejection_deadline, p.shortfall_amount
    from public.payments p
    where p.order_id = o.id
    order by p.submitted_at desc, p.id desc
    limit 1
  ) latest on true
  where o.buyer_id = auth.uid();
$$;

revoke all on function public.review_order_payment(
  uuid, public.payment_status, text, numeric, numeric
) from public;
grant execute on function public.review_order_payment(
  uuid, public.payment_status, text, numeric, numeric
) to authenticated;

revoke all on function public.phase3_review_order_payment(
  uuid, public.payment_status, text, numeric, numeric
) from public;

revoke all on function public.review_group_order_payment(
  uuid, public.payment_status, text, numeric, numeric
) from public;
grant execute on function public.review_group_order_payment(
  uuid, public.payment_status, text, numeric, numeric
) to authenticated;

commit;
