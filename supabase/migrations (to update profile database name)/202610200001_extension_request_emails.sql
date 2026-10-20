-- Extension request queueing and lifecycle guards.
-- A buyer may request again after a denial, but an approved order cannot be
-- extended again. This migration is safe to re-run before deployment.

drop function if exists public.request_order_extension(uuid, integer, text);

create or replace function public.request_order_extension(
  p_order_id uuid,
  p_hours integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  request_key text;
begin
  if p_hours is null or p_hours < 1 or p_hours > 168 then
    raise exception 'Requested hours must be between 1 and 168';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10
     or length(trim(coalesce(p_reason, ''))) > 500 then
    raise exception 'Reason must be between 10 and 500 characters';
  end if;

  select * into target from public.orders where id = p_order_id for update;
  if not found or target.buyer_id <> auth.uid() or not public.is_active(auth.uid()) then
    raise exception 'Order is not eligible for extension';
  end if;
  if target.status not in ('payment_pending', 'insufficient_payment') then
    raise exception 'Order is not payable';
  end if;
  if target.extension_status = 'pending' then
    raise exception 'An extension request is already pending';
  end if;
  if target.extension_status = 'approved' then
    raise exception 'This order already has an approved extension';
  end if;
  if target.deadline_paused_at is null and target.reservation_expires_at <= now() then
    raise exception 'The payment deadline has expired';
  end if;

  update public.orders
  set extension_status = 'pending',
      extension_requested_hours = p_hours,
      extension_reason = trim(p_reason),
      extension_requested_at = now(),
      extension_decided_at = null
  where id = target.id
  returning * into target;

  request_key := 'extension_requested_' || target.id::text || '_' ||
    extract(epoch from target.extension_requested_at)::bigint::text;

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    target.seller_id,
    'clock',
    'A buyer requested a payment extension for ' || target.order_number,
    'Batches',
    jsonb_build_object('order_id', target.id, 'requested_hours', target.extension_requested_hours),
    request_key
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  if public.wants_email(target.seller_id, 'payments') then
    insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
    values (
      target.seller_id,
      'extension_requested',
      'Payment extension requested for ' || target.order_number,
      'A buyer requested ' || target.extension_requested_hours || ' additional hours for order ' || target.order_number || '.',
      'Reason: ' || target.extension_reason,
      jsonb_build_object(
        'order_id', target.id,
        'requested_hours', target.extension_requested_hours,
        'reason', target.extension_reason,
        'current_deadline', target.reservation_expires_at,
        'target_path', 'Batches'
      ),
      request_key
    )
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
end;
$$;

revoke all on function public.request_order_extension(uuid, integer, text) from public;
grant execute on function public.request_order_extension(uuid, integer, text) to authenticated;

create or replace function public.decide_order_extension(p_order_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  new_deadline timestamptz;
  decision text;
  decision_key text;
begin
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
$$;

revoke all on function public.decide_order_extension(uuid, boolean) from public;
grant execute on function public.decide_order_extension(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
