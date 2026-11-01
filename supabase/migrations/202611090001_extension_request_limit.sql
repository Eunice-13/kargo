-- Enforce a per-order cap on payment extension requests.
-- A buyer may request again after a denial, but no more than
-- MAX_EXTENSION_REQUESTS (2) times per order over its lifetime.

alter table public.orders
  add column if not exists extension_request_count integer not null default 0;

-- Existing orders already carry one extension decision, so seed the counter
-- from extension_status before the guard below can be enforced.
update public.orders
set extension_request_count = 1
where extension_status <> 'none'
  and extension_request_count = 0;

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
  max_requests constant integer := 2;
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
  if target.extension_request_count >= max_requests then
    raise exception 'You have used all % extension requests for this order', max_requests;
  end if;
  if target.deadline_paused_at is null and target.reservation_expires_at <= now() then
    raise exception 'The payment deadline has expired';
  end if;

  update public.orders
  set extension_status = 'pending',
      extension_requested_hours = p_hours,
      extension_reason = trim(p_reason),
      extension_requested_at = now(),
      extension_decided_at = null,
      extension_request_count = extension_request_count + 1
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
      'A buyer requested ' || target.extension_requested_hours || ' additional hours for order ' || target.order_number || '. Reason: ' || target.extension_reason,
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

notify pgrst, 'reload schema';
