-- Buyer transactional emails: payment lifecycle, deadline reminders, and
-- explicit fulfillment stages controlled by the seller's fulfillment board.

-- Keep the financial order_status enum stable. Shipped/in-transit are
-- fulfillment details within the existing `preparing` financial state.
alter table public.orders
  add column if not exists fulfillment_stage text;

alter table public.orders
  drop constraint if exists orders_fulfillment_stage_check;
alter table public.orders
  add constraint orders_fulfillment_stage_check
  check (fulfillment_stage in ('preparing', 'shipped', 'in_transit', 'delivered'));

update public.orders
set fulfillment_stage = case
  when status = 'preparing' then 'preparing'
  when status = 'completed' then 'delivered'
  else fulfillment_stage
end
where fulfillment_stage is null
  and status in ('preparing', 'completed');

-- The board sends text stages. Internally, preparing/shipped/in_transit remain
-- the `preparing` order status; delivered maps to `completed`.
drop function if exists public.set_fulfillment_status(uuid, public.order_status);

create function public.set_fulfillment_status(
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  display_status text;
begin
  if p_status not in (
    'payment_confirmed',
    'preparing',
    'shipped',
    'in_transit',
    'completed',
    'cancelled',
    'incomplete'
  ) then
    raise exception 'Invalid fulfillment status';
  end if;

  update public.orders
  set status = case
        when p_status in ('preparing', 'shipped', 'in_transit')
          then 'preparing'::public.order_status
        when p_status = 'completed'
          then 'completed'::public.order_status
        else p_status::public.order_status
      end,
      fulfillment_stage = case
        when p_status in ('preparing', 'shipped', 'in_transit') then p_status
        when p_status = 'completed' then 'delivered'
        else null
      end,
      completed_at = case
        when p_status = 'completed' then now()
        else completed_at
      end
  where id = p_order_id
    and seller_id = auth.uid()
    and public.can_sell(auth.uid())
  returning * into target;

  if not found then raise exception 'Order not found'; end if;

  display_status := case p_status
    when 'in_transit' then 'in transit'
    when 'completed' then 'delivered'
    else replace(p_status, '_', ' ')
  end;

  insert into public.notifications (
    recipient_id, category, message, target_path, context, dedupe_key
  ) values (
    target.buyer_id,
    'package',
    'Order ' || target.order_number || ' is now ' || display_status,
    'Orders',
    jsonb_build_object('order_id', target.id, 'fulfillment_stage', target.fulfillment_stage),
    'fulfillment_' || p_status || '_' || target.id::text
  )
  on conflict (recipient_id, dedupe_key)
    where dedupe_key is not null do nothing;
end;
$$;

revoke all on function public.set_fulfillment_status(uuid, text) from public;
grant execute on function public.set_fulfillment_status(uuid, text) to authenticated;

create or replace function public.queue_fulfillment_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_name text;
  email_subject text;
  email_body text;
begin
  if new.fulfillment_stage is not distinct from old.fulfillment_stage
    or new.fulfillment_stage not in ('shipped', 'in_transit', 'delivered') then
    return new;
  end if;

  if not public.wants_email(new.buyer_id, 'claims') then
    return new;
  end if;

  select bp.name into product_name
  from public.batch_products bp
  where bp.id = new.batch_product_id;

  email_subject := case new.fulfillment_stage
    when 'shipped' then 'Your KARGO order has shipped'
    when 'in_transit' then 'Your KARGO order is in transit'
    else 'Your KARGO order was delivered'
  end;

  email_body := case new.fulfillment_stage
    when 'shipped' then
      'Your order ' || new.order_number || ' for ' || product_name ||
      ' has been marked as shipped by the seller.'
    when 'in_transit' then
      'Your order ' || new.order_number || ' for ' || product_name ||
      ' is now in transit.'
    else
      'Your order ' || new.order_number || ' for ' || product_name ||
      ' has been marked as delivered. Open KARGO to review your completed order.'
  end;

  insert into public.pending_emails (
    recipient_id, template, subject, body, context, dedupe_key
  ) values (
    new.buyer_id,
    'order_' || new.fulfillment_stage,
    email_subject,
    email_body,
    jsonb_build_object('order_id', new.id, 'fulfillment_stage', new.fulfillment_stage),
    'fulfillment_' || new.fulfillment_stage || '_' || new.id::text
  )
  on conflict (recipient_id, dedupe_key)
    where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists queue_fulfillment_email_trigger on public.orders;
create trigger queue_fulfillment_email_trigger
after update of fulfillment_stage on public.orders
for each row execute function public.queue_fulfillment_email();

revoke all on function public.queue_fulfillment_email() from public;

create or replace function public.queue_payment_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  product_name text;
  total_verified numeric;
  remaining numeric;
  email_template text;
  email_subject text;
  email_body text;
  email_dedupe_key text;
begin
  select o.* into target
  from public.orders o
  where o.id = new.order_id;

  if not found or not public.wants_email(target.buyer_id, 'payments') then
    return new;
  end if;

  select bp.name into product_name
  from public.batch_products bp
  where bp.id = target.batch_product_id;

  if tg_op = 'INSERT' then
    email_template := 'payment_submitted';
    email_subject := 'KARGO received your payment submission';
    email_body := 'Your payment submission for order ' || target.order_number ||
      ' (' || product_name || ') was received and is waiting for seller verification.';
    email_dedupe_key := 'payment_submitted_' || new.id::text;
  elsif old.status is distinct from new.status and new.status = 'verified' then
    select coalesce(sum(p.amount), 0) into total_verified
    from public.payments p
    where p.order_id = target.id and p.status = 'verified';

    remaining := greatest(target.total_amount - total_verified, 0);
    if remaining = 0 then
      email_template := 'payment_verified';
      email_subject := 'Your KARGO payment was verified';
      email_body := 'Your payment for order ' || target.order_number ||
        ' (' || product_name || ') was verified. Your order is now confirmed.';
    else
      email_template := 'payment_insufficient';
      email_subject := 'Your KARGO payment was verified, but a balance remains';
      email_body := 'Your payment for order ' || target.order_number ||
        ' (' || product_name || ') was verified. A remaining balance of PHP ' ||
        trim(to_char(remaining, 'FM9999999990.00')) || ' still needs to be paid.';
    end if;
    email_dedupe_key := 'payment_verified_' || new.id::text;
  elsif old.status is distinct from new.status and new.status = 'rejected' then
    email_template := 'payment_rejected';
    email_subject := 'Your KARGO payment was rejected';
    email_body := 'Your payment for order ' || target.order_number ||
      ' (' || product_name || ') was rejected.' ||
      case when nullif(trim(new.rejection_reason), '') is not null
        then ' Reason: ' || trim(new.rejection_reason) || '.' else '' end ||
      ' Submit a new payment proof before the updated deadline shown in KARGO.';
    email_dedupe_key := 'payment_rejected_' || new.id::text;
  else
    return new;
  end if;

  insert into public.pending_emails (
    recipient_id, template, subject, body, context, dedupe_key
  ) values (
    target.buyer_id,
    email_template,
    email_subject,
    email_body,
    jsonb_build_object('order_id', target.id, 'payment_id', new.id),
    email_dedupe_key
  )
  on conflict (recipient_id, dedupe_key)
    where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists queue_payment_submitted_email_trigger on public.payments;
create trigger queue_payment_submitted_email_trigger
after insert on public.payments
for each row execute function public.queue_payment_email();

drop trigger if exists queue_payment_reviewed_email_trigger on public.payments;
create trigger queue_payment_reviewed_email_trigger
after update of status on public.payments
for each row execute function public.queue_payment_email();

revoke all on function public.queue_payment_email() from public;

create or replace function public.queue_payment_deadline_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued_count integer;
begin
  insert into public.pending_emails (
    recipient_id, template, subject, body, context, dedupe_key
  )
  select
    o.buyer_id,
    'payment_deadline_reminder',
    'One hour left to pay for your KARGO claim',
    'Your payment deadline for order ' || o.order_number || ' (' || bp.name ||
      ') is less than one hour away. Submit payment in KARGO to keep your reservation.',
    jsonb_build_object('order_id', o.id, 'deadline', o.reservation_expires_at),
    'payment_reminder_' || o.id::text || '_' ||
      extract(epoch from o.reservation_expires_at)::bigint::text
  from public.orders o
  join public.batch_products bp on bp.id = o.batch_product_id
  where o.status in ('payment_pending', 'insufficient_payment')
    and o.reservation_expires_at > now()
    and o.reservation_expires_at <= now() + interval '1 hour'
    and public.wants_email(o.buyer_id, 'payments')
  on conflict (recipient_id, dedupe_key)
    where dedupe_key is not null do nothing;

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

revoke all on function public.queue_payment_deadline_reminders()
  from public, authenticated;
grant execute on function public.queue_payment_deadline_reminders()
  to service_role;

do $$
begin
  perform cron.unschedule('kargo_payment_deadline_reminders');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'kargo_payment_deadline_reminders',
  '* * * * *',
  $$select public.queue_payment_deadline_reminders();$$
);

notify pgrst, 'reload schema';
