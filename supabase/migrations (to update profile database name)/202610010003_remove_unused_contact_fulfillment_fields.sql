-- Remove unused fulfillment/contact fields and simplify the fulfillment RPC.

drop function if exists public.set_fulfillment_status(
  uuid,
  public.order_status,
  text,
  timestamptz
);

create function public.set_fulfillment_status(
  p_order_id uuid,
  p_status public.order_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in (
    'payment_confirmed',
    'preparing',
    'completed',
    'cancelled',
    'incomplete'
  ) then
    raise exception 'Invalid fulfillment status';
  end if;

  update public.orders
  set status = p_status,
      completed_at = case
        when p_status = 'completed' then now()
        else completed_at
      end
  where id = p_order_id
    and seller_id = auth.uid()
    and public.can_sell(auth.uid());

  if not found then raise exception 'Order not found'; end if;

  insert into public.notifications (
    recipient_id,
    category,
    message,
    target_path,
    context
  )
  select
    buyer_id,
    'package',
    'Order ' || order_number || ' is now ' || replace(p_status::text, '_', ' '),
    'Orders',
    jsonb_build_object('order_id', id)
  from public.orders
  where id = p_order_id;
end;
$$;

revoke all on function public.set_fulfillment_status(uuid, public.order_status)
  from public;
grant execute on function public.set_fulfillment_status(uuid, public.order_status)
  to authenticated;

alter table public.orders
  drop column if exists tracking_number,
  drop column if exists eta;

alter table public.payments
  drop column if exists seller_payment_method_id;

alter table public.profiles
  drop column if exists phone;
