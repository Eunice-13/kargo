-- Admin order detail: expose each payment's receipt path and the amount paid so
-- far, so the admin order modal can show the buyer's uploaded receipt (for a
-- payment still under review) and, for an insufficient payment, how much more is
-- owed.
--
-- Only the admin_get_order function body changes (CREATE OR REPLACE). It adds two
-- read-only fields:
--   * each payment row now includes "receiptPath" (payments.receipt_path),
--   * the result gains "amountPaid" = sum of VERIFIED payments on the order,
--   * and "amountDue" = total_amount + shipping_fee (the same total the payment
--     review uses to decide an order is short).
-- The client shows owed = amountDue - amountPaid.
--
-- No tables, columns, indexes, or data are created or changed. The receipt path
-- is only a storage key; the client still fetches a short-lived signed URL via
-- the existing payment-receipts bucket. Safe to re-run.

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
  v_paid numeric;
begin
  perform public.admin_assert();

  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'product', bp.name,
    'quantity', o.quantity,
    'amount', o.total_amount,
    'amountDue', o.total_amount + coalesce(o.shipping_fee, 0),
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

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where order_id = p_order_id and status = 'verified';

  select coalesce(jsonb_agg(row_to_json(p) order by p."submittedAt" desc), '[]'::jsonb)
    into v_payments
  from (
    select id, status, method_type as method, amount, reference_number as "referenceNumber",
      receipt_path as "receiptPath", submitted_at as "submittedAt"
    from public.payments where order_id = p_order_id
  ) p;

  return v || jsonb_build_object('payments', v_payments, 'amountPaid', v_paid);
end;
$$;

revoke all on function public.admin_get_order(uuid) from public, anon;
grant execute on function public.admin_get_order(uuid) to authenticated;

notify pgrst, 'reload schema';
