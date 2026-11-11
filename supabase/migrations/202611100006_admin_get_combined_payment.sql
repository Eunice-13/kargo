-- Admin read-only detail for one combined-delivery group.
--
-- The seller already has a rich combined-delivery view, but its RPC
-- (seller_combined_delivery_requests) is scoped to the signed-in seller, so an
-- admin can't use it to inspect any group. This adds an admin-gated companion
-- that returns the same shape for a single group, by id.
--
-- Adds ONE function only. No tables, columns, indexes, triggers, or data are
-- created or changed. It reads existing combined-delivery tables and degrades
-- gracefully when the combined-delivery schema isn't present. Safe to re-run.

create or replace function public.admin_get_combined_payment(p_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_has_payments boolean;
  result jsonb;
begin
  perform public.admin_assert();

  -- Degrade gracefully when combined delivery is not enabled in this environment.
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'combined_delivery_groups'
  ) then
    return jsonb_build_object('available', false);
  end if;

  v_has_payments := exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'combined_delivery_payment_accounts'
  );

  select to_jsonb(g)
    || jsonb_build_object(
      'available', true,
      'buyerName', buyer.display_name,
      'sellerName', seller.display_name,
      'batchName', b.title,
      'destination', jsonb_build_object(
        'pin_lat', d.pin_lat,
        'pin_lng', d.pin_lng,
        'address_text', d.address_text
      ),
      'payment', case
        when v_has_payments then (
          select to_jsonb(a)
          from public.combined_delivery_payment_accounts a
          where a.group_id = g.id
        )
        else null
      end,
      'members', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'order_id', m.order_id,
            'order_number', o.order_number,
            'item_subtotal', m.item_subtotal,
            'released_at', m.released_at,
            'quantity', o.quantity,
            'product', bp.name,
            'status', o.status
          ) order by m.order_id
        )
        from public.combined_delivery_members m
        join public.orders o on o.id = m.order_id
        join public.batch_products bp on bp.id = o.batch_product_id
        where m.group_id = g.id
      ), '[]'::jsonb)
    )
    into result
  from public.combined_delivery_groups g
  join public.user_profiles buyer on buyer.id = g.buyer_id
  join public.user_profiles seller on seller.id = g.seller_id
  join public.batches b on b.id = g.batch_id
  join public.delivery_destinations d on d.id = g.destination_id
  where g.id = p_group_id;

  if result is null then
    raise exception 'Combined payment not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.admin_get_combined_payment(uuid) from public, anon;
grant execute on function public.admin_get_combined_payment(uuid) to authenticated;

notify pgrst, 'reload schema';
