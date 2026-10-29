-- Once payment is confirmed, an order can never be cancelled — by sellers,
-- admins, or any other path — regardless of fulfillment stage.
--
-- "Payment confirmed" is identified by orders.payment_confirmed_at being set
-- (stamped once at confirmation and never cleared, per the GMV realization
-- design), which is stage-independent and also covers confirmed orders that
-- have advanced to preparing/shipped/delivered. The status set
-- (payment_confirmed/preparing/completed) is checked as a belt-and-suspenders
-- fallback for any legacy confirmed row missing the timestamp.
--
-- This supersedes the cancellation branch of the forward-only fulfillment work
-- (202611040001): the Seller Fulfillment Board may no longer move a confirmed
-- order to cancelled. Cancellation remains available only while unpaid — buyer
-- self-cancel (cancel_order) and seller delivery decline (decline_delivery_order)
-- both already gate on status = 'payment_pending', so they are unaffected.
--
-- Every function/trigger is CREATE OR REPLACE and no data is rewritten, so the
-- migration is safe to re-run and leaves existing orders untouched.

-- ─── 1. Guard: block any confirmed order from entering a cancelled state ──────
-- Extends the forward-only row trigger. It fires on every UPDATE to
-- public.orders (including admin and security-definer RPCs and direct SQL), so
-- this is the authoritative, un-bypassable enforcement point.
create or replace function public.guard_forward_fulfillment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_rank integer;
  new_rank integer;
begin
  if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
    raise exception 'Delivered fulfillment history cannot be changed' using errcode = '23514';
  end if;
  if new.status is not distinct from old.status
     and new.fulfillment_stage is not distinct from old.fulfillment_stage then
    return new;
  end if;

  -- A confirmed order can never be cancelled/voided, at any fulfillment stage.
  -- payment_confirmed_at is the canonical confirmation signal; the status set is
  -- a fallback for legacy confirmed rows without the timestamp.
  if new.status::text in ('cancelled','incomplete','expired')
     and old.status::text not in ('cancelled','incomplete','expired')
     and (old.payment_confirmed_at is not null
          or old.status::text in ('payment_confirmed','preparing','completed')) then
    raise exception 'A confirmed order cannot be cancelled' using errcode = '23514';
  end if;

  -- Cancellation/incomplete/expiry are terminal branches, never a way to reset progress.
  if old.status::text in ('cancelled','incomplete','expired') then
    raise exception 'Terminal orders cannot be reopened or change fulfillment stage' using errcode = '23514';
  end if;

  old_rank := greatest(
    case old.status::text when 'payment_confirmed' then 1 when 'preparing' then 2 when 'completed' then 5 else 0 end,
    case old.fulfillment_stage when 'preparing' then 2 when 'shipped' then 3 when 'in_transit' then 4 when 'delivered' then 5 else 0 end,
    case when old.completed_at is not null then 5 else 0 end);
  new_rank := greatest(
    case new.status::text when 'payment_confirmed' then 1 when 'preparing' then 2 when 'completed' then 5 else 0 end,
    case new.fulfillment_stage when 'preparing' then 2 when 'shipped' then 3 when 'in_transit' then 4 when 'delivered' then 5 else 0 end);

  if new.status::text in ('cancelled','incomplete','expired') then
    if old_rank >= 5 then
      raise exception 'Delivered orders cannot change fulfillment stage' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status::text = 'completed' and new.status is distinct from old.status then
    raise exception 'Delivered orders cannot change fulfillment stage' using errcode = '23514';
  end if;
  if (case new.fulfillment_stage when 'preparing' then 2 when 'shipped' then 3 when 'in_transit' then 4 when 'delivered' then 5 else 0 end)
     < (case old.fulfillment_stage when 'preparing' then 2 when 'shipped' then 3 when 'in_transit' then 4 when 'delivered' then 5 else 0 end) then
    raise exception 'Fulfillment cannot move backward' using errcode = '23514';
  end if;

  -- Payment corrections before preparation remain the payment workflow's concern.
  -- Once preparation starts, no operation may erase or lower fulfillment progress.
  if old_rank >= 2 and new_rank < old_rank then
    raise exception 'Fulfillment cannot move backward' using errcode = '23514';
  end if;
  if new_rank > old_rank + 1 and not (old_rank = 3 and new_rank = 5) then
    raise exception 'Advance to the next fulfillment stage first' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_forward_fulfillment() from public, anon, authenticated;

-- ─── 2. Seller board: remove 'cancelled' from the allow-list ──────────────────
-- Every order on the board is already payment-confirmed, so cancellation from
-- the board is no longer a valid operation. 'incomplete' is likewise dropped.
create or replace function public.set_fulfillment_status(
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
  if p_status is null or p_status not in (
    'payment_confirmed',
    'preparing',
    'shipped',
    'in_transit',
    'completed'
  ) then
    raise exception 'Invalid fulfillment status';
  end if;

  -- Serialize decisions and return before UPDATE/notifications for exact retries.
  select * into target from public.orders
  where id = p_order_id and seller_id = auth.uid() and public.can_sell(auth.uid())
  for update;
  if not found then raise exception 'Order not found'; end if;
  if (p_status = target.status::text and
      (p_status <> 'preparing' or coalesce(target.fulfillment_stage, 'preparing') = 'preparing'))
     or (p_status in ('shipped','in_transit') and target.fulfillment_stage = p_status) then
    return;
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
        when p_status = 'completed' then coalesce(completed_at, now())
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

-- ─── 3. Admin: cannot cancel a confirmed order (no override) ──────────────────
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
