-- Forward-only fulfillment. No data backfill, role bypass, or payment changes.
-- The row trigger also covers admin RPCs and indirect order updates.
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

create trigger zz_orders_forward_fulfillment
before update on public.orders
for each row execute function public.guard_forward_fulfillment();

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
    'completed',
    'cancelled',
    'incomplete'
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
