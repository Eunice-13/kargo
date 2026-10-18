-- Persist the human-readable address resolved for a buyer's delivery pin.

alter table public.orders
  add column if not exists delivery_pin_address text;

alter table public.orders
  drop constraint if exists orders_delivery_pin_address_length_check,
  add constraint orders_delivery_pin_address_length_check check (
    delivery_pin_address is null or char_length(delivery_pin_address) <= 1000
  );

grant update (delivery_pin_address) on public.orders to authenticated;

comment on column public.orders.delivery_pin_address is
  'Human-readable address selected or reverse-geocoded from the delivery pin.';

create or replace function public.claim_batch_product_with_address(
  p_batch_product_id uuid,
  p_quantity integer,
  p_payment_method text,
  p_pin_lat double precision,
  p_pin_lng double precision,
  p_pin_url text,
  p_accept_shipping boolean,
  p_pin_address text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.orders;
begin
  if char_length(coalesce(p_pin_address, '')) > 1000 then
    raise exception 'Delivery address is too long';
  end if;

  result := public.claim_batch_product(
    p_batch_product_id,
    p_quantity,
    p_payment_method,
    p_pin_lat,
    p_pin_lng,
    p_pin_url,
    p_accept_shipping
  );

  update public.orders
  set delivery_pin_address = nullif(trim(p_pin_address), '')
  where id = result.id and result.shipping_applies;

  select * into result from public.orders where id = result.id;
  return result;
end;
$$;

create or replace function public.update_order_delivery_pin_with_address(
  p_order_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_url text,
  p_address text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(coalesce(p_address, '')) > 1000 then
    raise exception 'Delivery address is too long';
  end if;

  perform public.update_order_delivery_pin(p_order_id, p_lat, p_lng, p_url);

  update public.orders
  set delivery_pin_address = nullif(trim(p_address), '')
  where id = p_order_id;
end;
$$;

revoke all on function public.claim_batch_product_with_address(
  uuid, integer, text, double precision, double precision, text, boolean, text
) from public;
revoke all on function public.update_order_delivery_pin_with_address(
  uuid, double precision, double precision, text, text
) from public;

grant execute on function public.claim_batch_product_with_address(
  uuid, integer, text, double precision, double precision, text, boolean, text
) to authenticated;
grant execute on function public.update_order_delivery_pin_with_address(
  uuid, double precision, double precision, text, text
) to authenticated;
