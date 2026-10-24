-- Fixes the order-detail RPC so the admin console can open an order.
--
-- 202611010003 ordered the payment history by p.submitted_at, but the alias `p`
-- is a subquery that exposes the column as "submittedAt". Postgres rejects the
-- reference with `column p.submitted_at does not exist`, which surfaced as an
-- error in the admin order-detail modal. Ordering now uses the projected alias.
--
-- Replaces the function from 202611010003_admin_batches_transactions.sql.
-- Re-run is safe: CREATE OR REPLACE.

create or replace function public.admin_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
  v_payments jsonb;
begin
  perform public.admin_assert();

  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'product', bp.name,
    'quantity', o.quantity,
    'amount', o.total_amount,
    'status', o.status,
    'buyer', buyer.display_name,
    'buyerId', o.buyer_id,
    'seller', seller.display_name,
    'sellerId', o.seller_id,
    'trackingNumber', o.tracking_number,
    'eta', o.eta,
    'deliveryAddress', o.delivery_pin_address,
    'reservationExpiresAt', o.reservation_expires_at,
    'paymentConfirmedAt', o.payment_confirmed_at,
    'completedAt', o.completed_at,
    'createdAt', o.created_at
  )
  into v
  from public.orders o
  join public.batch_products bp on bp.id = o.batch_product_id
  join public.user_profiles buyer on buyer.id = o.buyer_id
  join public.user_profiles seller on seller.id = o.seller_id
  where o.id = p_order_id;

  if v is null then raise exception 'Order not found' using errcode = 'P0002'; end if;

  select coalesce(jsonb_agg(row_to_json(p) order by p."submittedAt" desc), '[]'::jsonb)
    into v_payments
  from (
    select id, status, method_type as method, amount, reference_number as "referenceNumber",
      submitted_at as "submittedAt"
    from public.payments where order_id = p_order_id
  ) p;

  return v || jsonb_build_object('payments', v_payments);
end;
$$;

revoke all on function public.admin_get_order(uuid) from public, anon;
grant execute on function public.admin_get_order(uuid) to authenticated;
