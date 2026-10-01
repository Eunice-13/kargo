-- Buyers may cancel only while their claim is awaiting payment. Cancelling
-- frees the stock immediately and advances the product waitlist.
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  prod_id uuid;
begin
  update public.orders
  set status = 'cancelled'::public.order_status
  where id = p_order_id
    and buyer_id = auth.uid()
    and status = 'payment_pending'::public.order_status
    and public.is_active(auth.uid())
  returning batch_product_id into prod_id;

  if prod_id is null then
    raise exception 'Only a pending claim can be cancelled';
  end if;

  perform public.offer_to_next_waitlist(prod_id);
end;
$$;

revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated;
