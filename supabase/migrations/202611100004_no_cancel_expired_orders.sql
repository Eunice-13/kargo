-- An expired order stays expired: it can never be cancelled (or otherwise reopened).
--
-- The row trigger guard_forward_fulfillment (202611050001) already refuses any
-- status change on an order that is cancelled, expired or incomplete, from every
-- path. What was missing is a clear answer from the admin cancel action, which
-- went on to the trigger and returned its generic "Terminal orders cannot be
-- reopened..." error. This replaces admin_cancel_order so an admin gets a plain
-- message before anything is touched, and nothing is written or audited.
--
-- Function body only (CREATE OR REPLACE). No tables, columns or data change.
-- Safe to re-run. Everything else in the function is copied unchanged from
-- 202611050001_no_cancel_after_payment.sql.

create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public.admin_assert();
  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'completed' then
    raise exception 'A completed order cannot be cancelled' using errcode = '22023';
  end if;
  if v_order.status = 'cancelled' then
    return jsonb_build_object('changed', false);
  end if;
  -- Expired (or incomplete) orders are final. Cancelling one would rewrite history.
  if v_order.status in ('expired', 'incomplete') then
    raise exception 'An expired order cannot be cancelled' using errcode = '22023';
  end if;
  -- No admin override: once payment is confirmed, the order cannot be cancelled
  -- regardless of fulfillment stage. payment_confirmed_at is the canonical
  -- signal; the status set is a fallback for legacy confirmed rows.
  if v_order.payment_confirmed_at is not null
     or v_order.status in ('payment_confirmed', 'preparing') then
    raise exception 'A confirmed order cannot be cancelled' using errcode = '22023';
  end if;

  update public.orders
  set status = 'cancelled'
  where id = p_order_id;

  perform public.admin_audit(
    'cancel_order', 'order', p_order_id::text, v_order.order_number, trim(p_reason),
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'cancelled')
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  select r, 'package',
    'Order ' || v_order.order_number || ' was cancelled by an admin. Reason: ' || trim(p_reason),
    'Orders', jsonb_build_object('order_id', v_order.id),
    'admin_cancel_' || v_order.id::text
  from unnest(array[v_order.buyer_id, v_order.seller_id]) as r
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true);
end;
$$;

revoke all on function public.admin_cancel_order(uuid, text) from public, anon;
grant execute on function public.admin_cancel_order(uuid, text) to authenticated;

notify pgrst, 'reload schema';
