do $$
declare
  target_order_id uuid;
  target_seller_id uuid;
  target_deadline timestamptz;
  matching_orders integer;
begin
  select count(*)
  into matching_orders
  from public.orders o
  join public.profiles buyer on buyer.id = o.buyer_id
  join public.profiles seller on seller.id = o.seller_id
  join public.batch_products product on product.id = o.batch_product_id
  join public.batches batch on batch.id = product.batch_id
  where buyer.display_name = 'Mia Cruz'
    and seller.display_name = 'Jade Bautista'
    and product.name = 'SK-II Essence'
    and batch.title = 'Singapore Skincare Edit — December 2026';

  if matching_orders <> 1 then
    raise exception 'Expected exactly one Mia/Jade SK-II order, found %', matching_orders;
  end if;

  select o.id, o.seller_id
  into target_order_id, target_seller_id
  from public.orders o
  join public.profiles buyer on buyer.id = o.buyer_id
  join public.profiles seller on seller.id = o.seller_id
  join public.batch_products product on product.id = o.batch_product_id
  join public.batches batch on batch.id = product.batch_id
  where buyer.display_name = 'Mia Cruz'
    and seller.display_name = 'Jade Bautista'
    and product.name = 'SK-II Essence'
    and batch.title = 'Singapore Skincare Edit — December 2026';

  select max(p.rejection_deadline)
  into target_deadline
  from public.payments p
  where p.order_id = target_order_id
    and p.status = 'rejected'::public.payment_status
    and p.rejection_deadline > now();

  target_deadline := coalesce(target_deadline, now() + interval '24 hours');

  update public.payments
  set status = 'rejected'::public.payment_status,
      rejection_reason = coalesce(rejection_reason, 'Payment rejected; buyer may resubmit.'),
      rejection_deadline = target_deadline,
      reviewed_at = coalesce(reviewed_at, now()),
      reviewed_by = coalesce(reviewed_by, target_seller_id)
  where order_id = target_order_id
    and status = 'pending_review'::public.payment_status;

  update public.orders
  set status = 'payment_pending'::public.order_status,
      reservation_expires_at = target_deadline,
      payment_confirmed_at = null
  where id = target_order_id;
end;
$$;
